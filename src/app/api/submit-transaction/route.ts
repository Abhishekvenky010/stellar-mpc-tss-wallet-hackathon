import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('🔄 API Route called: /api/submit-transaction');

  try {
    console.log('📨 Parsing request body...');
    const { xdr, network } = await request.json();
    console.log('📨 Submit transaction request:', { xdr: xdr.substring(0, 100) + '...', network });

    if (!xdr) {
      return NextResponse.json({ error: 'XDR is required' }, { status: 400 });
    }

    const horizonUrl = network === 'mainnet'
      ? 'https://horizon.stellar.org/transactions'
      : 'https://horizon-testnet.stellar.org/transactions';

    console.log('Submitting to:', horizonUrl);

    const response = await fetch(horizonUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        tx: xdr
      })
    });

    console.log('Horizon response status:', response.status);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        const text = await response.text();
        errorData = { text, status: response.status, statusText: response.statusText };
      }
      console.log('Horizon error response:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        result_codes: errorData.extras?.result_codes,
        xdr: xdr.substring(0, 200) + '...'
      });
      return NextResponse.json({
        error: 'Transaction submission failed',
        details: errorData
      }, { status: response.status });
    }

    const result = await response.json();
    console.log('✅ Horizon success:', result);
    console.log('🏁 API Route completed successfully');
    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Submit transaction error:', error);
    console.log('🏁 API Route completed with error');
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}