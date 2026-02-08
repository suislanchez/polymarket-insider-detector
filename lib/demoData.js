// Generates realistic demo data simulating insider trading patterns

const MARKET_TOPICS = [
  'Fed rate cut', 'CPI inflation', 'Jobs report', 'GDP growth', 'Trump tweet',
  'BTC 100k', 'ETH flip', 'SEC approval', 'Election result', 'Court ruling',
  'Earnings beat', 'Merger approval', 'IPO pricing', 'Rate decision', 'Trade deal'
];

function randomAddress() {
  return '0x' + [...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

export function generateDemoData() {
  const now = Date.now() / 1000;
  const markets = [];
  const trades = [];
  const wallets = new Map();

  // Generate 100 resolved markets
  for (let i = 0; i < 100; i++) {
    const resolutionTime = now - randomBetween(86400, 86400 * 90); // 1-90 days ago
    markets.push({
      id: `market_${i}`,
      question: `${MARKET_TOPICS[i % MARKET_TOPICS.length]} ${Math.floor(i / MARKET_TOPICS.length) + 1}?`,
      resolution_time: resolutionTime,
      outcome: Math.random() > 0.5 ? 'YES' : 'NO'
    });
  }

  // Generate 3 suspicious wallets (insider pattern)
  const suspiciousWallets = [
    { address: randomAddress(), name: 'Whale Alpha', winRate: 0.95, avgMinBefore: 3 },
    { address: randomAddress(), name: 'Sybil Ring Leader', winRate: 0.88, avgMinBefore: 4 },
    { address: randomAddress(), name: 'Economic Data Front-runner', winRate: 0.92, avgMinBefore: 2 }
  ];

  // Generate sybil cluster (12 wallets trading together)
  const sybilCluster = [];
  for (let i = 0; i < 12; i++) {
    sybilCluster.push({
      address: randomAddress(),
      fundingSource: suspiciousWallets[1].address,
      winRate: 0.85 + Math.random() * 0.1
    });
  }

  // Generate trades for suspicious wallets
  for (const sw of suspiciousWallets) {
    const numTrades = Math.floor(randomBetween(30, 60));
    let wins = 0, losses = 0, pnl = 0;

    for (let i = 0; i < numTrades; i++) {
      const market = markets[Math.floor(Math.random() * markets.length)];
      const isWin = Math.random() < sw.winRate;
      const amount = randomBetween(50000, 500000);
      const price = randomBetween(0.4, 0.7);
      const minutesBefore = sw.avgMinBefore + randomBetween(-1, 2);

      if (isWin) {
        wins++;
        pnl += amount * (1 - price);
      } else {
        losses++;
        pnl -= amount * price;
      }

      trades.push({
        id: `trade_${trades.length}`,
        market_id: market.id,
        wallet: sw.address,
        side: isWin ? (market.outcome === 'YES' ? 'buy' : 'sell') : (market.outcome === 'YES' ? 'sell' : 'buy'),
        amount,
        price,
        timestamp: market.resolution_time - (minutesBefore * 60)
      });
    }

    wallets.set(sw.address, {
      address: sw.address,
      trades: numTrades,
      wins,
      losses,
      winRate: wins / numTrades,
      pnl,
      avgMinutesBefore: sw.avgMinBefore,
      cluster: null
    });
  }

  // Generate trades for sybil cluster
  const clusterId = 'cluster_sybil_1';
  for (const member of sybilCluster) {
    const numTrades = Math.floor(randomBetween(15, 30));
    let wins = 0, losses = 0, pnl = 0;

    // They all trade the same markets around the same time
    const clusterMarkets = markets.slice(0, 20);

    for (const market of clusterMarkets.slice(0, numTrades)) {
      const isWin = Math.random() < member.winRate;
      const amount = randomBetween(200000, 500000);
      const price = randomBetween(0.45, 0.65);
      const minutesBefore = 3 + randomBetween(0, 2); // 3-5 minutes before

      if (isWin) {
        wins++;
        pnl += amount * (1 - price);
      } else {
        losses++;
        pnl -= amount * price;
      }

      trades.push({
        id: `trade_${trades.length}`,
        market_id: market.id,
        wallet: member.address,
        side: isWin ? (market.outcome === 'YES' ? 'buy' : 'sell') : (market.outcome === 'YES' ? 'sell' : 'buy'),
        amount,
        price,
        timestamp: market.resolution_time - (minutesBefore * 60)
      });
    }

    wallets.set(member.address, {
      address: member.address,
      trades: numTrades,
      wins,
      losses,
      winRate: wins / (wins + losses),
      pnl,
      avgMinutesBefore: 4,
      cluster: clusterId,
      fundingSource: member.fundingSource
    });
  }

  // Generate 50 normal wallets
  for (let i = 0; i < 50; i++) {
    const address = randomAddress();
    const numTrades = Math.floor(randomBetween(5, 30));
    let wins = 0, losses = 0, pnl = 0;

    for (let j = 0; j < numTrades; j++) {
      const market = markets[Math.floor(Math.random() * markets.length)];
      const isWin = Math.random() < 0.5; // 50% win rate (random)
      const amount = randomBetween(100, 10000);
      const price = randomBetween(0.3, 0.7);
      const minutesBefore = randomBetween(60, 86400 / 60); // 1 hour to 1 day before

      if (isWin) {
        wins++;
        pnl += amount * (1 - price);
      } else {
        losses++;
        pnl -= amount * price;
      }

      trades.push({
        id: `trade_${trades.length}`,
        market_id: market.id,
        wallet: address,
        side: isWin ? (market.outcome === 'YES' ? 'buy' : 'sell') : (market.outcome === 'YES' ? 'sell' : 'buy'),
        amount,
        price,
        timestamp: market.resolution_time - (minutesBefore * 60)
      });
    }

    wallets.set(address, {
      address,
      trades: numTrades,
      wins,
      losses,
      winRate: wins / numTrades,
      pnl,
      avgMinutesBefore: 500, // Normal traders trade hours/days before
      cluster: null
    });
  }

  return {
    markets,
    trades,
    wallets: Array.from(wallets.values()),
    clusters: [{
      id: clusterId,
      wallets: sybilCluster.map(s => s.address),
      totalVolume: sybilCluster.length * 300000 * 15,
      fundingSource: suspiciousWallets[1].address,
      score: 0.92
    }]
  };
}
