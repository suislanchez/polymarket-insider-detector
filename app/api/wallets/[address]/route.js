import { NextResponse } from 'next/server';
import { generateDemoData } from '@/lib/demoData';
import { analyzeWallet } from '@/lib/detection';

let cachedData = null;

export async function GET(request, { params }) {
  try {
    if (!cachedData) {
      cachedData = generateDemoData();
    }

    const address = params.address;
    const wallet = cachedData.wallets.find(w => w.address === address);

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const analysis = analyzeWallet(wallet, cachedData.trades, cachedData.markets);
    const walletTrades = cachedData.trades
      .filter(t => t.wallet === address)
      .map(t => {
        const market = cachedData.markets.find(m => m.id === t.market_id);
        return {
          ...t,
          marketQuestion: market?.question,
          marketOutcome: market?.outcome,
          resolutionTime: market?.resolution_time,
          minutesBefore: market ? (market.resolution_time - t.timestamp) / 60 : null
        };
      })
      .sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({
      ...analysis,
      trades: walletTrades
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
