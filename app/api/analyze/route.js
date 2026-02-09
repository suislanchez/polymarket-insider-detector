import { NextResponse } from 'next/server';
import { generateDemoData } from '@/lib/demoData';
import { runFullAnalysis, binomialPValue } from '@/lib/detection';
import {
  fetchAllTrades,
  aggregateByWallet,
  fetchRecentlyResolvedMarkets,
  calculatePreResolutionScore,
  calculateResolvedWinRate,
  analyzeCrossMarketPatterns,
  analyzeWhaleActivity,
  buildWalletClusters,
  attachClusterInfo
} from '@/lib/polymarketApi';
import { batchGetFundingSources } from '@/lib/polygonRpc';

let cachedAnalysis = null;
let lastFetch = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchAndAnalyzeRealData() {
  console.log('Fetching real data from Polymarket...');

  // Fetch recent trades and resolved markets in parallel
  const [trades, resolvedMarkets] = await Promise.all([
    fetchAllTrades(3000),
    fetchRecentlyResolvedMarkets(100)
  ]);

  console.log(`Fetched ${trades.length} trades`);
  console.log(`Fetched ${resolvedMarkets.length} resolved markets`);

  if (trades.length === 0) {
    throw new Error('No trades found');
  }

  // Aggregate by wallet
  const wallets = aggregateByWallet(trades);
  console.log(`Found ${wallets.length} unique wallets`);

  // Analyze each wallet
  const analyzedWallets = [];

  for (const wallet of wallets) {
    if (wallet.trades.length < 3) continue;

    // For real trades, we need to match with resolved market outcomes
    // Since we have the outcome from the trade data, we can analyze directly
    let wins = 0, losses = 0;
    let totalPnL = 0, totalStake = 0;

    for (const trade of wallet.trades) {
      // Each trade has outcome and price
      // A "win" is buying YES when market resolves YES, or selling YES when NO
      // Since we're looking at recent trades, many may not be resolved yet
      // We'll calculate based on current prices as approximation

      const stake = trade.amount * trade.price;
      totalStake += stake;

      // Approximate PnL based on trade direction and price
      // If bought at low price and it's now higher, that's profit
      if (trade.side === 'buy') {
        // Bought - profit if price went up
        totalPnL += trade.amount * (0.5 - trade.price); // Approximate
        if (trade.price < 0.5) wins++;
        else losses++;
      } else {
        // Sold - profit if price went down
        totalPnL += trade.amount * (trade.price - 0.5);
        if (trade.price > 0.5) wins++;
        else losses++;
      }
    }

    const total = wins + losses;
    if (total < 3) continue;

    const winRate = wins / total;
    const pValue = binomialPValue(wins, total, 0.5);

    // Calculate suspicion score
    let suspicionScore = 0;
    if (pValue < 0.0001) suspicionScore += 4;
    else if (pValue < 0.001) suspicionScore += 3;
    else if (pValue < 0.01) suspicionScore += 2;
    else if (pValue < 0.05) suspicionScore += 1;

    if (winRate > 0.9) suspicionScore += 2;
    else if (winRate > 0.8) suspicionScore += 1;

    // Volume-based scoring
    if (totalStake > 100000) suspicionScore += 2;
    else if (totalStake > 10000) suspicionScore += 1;

    // Pre-resolution timing analysis
    const preResolution = calculatePreResolutionScore(wallet.trades, resolvedMarkets);
    suspicionScore += preResolution.score;

    // Calculate average minutes before resolution for trades that match
    let avgMinutesBefore = null;
    if (preResolution.timing.tradesByTiming.length > 0) {
      const totalMinutes = preResolution.timing.tradesByTiming.reduce(
        (sum, t) => sum + t.minutesBefore, 0
      );
      avgMinutesBefore = totalMinutes / preResolution.timing.tradesByTiming.length;
    }

    // Resolved win rate (based on actual market outcomes)
    const resolvedStats = calculateResolvedWinRate(wallet.trades, resolvedMarkets);

    // Cross-market pattern analysis
    const crossMarket = analyzeCrossMarketPatterns(wallet.trades);
    suspicionScore += crossMarket.crossMarketScore;

    // Whale activity analysis
    const whaleStats = analyzeWhaleActivity(wallet.trades, resolvedMarkets);
    suspicionScore += whaleStats.whaleScore;

    let level = 'low';
    if (suspicionScore >= 8) level = 'critical';
    else if (suspicionScore >= 5) level = 'high';
    else if (suspicionScore >= 3) level = 'medium';

    analyzedWallets.push({
      address: wallet.address,
      username: wallet.usernames?.[0] || null,
      trades: total,
      wins,
      losses,
      winRate,
      pValue,
      totalPnL,
      totalStake,
      roi: totalStake > 0 ? totalPnL / totalStake : 0,
      avgMinutesBefore,
      lastMinuteRatio: preResolution.lastMinuteRatio || 0,
      last10MinRatio: preResolution.last10MinRatio || 0,
      lastHourRatio: preResolution.lastHourRatio || 0,
      preResolutionTrades: preResolution.timing.tradesWithTiming,
      // Resolved win rate
      resolvedWins: resolvedStats.resolvedWins,
      resolvedLosses: resolvedStats.resolvedLosses,
      resolvedTradeCount: resolvedStats.resolvedTradeCount,
      resolvedWinRate: resolvedStats.resolvedWinRate,
      // Cross-market patterns
      uniqueMarkets: crossMarket.uniqueMarkets,
      winningMarkets: crossMarket.winningMarkets,
      crossMarketWinRate: crossMarket.crossMarketWinRate,
      crossMarketScore: crossMarket.crossMarketScore,
      // Whale stats
      largestTrade: whaleStats.largestTrade,
      whaleTrades: whaleStats.whaleTrades,
      isWhale: whaleStats.isWhale,
      isMegaWhale: whaleStats.isMegaWhale,
      whalePreResolutionTrades: whaleStats.whalePreResolutionTrades,
      whaleScore: whaleStats.whaleScore,
      suspicionScore,
      suspicionLevel: level,
      cluster: null,
      clusterSize: 1,
      sharedFundingSource: null,
      // Include recent trades for display
      recentTrades: wallet.trades.slice(0, 20).map(t => ({
        market: t.market_question || t.market_slug || 'Unknown Market',
        marketSlug: t.market_slug || null,
        conditionId: t.conditionId || null,
        side: t.side,
        amount: t.amount,
        price: t.price,
        outcome: t.outcome,
        timestamp: t.timestamp ? new Date(t.timestamp * 1000).toISOString() : null
      }))
    });
  }

  analyzedWallets.sort((a, b) => a.pValue - b.pValue);

  // Wallet clustering - fetch funding sources for top suspicious wallets
  let clusterResult = { clusters: [], walletToCluster: new Map() };
  try {
    const walletsToCluster = analyzedWallets
      .filter(w => w.suspicionLevel !== 'low')
      .slice(0, 30)
      .map(w => w.address);

    if (walletsToCluster.length > 0) {
      console.log(`Clustering ${walletsToCluster.length} suspicious wallets...`);
      const fundingSourceMap = await batchGetFundingSources(walletsToCluster, {
        blockRange: 100000,
        maxConcurrent: 2,
        delayMs: 300
      });
      clusterResult = buildWalletClusters(fundingSourceMap);
      console.log(`Found ${clusterResult.clusters.length} clusters`);
    }
  } catch (e) {
    console.error('Clustering error (continuing without clusters):', e.message);
  }

  // Attach cluster info to wallets
  const clusteredWallets = attachClusterInfo(analyzedWallets, clusterResult);

  const flaggedCount = clusteredWallets.filter(w => w.suspicionLevel !== 'low').length;
  const criticalCount = clusteredWallets.filter(w => w.suspicionLevel === 'critical').length;
  const totalVolume = clusteredWallets.reduce((sum, w) => sum + w.totalStake, 0);
  const suspiciousVolume = clusteredWallets
    .filter(w => w.suspicionLevel !== 'low')
    .reduce((sum, w) => sum + w.totalStake, 0);

  // Count wallets with pre-resolution trading
  const walletsWithPreRes = clusteredWallets.filter(w => w.preResolutionTrades > 0).length;
  const highPreResWallets = clusteredWallets.filter(w => w.lastMinuteRatio > 0.1).length;
  const whaleCount = clusteredWallets.filter(w => w.isWhale).length;

  return {
    summary: {
      totalWallets: wallets.length,
      totalTrades: trades.length,
      totalMarkets: new Set(trades.map(t => t.conditionId)).size,
      resolvedMarketsAnalyzed: resolvedMarkets.length,
      flaggedWallets: flaggedCount,
      criticalWallets: criticalCount,
      walletsWithPreResolutionTrades: walletsWithPreRes,
      highPreResolutionWallets: highPreResWallets,
      clusterCount: clusterResult.clusters.length,
      whaleCount,
      totalVolume,
      suspiciousVolume,
      suspiciousVolumePercent: totalVolume > 0 ? (suspiciousVolume / totalVolume) * 100 : 0,
      dataSource: 'live'
    },
    wallets: clusteredWallets,
    clusters: clusterResult.clusters,
    topSuspicious: clusteredWallets.slice(0, 20)
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const useDemo = searchParams.get('demo') === 'true';

  try {
    const now = Date.now();
    const cacheExpired = now - lastFetch > CACHE_TTL;

    if (useDemo) {
      const demoData = generateDemoData();
      const analysis = runFullAnalysis(demoData);
      analysis.summary.dataSource = 'demo';
      return NextResponse.json(analysis);
    }

    // Use real data
    if (!cachedAnalysis || cacheExpired) {
      cachedAnalysis = await fetchAndAnalyzeRealData();
      lastFetch = now;
    }

    return NextResponse.json(cachedAnalysis);
  } catch (error) {
    console.error('Analysis error:', error);
    // Fall back to demo data on error
    const demoData = generateDemoData();
    const analysis = runFullAnalysis(demoData);
    analysis.summary.dataSource = 'demo (fallback: ' + error.message + ')';
    return NextResponse.json(analysis);
  }
}

export async function POST(request) {
  try {
    cachedAnalysis = await fetchAndAnalyzeRealData();
    lastFetch = Date.now();
    return NextResponse.json(cachedAnalysis);
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
