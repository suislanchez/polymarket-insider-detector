// Polygon RPC utilities for on-chain data
const RPC_ENDPOINTS = [
  'https://polygon.drpc.org',
  'https://polygon-bor-rpc.publicnode.com',
  'https://1rpc.io/matic'
];

let currentRpcIndex = 0;

async function rpcCall(method, params, retries = 2) {
  for (let i = 0; i < retries; i++) {
    const rpc = RPC_ENDPOINTS[(currentRpcIndex + i) % RPC_ENDPOINTS.length];
    try {
      const res = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 })
      });
      const data = await res.json();
      if (data.result !== undefined) return data.result;
      if (data.error) throw new Error(data.error.message);
    } catch (e) {
      console.error(`RPC error (${rpc}):`, e.message);
      currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
    }
  }
  return null;
}

// Get current block number
export async function getCurrentBlock() {
  const result = await rpcCall('eth_blockNumber', []);
  return result ? parseInt(result, 16) : null;
}

// Get block timestamp
export async function getBlockTimestamp(blockNumber) {
  const hexBlock = '0x' + blockNumber.toString(16);
  const block = await rpcCall('eth_getBlockByNumber', [hexBlock, false]);
  return block ? parseInt(block.timestamp, 16) * 1000 : null;
}

// Get transaction details
export async function getTransaction(txHash) {
  return await rpcCall('eth_getTransactionByHash', [txHash]);
}

// Polymarket CTF Exchange contract
const CTF_EXCHANGE = '0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E';
const ORDER_FILLED_TOPIC = '0xd0a08e8c493f9c94f29311604c9de1b4e8c8d4c06bd0c789af57f2d65bfec0f6';

// Get recent OrderFilled events
export async function getRecentTrades(blockRange = 1000) {
  const currentBlock = await getCurrentBlock();
  if (!currentBlock) return [];

  const fromBlock = '0x' + (currentBlock - blockRange).toString(16);

  const logs = await rpcCall('eth_getLogs', [{
    address: CTF_EXCHANGE,
    topics: [ORDER_FILLED_TOPIC],
    fromBlock,
    toBlock: 'latest'
  }]);

  if (!logs) return [];

  // Get unique blocks for timestamps
  const blockNumbers = [...new Set(logs.map(l => parseInt(l.blockNumber, 16)))];
  const blockTimestamps = {};

  // Batch fetch block timestamps (limit to avoid rate limits)
  for (const blockNum of blockNumbers.slice(0, 100)) {
    blockTimestamps[blockNum] = await getBlockTimestamp(blockNum);
  }

  return logs.map(log => ({
    txHash: log.transactionHash,
    blockNumber: parseInt(log.blockNumber, 16),
    timestamp: blockTimestamps[parseInt(log.blockNumber, 16)] || null,
    conditionId: log.topics[1] || null
  }));
}

// USDC contract for tracking funding
const USDC = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

// Get USDC funding sources for a wallet
export async function getWalletFundingSources(walletAddress, blockRange = 50000) {
  const currentBlock = await getCurrentBlock();
  if (!currentBlock) return [];

  const paddedWallet = '0x000000000000000000000000' + walletAddress.slice(2).toLowerCase();

  const logs = await rpcCall('eth_getLogs', [{
    address: USDC,
    topics: [TRANSFER_TOPIC, null, paddedWallet],
    fromBlock: '0x' + (currentBlock - blockRange).toString(16),
    toBlock: 'latest'
  }]);

  if (!logs) return [];

  const sources = {};
  for (const log of logs) {
    const from = '0x' + log.topics[1].slice(26);
    const amount = parseInt(log.data, 16) / 1e6; // USDC has 6 decimals
    sources[from] = (sources[from] || 0) + amount;
  }

  return Object.entries(sources)
    .map(([address, amount]) => ({ address, amount }))
    .sort((a, b) => b.amount - a.amount);
}
