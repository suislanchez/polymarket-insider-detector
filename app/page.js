'use client';

import { useState, useEffect } from 'react';

function formatNumber(n) {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toFixed(0);
}

function formatPValue(p) {
  if (p == null || isNaN(p)) return '-';
  if (p < 1e-15) return '< 1e-15';
  if (p < 0.0001) return p.toExponential(2);
  return p.toFixed(4);
}

function StatCard({ label, value, subtext, color }) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="text-gray-400 text-sm mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color || 'text-white'}`}>{value || '-'}</div>
      {subtext && <div className="text-gray-500 text-sm mt-1">{subtext}</div>}
    </div>
  );
}

function Badge({ level }) {
  const classes = {
    critical: 'bg-red-900 text-red-300',
    high: 'bg-orange-900 text-orange-300',
    medium: 'bg-yellow-900 text-yellow-300',
    low: 'bg-gray-700 text-gray-300'
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${classes[level] || classes.low}`}>
      {level || 'low'}
    </span>
  );
}

function WalletRow({ wallet, onClick }) {
  if (!wallet) return null;

  const winRate = wallet.winRate != null ? (wallet.winRate * 100).toFixed(1) : '0';
  const pnl = wallet.totalPnL != null ? Math.abs(wallet.totalPnL) : 0;

  return (
    <tr
      className="border-b border-gray-700 hover:bg-gray-800/50 cursor-pointer transition-colors"
      onClick={() => onClick(wallet)}
    >
      <td className="py-3 px-4">
        <span className="font-mono text-sm text-gray-300">
          {wallet.address ? `${wallet.address.slice(0, 8)}...${wallet.address.slice(-6)}` : '-'}
        </span>
      </td>
      <td className="py-3 px-4 text-right">{wallet.trades || 0}</td>
      <td className="py-3 px-4 text-right">
        <span className={wallet.winRate > 0.8 ? 'text-red-400' : wallet.winRate > 0.6 ? 'text-yellow-400' : 'text-gray-300'}>
          {winRate}%
        </span>
      </td>
      <td className="py-3 px-4 text-right font-mono text-sm">
        <span className={wallet.pValue < 0.001 ? 'text-red-400' : 'text-gray-400'}>
          {formatPValue(wallet.pValue)}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <span className={wallet.totalPnL > 0 ? 'text-green-400' : 'text-red-400'}>
          ${formatNumber(pnl)}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <span className="text-gray-500">-</span>
      </td>
      <td className="py-3 px-4 text-right">
        <Badge level={wallet.suspicionLevel} />
      </td>
    </tr>
  );
}

function WalletModal({ wallet, onClose }) {
  if (!wallet) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold mb-1">Wallet Analysis</h2>
            <div className="font-mono text-gray-400 text-sm">{wallet.address}</div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Win Rate</div>
            <div className="text-2xl font-bold">{wallet.winRate != null ? (wallet.winRate * 100).toFixed(1) : 0}%</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">P-Value</div>
            <div className="text-2xl font-bold font-mono text-red-400">{formatPValue(wallet.pValue)}</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Total PnL</div>
            <div className={`text-2xl font-bold ${wallet.totalPnL > 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${formatNumber(Math.abs(wallet.totalPnL || 0))}
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm">Suspicion Level</div>
            <div className="text-2xl font-bold mt-1">
              <Badge level={wallet.suspicionLevel} />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-bold mb-3">Details</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-400">Trades:</span>
              <span className="ml-2 text-white">{wallet.trades || 0}</span>
            </div>
            <div>
              <span className="text-gray-400">Wins/Losses:</span>
              <span className="ml-2 text-white">{wallet.wins || 0} / {wallet.losses || 0}</span>
            </div>
            <div>
              <span className="text-gray-400">Total Stake:</span>
              <span className="ml-2 text-white">${formatNumber(wallet.totalStake || 0)}</span>
            </div>
            <div>
              <span className="text-gray-400">ROI:</span>
              <span className={`ml-2 ${(wallet.roi || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {((wallet.roi || 0) * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-gray-400">Score:</span>
              <span className="ml-2 text-white">{wallet.suspicionScore || 0}/10</span>
            </div>
            {wallet.username && (
              <div>
                <span className="text-gray-400">Username:</span>
                <span className="ml-2 text-white">{wallet.username}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/analyze')
      .then(r => {
        if (!r.ok) throw new Error('API request failed');
        return r.json();
      })
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error('Fetch error:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analyze', { method: 'POST' });
      if (!res.ok) throw new Error('Refresh failed');
      const d = await res.json();
      setData(d);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const wallets = data?.wallets || [];
  const filteredWallets = wallets.filter(w => {
    if (filter === 'all') return true;
    return w.suspicionLevel === filter;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-gray-400 mb-2">Analyzing trading patterns...</div>
          <div className="text-sm text-gray-500">Fetching live data from Polymarket</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl text-red-400 mb-2">Error loading data</div>
          <div className="text-sm text-gray-500 mb-4">{error}</div>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-1">Polymarket Insider Detector</h1>
              <div className="text-xs text-gray-600">v2.0</div>
              <p className="text-gray-400">
                Statistical analysis of trading patterns
                {summary.dataSource && (
                  <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                    summary.dataSource === 'live' ? 'bg-green-900 text-green-400' : 'bg-yellow-900 text-yellow-400'
                  }`}>
                    {summary.dataSource === 'live' ? 'LIVE DATA' : 'DEMO DATA'}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Refresh Data
            </button>
          </div>
        </header>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Wallets Analyzed"
            value={summary.totalWallets?.toLocaleString() || '0'}
          />
          <StatCard
            label="Flagged Wallets"
            value={summary.flaggedWallets || 0}
            color="text-yellow-400"
            subtext={`${summary.criticalWallets || 0} critical`}
          />
          <StatCard
            label="Total Volume"
            value={`$${formatNumber(summary.totalVolume || 0)}`}
          />
          <StatCard
            label="Suspicious Volume"
            value={`${(summary.suspiciousVolumePercent || 0).toFixed(1)}%`}
            color="text-red-400"
            subtext={`$${formatNumber(summary.suspiciousVolume || 0)}`}
          />
        </div>

        {/* Wallet Table */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-gray-700 gap-4">
            <h2 className="text-xl font-bold">Wallet Analysis</h2>
            <div className="flex flex-wrap gap-2">
              {['all', 'critical', 'high', 'medium', 'low'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded text-sm capitalize ${
                    filter === f ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
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
                <tr className="text-gray-400 text-left text-sm bg-gray-800/50">
                  <th className="py-3 px-4">Wallet</th>
                  <th className="py-3 px-4 text-right">Trades</th>
                  <th className="py-3 px-4 text-right">Win Rate</th>
                  <th className="py-3 px-4 text-right">P-Value</th>
                  <th className="py-3 px-4 text-right">PnL</th>
                  <th className="py-3 px-4 text-right">Timing</th>
                  <th className="py-3 px-4 text-right">Level</th>
                </tr>
              </thead>
              <tbody>
                {filteredWallets.length > 0 ? (
                  filteredWallets.slice(0, 50).map((w, i) => (
                    <WalletRow key={w.address || i} wallet={w} onClick={setSelectedWallet} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No wallets found matching this filter
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h3 className="font-bold mb-2">How Detection Works</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li><strong className="text-gray-300">P-Value:</strong> Probability of win rate occurring by chance. Lower = more suspicious.</li>
            <li><strong className="text-gray-300">Win Rate:</strong> Percentage of profitable trades. Consistently high rates are flagged.</li>
            <li><strong className="text-gray-300">Suspicion Score:</strong> Composite of p-value, win rate, and volume patterns.</li>
          </ul>
        </div>

        {selectedWallet && (
          <WalletModal wallet={selectedWallet} onClose={() => setSelectedWallet(null)} />
        )}
      </div>
    </div>
  );
}
