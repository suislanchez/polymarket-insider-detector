'use client';

import { useState, useEffect } from 'react';

function formatNumber(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function formatPValue(p) {
  if (p < 1e-15) return '< 1e-15';
  if (p < 0.0001) return p.toExponential(2);
  return p.toFixed(4);
}

function StatCard({ label, value, subtext, color }) {
  return (
    <div className="card">
      <div className="text-gray-400 text-sm mb-1">{label}</div>
      <div className={`stat-value ${color || 'text-white'}`}>{value}</div>
      {subtext && <div className="text-gray-500 text-sm mt-1">{subtext}</div>}
    </div>
  );
}

function Badge({ level }) {
  const classes = {
    critical: 'badge-critical',
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low'
  };
  return <span className={`badge ${classes[level]}`}>{level}</span>;
}

function WalletRow({ wallet, onClick }) {
  return (
    <tr
      className="border-b border-gray-800 hover:bg-gray-800/50 cursor-pointer transition-colors"
      onClick={() => onClick(wallet)}
    >
      <td className="py-4 px-4">
        <span className="mono text-gray-300">{wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}</span>
      </td>
      <td className="py-4 px-4 text-right">{wallet.trades}</td>
      <td className="py-4 px-4 text-right">
        <span className={wallet.winRate > 0.8 ? 'text-red-400' : wallet.winRate > 0.6 ? 'text-yellow-400' : 'text-gray-300'}>
          {(wallet.winRate * 100).toFixed(1)}%
        </span>
      </td>
      <td className="py-4 px-4 text-right mono">
        <span className={wallet.pValue < 0.001 ? 'text-red-400' : 'text-gray-400'}>
          {formatPValue(wallet.pValue)}
        </span>
      </td>
      <td className="py-4 px-4 text-right">
        <span className={wallet.totalPnL > 0 ? 'text-green-400' : 'text-red-400'}>
          ${formatNumber(Math.abs(wallet.totalPnL))}
        </span>
      </td>
      <td className="py-4 px-4 text-right">
        {wallet.avgMinutesBefore < 30 ? (
          <span className="text-red-400">{wallet.avgMinutesBefore.toFixed(0)}m</span>
        ) : (
          <span className="text-gray-400">{wallet.avgMinutesBefore.toFixed(0)}m</span>
        )}
      </td>
      <td className="py-4 px-4 text-right">
        <Badge level={wallet.suspicionLevel} />
      </td>
    </tr>
  );
}

function WalletModal({ wallet, onClose }) {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/wallets/${wallet.address}`)
      .then(r => r.json())
      .then(data => {
        setDetails(data);
        setLoading(false);
      });
  }, [wallet.address]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card max-w-4xl w-full max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold mb-1">Wallet Analysis</h2>
            <div className="mono text-gray-400">{wallet.address}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">Loading...</div>
        ) : details ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Win Rate</div>
                <div className="text-2xl font-bold">{(details.winRate * 100).toFixed(1)}%</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm">P-Value</div>
                <div className="text-2xl font-bold mono text-red-400">{formatPValue(details.pValue)}</div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Total PnL</div>
                <div className={`text-2xl font-bold ${details.totalPnL > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ${formatNumber(Math.abs(details.totalPnL))}
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm">Suspicion</div>
                <div className="text-2xl font-bold">
                  <Badge level={details.suspicionLevel} />
                </div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
                <span>Avg. {details.avgMinutesBefore?.toFixed(1)} min before resolution</span>
                <span>|</span>
                <span>{(details.lastMinuteRatio * 100).toFixed(0)}% trades in last 30 min</span>
                <span>|</span>
                <span>Score: {details.suspicionScore}/14</span>
              </div>
            </div>

            <h3 className="font-bold mb-3">Recent Trades</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 text-left border-b border-gray-700">
                    <th className="pb-2">Market</th>
                    <th className="pb-2 text-right">Side</th>
                    <th className="pb-2 text-right">Amount</th>
                    <th className="pb-2 text-right">Price</th>
                    <th className="pb-2 text-right">Before Resolution</th>
                    <th className="pb-2 text-right">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {details.trades?.slice(0, 20).map((t, i) => {
                    const won = (t.side === 'buy' && t.marketOutcome === 'YES') ||
                                (t.side === 'sell' && t.marketOutcome === 'NO');
                    return (
                      <tr key={i} className="border-b border-gray-800">
                        <td className="py-2 max-w-[200px] truncate">{t.marketQuestion}</td>
                        <td className="py-2 text-right">
                          <span className={t.side === 'buy' ? 'text-green-400' : 'text-red-400'}>
                            {t.side.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 text-right">${formatNumber(t.amount)}</td>
                        <td className="py-2 text-right">{(t.price * 100).toFixed(0)}c</td>
                        <td className="py-2 text-right">
                          <span className={t.minutesBefore < 30 ? 'text-red-400' : ''}>
                            {t.minutesBefore?.toFixed(0)}m
                          </span>
                        </td>
                        <td className="py-2 text-right">
                          <span className={won ? 'text-green-400' : 'text-red-400'}>
                            {won ? 'WIN' : 'LOSS'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ClusterCard({ cluster }) {
  return (
    <div className="card">
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-bold">Sybil Cluster</div>
          <div className="text-gray-400 text-sm">{cluster.wallets.length} linked wallets</div>
        </div>
        <Badge level="critical" />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-3">
        <div>
          <div className="text-gray-400 text-xs">Total Volume</div>
          <div className="font-bold text-lg">${formatNumber(cluster.totalVolume)}</div>
        </div>
        <div>
          <div className="text-gray-400 text-xs">Detection Score</div>
          <div className="font-bold text-lg">{(cluster.score * 100).toFixed(0)}%</div>
        </div>
      </div>
      <div className="text-xs text-gray-500">
        Funding source: <span className="mono">{cluster.fundingSource?.slice(0, 10)}...</span>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/analyze')
      .then(r => r.json())
      .then(d => {
        setData(d);
        setLoading(false);
      });
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    const res = await fetch('/api/analyze', { method: 'POST' });
    const d = await res.json();
    setData(d);
    setLoading(false);
  };

  const filteredWallets = data?.wallets?.filter(w => {
    if (filter === 'all') return true;
    return w.suspicionLevel === filter;
  }) || [];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-400">Analyzing trading patterns...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      <header className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold mb-1">Polymarket Insider Detector</h1>
            <p className="text-gray-400">Statistical analysis of on-chain trading patterns</p>
          </div>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Generate New Data
          </button>
        </div>
      </header>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Wallets Analyzed"
          value={data?.summary?.totalWallets?.toLocaleString()}
        />
        <StatCard
          label="Flagged Wallets"
          value={data?.summary?.flaggedWallets}
          color="text-yellow-400"
          subtext={`${data?.summary?.criticalWallets} critical`}
        />
        <StatCard
          label="Total Volume"
          value={`$${formatNumber(data?.summary?.totalVolume)}`}
        />
        <StatCard
          label="Suspicious Volume"
          value={`${data?.summary?.suspiciousVolumePercent?.toFixed(1)}%`}
          color="text-red-400"
          subtext={`$${formatNumber(data?.summary?.suspiciousVolume)}`}
        />
      </div>

      {/* Clusters */}
      {data?.clusters?.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4">Detected Sybil Clusters</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.clusters.map((c, i) => (
              <ClusterCard key={i} cluster={c} />
            ))}
          </div>
        </div>
      )}

      {/* Wallet Table */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Wallet Analysis</h2>
          <div className="flex gap-2">
            {['all', 'critical', 'high', 'medium', 'low'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded text-sm capitalize ${
                  filter === f ? 'bg-blue-600' : 'bg-gray-800 hover:bg-gray-700'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-gray-400 text-left text-sm border-b border-gray-700">
                <th className="pb-3 px-4">Wallet</th>
                <th className="pb-3 px-4 text-right">Trades</th>
                <th className="pb-3 px-4 text-right">Win Rate</th>
                <th className="pb-3 px-4 text-right">P-Value</th>
                <th className="pb-3 px-4 text-right">PnL</th>
                <th className="pb-3 px-4 text-right">Avg Timing</th>
                <th className="pb-3 px-4 text-right">Level</th>
              </tr>
            </thead>
            <tbody>
              {filteredWallets.slice(0, 50).map((w, i) => (
                <WalletRow key={i} wallet={w} onClick={setSelectedWallet} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Info Box */}
      <div className="mt-8 card bg-gray-900">
        <h3 className="font-bold mb-2">How Detection Works</h3>
        <ul className="text-sm text-gray-400 space-y-1">
          <li><strong>P-Value:</strong> Probability of win rate occurring by chance. Lower = more suspicious.</li>
          <li><strong>Timing Analysis:</strong> Flags wallets trading consistently within minutes of resolution.</li>
          <li><strong>Cluster Detection:</strong> Identifies sybil networks via shared funding and coordinated timing.</li>
          <li><strong>Suspicion Score:</strong> Composite of p-value, win rate, timing, volume, and patterns.</li>
        </ul>
        <p className="text-xs text-gray-500 mt-3">
          Demo mode: Using simulated data. Connect RPC for real on-chain analysis.
        </p>
      </div>

      {selectedWallet && (
        <WalletModal wallet={selectedWallet} onClose={() => setSelectedWallet(null)} />
      )}
    </div>
  );
}
