'use client';

import { useState, useEffect, useMemo } from 'react';

// ============ UTILITY FUNCTIONS ============
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

function formatPercent(n) {
  if (n == null || isNaN(n)) return '0%';
  return (n * 100).toFixed(1) + '%';
}

function timeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ============ UI COMPONENTS ============

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
          <div className="absolute inset-2 border-4 border-transparent border-t-purple-500 rounded-full animate-spin" style={{animationDirection: 'reverse', animationDuration: '1.5s'}}></div>
        </div>
        <div className="text-xl font-semibold text-white mb-2">Analyzing Trading Patterns</div>
        <div className="text-sm text-gray-500">Fetching live data from Polymarket...</div>
        <div className="flex justify-center gap-1 mt-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: `${i * 0.15}s`}}></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, subtext, color, icon, trend }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur rounded-xl p-5 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 group">
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/5 to-purple-500/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-gray-400 text-sm font-medium mb-1">{label}</div>
          <div className={`text-2xl font-bold ${color || 'text-white'}`}>{value || '-'}</div>
          {subtext && <div className="text-gray-500 text-sm mt-1">{subtext}</div>}
        </div>
        {icon && <div className="text-2xl opacity-50 group-hover:opacity-80 transition-opacity">{icon}</div>}
      </div>
      {trend !== undefined && (
        <div className={`absolute bottom-2 right-3 text-xs ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function Badge({ level, size = 'sm' }) {
  const config = {
    critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30', dot: 'bg-red-500' },
    high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', dot: 'bg-orange-500' },
    medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', dot: 'bg-yellow-500' },
    low: { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', dot: 'bg-gray-500' }
  };
  const c = config[level] || config.low;
  const sizeClasses = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 ${sizeClasses} rounded-full font-medium ${c.bg} ${c.text} border ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} animate-pulse`}></span>
      {level || 'low'}
    </span>
  );
}

function ProgressBar({ value, max = 100, color = 'blue' }) {
  const percent = Math.min((value / max) * 100, 100);
  const colors = {
    blue: 'from-blue-500 to-blue-400',
    red: 'from-red-500 to-red-400',
    green: 'from-green-500 to-green-400',
    yellow: 'from-yellow-500 to-yellow-400',
    purple: 'from-purple-500 to-purple-400'
  };
  return (
    <div className="w-full h-1.5 bg-gray-700/50 rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${colors[color]} rounded-full transition-all duration-500`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function DistributionChart({ data }) {
  const levels = ['critical', 'high', 'medium', 'low'];
  const counts = levels.map(level => data?.filter(w => w.suspicionLevel === level).length || 0);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-gray-500'];

  return (
    <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur rounded-xl p-5 border border-gray-700/50">
      <h3 className="text-sm font-semibold text-gray-300 mb-4">Risk Distribution</h3>
      <div className="flex h-3 rounded-full overflow-hidden bg-gray-700/30 mb-4">
        {counts.map((count, i) => (
          <div
            key={levels[i]}
            className={`${colors[i]} transition-all duration-500`}
            style={{ width: `${(count / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {levels.map((level, i) => (
          <div key={level} className="text-center">
            <div className={`text-lg font-bold ${['text-red-400', 'text-orange-400', 'text-yellow-400', 'text-gray-400'][i]}`}>
              {counts[i]}
            </div>
            <div className="text-xs text-gray-500 capitalize">{level}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopSuspiciousCard({ wallets, onSelect }) {
  const top3 = wallets?.slice(0, 3) || [];
  if (top3.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-red-900/20 to-gray-900/80 backdrop-blur rounded-xl p-5 border border-red-500/20">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-red-400 text-lg">⚠</span>
        <h3 className="text-sm font-semibold text-gray-300">Most Suspicious Wallets</h3>
      </div>
      <div className="space-y-3">
        {top3.map((wallet, i) => (
          <div
            key={wallet.address}
            onClick={() => onSelect(wallet)}
            className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-700/50 transition-colors"
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
              i === 0 ? 'bg-red-500/30 text-red-400' : i === 1 ? 'bg-orange-500/30 text-orange-400' : 'bg-yellow-500/30 text-yellow-400'
            }`}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm text-gray-300 truncate">
                {wallet.address?.slice(0, 10)}...{wallet.address?.slice(-6)}
              </div>
              <div className="text-xs text-gray-500">
                {formatPercent(wallet.winRate)} win rate
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-red-400">{formatPValue(wallet.pValue)}</div>
              <Badge level={wallet.suspicionLevel} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WalletRow({ wallet, onClick, rank }) {
  if (!wallet) return null;

  const winRate = wallet.winRate != null ? (wallet.winRate * 100) : 0;
  const pnl = wallet.totalPnL != null ? wallet.totalPnL : 0;
  const winRateColor = winRate > 80 ? 'red' : winRate > 60 ? 'yellow' : 'blue';

  return (
    <tr
      className="border-b border-gray-700/50 hover:bg-gray-800/30 cursor-pointer transition-all duration-200 group"
      onClick={() => onClick(wallet)}
    >
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <span className="text-gray-600 text-sm font-mono w-6">{rank}</span>
          <div>
            <span className="font-mono text-sm text-gray-300 group-hover:text-white transition-colors">
              {wallet.address ? `${wallet.address.slice(0, 10)}...${wallet.address.slice(-6)}` : '-'}
            </span>
            {wallet.username && (
              <div className="text-xs text-gray-500">@{wallet.username}</div>
            )}
          </div>
        </div>
      </td>
      <td className="py-4 px-4 text-right">
        <span className="text-gray-300">{wallet.trades || 0}</span>
      </td>
      <td className="py-4 px-4">
        <div className="flex flex-col items-end gap-1">
          <span className={winRate > 80 ? 'text-red-400 font-semibold' : winRate > 60 ? 'text-yellow-400' : 'text-gray-300'}>
            {winRate.toFixed(1)}%
          </span>
          <div className="w-16">
            <ProgressBar value={winRate} color={winRateColor} />
          </div>
        </div>
      </td>
      <td className="py-4 px-4 text-right">
        <span className={`font-mono text-sm ${wallet.pValue < 0.001 ? 'text-red-400 font-semibold' : wallet.pValue < 0.05 ? 'text-yellow-400' : 'text-gray-400'}`}>
          {formatPValue(wallet.pValue)}
        </span>
      </td>
      <td className="py-4 px-4 text-right">
        <span className={pnl > 0 ? 'text-green-400' : 'text-red-400'}>
          {pnl >= 0 ? '+' : '-'}${formatNumber(Math.abs(pnl))}
        </span>
      </td>
      <td className="py-4 px-4 text-right">
        <span className="text-gray-500">{wallet.suspicionScore || 0}/10</span>
      </td>
      <td className="py-4 px-4 text-right">
        <Badge level={wallet.suspicionLevel} />
      </td>
    </tr>
  );
}

function WalletModal({ wallet, onClose }) {
  if (!wallet) return null;

  const winRate = wallet.winRate != null ? (wallet.winRate * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-gradient-to-br from-gray-900 to-gray-950 border border-gray-700/50 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-700/50 p-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-xl font-bold text-white">Wallet Analysis</h2>
                <Badge level={wallet.suspicionLevel} size="lg" />
              </div>
              <div className="font-mono text-gray-400 text-sm flex items-center gap-2">
                <span>{wallet.address}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(wallet.address)}
                  className="text-gray-500 hover:text-white transition-colors"
                  title="Copy address"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              {wallet.username && (
                <div className="text-sm text-blue-400 mt-1">@{wallet.username}</div>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white p-2 hover:bg-gray-800 rounded-lg transition-all">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
              <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">Win Rate</div>
              <div className={`text-2xl font-bold ${winRate > 80 ? 'text-red-400' : winRate > 60 ? 'text-yellow-400' : 'text-white'}`}>
                {winRate.toFixed(1)}%
              </div>
              <ProgressBar value={winRate} color={winRate > 80 ? 'red' : winRate > 60 ? 'yellow' : 'blue'} />
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
              <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">P-Value</div>
              <div className={`text-2xl font-bold font-mono ${wallet.pValue < 0.001 ? 'text-red-400' : 'text-white'}`}>
                {formatPValue(wallet.pValue)}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {wallet.pValue < 0.001 ? 'Highly suspicious' : wallet.pValue < 0.05 ? 'Suspicious' : 'Normal range'}
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
              <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">Total PnL</div>
              <div className={`text-2xl font-bold ${wallet.totalPnL > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {wallet.totalPnL >= 0 ? '+' : '-'}${formatNumber(Math.abs(wallet.totalPnL || 0))}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                ROI: {((wallet.roi || 0) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
              <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">Risk Score</div>
              <div className="text-2xl font-bold text-white">{wallet.suspicionScore || 0}<span className="text-gray-500 text-lg">/10</span></div>
              <ProgressBar value={(wallet.suspicionScore || 0) * 10} color="red" />
            </div>
          </div>

          {/* Trading Stats */}
          <div className="bg-gray-800/30 rounded-xl p-5 border border-gray-700/30">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-lg">📊</span>
              Trading Statistics
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-gray-400 text-sm">Total Trades</div>
                <div className="text-xl font-semibold text-white">{wallet.trades || 0}</div>
              </div>
              <div>
                <div className="text-gray-400 text-sm">Wins / Losses</div>
                <div className="text-xl font-semibold">
                  <span className="text-green-400">{wallet.wins || 0}</span>
                  <span className="text-gray-500 mx-1">/</span>
                  <span className="text-red-400">{wallet.losses || 0}</span>
                </div>
              </div>
              <div>
                <div className="text-gray-400 text-sm">Total Stake</div>
                <div className="text-xl font-semibold text-white">${formatNumber(wallet.totalStake || 0)}</div>
              </div>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="bg-gradient-to-r from-red-900/20 to-transparent rounded-xl p-5 border border-red-500/20">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <span className="text-lg">⚠</span>
              Risk Assessment
            </h3>
            <div className="space-y-2 text-sm">
              {wallet.pValue < 0.001 && (
                <div className="flex items-center gap-2 text-red-400">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  Extremely low p-value indicates non-random trading pattern
                </div>
              )}
              {winRate > 80 && (
                <div className="flex items-center gap-2 text-red-400">
                  <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                  Win rate exceeds 80% - statistically improbable
                </div>
              )}
              {wallet.totalStake > 10000 && (
                <div className="flex items-center gap-2 text-yellow-400">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  High volume trader - increased scrutiny recommended
                </div>
              )}
              {wallet.pValue >= 0.05 && winRate <= 60 && (
                <div className="flex items-center gap-2 text-green-400">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Trading pattern appears within normal parameters
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN DASHBOARD ============

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('pValue');
  const [sortOrder, setSortOrder] = useState('asc');
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetch('/api/analyze')
      .then(r => {
        if (!r.ok) throw new Error('API request failed');
        return r.json();
      })
      .then(d => {
        setData(d);
        setLastUpdated(new Date());
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
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const wallets = data?.wallets || [];

  const filteredAndSortedWallets = useMemo(() => {
    let result = wallets.filter(w => {
      if (filter === 'all') return true;
      return w.suspicionLevel === filter;
    });

    result.sort((a, b) => {
      let aVal = a[sortBy] ?? 0;
      let bVal = b[sortBy] ?? 0;
      if (sortOrder === 'asc') return aVal - bVal;
      return bVal - aVal;
    });

    return result;
  }, [wallets, filter, sortBy, sortOrder]);

  const suspiciousWallets = useMemo(() =>
    wallets.filter(w => w.suspicionLevel === 'critical' || w.suspicionLevel === 'high')
      .sort((a, b) => (a.pValue || 1) - (b.pValue || 1)),
    [wallets]
  );

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-6xl mb-4">⚠</div>
          <div className="text-xl text-red-400 font-semibold mb-2">Error Loading Data</div>
          <div className="text-gray-500 mb-6">{error}</div>
          <button
            onClick={handleRefresh}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-medium transition-all hover:scale-105"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {};
  const filterCounts = {
    all: wallets.length,
    critical: wallets.filter(w => w.suspicionLevel === 'critical').length,
    high: wallets.filter(w => w.suspicionLevel === 'high').length,
    medium: wallets.filter(w => w.suspicionLevel === 'medium').length,
    low: wallets.filter(w => w.suspicionLevel === 'low').length,
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none"></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                  Polymarket Insider Detector
                </h1>
                {summary.dataSource && (
                  <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                    summary.dataSource === 'live'
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${summary.dataSource === 'live' ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`}></span>
                    {summary.dataSource === 'live' ? 'LIVE' : 'DEMO'}
                  </span>
                )}
              </div>
              <p className="text-gray-400">
                Statistical analysis of on-chain trading patterns
              </p>
              {lastUpdated && (
                <p className="text-gray-600 text-sm mt-1">
                  Last updated: {timeAgo(lastUpdated)}
                </p>
              )}
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-xl font-medium transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/25 flex items-center gap-2 disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Data
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Wallets Analyzed"
            value={summary.totalWallets?.toLocaleString() || '0'}
            icon="👛"
            subtext={`${summary.totalTrades?.toLocaleString() || 0} trades`}
          />
          <StatCard
            label="Flagged Wallets"
            value={summary.flaggedWallets || 0}
            color="text-yellow-400"
            icon="🚨"
            subtext={`${summary.criticalWallets || 0} critical`}
          />
          <StatCard
            label="Total Volume"
            value={`$${formatNumber(summary.totalVolume || 0)}`}
            icon="💰"
            subtext={`${summary.totalMarkets || 0} markets`}
          />
          <StatCard
            label="Suspicious Volume"
            value={`${(summary.suspiciousVolumePercent || 0).toFixed(1)}%`}
            color="text-red-400"
            icon="⚠"
            subtext={`$${formatNumber(summary.suspiciousVolume || 0)}`}
          />
        </div>

        {/* Secondary Grid */}
        <div className="grid lg:grid-cols-3 gap-4 mb-8">
          <DistributionChart data={wallets} />
          <div className="lg:col-span-2">
            <TopSuspiciousCard wallets={suspiciousWallets} onSelect={setSelectedWallet} />
          </div>
        </div>

        {/* Wallet Table */}
        <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur rounded-2xl border border-gray-700/50 overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 border-b border-gray-700/50 gap-4">
            <div>
              <h2 className="text-xl font-bold">Wallet Analysis</h2>
              <p className="text-gray-500 text-sm">{filteredAndSortedWallets.length} wallets</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['all', 'critical', 'high', 'medium', 'low'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                    filter === f
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                      : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white'
                  }`}
                >
                  {f} ({filterCounts[f]})
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-gray-400 text-left text-sm bg-gray-800/30">
                  <th className="py-4 px-4 font-medium">Wallet</th>
                  <th className="py-4 px-4 text-right font-medium cursor-pointer hover:text-white" onClick={() => handleSort('trades')}>
                    Trades {sortBy === 'trades' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-4 px-4 text-right font-medium cursor-pointer hover:text-white" onClick={() => handleSort('winRate')}>
                    Win Rate {sortBy === 'winRate' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-4 px-4 text-right font-medium cursor-pointer hover:text-white" onClick={() => handleSort('pValue')}>
                    P-Value {sortBy === 'pValue' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-4 px-4 text-right font-medium cursor-pointer hover:text-white" onClick={() => handleSort('totalPnL')}>
                    PnL {sortBy === 'totalPnL' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-4 px-4 text-right font-medium cursor-pointer hover:text-white" onClick={() => handleSort('suspicionScore')}>
                    Score {sortBy === 'suspicionScore' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-4 px-4 text-right font-medium">Level</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedWallets.length > 0 ? (
                  filteredAndSortedWallets.slice(0, 50).map((w, i) => (
                    <WalletRow key={w.address || i} wallet={w} onClick={setSelectedWallet} rank={i + 1} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      <div className="text-4xl mb-2">🔍</div>
                      No wallets found matching this filter
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredAndSortedWallets.length > 50 && (
            <div className="p-4 text-center text-gray-500 text-sm border-t border-gray-700/50">
              Showing 50 of {filteredAndSortedWallets.length} wallets
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-gradient-to-br from-gray-800/30 to-gray-900/30 backdrop-blur rounded-2xl border border-gray-700/50 p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <span>ℹ</span> How Detection Works
          </h3>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="text-blue-400 font-semibold mb-1">P-Value Analysis</div>
              <p className="text-gray-400">Probability of achieving the observed win rate by chance. Values below 0.001 indicate statistically impossible luck.</p>
            </div>
            <div>
              <div className="text-purple-400 font-semibold mb-1">Win Rate Tracking</div>
              <p className="text-gray-400">Monitors trading success rates. Sustained rates above 70% across multiple trades are flagged for review.</p>
            </div>
            <div>
              <div className="text-red-400 font-semibold mb-1">Risk Scoring</div>
              <p className="text-gray-400">Composite score combining p-value, win rate, volume patterns, and timing analysis for comprehensive risk assessment.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-8 text-center text-gray-600 text-sm">
          <p>Data sourced from Polymarket public API. Analysis is probabilistic, not definitive proof of insider trading.</p>
        </footer>
      </div>

      {selectedWallet && (
        <WalletModal wallet={selectedWallet} onClose={() => setSelectedWallet(null)} />
      )}
    </div>
  );
}
