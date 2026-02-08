import jStat from 'jstat';

/**
 * Calculate binomial p-value for win rate
 */
export function binomialPValue(wins, total, p = 0.5) {
  if (total === 0) return 1;
  let pValue = 0;
  for (let k = wins; k <= total; k++) {
    pValue += jStat.binomial.pdf(k, total, p);
  }
  return pValue;
}

/**
 * Analyze a wallet's trading patterns
 */
export function analyzeWallet(wallet, trades, markets) {
  const walletTrades = trades.filter(t => t.wallet === wallet.address);
  if (walletTrades.length < 5) return null;

  const marketMap = new Map(markets.map(m => [m.id, m]));

  let wins = 0, losses = 0;
  let totalPnL = 0;
  let totalStake = 0;
  let timingsBeforeResolution = [];

  for (const trade of walletTrades) {
    const market = marketMap.get(trade.market_id);
    if (!market || !market.outcome) continue;

    const minutesBefore = (market.resolution_time - trade.timestamp) / 60;
    timingsBeforeResolution.push(minutesBefore);

    const boughtYes = trade.side === 'buy';
    const outcomeYes = market.outcome === 'YES';
    const won = boughtYes === outcomeYes;

    if (won) {
      wins++;
      totalPnL += trade.amount * (1 - trade.price);
    } else {
      losses++;
      totalPnL -= trade.amount * trade.price;
    }
    totalStake += trade.amount;
  }

  const total = wins + losses;
  if (total === 0) return null;

  const winRate = wins / total;
  const pValue = binomialPValue(wins, total, 0.5);

  // Timing analysis
  const avgMinutesBefore = timingsBeforeResolution.reduce((a, b) => a + b, 0) / timingsBeforeResolution.length;
  const lastMinuteTrades = timingsBeforeResolution.filter(t => t <= 30).length;
  const lastMinuteRatio = lastMinuteTrades / timingsBeforeResolution.length;

  // Calculate suspicion score
  let suspicionScore = 0;

  // P-value component
  if (pValue < 0.0001) suspicionScore += 4;
  else if (pValue < 0.001) suspicionScore += 3;
  else if (pValue < 0.01) suspicionScore += 2;
  else if (pValue < 0.05) suspicionScore += 1;

  // Win rate component
  if (winRate > 0.9) suspicionScore += 2;
  else if (winRate > 0.8) suspicionScore += 1;

  // Timing component
  if (avgMinutesBefore < 10) suspicionScore += 3;
  else if (avgMinutesBefore < 30) suspicionScore += 2;
  else if (avgMinutesBefore < 60) suspicionScore += 1;

  // Last-minute ratio
  if (lastMinuteRatio > 0.8) suspicionScore += 2;
  else if (lastMinuteRatio > 0.5) suspicionScore += 1;

  // Volume
  if (totalStake > 500000) suspicionScore += 2;
  else if (totalStake > 100000) suspicionScore += 1;

  let level = 'low';
  if (suspicionScore >= 10) level = 'critical';
  else if (suspicionScore >= 7) level = 'high';
  else if (suspicionScore >= 4) level = 'medium';

  return {
    address: wallet.address,
    trades: total,
    wins,
    losses,
    winRate,
    pValue,
    totalPnL,
    totalStake,
    roi: totalStake > 0 ? totalPnL / totalStake : 0,
    avgMinutesBefore,
    lastMinuteRatio,
    suspicionScore,
    suspicionLevel: level,
    cluster: wallet.cluster
  };
}

/**
 * Run full analysis on all data
 */
export function runFullAnalysis(data) {
  const { markets, trades, wallets, clusters } = data;

  // Analyze each wallet
  const analyzedWallets = wallets
    .map(w => analyzeWallet(w, trades, markets))
    .filter(Boolean)
    .sort((a, b) => a.pValue - b.pValue);

  // Summary stats
  const flaggedCount = analyzedWallets.filter(w => w.suspicionLevel !== 'low').length;
  const criticalCount = analyzedWallets.filter(w => w.suspicionLevel === 'critical').length;
  const totalVolume = analyzedWallets.reduce((sum, w) => sum + w.totalStake, 0);
  const suspiciousVolume = analyzedWallets
    .filter(w => w.suspicionLevel !== 'low')
    .reduce((sum, w) => sum + w.totalStake, 0);

  return {
    summary: {
      totalWallets: wallets.length,
      totalTrades: trades.length,
      totalMarkets: markets.length,
      flaggedWallets: flaggedCount,
      criticalWallets: criticalCount,
      totalVolume,
      suspiciousVolume,
      suspiciousVolumePercent: (suspiciousVolume / totalVolume) * 100
    },
    wallets: analyzedWallets,
    clusters,
    topSuspicious: analyzedWallets.slice(0, 20)
  };
}
