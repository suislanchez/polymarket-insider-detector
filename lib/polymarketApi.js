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

// Calculate resolved win rate for wallet trades based on actual market outcomes
export function calculateResolvedWinRate(walletTrades, resolvedMarkets) {
  const marketMap = new Map(resolvedMarkets.map(m => [m.conditionId, m]));

  let resolvedWins = 0;
  let resolvedLosses = 0;
  const matchedTrades = [];

  for (const trade of walletTrades) {
    if (!trade.conditionId) continue;

    const market = marketMap.get(trade.conditionId);
    if (!market || !market.outcome) continue;

    const tradeOutcome = trade.outcome;
    const marketOutcome = market.outcome;
    const isBuy = trade.side === 'buy';

    let isWin = false;
    if (isBuy) {
      isWin = tradeOutcome === marketOutcome;
    } else {
      isWin = tradeOutcome !== marketOutcome;
    }

    if (isWin) resolvedWins++;
    else resolvedLosses++;

    matchedTrades.push({ ...trade, marketOutcome, isWin });
  }

  const resolvedTradeCount = resolvedWins + resolvedLosses;
  const resolvedWinRate = resolvedTradeCount > 0 ? resolvedWins / resolvedTradeCount : null;

  return { resolvedWins, resolvedLosses, resolvedTradeCount, resolvedWinRate, matchedTrades };
}

// Cross-market pattern analysis
export function analyzeCrossMarketPatterns(walletTrades) {
  const marketTrades = new Map();

  for (const trade of walletTrades) {
    if (!trade.conditionId) continue;

    if (!marketTrades.has(trade.conditionId)) {
      marketTrades.set(trade.conditionId, {
        conditionId: trade.conditionId,
        question: trade.market_question,
        trades: [],
        totalStake: 0,
        pnl: 0
      });
    }

    const market = marketTrades.get(trade.conditionId);
    market.trades.push(trade);
    const stake = trade.amount * trade.price;
    market.totalStake += stake;

    if (trade.side === 'buy') {
      market.pnl += trade.amount * (0.5 - trade.price);
    } else {
      market.pnl += trade.amount * (trade.price - 0.5);
    }
  }

  const uniqueMarkets = marketTrades.size;
  let winningMarkets = 0;
  for (const [, market] of marketTrades) {
    if (market.pnl > 0) winningMarkets++;
  }

  const crossMarketWinRate = uniqueMarkets > 0 ? winningMarkets / uniqueMarkets : 0;

  let crossMarketScore = 0;
  if (winningMarkets >= 5 && crossMarketWinRate > 0.7) crossMarketScore += 2;
  if (winningMarkets >= 10 && crossMarketWinRate > 0.6) crossMarketScore += 3;

  return {
    uniqueMarkets,
    winningMarkets,
    crossMarketWinRate,
    crossMarketScore,
    marketBreakdown: Array.from(marketTrades.values()).map(m => ({
      conditionId: m.conditionId,
      question: m.question,
      trades: m.trades.length,
      pnl: m.pnl,
      isWin: m.pnl > 0
    }))
  };
}

// Whale detection thresholds
const WHALE_THRESHOLDS = {
  WHALE_TRADE: 5000,
  MEGA_WHALE_TRADE: 25000,
  WHALE_WALLET: 50000
};

// Analyze whale activity for a wallet
export function analyzeWhaleActivity(walletTrades, resolvedMarkets) {
  const marketMap = new Map(resolvedMarkets.map(m => [m.conditionId, m]));

  let largestTrade = 0;
  let whaleTrades = 0;
  let megaWhaleTrades = 0;
  let totalVolume = 0;
  let whalePreResolutionTrades = 0;

  for (const trade of walletTrades) {
    const tradeSize = (trade.amount || 0) * (trade.price || 0);
    totalVolume += tradeSize;

    if (tradeSize > largestTrade) largestTrade = tradeSize;

    if (tradeSize > WHALE_THRESHOLDS.WHALE_TRADE) {
      whaleTrades++;
      if (tradeSize > WHALE_THRESHOLDS.MEGA_WHALE_TRADE) megaWhaleTrades++;

      if (trade.conditionId && trade.timestamp) {
        const market = marketMap.get(trade.conditionId);
        if (market && market.resolutionTime) {
          const tradeTime = typeof trade.timestamp === 'number'
            ? (trade.timestamp > 1e12 ? trade.timestamp : trade.timestamp * 1000)
            : new Date(trade.timestamp).getTime();
          const minutesBefore = (market.resolutionTime - tradeTime) / (1000 * 60);
          if (minutesBefore > 0 && minutesBefore <= 10) whalePreResolutionTrades++;
        }
      }
    }
  }

  const isWhale = totalVolume > WHALE_THRESHOLDS.WHALE_WALLET || whaleTrades > 0;
  const isMegaWhale = largestTrade > WHALE_THRESHOLDS.MEGA_WHALE_TRADE || megaWhaleTrades > 0;

  let whaleScore = 0;
  if (isWhale) whaleScore += 1;
  if (isMegaWhale) whaleScore += 2;
  if (whalePreResolutionTrades > 0) whaleScore += 3;

  return {
    largestTrade, whaleTrades, megaWhaleTrades, totalVolume,
    isWhale, isMegaWhale, whalePreResolutionTrades, whaleScore
  };
}

// Build clusters from funding source data using Union-Find
export function buildWalletClusters(fundingSourceMap) {
  const parent = new Map();
  const rank = new Map();

  function find(x) {
    if (!parent.has(x)) {
      parent.set(x, x);
      rank.set(x, 0);
    }
    if (parent.get(x) !== x) {
      parent.set(x, find(parent.get(x)));
    }
    return parent.get(x);
  }

  function union(x, y) {
    const rootX = find(x);
    const rootY = find(y);
    if (rootX === rootY) return;
    const rankX = rank.get(rootX) || 0;
    const rankY = rank.get(rootY) || 0;
    if (rankX < rankY) parent.set(rootX, rootY);
    else if (rankX > rankY) parent.set(rootY, rootX);
    else { parent.set(rootY, rootX); rank.set(rootX, rankX + 1); }
  }

  const sourceToWallets = new Map();
  for (const [walletAddr, sources] of fundingSourceMap.entries()) {
    if (!sources || sources.length === 0) continue;
    for (const source of sources) {
      if (source.amount < 100) continue;
      const sourceAddr = source.address.toLowerCase();
      if (!sourceToWallets.has(sourceAddr)) sourceToWallets.set(sourceAddr, []);
      sourceToWallets.get(sourceAddr).push(walletAddr.toLowerCase());
    }
  }

  for (const [, wallets] of sourceToWallets.entries()) {
    if (wallets.length < 2) continue;
    for (let i = 1; i < wallets.length; i++) union(wallets[0], wallets[i]);
  }

  const clusterMap = new Map();
  let clusterIdCounter = 1;
  for (const walletAddr of fundingSourceMap.keys()) {
    const root = find(walletAddr.toLowerCase());
    if (!clusterMap.has(root)) {
      clusterMap.set(root, { id: clusterIdCounter++, wallets: [], sharedSources: new Set() });
    }
    clusterMap.get(root).wallets.push(walletAddr.toLowerCase());
  }

  for (const [sourceAddr, wallets] of sourceToWallets.entries()) {
    if (wallets.length < 2) continue;
    const root = find(wallets[0]);
    const cluster = clusterMap.get(root);
    if (cluster) cluster.sharedSources.add(sourceAddr);
  }

  const result = { clusters: [], walletToCluster: new Map() };
  for (const [, cluster] of clusterMap.entries()) {
    if (cluster.wallets.length > 1) {
      const clusterInfo = {
        id: cluster.id,
        size: cluster.wallets.length,
        wallets: cluster.wallets,
        sharedFundingSources: Array.from(cluster.sharedSources)
      };
      result.clusters.push(clusterInfo);
      for (const wallet of cluster.wallets) {
        result.walletToCluster.set(wallet, {
          clusterId: cluster.id,
          clusterSize: cluster.wallets.length,
          sharedFundingSource: cluster.sharedSources.size > 0 ? Array.from(cluster.sharedSources)[0] : null
        });
      }
    }
  }
  result.clusters.sort((a, b) => b.size - a.size);
  return result;
}

// Attach cluster info to wallet objects
export function attachClusterInfo(wallets, clusterResult) {
  if (!clusterResult || !clusterResult.walletToCluster) return wallets;
  return wallets.map(wallet => {
    const clusterInfo = clusterResult.walletToCluster.get(wallet.address?.toLowerCase());
    if (clusterInfo) {
      return { ...wallet, cluster: clusterInfo.clusterId, clusterSize: clusterInfo.clusterSize, sharedFundingSource: clusterInfo.sharedFundingSource };
    }
    return { ...wallet, cluster: null, clusterSize: 1, sharedFundingSource: null };
  });
}
