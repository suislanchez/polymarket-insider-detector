# Polymarket Insider Detector

A statistical analysis tool for detecting potential insider trading patterns on [Polymarket](https://polymarket.com), the largest prediction market platform.

**Live Demo:** [polymarket-insider-detector.vercel.app](https://polymarket-insider-detector.vercel.app/)

## Overview

This tool analyzes on-chain trading data to identify wallets exhibiting statistically anomalous trading patterns that may indicate insider information access. It combines multiple detection methodologies into a comprehensive risk scoring system.

## Detection Methodology

### Statistical Analysis
- **Binomial P-Value Testing**: Calculates the probability of achieving observed win rates by chance. Values below 0.001 indicate statistically improbable success rates.
- **Win Rate Analysis**: Flags wallets with win rates exceeding normal distribution expectations (>80% considered highly suspicious).

### Timing Analysis
- **Pre-Resolution Trading**: Identifies trades placed shortly before market resolution—a key indicator of advance knowledge.
- **Last-Minute Ratio**: Tracks percentage of trades placed within 1-10 minutes of resolution.
- **Average Time Before Resolution**: Measures typical trade timing relative to market outcomes.

### Whale Detection
- **Whale Classification**: Identifies large position traders ($5k+ trades).
- **Mega Whale Detection**: Flags extremely large trades ($25k+).
- **Pre-Resolution Whale Activity**: Particularly suspicious pattern of large bets before resolution.

### Wallet Clustering
- **Funding Source Analysis**: Traces USDC funding on Polygon to identify wallets controlled by the same entity.
- **Sybil Detection**: Groups wallets with shared funding sources that may be coordinating trades.

### Cross-Market Patterns
- **Multi-Market Success**: Detects wallets winning across multiple unrelated markets—strong indicator of broad insider access.
- **Cross-Market Win Rate**: Aggregates performance across diverse prediction categories.

## Risk Scoring

Wallets receive a composite suspicion score (0-10) based on:
- P-value anomaly level
- Win rate deviation
- Pre-resolution timing patterns
- Whale activity indicators
- Cluster membership
- Cross-market success

Risk levels: **Low** | **Medium** | **High** | **Critical**

## Tech Stack

- **Framework**: Next.js 14
- **Styling**: Tailwind CSS
- **Statistics**: jstat for binomial probability calculations
- **Charts**: Recharts for data visualization
- **Data Sources**:
  - Polymarket API (trading data)
  - Gamma API (market resolutions)
  - Polygon RPC (on-chain funding traces)

## Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Features

- Real-time wallet analysis dashboard
- Sortable/filterable wallet table
- Detailed wallet modal with trading history
- CSV export functionality
- Risk distribution visualization
- Search by wallet address or username

## Disclaimer

This tool provides statistical analysis for research and educational purposes. Flagged patterns are probabilistic indicators, not definitive proof of insider trading. Always conduct thorough investigation before drawing conclusions.

## License

MIT
