import { NextResponse } from 'next/server';
import { isAdepaEnabled } from '@/lib/adepa/config';

export function GET() {
  return NextResponse.json({ enabled: isAdepaEnabled() });
}
