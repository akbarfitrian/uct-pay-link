/**
 * Cryptocurrency configuration with CoinGecko API mappings
 * UCT dan USDU menggunakan harga default 1 USD tanpa logo
 */

export interface Coin {
  id: string
  symbol: string
  name: string
  decimals: number
  coingeckoId: string | null
  logo: string | null
  defaultPrice: number | null
}

export const COINS: Record<string, Coin> = {
  UCT: {
    id: 'UCT',
    symbol: 'UCT',
    name: 'Unicity Token',
    decimals: 6,
    coingeckoId: null,
    logo: null,
    defaultPrice: 1,
  },
  USDU: {
    id: 'USDU',
    symbol: 'USDU',
    name: 'USD Unicity',
    decimals: 6,
    coingeckoId: null,
    logo: null,
    defaultPrice: 1,
  },
  USDC: {
    id: 'USDC',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    coingeckoId: 'usd-coin',
    logo: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png',
    defaultPrice: null,
  },
  SOL: {
    id: 'SOL',
    symbol: 'SOL',
    name: 'Solana',
    decimals: 9,
    coingeckoId: 'solana',
    logo: 'https://assets.coingecko.com/coins/images/4128/standard/solana.png',
    defaultPrice: null,
  },
  ETH: {
    id: 'ETH',
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    coingeckoId: 'ethereum',
    logo: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png',
    defaultPrice: null,
  },
  BTC: {
    id: 'BTC',
    symbol: 'BTC',
    name: 'Bitcoin',
    decimals: 8,
    coingeckoId: 'bitcoin',
    logo: 'https://assets.coingecko.com/coins/images/1/standard/bitcoin.png',
    defaultPrice: null,
  },
}

export const SUPPORTED_COINS = Object.values(COINS)
export const COIN_IDS = Object.keys(COINS)
