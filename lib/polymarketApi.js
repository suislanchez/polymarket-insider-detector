const DATA_API = 'https://data-api.polymarket.com';
const GAMMA_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

// Cache for market resolution times
const marketResolutionCache = new Map();

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

// Fetch market details including resolution time
export async function fetchMarketDetails(conditionId) {
  if (marketResolutionCache.has(conditionId)) {
    return marketResolutionCache.get(conditionId);
  }

  try {
    // Try CLOB API first (more reliable for recent markets)
    const clobRes = await fetch(`${CLOB_API}/markets/${conditionId}`);
    if (clobRes.ok) {
      const data = await clobRes.json();
      const details = {
        conditionId,
        question: data.question,
        closed: data.closed,
        resolutionTime: data.end_date_iso ? new Date(data.end_date_iso).getTime() : null,
        outcome: data.closed ? (data.tokens?.[0]?.winner ? 'Yes' : 'No') : null
      };
      marketResolutionCache.set(conditionId, details);
      return details;
    }
  } catch (e) {
    console.error('CLOB fetch error:', e.message);
  }

  return null;
}

// Fetch recently resolved markets with their resolution times
export async function fetchRecentlyResolvedMarkets(limit = 50) {
  const resolved = [];

  try {
    const res = await fetch(`${GAMMA_API}/markets?closed=true&limit=${limit}&order=volume&ascending=false`);
    if (!res.ok) return resolved;

    const markets = await res.json();

    for (const m of markets) {
      if (m.closed && m.closedTime) {
        let outcome = null;
        if (m.outcomePrices) {
          try {
            const prices = JSON.parse(m.outcomePrices);
            if (prices[0] === '1' || parseFloat(prices[0]) > 0.99) outcome = 'Yes';
            else if (prices[1] === '1' || parseFloat(prices[1]) > 0.99) outcome = 'No';
          } catch (e) {}
        }

        resolved.push({
          conditionId: m.conditionId,
          question: m.question,
          resolutionTime: new Date(m.closedTime).getTime(),
          outcome,
          volume: m.volumeNum || 0
        });

        // Cache it
        marketResolutionCache.set(m.conditionId, {
          conditionId: m.conditionId,
          question: m.question,
          closed: true,
          resolutionTime: new Date(m.closedTime).getTime(),
          outcome
        });
      }
    }
  } catch (e) {
    console.error('Gamma fetch error:', e.message);
  }

  return resolved;
}

// Analyze pre-resolution timing for trades
export function analyzePreResolutionTiming(trades, resolvedMarkets) {
  const marketMap = new Map(resolvedMarkets.map(m => [m.conditionId, m]));

  const timingAnalysis = {
    tradesAnalyzed: 0,
    tradesWithTiming: 0,
    within1Hour: 0,
    within10Min: 0,
    within1Min: 0,
    tradesByTiming: []
  };

  for (const trade of trades) {
    if (!trade.conditionId || !trade.timestamp) continue;

    const market = marketMap.get(trade.conditionId);
    if (!market || !market.resolutionTime) continue;

    timingAnalysis.tradesAnalyzed++;

    const tradeTime = typeof trade.timestamp === 'number'
      ? (trade.timestamp > 1e12 ? trade.timestamp : trade.timestamp * 1000)
      : new Date(trade.timestamp).getTime();

    const minutesBefore = (market.resolutionTime - tradeTime) / (1000 * 60);

    if (minutesBefore > 0 && minutesBefore <= 60) {
      timingAnalysis.tradesWithTiming++;
      timingAnalysis.tradesByTiming.push({
        ...trade,
        minutesBefore,
        marketQuestion: market.question,
        marketOutcome: market.outcome
      });

      if (minutesBefore <= 60) timingAnalysis.within1Hour++;
      if (minutesBefore <= 10) timingAnalysis.within10Min++;
      if (minutesBefore <= 1) timingAnalysis.within1Min++;
    }
  }

  return timingAnalysis;
}

// Calculate pre-resolution score for a wallet
export function calculatePreResolutionScore(walletTrades, resolvedMarkets) {
  const timing = analyzePreResolutionTiming(walletTrades, resolvedMarkets);

  if (timing.tradesAnalyzed === 0) return { score: 0, timing };

  // Calculate suspicion multipliers
  let score = 0;

  // Last-minute trades are highly suspicious
  const lastMinuteRatio = timing.within1Min / timing.tradesAnalyzed;
  const last10MinRatio = timing.within10Min / timing.tradesAnalyzed;
  const lastHourRatio = timing.within1Hour / timing.tradesAnalyzed;

  if (lastMinuteRatio > 0.3) score += 4;
  else if (lastMinuteRatio > 0.1) score += 2;

  if (last10MinRatio > 0.5) score += 3;
  else if (last10MinRatio > 0.2) score += 1;

  if (lastHourRatio > 0.7) score += 2;
  else if (lastHourRatio > 0.4) score += 1;

  return {
    score,
    timing,
    lastMinuteRatio,
    last10MinRatio,
    lastHourRatio
  };
}
