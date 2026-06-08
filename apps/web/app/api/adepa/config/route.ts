import { NextResponse } from 'next/server';
import { isAdepaEnabled } from '@/lib/adepa/config';
import { corsHeaders, preflight } from '@/lib/http/cors';

export function GET(req: Request) {
  const headers = corsHeaders(req.headers.get('origin'));
  return NextResponse.json({ enabled: isAdepaEnabled() }, { headers });
}

export function OPTIONS(req: Request) {
  return preflight(req);
}
