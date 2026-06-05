import { tool } from 'ai';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import * as exec from './executor';
import { customiseChopBar } from './chopbar';

export function buildTools(supabase: SupabaseClient, tenantId: string | null) {
  return {
    search_menu: tool({
      description: 'Search available dishes by name and optional max price.',
      inputSchema: z.object({
        query: z.string().optional(),
        maxPrice: z.number().optional(),
      }),
      execute: async (a) => exec.searchMenu(supabase, tenantId, a),
    }),
    find_kitchens: tool({
      description: 'Find restaurants by name or city.',
      inputSchema: z.object({
        query: z.string().optional(),
        city: z.string().optional(),
      }),
      execute: async (a) => exec.findKitchens(supabase, a),
    }),
    check_hours: tool({
      description: 'Check if the current restaurant is open today.',
      inputSchema: z.object({}),
      execute: async () => (tenantId ? exec.checkHours(supabase, tenantId) : { open: null }),
    }),
    track_order: tool({
      description: 'Look up an order by its number (FA-####) or id.',
      inputSchema: z.object({ ref: z.string() }),
      execute: async (a) => exec.trackOrder(supabase, a.ref),
    }),
    get_recommendations: tool({
      description: 'Suggest popular dishes.',
      inputSchema: z.object({}),
      execute: async () => exec.getRecommendations(supabase, tenantId),
    }),
    customise_chop_bar: tool({
      description:
        "Build a chop-bar bowl from a plain-language request. Use when the customer describes a custom plate (e.g. 'banku with tilapia, extra pepper, no shito'). `item` is the chop-bar dish name (e.g. 'Chop Bar Bowl', 'Banku'); `request` is exactly what they want in it. Returns the grounded selection — only real options are chosen.",
      inputSchema: z.object({
        item: z.string().describe('The chop-bar dish to customise.'),
        request: z.string().describe('The customer\'s plain-language bowl description.'),
      }),
      execute: async (a) => customiseChopBar(supabase, tenantId, a),
    }),
  };
}
