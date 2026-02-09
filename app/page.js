'use client';

import { useState, useEffect, useMemo } from 'react';

// ============ UTILITY FUNCTIONS ============
function formatNumber(n) {
  if (n == null || isNaN(n)) return '0';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
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

function formatMinutes(mins) {
  if (mins == null || isNaN(mins)) return '-';
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${Math.round(mins)} min`;
  return `${(mins / 60).toFixed(1)} hrs`;
}

function exportToCSV(wallets, filename = 'polymarket-analysis.csv') {
  const headers = [
    'Address', 'Username', 'Trades', 'Wins', 'Losses', 'Win Rate', 'P-Value',
    'Total PnL', 'Total Stake', 'ROI',
    // Pre-resolution timing
    'Avg Mins Before Resolution', 'Last Min Ratio', 'Last 10 Min Ratio', 'Pre-Res Trades',
    // Resolved win rate
    'Resolved Trades', 'Resolved Wins', 'Resolved Losses', 'Resolved Win Rate',
    // Cross-market
    'Unique Markets', 'Winning Markets', 'Cross-Market Win Rate', 'Cross-Market Score',
    // Whale stats
    'Is Whale', 'Is Mega Whale', 'Largest Trade', 'Whale Trades', 'Whale Pre-Res Trades', 'Whale Score',
    // Clustering
    'Cluster ID', 'Cluster Size', 'Shared Funding Source',
    // Overall
    'Suspicion Score', 'Level'
  ];
  const rows = wallets.map(w => [
    w.address,
    w.username || '',
    w.trades,
    w.wins,
    w.losses,
    (w.winRate * 100).toFixed(2) + '%',
    w.pValue?.toExponential(4) || '',
    '$' + (w.totalPnL || 0).toFixed(2),
    '$' + (w.totalStake || 0).toFixed(2),
    ((w.roi || 0) * 100).toFixed(2) + '%',
    // Pre-resolution timing
    w.avgMinutesBefore?.toFixed(1) || '',
    ((w.lastMinuteRatio || 0) * 100).toFixed(1) + '%',
    ((w.last10MinRatio || 0) * 100).toFixed(1) + '%',
    w.preResolutionTrades || 0,
    // Resolved win rate
    w.resolvedTradeCount || 0,
    w.resolvedWins || 0,
    w.resolvedLosses || 0,
    ((w.resolvedWinRate || 0) * 100).toFixed(1) + '%',
    // Cross-market
    w.uniqueMarkets || 0,
    w.winningMarkets || 0,
    ((w.crossMarketWinRate || 0) * 100).toFixed(1) + '%',
    w.crossMarketScore || 0,
    // Whale stats
    w.isWhale ? 'Yes' : 'No',
    w.isMegaWhale ? 'Yes' : 'No',
    '$' + (w.largestTrade || 0).toFixed(2),
    w.whaleTrades || 0,
    w.whalePreResolutionTrades || 0,
    w.whaleScore || 0,
    // Clustering
    w.cluster || '',
    w.clusterSize || 1,
    w.sharedFundingSource || '',
    // Overall
    w.suspicionScore || 0,
    w.suspicionLevel
  ]);

  const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

// ============ UI COMPONENTS ============

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        <div className="relative w-12 h-12 mx-auto mb-6">
          <div className="absolute inset-0 border-2 border-neutral-800 rounded-full"></div>
          <div className="absolute inset-0 border-2 border-transparent border-t-neutral-400 rounded-full animate-spin"></div>
        </div>
        <div className="text-sm font-medium text-neutral-300 mb-1">LOADING</div>
        <div className="text-xs text-neutral-600">Fetching market data...</div>
      </div>
    </div>
  );
}

function SearchBar({ value, onChange, onClear }) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg className="w-4 h-4 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search wallet address..."
        className="w-full pl-10 pr-10 py-2 bg-neutral-900 border border-neutral-800 text-neutral-200 placeholder-neutral-600 focus:border-neutral-600 transition-colors font-mono text-sm"
      />
      {value && (
        <button
          onClick={onClear}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-600 hover:text-neutral-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

function StatCard({ label, value, subtext, color }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 p-4">
      <div className="text-neutral-500 text-xs uppercase tracking-wider mb-2">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${color || 'text-neutral-100'}`}>{value || '-'}</div>
      {subtext && <div className="text-neutral-600 text-xs mt-1">{subtext}</div>}
    </div>
  );
}

function Badge({ level, size = 'sm' }) {
  const config = {
    critical: { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20' },
    high: { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20' },
    medium: { bg: 'bg-neutral-500/10', text: 'text-neutral-400', border: 'border-neutral-500/20' },
    low: { bg: 'bg-neutral-800', text: 'text-neutral-500', border: 'border-neutral-700' }
  };
  const c = config[level] || config.low;
  const sizeClasses = size === 'lg' ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]';

  return (
    <span className={`inline-flex items-center ${sizeClasses} font-medium uppercase tracking-wider ${c.bg} ${c.text} border ${c.border}`}>
      {level || 'low'}
    </span>
  );
}

function ClusterBadge({ clusterId, clusterSize }) {
  if (!clusterId || clusterSize <= 1) return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20" title={`Cluster ${clusterId}: ${clusterSize} wallets with shared funding`}>
      C{clusterId}
    </span>
  );
}

function WhaleBadge({ isWhale, isMegaWhale }) {
  if (!isWhale) return null;
  return (
    <span className={`inline-flex items-center px-1 text-[10px] ${isMegaWhale ? 'text-blue-400' : 'text-blue-500/70'}`} title={isMegaWhale ? 'Mega Whale (>$25k trades)' : 'Whale (>$5k trades)'}>
      {isMegaWhale ? '🐋' : '🐳'}
    </span>
  );
}

function ProgressBar({ value, max = 100, color = 'neutral' }) {
  const percent = Math.min((value / max) * 100, 100);
  const colors = {
    neutral: 'bg-neutral-500',
    red: 'bg-red-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
  };
  return (
    <div className="w-full h-1 bg-neutral-800 overflow-hidden">
      <div
        className={`h-full ${colors[color]} transition-all duration-300`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

function TimingChart({ trades }) {
  if (!trades || trades.length === 0) return null;

  const hourCounts = Array(24).fill(0);
  trades.forEach(t => {
    if (t.timestamp) {
      const hour = new Date(t.timestamp).getHours();
      hourCounts[hour]++;
    }
  });

  const maxCount = Math.max(...hourCounts, 1);

  return (
    <div className="bg-neutral-900 border border-neutral-800 p-4">
      <h4 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
        Activity Distribution (UTC)
      </h4>
      <div className="flex items-end gap-px h-12">
        {hourCounts.map((count, hour) => (
          <div key={hour} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-neutral-600 hover:bg-neutral-500 transition-colors"
              style={{ height: `${(count / maxCount) * 100}%`, minHeight: count > 0 ? '2px' : '0' }}
              title={`${hour}:00 - ${count} trades`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-neutral-700 font-mono">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  );
}

function DistributionChart({ data }) {
  const levels = ['critical', 'high', 'medium', 'low'];
  const counts = levels.map(level => data?.filter(w => w.suspicionLevel === level).length || 0);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-neutral-500', 'bg-neutral-700'];

  return (
    <div className="bg-neutral-900 border border-neutral-800 p-4">
      <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-4">Risk Distribution</h3>
      <div className="flex h-2 overflow-hidden bg-neutral-800 mb-4">
        {counts.map((count, i) => (
          <div
            key={levels[i]}
            className={`${colors[i]} transition-all duration-300`}
            style={{ width: `${(count / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {levels.map((level, i) => (
          <div key={level} className="text-center">
            <div className={`text-lg font-semibold tabular-nums ${['text-red-500', 'text-orange-500', 'text-neutral-400', 'text-neutral-600'][i]}`}>
              {counts[i]}
            </div>
            <div className="text-[10px] text-neutral-600 uppercase tracking-wider">{level}</div>
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
    <div className="bg-neutral-900 border border-neutral-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">Highest Risk Wallets</h3>
        <span className="text-[10px] text-red-500 uppercase tracking-wider">Alert</span>
      </div>
      <div className="space-y-2">
        {top3.map((wallet, i) => (
          <div
            key={wallet.address}
            onClick={() => onSelect(wallet)}
            className="flex items-center gap-3 p-3 bg-neutral-950 border border-neutral-800 cursor-pointer hover:border-neutral-700 transition-colors"
          >
            <div className={`w-5 h-5 flex items-center justify-center text-[10px] font-semibold border ${
              i === 0 ? 'border-red-500/30 text-red-500' : i === 1 ? 'border-orange-500/30 text-orange-500' : 'border-neutral-600 text-neutral-500'
            }`}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-xs text-neutral-300 truncate">
                {wallet.address?.slice(0, 10)}...{wallet.address?.slice(-6)}
              </div>
              <div className="text-[10px] text-neutral-600">
                {formatPercent(wallet.winRate)} win rate
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono text-red-500">{formatPValue(wallet.pValue)}</div>
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
  const winRateColor = winRate > 80 ? 'red' : winRate > 60 ? 'yellow' : 'neutral';

  return (
    <tr
      className="border-b border-neutral-800 hover:bg-neutral-900/50 cursor-pointer transition-colors"
      onClick={() => onClick(wallet)}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <span className="text-neutral-700 text-xs font-mono w-6">{rank}</span>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-neutral-300">
                {wallet.address ? `${wallet.address.slice(0, 10)}...${wallet.address.slice(-6)}` : '-'}
              </span>
              <a
                href={`https://polymarket.com/profile/${wallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-neutral-700 hover:text-green-500 transition-colors"
                title="Polymarket"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </a>
              <a
                href={`https://polygonscan.com/address/${wallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-neutral-700 hover:text-purple-500 transition-colors"
                title="Polygonscan"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <WhaleBadge isWhale={wallet.isWhale} isMegaWhale={wallet.isMegaWhale} />
              <ClusterBadge clusterId={wallet.cluster} clusterSize={wallet.clusterSize} />
            </div>
            <div className="flex items-center gap-2">
              {wallet.username && (
                <span className="text-[10px] text-neutral-600">@{wallet.username}</span>
              )}
              {wallet.crossMarketWinRate > 0.7 && wallet.uniqueMarkets >= 3 && (
                <span className="text-[10px] text-cyan-500" title={`${wallet.uniqueMarkets} markets, ${formatPercent(wallet.crossMarketWinRate)} cross-market win rate`}>
                  x{wallet.uniqueMarkets}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <span className="text-neutral-400 text-sm tabular-nums">{wallet.trades || 0}</span>
      </td>
      <td className="py-3 px-4">
        <div className="flex flex-col items-end gap-1">
          <span className={`text-sm tabular-nums ${winRate > 80 ? 'text-red-500' : winRate > 60 ? 'text-yellow-500' : 'text-neutral-400'}`}>
            {winRate.toFixed(1)}%
          </span>
          <div className="w-12">
            <ProgressBar value={winRate} color={winRateColor} />
          </div>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <span className={`font-mono text-xs ${wallet.pValue < 0.001 ? 'text-red-500' : wallet.pValue < 0.05 ? 'text-yellow-500' : 'text-neutral-500'}`}>
          {formatPValue(wallet.pValue)}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <span className={`text-sm tabular-nums ${pnl > 0 ? 'text-green-500' : 'text-red-500'}`}>
          {pnl >= 0 ? '+' : ''}{formatNumber(pnl)}
        </span>
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-1">
          {wallet.preResolutionTrades > 0 && (
            <span className="text-orange-500 text-[10px]" title={`${wallet.preResolutionTrades} pre-resolution trades`}>
              ⚡{wallet.preResolutionTrades}
            </span>
          )}
          {wallet.whalePreResolutionTrades > 0 && (
            <span className="text-blue-400 text-[10px]" title={`${wallet.whalePreResolutionTrades} whale-size pre-resolution trades`}>
              W{wallet.whalePreResolutionTrades}
            </span>
          )}
          <span className="text-neutral-600 text-sm tabular-nums">{wallet.suspicionScore || 0}/10</span>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <Badge level={wallet.suspicionLevel} />
      </td>
    </tr>
  );
}

function WalletModal({ wallet, onClose }) {
  if (!wallet) return null;

  const winRate = wallet.winRate != null ? (wallet.winRate * 100) : 0;

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-neutral-950 border border-neutral-800 max-w-3xl w-full max-h-[90vh] overflow-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-neutral-950 border-b border-neutral-800 p-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-sm font-semibold text-neutral-200 uppercase tracking-wider">Wallet Analysis</h2>
                <Badge level={wallet.suspicionLevel} size="lg" />
              </div>
              <div className="font-mono text-neutral-500 text-xs flex items-center gap-2">
                <span>{wallet.address}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(wallet.address)}
                  className="text-neutral-600 hover:text-neutral-400 transition-colors"
                  title="Copy address"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                <a
                  href={`https://polymarket.com/profile/${wallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-600 hover:text-green-500 transition-colors"
                  title="View on Polymarket"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </a>
                <a
                  href={`https://polygonscan.com/address/${wallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-600 hover:text-purple-500 transition-colors"
                  title="View on Polygonscan"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
              {wallet.username && (
                <a
                  href={`https://polymarket.com/profile/${wallet.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-neutral-500 hover:text-green-500 transition-colors mt-1"
                >
                  @{wallet.username}
                </a>
              )}
            </div>
            <button onClick={onClose} className="text-neutral-600 hover:text-neutral-400 p-1 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-neutral-900 border border-neutral-800 p-3">
              <div className="text-neutral-600 text-[10px] uppercase tracking-wider mb-1">Win Rate</div>
              <div className={`text-lg font-semibold tabular-nums ${winRate > 80 ? 'text-red-500' : winRate > 60 ? 'text-yellow-500' : 'text-neutral-200'}`}>
                {winRate.toFixed(1)}%
              </div>
              <ProgressBar value={winRate} color={winRate > 80 ? 'red' : winRate > 60 ? 'yellow' : 'neutral'} />
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-3">
              <div className="text-neutral-600 text-[10px] uppercase tracking-wider mb-1">P-Value</div>
              <div className={`text-lg font-semibold font-mono ${wallet.pValue < 0.001 ? 'text-red-500' : 'text-neutral-200'}`}>
                {formatPValue(wallet.pValue)}
              </div>
              <div className="text-[10px] text-neutral-600 mt-1">
                {wallet.pValue < 0.001 ? 'Highly anomalous' : wallet.pValue < 0.05 ? 'Suspicious' : 'Normal range'}
              </div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-3">
              <div className="text-neutral-600 text-[10px] uppercase tracking-wider mb-1">Total PnL</div>
              <div className={`text-lg font-semibold tabular-nums ${wallet.totalPnL > 0 ? 'text-green-500' : 'text-red-500'}`}>
                {wallet.totalPnL >= 0 ? '+' : ''}{formatNumber(wallet.totalPnL || 0)}
              </div>
              <div className="text-[10px] text-neutral-600 mt-1">
                ROI: {((wallet.roi || 0) * 100).toFixed(1)}%
              </div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 p-3">
              <div className="text-neutral-600 text-[10px] uppercase tracking-wider mb-1">Risk Score</div>
              <div className="text-lg font-semibold text-neutral-200 tabular-nums">{wallet.suspicionScore || 0}<span className="text-neutral-600 text-sm">/10</span></div>
              <ProgressBar value={(wallet.suspicionScore || 0) * 10} color="red" />
            </div>
          </div>

          {/* Timing Chart */}
          {wallet.recentTrades && wallet.recentTrades.length > 0 && (
            <TimingChart trades={wallet.recentTrades} />
          )}

          {/* Pre-Resolution Timing */}
          {(wallet.preResolutionTrades > 0 || wallet.avgMinutesBefore) && (
            <div className="bg-neutral-900 border border-orange-500/30 p-4">
              <h3 className="text-xs font-medium text-orange-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>⚡</span> Pre-Resolution Timing
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-neutral-600 text-xs">Avg Time Before</div>
                  <div className="text-lg font-semibold text-orange-500 tabular-nums">
                    {formatMinutes(wallet.avgMinutesBefore)}
                  </div>
                </div>
                <div>
                  <div className="text-neutral-600 text-xs">Pre-Res Trades</div>
                  <div className="text-lg font-semibold text-neutral-200 tabular-nums">{wallet.preResolutionTrades || 0}</div>
                </div>
                <div>
                  <div className="text-neutral-600 text-xs">Last Min Ratio</div>
                  <div className={`text-lg font-semibold tabular-nums ${(wallet.lastMinuteRatio || 0) > 0.1 ? 'text-red-500' : 'text-neutral-400'}`}>
                    {((wallet.lastMinuteRatio || 0) * 100).toFixed(1)}%
                  </div>
                </div>
                <div>
                  <div className="text-neutral-600 text-xs">Last 10 Min Ratio</div>
                  <div className={`text-lg font-semibold tabular-nums ${(wallet.last10MinRatio || 0) > 0.3 ? 'text-orange-500' : 'text-neutral-400'}`}>
                    {((wallet.last10MinRatio || 0) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>
              <div className="mt-3 text-[10px] text-neutral-600">
                Trades placed shortly before market resolution may indicate advance knowledge of outcomes
              </div>
            </div>
          )}

          {/* Resolved Win Rate */}
          {wallet.resolvedTradeCount > 0 && (
            <div className="bg-neutral-900 border border-green-500/30 p-4">
              <h3 className="text-xs font-medium text-green-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>✓</span> Resolved Market Performance
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-neutral-600 text-xs">Resolved Win Rate</div>
                  <div className={`text-lg font-semibold tabular-nums ${(wallet.resolvedWinRate || 0) > 0.8 ? 'text-red-500' : (wallet.resolvedWinRate || 0) > 0.6 ? 'text-yellow-500' : 'text-green-500'}`}>
                    {formatPercent(wallet.resolvedWinRate)}
                  </div>
                </div>
                <div>
                  <div className="text-neutral-600 text-xs">Resolved Trades</div>
                  <div className="text-lg font-semibold text-neutral-200 tabular-nums">{wallet.resolvedTradeCount || 0}</div>
                </div>
                <div>
                  <div className="text-neutral-600 text-xs">Resolved Wins</div>
                  <div className="text-lg font-semibold text-green-500 tabular-nums">{wallet.resolvedWins || 0}</div>
                </div>
                <div>
                  <div className="text-neutral-600 text-xs">Resolved Losses</div>
                  <div className="text-lg font-semibold text-red-500 tabular-nums">{wallet.resolvedLosses || 0}</div>
                </div>
              </div>
              <div className="mt-3 text-[10px] text-neutral-600">
                Based on actual market outcomes, not price-based estimates
              </div>
            </div>
          )}

          {/* Cross-Market Patterns */}
          {wallet.uniqueMarkets >= 2 && (
            <div className="bg-neutral-900 border border-cyan-500/30 p-4">
              <h3 className="text-xs font-medium text-cyan-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>⛓</span> Cross-Market Analysis
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-neutral-600 text-xs">Markets Traded</div>
                  <div className="text-lg font-semibold text-neutral-200 tabular-nums">{wallet.uniqueMarkets || 0}</div>
                </div>
                <div>
                  <div className="text-neutral-600 text-xs">Winning Markets</div>
                  <div className="text-lg font-semibold text-cyan-500 tabular-nums">{wallet.winningMarkets || 0}</div>
                </div>
                <div>
                  <div className="text-neutral-600 text-xs">Cross-Market Win Rate</div>
                  <div className={`text-lg font-semibold tabular-nums ${(wallet.crossMarketWinRate || 0) > 0.8 ? 'text-red-500' : (wallet.crossMarketWinRate || 0) > 0.6 ? 'text-yellow-500' : 'text-neutral-400'}`}>
                    {formatPercent(wallet.crossMarketWinRate)}
                  </div>
                </div>
                <div>
                  <div className="text-neutral-600 text-xs">Pattern Score</div>
                  <div className="text-lg font-semibold text-neutral-200 tabular-nums">+{wallet.crossMarketScore || 0}</div>
                </div>
              </div>
              <div className="mt-3 text-[10px] text-neutral-600">
                Winning across multiple unrelated markets indicates potential insider access
              </div>
            </div>
          )}

          {/* Whale Activity */}
          {wallet.isWhale && (
            <div className="bg-neutral-900 border border-blue-500/30 p-4">
              <h3 className="text-xs font-medium text-blue-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>{wallet.isMegaWhale ? '🐋' : '🐳'}</span> Whale Analysis
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-neutral-600 text-xs">Largest Trade</div>
                  <div className="text-lg font-semibold text-blue-500 tabular-nums">${formatNumber(wallet.largestTrade || 0)}</div>
                </div>
                <div>
                  <div className="text-neutral-600 text-xs">Whale Trades</div>
                  <div className="text-lg font-semibold text-neutral-200 tabular-nums">{wallet.whaleTrades || 0}</div>
                </div>
                <div>
                  <div className="text-neutral-600 text-xs">Pre-Res Whale Trades</div>
                  <div className={`text-lg font-semibold tabular-nums ${(wallet.whalePreResolutionTrades || 0) > 0 ? 'text-red-500' : 'text-neutral-400'}`}>
                    {wallet.whalePreResolutionTrades || 0}
                  </div>
                </div>
                <div>
                  <div className="text-neutral-600 text-xs">Whale Score</div>
                  <div className="text-lg font-semibold text-neutral-200 tabular-nums">+{wallet.whaleScore || 0}</div>
                </div>
              </div>
              <div className="mt-3 text-[10px] text-neutral-600">
                {wallet.isMegaWhale ? 'Mega whale: trades over $25,000' : 'Whale: trades over $5,000'} - large bets with insider info are especially concerning
              </div>
            </div>
          )}

          {/* Wallet Cluster */}
          {wallet.cluster && wallet.clusterSize > 1 && (
            <div className="bg-neutral-900 border border-purple-500/30 p-4">
              <h3 className="text-xs font-medium text-purple-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <span>🔗</span> Wallet Cluster
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-neutral-600 text-xs">Cluster ID</div>
                  <div className="text-lg font-semibold text-purple-500 tabular-nums">C{wallet.cluster}</div>
                </div>
                <div>
                  <div className="text-neutral-600 text-xs">Cluster Size</div>
                  <div className="text-lg font-semibold text-neutral-200 tabular-nums">{wallet.clusterSize} wallets</div>
                </div>
                {wallet.sharedFundingSource && (
                  <div>
                    <div className="text-neutral-600 text-xs">Shared Funding</div>
                    <a
                      href={`https://polygonscan.com/address/${wallet.sharedFundingSource}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                      title={wallet.sharedFundingSource}
                    >
                      <span>{wallet.sharedFundingSource.slice(0, 8)}...{wallet.sharedFundingSource.slice(-6)}</span>
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>
              <div className="mt-3 text-[10px] text-neutral-600">
                Multiple wallets funded by the same source may be controlled by a single entity
              </div>
            </div>
          )}

          {/* Trading Stats */}
          <div className="bg-neutral-900 border border-neutral-800 p-4">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-4">
              Trading Statistics
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-neutral-600 text-xs">Total Trades</div>
                <div className="text-lg font-semibold text-neutral-200 tabular-nums">{wallet.trades || 0}</div>
              </div>
              <div>
                <div className="text-neutral-600 text-xs">Wins / Losses</div>
                <div className="text-lg font-semibold tabular-nums">
                  <span className="text-green-500">{wallet.wins || 0}</span>
                  <span className="text-neutral-700 mx-1">/</span>
                  <span className="text-red-500">{wallet.losses || 0}</span>
                </div>
              </div>
              <div>
                <div className="text-neutral-600 text-xs">Total Stake</div>
                <div className="text-lg font-semibold text-neutral-200 tabular-nums">${formatNumber(wallet.totalStake || 0)}</div>
              </div>
            </div>
          </div>

          {/* Risk Assessment */}
          <div className="bg-neutral-900 border border-red-500/20 p-4">
            <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">
              Risk Assessment
            </h3>
            <div className="space-y-2 text-xs">
              {wallet.pValue < 0.001 && (
                <div className="flex items-center gap-2 text-red-500">
                  <span className="w-1 h-1 bg-red-500"></span>
                  Extremely low p-value indicates non-random trading pattern
                </div>
              )}
              {winRate > 80 && (
                <div className="flex items-center gap-2 text-red-500">
                  <span className="w-1 h-1 bg-red-500"></span>
                  Win rate exceeds 80% - statistically improbable
                </div>
              )}
              {wallet.resolvedWinRate > 0.8 && wallet.resolvedTradeCount >= 5 && (
                <div className="flex items-center gap-2 text-red-500">
                  <span className="w-1 h-1 bg-red-500"></span>
                  Verified {formatPercent(wallet.resolvedWinRate)} win rate on {wallet.resolvedTradeCount} resolved markets
                </div>
              )}
              {wallet.crossMarketWinRate > 0.7 && wallet.uniqueMarkets >= 5 && (
                <div className="flex items-center gap-2 text-red-500">
                  <span className="w-1 h-1 bg-red-500"></span>
                  Winning across {wallet.uniqueMarkets} different markets - cross-market insider access suspected
                </div>
              )}
              {wallet.isMegaWhale && (
                <div className="flex items-center gap-2 text-red-500">
                  <span className="w-1 h-1 bg-red-500"></span>
                  Mega whale: trades exceeding $25,000 detected
                </div>
              )}
              {wallet.whalePreResolutionTrades > 0 && (
                <div className="flex items-center gap-2 text-red-500">
                  <span className="w-1 h-1 bg-red-500"></span>
                  {wallet.whalePreResolutionTrades} large trades placed before market resolution
                </div>
              )}
              {wallet.cluster && wallet.clusterSize > 2 && (
                <div className="flex items-center gap-2 text-purple-500">
                  <span className="w-1 h-1 bg-purple-500"></span>
                  Part of {wallet.clusterSize}-wallet cluster with shared funding source
                </div>
              )}
              {wallet.totalStake > 10000 && (
                <div className="flex items-center gap-2 text-yellow-500">
                  <span className="w-1 h-1 bg-yellow-500"></span>
                  High volume trader - increased scrutiny recommended
                </div>
              )}
              {wallet.lastMinuteRatio > 0.1 && (
                <div className="flex items-center gap-2 text-red-500">
                  <span className="w-1 h-1 bg-red-500"></span>
                  {((wallet.lastMinuteRatio || 0) * 100).toFixed(0)}% of trades placed within 1 minute of resolution
                </div>
              )}
              {wallet.last10MinRatio > 0.3 && (
                <div className="flex items-center gap-2 text-orange-500">
                  <span className="w-1 h-1 bg-orange-500"></span>
                  {((wallet.last10MinRatio || 0) * 100).toFixed(0)}% of trades placed within 10 minutes of resolution
                </div>
              )}
              {wallet.pValue >= 0.05 && winRate <= 60 && !wallet.isWhale && !wallet.cluster && (
                <div className="flex items-center gap-2 text-green-500">
                  <span className="w-1 h-1 bg-green-500"></span>
                  Trading pattern within normal parameters
                </div>
              )}
            </div>
          </div>

          {/* Recent Trades */}
          {wallet.recentTrades && wallet.recentTrades.length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 overflow-hidden">
              <div className="p-3 border-b border-neutral-800">
                <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Recent Trades
                  <span className="text-neutral-700 ml-2">({wallet.recentTrades.length})</span>
                </h3>
              </div>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-950 sticky top-0">
                    <tr className="text-neutral-600 text-left">
                      <th className="py-2 px-3 font-medium">Market</th>
                      <th className="py-2 px-3 font-medium text-center">Side</th>
                      <th className="py-2 px-3 font-medium text-right">Amount</th>
                      <th className="py-2 px-3 font-medium text-right">Price</th>
                      <th className="py-2 px-3 font-medium text-right">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wallet.recentTrades.map((trade, i) => (
                      <tr key={i} className="border-t border-neutral-800 hover:bg-neutral-800/30">
                        <td className="py-2 px-3">
                          {trade.marketSlug ? (
                            <a
                              href={`https://polymarket.com/event/${trade.marketSlug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="max-w-[180px] truncate text-neutral-400 hover:text-green-500 transition-colors flex items-center gap-1"
                              title={trade.market}
                            >
                              <span className="truncate">{trade.market}</span>
                              <svg className="w-3 h-3 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          ) : (
                            <div className="max-w-[180px] truncate text-neutral-400" title={trade.market}>
                              {trade.market}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                            trade.side === 'buy'
                              ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                              : 'bg-red-500/10 text-red-500 border border-red-500/20'
                          }`}>
                            {trade.side}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-neutral-400 tabular-nums">
                          ${formatNumber(trade.amount || 0)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <span className="text-neutral-500 tabular-nums">{((trade.price || 0) * 100).toFixed(0)}c</span>
                        </td>
                        <td className="py-2 px-3 text-right text-neutral-600">
                          {trade.timestamp ? new Date(trade.timestamp).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleExport = () => {
    if (filteredAndSortedWallets.length > 0) {
      exportToCSV(filteredAndSortedWallets, `polymarket-analysis-${new Date().toISOString().split('T')[0]}.csv`);
    }
  };

  const wallets = data?.wallets || [];

  const filteredAndSortedWallets = useMemo(() => {
    let result = wallets.filter(w => {
      if (filter !== 'all' && w.suspicionLevel !== filter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return w.address?.toLowerCase().includes(query) ||
               w.username?.toLowerCase().includes(query);
      }
      return true;
    });

    result.sort((a, b) => {
      let aVal = a[sortBy] ?? 0;
      let bVal = b[sortBy] ?? 0;
      if (sortOrder === 'asc') return aVal - bVal;
      return bVal - aVal;
    });

    return result;
  }, [wallets, filter, sortBy, sortOrder, searchQuery]);

  const suspiciousWallets = useMemo(() =>
    wallets.filter(w => w.suspicionLevel === 'critical' || w.suspicionLevel === 'high')
      .sort((a, b) => (a.pValue || 1) - (b.pValue || 1)),
    [wallets]
  );

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-red-500 text-xs uppercase tracking-wider mb-2">Error</div>
          <div className="text-neutral-300 text-sm mb-4">{error}</div>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-neutral-900 border border-neutral-700 hover:border-neutral-600 text-neutral-300 text-sm transition-colors"
          >
            Retry
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
    <div className="min-h-screen bg-black text-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <header className="mb-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-lg font-semibold text-neutral-100 uppercase tracking-wider">
                  Polymarket Insider Detection
                </h1>
                {summary.dataSource && (
                  <span className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                    summary.dataSource === 'live'
                      ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                      : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                  }`}>
                    {summary.dataSource === 'live' ? 'Live' : 'Demo'}
                  </span>
                )}
              </div>
              <p className="text-neutral-600 text-xs">
                Statistical analysis of on-chain trading patterns
                {lastUpdated && <span className="ml-2">| Updated {timeAgo(lastUpdated)}</span>}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="px-3 py-1.5 bg-neutral-900 border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-neutral-300 text-xs transition-colors flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 hover:border-neutral-600 text-neutral-300 text-xs transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
          <StatCard
            label="Wallets Analyzed"
            value={summary.totalWallets?.toLocaleString() || '0'}
            subtext={`${summary.totalTrades?.toLocaleString() || 0} trades`}
          />
          <StatCard
            label="Flagged Wallets"
            value={summary.flaggedWallets || 0}
            color="text-yellow-500"
            subtext={`${summary.criticalWallets || 0} critical`}
          />
          <StatCard
            label="Total Volume"
            value={`$${formatNumber(summary.totalVolume || 0)}`}
            subtext={`${summary.totalMarkets || 0} markets`}
          />
          <StatCard
            label="Suspicious Volume"
            value={`${(summary.suspiciousVolumePercent || 0).toFixed(1)}%`}
            color="text-red-500"
            subtext={`$${formatNumber(summary.suspiciousVolume || 0)}`}
          />
        </div>

        {/* Secondary Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-6">
          <StatCard
            label="Pre-Res Traders"
            value={summary.walletsWithPreResolutionTrades || 0}
            color="text-orange-500"
            subtext={`${summary.highPreResolutionWallets || 0} high-risk`}
          />
          <StatCard
            label="Whales Detected"
            value={summary.whaleCount || 0}
            color="text-blue-500"
            subtext="Large position traders"
          />
          <StatCard
            label="Wallet Clusters"
            value={summary.clusterCount || 0}
            color="text-purple-500"
            subtext="Linked wallet groups"
          />
          <StatCard
            label="Resolved Markets"
            value={summary.resolvedMarketsAnalyzed || 0}
            subtext="For outcome verification"
          />
        </div>

        {/* Secondary Grid */}
        <div className="grid lg:grid-cols-3 gap-2 mb-6">
          <DistributionChart data={wallets} />
          <div className="lg:col-span-2">
            <TopSuspiciousCard wallets={suspiciousWallets} onSelect={setSelectedWallet} />
          </div>
        </div>

        {/* Wallet Table */}
        <div className="bg-neutral-900 border border-neutral-800 overflow-hidden">
          <div className="p-4 border-b border-neutral-800 space-y-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-sm font-semibold text-neutral-200 uppercase tracking-wider">Wallet Analysis</h2>
                <p className="text-neutral-600 text-xs">{filteredAndSortedWallets.length} wallets</p>
              </div>
              <div className="w-full sm:w-64">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  onClear={() => setSearchQuery('')}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {['all', 'critical', 'high', 'medium', 'low'].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                    filter === f
                      ? 'bg-neutral-700 text-neutral-200 border border-neutral-600'
                      : 'bg-neutral-900 text-neutral-500 border border-neutral-800 hover:border-neutral-700 hover:text-neutral-400'
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
                <tr className="text-neutral-600 text-left text-xs bg-neutral-950">
                  <th className="py-3 px-4 font-medium">Wallet</th>
                  <th className="py-3 px-4 text-right font-medium cursor-pointer hover:text-neutral-400" onClick={() => handleSort('trades')}>
                    Trades {sortBy === 'trades' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-3 px-4 text-right font-medium cursor-pointer hover:text-neutral-400" onClick={() => handleSort('winRate')}>
                    Win Rate {sortBy === 'winRate' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-3 px-4 text-right font-medium cursor-pointer hover:text-neutral-400" onClick={() => handleSort('pValue')}>
                    P-Value {sortBy === 'pValue' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-3 px-4 text-right font-medium cursor-pointer hover:text-neutral-400" onClick={() => handleSort('totalPnL')}>
                    PnL {sortBy === 'totalPnL' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-3 px-4 text-right font-medium cursor-pointer hover:text-neutral-400" onClick={() => handleSort('suspicionScore')}>
                    Score {sortBy === 'suspicionScore' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="py-3 px-4 text-right font-medium">Level</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedWallets.length > 0 ? (
                  filteredAndSortedWallets.slice(0, 50).map((w, i) => (
                    <WalletRow key={w.address || i} wallet={w} onClick={setSelectedWallet} rank={i + 1} />
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-neutral-600 text-sm">
                      {searchQuery ? `No wallets found matching "${searchQuery}"` : 'No wallets found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredAndSortedWallets.length > 50 && (
            <div className="p-3 text-center text-neutral-600 text-xs border-t border-neutral-800">
              Showing 50 of {filteredAndSortedWallets.length} wallets
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-neutral-900 border border-neutral-800 p-4">
          <h3 className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-4">Detection Methodology</h3>
          <div className="grid md:grid-cols-4 gap-6 text-xs mb-6">
            <div>
              <div className="text-neutral-400 font-medium mb-1">P-Value Analysis</div>
              <p className="text-neutral-600">Probability of achieving the observed win rate by chance. Values below 0.001 indicate statistically impossible luck.</p>
            </div>
            <div>
              <div className="text-green-500 font-medium mb-1">✓ Resolved Win Rate</div>
              <p className="text-neutral-600">Accurate win rates based on actual market resolutions, not price estimates. Verified against on-chain outcomes.</p>
            </div>
            <div>
              <div className="text-orange-500 font-medium mb-1">⚡ Pre-Resolution Timing</div>
              <p className="text-neutral-600">Analyzes trade timing relative to market resolution. Trades placed minutes before resolution are highly suspicious.</p>
            </div>
            <div>
              <div className="text-cyan-500 font-medium mb-1">⛓ Cross-Market Patterns</div>
              <p className="text-neutral-600">Detects wallets winning across multiple unrelated markets - a strong indicator of insider information access.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-4 gap-6 text-xs">
            <div>
              <div className="text-blue-500 font-medium mb-1">🐋 Whale Detection</div>
              <p className="text-neutral-600">Flags large trades ($5k+ whale, $25k+ mega-whale), especially before resolution. Big bets with advance knowledge are high-risk.</p>
            </div>
            <div>
              <div className="text-purple-500 font-medium mb-1">🔗 Wallet Clustering</div>
              <p className="text-neutral-600">Traces USDC funding sources on Polygon to identify wallets controlled by the same entity. Sybil attack detection.</p>
            </div>
            <div>
              <div className="text-neutral-400 font-medium mb-1">Risk Scoring</div>
              <p className="text-neutral-600">Composite score combining all signals: p-value, timing, whale activity, cross-market wins, and cluster membership.</p>
            </div>
            <div>
              <div className="text-neutral-400 font-medium mb-1">Data Sources</div>
              <p className="text-neutral-600">Live data from Polymarket API, Gamma API for resolutions, and Polygon RPC for on-chain funding traces.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-6 text-center text-neutral-700 text-xs">
          <p>Data sourced from Polymarket public API. Analysis is probabilistic, not definitive proof of insider trading.</p>
        </footer>
      </div>

      {selectedWallet && (
        <WalletModal wallet={selectedWallet} onClose={() => setSelectedWallet(null)} />
      )}
    </div>
  );
}
