const DATA_API = 'https://data-api.polymarket.com';
const GAMMA_API = 'https://gamma-api.polymarket.com';

// Fetch resolved markets from Gamma API (public)
export async function fetchMarkets(limit = 100) {
  const markets = [];
  let offset = 0;

  while (markets.length < limit) {
    const url = `${GAMMA_API}/markets?closed=true&limit=100&offset=${offset}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data || data.length === 0) break;

    for (const m of data) {
      if (m.closed && m.outcomes) {
        let outcome = null;
        if (m.outcomePrices) {
          try {
            const prices = JSON.parse(m.outcomePrices);
            if (prices[0] === '1' || parseFloat(prices[0]) > 0.99) outcome = 'Yes';
            else if (prices[1] === '1' || parseFloat(prices[1]) > 0.99) outcome = 'No';
          } catch (e) {}
        }

        markets.push({
          id: m.conditionId || m.id,
          question: m.question,
          slug: m.slug,
          resolution_time: m.closedTime ? new Date(m.closedTime).getTime() / 1000 :
                          m.endDate ? new Date(m.endDate).getTime() / 1000 : null,
          outcome,
          volume: m.volumeNum || 0
        });
      }
    }

    offset += 100;
    if (data.length < 100) break;
  }

  return markets.slice(0, limit);
}

// Fetch trades from data API (public, real trades)
export async function fetchAllTrades(limit = 5000) {
  const allTrades = [];
  let offset = 0;
  const batchSize = 100;

  console.log('Fetching trades from Polymarket data API...');

  while (allTrades.length < limit) {
    try {
      const url = `${DATA_API}/trades?limit=${batchSize}&offset=${offset}`;
      const res = await fetch(url);

      if (!res.ok) {
        console.error(`Trade fetch error: ${res.status}`);
        break;
      }

      const data = await res.json();
      if (!data || data.length === 0) break;

      for (const t of data) {
        allTrades.push({
          id: t.transactionHash || `trade_${allTrades.length}`,
          conditionId: t.conditionId,
          market_question: t.title,
          market_slug: t.slug,
          wallet: t.proxyWallet?.toLowerCase(),
          side: t.side?.toLowerCase() || 'buy',
          amount: parseFloat(t.size || 0),
          price: parseFloat(t.price || 0),
          timestamp: t.timestamp,
          outcome: t.outcome,
          outcomeIndex: t.outcomeIndex,
          username: t.pseudonym || t.name
        });
      }

      console.log(`Fetched ${allTrades.length} trades...`);
      offset += batchSize;

      // Small delay to be nice to the API
      await new Promise(r => setTimeout(r, 50));

      if (data.length < batchSize) break;
    } catch (e) {
      console.error('Trade fetch error:', e.message);
      break;
    }
  }

  console.log(`Total trades fetched: ${allTrades.length}`);
  return allTrades;
}

// Aggregate trades by wallet
export function aggregateByWallet(trades) {
  const walletMap = new Map();

  for (const trade of trades) {
    if (!trade.wallet) continue;

    if (!walletMap.has(trade.wallet)) {
      walletMap.set(trade.wallet, {
        address: trade.wallet,
        trades: [],
        totalVolume: 0,
        usernames: new Set()
      });
    }

    const wallet = walletMap.get(trade.wallet);
    wallet.trades.push(trade);
    wallet.totalVolume += trade.amount * trade.price;
    if (trade.username) wallet.usernames.add(trade.username);
  }

  return Array.from(walletMap.values()).map(w => ({
    ...w,
    usernames: Array.from(w.usernames)
  }));
}
