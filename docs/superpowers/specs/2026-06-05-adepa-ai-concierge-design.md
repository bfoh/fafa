# Adepa — AI Concierge — Design Spec

**Date:** 2026-06-05
**Status:** Approved (design + decisions), implementing in slices
**Owner:** Ebenezer Barning
**Vision doc:** `docs/Adepa_ai.md` (the full blueprint; this spec is the implementable contract)

## Summary

Adepa is a transactional, tool-grounded AI concierge on the customer-facing site. She discovers food, recommends, customises chop-bar bowls in plain language, builds the cart, places orders (reusing the existing order pipeline), and tracks them — through natural conversation. She never invents prices (every food/price/status fact comes from a tool result) and never spends money without an explicit, server-enforced confirmation.

## Locked Decisions

1. **Transactional in v1** — full funnel including `place_order`.
2. **Model:** Anthropic **Haiku** (`anthropic/claude-haiku-4-5`) via the **Vercel AI Gateway**; model is a swappable env string (`ADEPA_MODEL`). Stronger model only if a turn needs it (tiering, later).
3. **Local Ghanaian voice:** off by default, per-tenant toggle.
4. **Placement:** storefront-first; marketplace later.
5. **Rate limits:** per-session turn cap (default 30) + per-IP throttle.
6. **Provider-agnostic** via the **Vercel AI SDK**. No keys hardcoded. **Env-guarded & dormant** until `AI_GATEWAY_API_KEY` is set (the FAB hides / the route 503s), exactly like the menu-photo feature.

## Non-Negotiable Constraints

- **Reuse, never re-implement business logic.** Orders go through the existing `/api/orders` (pricing, delivery/pin/fee, Paystack, COD, visibility all unchanged). Order tracking, cart (`use-cart`), chop-bar option structure, marketplace `search_kitchens` RPC, customer-prefs — all reused.
- **Grounding:** the model may not state a dish, price, or availability that didn't come from a tool result. Order totals shown are always server-computed.
- **Money safety:** `place_order` requires an explicit confirmation flag; the route enforces it (the model alone cannot place an order).
- **Mobile-first**, redesign design language + primitives, safe-area aware.
- **Next.js is a non-standard fork** — read `node_modules/next/dist/docs/` before touching Next APIs.

## Current State (relevant)

- AI Gateway already used by `app/api/menu/extract/route.ts` (env-guarded pattern to copy).
- Order placement: `POST /api/orders`. Order read/tracking: `GET /api/orders/[id]`. Cart: `hooks/use-cart`. Customer memory: `lib/utils/customer-prefs` (`loadLastOrder`, `loadCustomer`). Marketplace search: `search_kitchens` RPC (used by `lib/marketplace`). Chop-bar option model: in `storefront-menu`/menu page.
- Storefront shell: `app/(storefront)/[slug]/layout.tsx`. Design primitives: `components/ui/*`.
- Vitest for unit tests.

## Architecture

```
Customer ⇄ AdepaWidget (storefront) ⇄ POST /api/adepa/chat (streaming, AI SDK)
                                          │ multi-step tool loop (Haiku via gateway)
        read tools ─────────────┬──────── write tools (confirm-gated, reuse paths)
        search_menu  find_kitchens         add_to_cart  customise_chop_bar
        check_hours  track_order            review_cart  place_order(/api/orders)  reorder
        get_recommendations                              │
                         Supabase (admin client, tenant-scoped)
```

The route runs an AI-SDK agent loop: model → tool call → executor (Supabase / existing endpoints) → model, streaming text + structured tool results to the widget, which renders rich cards.

---

## Slice 1 — Brain + grounded read/recommend chat (this implementation)

### Files

- `lib/adepa/types.ts` — shared TS types (ChatMessage, ToolResult shapes).
- `lib/adepa/system-prompt.ts` — `buildSystemPrompt(ctx)`: assembles persona + rules + runtime context (tenant name, open/closed, customer first name, "the usual", storefront vs marketplace). Pure, unit-tested.
- `lib/adepa/tools.ts` — AI SDK tool definitions (zod schemas) for the read tools.
- `lib/adepa/executor.ts` — runs each tool against Supabase (admin client) tenant-scoped; returns typed JSON. (`search_menu`, `find_kitchens`, `check_hours`, `track_order`, `get_recommendations`.)
- `lib/adepa/config.ts` — model/env access + `isAdepaEnabled()` (key present).
- `lib/adepa/ratelimit.ts` — in-memory per-IP + per-session throttle (pure, testable); upgradeable to a store later.
- `app/api/adepa/chat/route.ts` — streaming chat endpoint: validates, rate-limits, builds prompt, runs the AI-SDK loop with the read tools, streams. 503 when not configured.
- `app/api/adepa/config/route.ts` — `GET` → `{ enabled }` so the widget can hide when dormant.
- `components/adepa/adepa-widget.tsx` — FAB → drawer, streaming text, quick replies, grounded text rendering (cards arrive in Slice 2).
- `app/(storefront)/[slug]/layout.tsx` — mount the widget (tenant-aware), only when enabled.

### Behaviour (Slice 1)

- Discovers/recommends/tracks within the active tenant; grounded; concise; in persona.
- Guardrails: scope-limited, injection-resistant (system rules server-side, tool results = data), no promises, rate-limited, GH₵ only.
- Dormant until `AI_GATEWAY_API_KEY` set → widget hidden, route 503.

### Tests (Slice 1)

- `system-prompt.test.ts` — includes tenant name, open/closed line, customer name when provided; omits "the usual" when no last order; storefront vs marketplace mode wording.
- `ratelimit.test.ts` — allows under cap, blocks over cap, resets after window, per-key isolation.

---

## Slice 2 — Transactional (outline)

- Write tools (confirm-gated): `add_to_cart`, `customise_chop_bar` (NL → existing option structure), `review_cart` (server-computed totals), `place_order` (calls `/api/orders`; route enforces a `confirmed` flag), `reorder` (`loadLastOrder`).
- Rich message cards: dish card (image·price·Add), cart summary card, order-status timeline card.
- Cart bridge: tools operate on the same `use-cart` state the storefront uses (via the widget living inside the cart provider, or a server-built cart handed to checkout).

## Slice 3 — Human + reach + proof (outline)

- Personalised greetings (returning customer / "the usual"), web-speech **voice input**, per-tenant local-voice toggle, observability (log turns/tools/outcomes; chat→order conversion + upsell lift; thumbs feedback), then **marketplace** placement + cross-tenant `search_menu`.

---

## Error / Edge States

- Not configured → widget hidden; route returns `{ enabled:false }` / 503.
- Tool/Supabase error → Adepa apologises + offers `escalate_to_human` (WhatsApp/phone) — never fabricates.
- Rate limit hit → friendly "let's slow down a touch" message.
- Off-topic / unsafe → polite redirect to food + ordering.

## Verification

- `npx tsc --noEmit` clean; `npm run build` succeeds; existing 54 tests still pass + new unit tests.
- Manual (with a key): storefront → Adepa FAB → "what's good under ₵40?" returns real dishes; "track FA-0001" returns real status; off-topic redirected; no key → no FAB.

## Build Sequence (Slice 1)

1. `config` + `ratelimit` (+ tests).
2. `types` + `system-prompt` (+ tests).
3. `tools` + `executor` (read tools).
4. `app/api/adepa/chat` + `config` routes.
5. `adepa-widget` + storefront mount (enabled-gated).
6. Verify + ship (dormant until key).

## Known Risks

- **AI SDK + gateway wiring** — verify request/streaming shape against current `vercel:ai-sdk` / `vercel:ai-gateway` docs during build; keep the route contract stable.
- **Grounding discipline** — enforce via system prompt + only ever rendering tool-sourced facts; never echo model-stated prices for orders (use server totals in Slice 2).
- **Cost/abuse** — rate limits + Haiku + trimmed context + per-tenant menu caching.
