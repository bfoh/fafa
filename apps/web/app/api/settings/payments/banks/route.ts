import { NextResponse } from 'next/server';
import { listBanks } from '@/lib/paystack/client';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await listBanks('GHS');
    
    // Sort banks: Mobile Money first, then alphabetical
    const sortedBanks = response.data.sort((a, b) => {
      if (a.type === 'mobile_money' && b.type !== 'mobile_money') return -1;
      if (a.type !== 'mobile_money' && b.type === 'mobile_money') return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ status: true, data: sortedBanks });
  } catch (error: any) {
    console.error('Failed to fetch banks from Paystack:', error);
    // Provide a fallback list of major Ghanaian mobile money providers and banks
    const fallbackBanks = [
      { name: 'MTN Mobile Money', code: 'MTN', type: 'mobile_money' },
      { name: 'Telecel (Vodafone) Cash', code: 'VOD', type: 'mobile_money' },
      { name: 'AirtelTigo Money', code: 'ATL', type: 'mobile_money' },
      { name: 'Ecobank Ghana Limited', code: '130100', type: 'ghipss' },
      { name: 'GCB Bank Limited', code: '040100', type: 'ghipss' },
      { name: 'Fidelity Bank Ghana Limited', code: '240100', type: 'ghipss' },
      { name: 'Stanbic Bank Ghana Limited', code: '190100', type: 'ghipss' },
    ];
    return NextResponse.json({ status: false, data: fallbackBanks, error: error.message });
  }
}
