# 🌟 Adepa — Didi's AI Concierge (polished blueprint)

> "Adepa" (Akan: *something good / the good one*). A warm, sharp Ghanaian food concierge who doesn't just *answer* — she gets your food ordered, customised, and on its way.

This supersedes the earlier Afia draft. The headline change: **Adepa is transactional and tool-grounded, not a read-only chatbot.** She builds the cart, configures chop-bar bowls in plain language, upsells, and places the order — with confirmation gates and zero hallucinated prices.

---

## Why this version wins (upgrades over v1)

| # | v1 (Afia) | v2 (Adepa) — improved |
|---|---|---|
| 1 | Read-only (search / track / escalate) | **Transactional** — add to cart, customise chop-bar, upsell, **place order**, reorder |
| 2 | Hardcoded to Gemini SDK | **Provider-agnostic** via Vercel AI SDK + AI Gateway (`"anthropic/…"`, `"google/…"`) — swap by string, matches the gateway already used for the menu-photo feature |
| 3 | Free-form answers | **Grounded** — every dish/price/status comes from a tool result; the model may never invent a price or claim availability |
| 4 | Thin persona | **Rich persona + memory** — knows returning customers (last order, saved name/phone/address), greets by context (open/closed, time of day), optional light local voice |
| 5 | Text-only bubbles | **Rich UI cards** — dish cards (image, price, Add), cart summary, live order-status timeline, quick replies |
| 6 | Basic "stay in scope" | **Hardened guardrails** — prompt-injection defence, write-action confirmation, no refunds/promises, PII care, per-session + per-IP caps, abuse/profanity handling |
| 7 | No metrics | **Observability** — logs every turn + tool call + outcome; tracks the metric that matters: **chats → orders (conversion)** + thumbs feedback |
| 8 | Web only, implicit | **Channel-ready** — one brain (tools layer) reusable later for WhatsApp + voice; web widget ships first |

---

## Persona — Adepa

| Attribute | Value |
|-----------|-------|
| **Name** | Adepa |
| **Role** | Food concierge — discovers, recommends, customises, orders, tracks |
| **Voice** | Warm, quick, confident; speaks like a knowledgeable friend, never a bot |
| **Language** | English by default; *optional* light Ghanaian flavour (“Chale, good choice 👌”) — a per-tenant toggle, never forced |
| **Behaviour** | Asks one clarifying question when ambiguous; confirms before spending money; celebrates the order; never over-talks |
| **Identity** | Brand-orange → amber gradient avatar, soft glow; “Adepa” + online dot |
| **Boundaries** | Food + this platform only. No medical/financial/general chat. No refunds or promises — connects to the restaurant instead. |

**Persona is data-driven, not vibes:** the system prompt is assembled at runtime with the tenant name, whether it's open, the customer's first name + “the usual” (if known), and the active context (storefront vs marketplace). That single move makes her feel human.

---

## Stack & provider (professional, swappable)

- **Vercel AI SDK (v6)** for the agent loop: streaming, multi-step tool-calling, structured outputs.
- **Vercel AI Gateway** as the model endpoint — same infra as the menu-photo feature. Model is a string (`ADEPA_MODEL`), default a fast capable model (e.g. `anthropic/claude-haiku-4-5` for routing/most turns; escalate to a stronger model only for complex reasoning — **model tiering** for cost).
- **No keys hardcoded.** `AI_GATEWAY_API_KEY` (gateway) drives it; on Vercel, deployed functions can authenticate via OIDC with no key at all.
- Env: `ADEPA_MODEL`, `ADEPA_MAX_TURNS_PER_SESSION` (default 30), `ADEPA_ENABLE_LOCAL_VOICE` (per-tenant override possible).

---

## Architecture — an agent loop, not a Q&A

```
Customer ⇄ AdepaWidget (rich chat) ⇄ POST /api/adepa/chat (streaming)
                                          │
                                   AI SDK agent loop
                                   (model + tools, multi-step)
                                          │
        ┌──────────── read tools ─────────┴────── write tools (confirm-gated) ───────┐
        search_menu   find_kitchens   track_order   add_to_cart   customise_chop_bar
        check_hours   get_recommendations            review_cart   place_order   reorder
                                          │                              │
                                   Supabase (RLS / admin)         existing /api/orders
                                                                  (no new order logic)
```

**Key principle:** Adepa **reuses existing endpoints** for anything that mutates (orders go through the current `/api/orders` with all its pricing/Paystack/visibility logic). She is an orchestration brain over proven capabilities — she never re-implements business rules.

---

## Tools (the real upgrade: she can *act*)

**Read (grounding):**
1. `search_menu(query, filters)` — dishes by name/cuisine/price/diet within the active tenant (or across, on marketplace). Returns name, price, image, availability, options. *Diet/spice/budget filters.*
2. `find_kitchens(query, city)` — reuse the `search_kitchens` RPC. Open-first.
3. `check_hours(tenant)` — open/closed + today's hours.
4. `track_order(orderNumberOrPhone)` — status, ETA, timeline, items. (Reuse the order-tracking read.)
5. `get_recommendations(context)` — popular dishes, “goes well with”, budget-fit, returning-customer “the usual”.

**Write (confirmation-gated, reuse existing paths):**
6. `add_to_cart(items[])` — stages items in the live cart (the existing `use-cart`), shown as a cart card.
7. `customise_chop_bar(item, naturalLanguage)` — translates “banku, tilapia, extra pepper, no shito” into the chop-bar option structure your UI already supports.
8. `review_cart()` — returns the cart + subtotal + delivery/ETA for explicit confirmation.
9. `place_order(confirmation)` — **only after the customer confirms** — calls the existing order API (delivery/pin/fee, Paystack, COD all unchanged). Idempotent.
10. `reorder(lastOrder)` — re-add the device's last order (existing `loadLastOrder`).

**Help:**
11. `escalate_to_human(tenant)` — WhatsApp/phone deep link.

**Hard rule:** money-moving tools (`place_order`) require an explicit yes after `review_cart`. The model is instructed and the route enforces it server-side (defence in depth) — the model alone can't place an order without the confirm flag.

---

## Accuracy & grounding (no hallucinations)

- Adepa answers food/price/status questions **only** from tool results — the prompt forbids inventing menu items, prices, or availability.
- Structured tool outputs (typed JSON) → rendered as cards, not paraphrased numbers.
- On uncertainty she asks one clarifying question rather than guessing.
- Order confirmations always echo the **server-computed** total (from `review_cart`/the order API), never a model-estimated price.

---

## Personalisation & memory

- Reads device memory (last order, saved name/phone/address from `customer-prefs`) → greets “Welcome back, Kofi 👋 — the usual (Waakye Special), or something new?”
- Session memory in `sessionStorage` (cleared on tab close); no server-side PII beyond what the customer already submitted.
- Context-aware: on a storefront she's that restaurant's expert; on the marketplace she's a cross-kitchen guide.

---

## Guardrails & safety (defence in depth)

- **Prompt-injection resistant:** system rules are server-side; tool results are treated as data, not instructions; the model can't be talked out of character or into placing an unconfirmed order.
- **Scope-limited:** politely redirects non-food / off-platform asks.
- **No promises:** never commits refunds/credits/ETAs it can't verify — escalates instead.
- **Money safety:** `place_order` gated by explicit confirm + server check.
- **Rate/cost caps:** per-session turn cap + per-IP throttle; model tiering; menu cached per tenant; trimmed context.
- **PII/abuse:** minimal data retention, profanity/abuse handling, audit log.

---

## Rich UI (premium, not a grey chatbox)

- Floating FAB (brand gradient, soft glow) → bottom-sheet on mobile / side panel on desktop; glass header “Adepa ✨”.
- **Message types:** text, **dish cards** (image · price · Add), **cart summary card** (items · subtotal · Checkout), **order-status timeline card**, **quick-reply chips** (“What's popular?”, “Track my order”, “Build me a bowl”).
- Streaming text, typing indicator, auto-scroll, voice-input mic (web speech) as an enhancer, haptics on send, unread badge.
- Matches the redesign design language (canvas, hairline, card depth, primitives).

---

## Observability & value proof

- Log each conversation: turns, tools called, latency, model, **outcome** (ordered? reordered? escalated?).
- North-star metric: **chat → order conversion** + average order value lift from upsells.
- Thumbs up/down per answer → prompt/tooling improvement loop.
- Cost dashboard (gateway usage), per-conversation cost target.

---

## Channel roadmap (one brain, many doors)

1. **Web widget** (this build) — storefront + marketplace.
2. **WhatsApp** — same tools layer behind the existing WhatsApp/SMS plumbing; order in chat.
3. **Voice** — web speech now; phone/IVR later.
4. **Marketplace concierge** — cross-tenant discovery once the per-store agent proves out.

---

## Build phases

1. **Tools layer + agent route** (`lib/adepa/*`, `app/api/adepa/chat`) — provider-agnostic, grounded, with read tools + `place_order` reusing `/api/orders`.
2. **Rich widget** (`components/adepa/*`) — FAB, drawer, card message types, streaming, quick replies, voice-in.
3. **Integration** — storefront layout (tenant-aware) first; marketplace second; observability + caps.
4. **Personalisation + upsell tuning** — memory greetings, recommendations, model tiering, analytics.

---

## Open decisions (confirm before spec)

1. **Transactional scope now, or phase it?** Recommended: ship read + recommend + **add-to-cart + place-order** in v1 (the whole funnel). Chop-bar natural-language config can be a fast-follow if needed.
2. **Provider/model:** default to the **AI Gateway** (matches photo feature). Pick the default model (recommend Anthropic Haiku for cost, Sonnet for hard turns) — or Gemini if you prefer; it's a string swap.
3. **Local voice:** off by default, per-tenant toggle? (Recommended.)
4. **Placement:** storefront-only first, then marketplace? (Recommended — focus where orders happen.)
5. **Rate limits:** per-session 30 turns + per-IP throttle OK?

Confirm these and I'll run it through brainstorm → spec → plan → build like the other features.
