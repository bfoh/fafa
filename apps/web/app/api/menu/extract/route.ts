import { NextResponse } from 'next/server';
import { getResolvedTenantId } from '@/lib/admin/guard';

const SYSTEM = `You extract menu items from a photo of a restaurant menu. Return ONLY valid JSON of shape {"sections":[{"category":string|null,"items":[{"name":string,"price":number,"description":string|null}]}]}. Prices are numbers in the local currency (Ghana Cedis), no symbols. Group items under their printed category headings. If unsure of a price, omit that item. No prose, JSON only.`;

export async function POST(req: Request) {
  const { tenantId } = await getResolvedTenantId();
  if (!tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Dormant until an AI key is configured.
  const key = process.env.AI_GATEWAY_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Photo import is not available yet.' }, { status: 503 });
  }

  try {
    const { imageBase64, mediaType } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4-6',
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract the menu as JSON.' },
              {
                type: 'image_url',
                image_url: { url: `data:${mediaType || 'image/jpeg'};base64,${imageBase64}` },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Could not read the menu image.' }, { status: 502 });
    }

    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? '';
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end === -1) {
      return NextResponse.json({ error: 'Could not read that menu — try a clearer photo or paste the list.' }, { status: 422 });
    }
    const parsed = JSON.parse(content.slice(start, end + 1));
    const sections = Array.isArray(parsed.sections) ? parsed.sections : [];
    return NextResponse.json({ sections });
  } catch {
    return NextResponse.json(
      { error: 'Could not read that menu — try a clearer photo or paste the list.' },
      { status: 422 }
    );
  }
}
