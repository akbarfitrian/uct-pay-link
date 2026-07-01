/**
 * CoinGecko API Service untuk fetch harga cryptocurrency realtime
 * Dengan caching untuk menghindari rate limiting
 */

import { COINS } from '../config/coins'

interface PriceCache {
  prices: Record<string, number>
  timestamp: number
}

const CACHE_DURATION = 60000 // 1 menit
let priceCache: PriceCache | null = null

interface CoingeckoResponse {
  [key: string]: {
    usd: number
  }
}

export async function getCoinPrice(coinId: string): Promise<number> {
  const coin = COINS[coinId]
  if (!coin) throw new Error(`Unknown coin: ${coinId}`)

  // Gunakan harga default jika tersedia (UCT, USDU)
  if (coin.defaultPrice !== null) {
    return coin.defaultPrice
  }

  // Cek cache terlebih dahulu
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_DURATION) {
    if (priceCache.prices[coinId] !== undefined) {
      return priceCache.prices[coinId]
    }
  }

  // Fetch dari CoinGecko jika belum di-cache atau cache expired
  return fetchFromCoingecko(coinId)
}

export async function getAllPrices(
  coinIds: string[]
): Promise<Record<string, number>> {
  // Filter coins yang perlu di-fetch dari API (skip yang punya defaultPrice)
  const coinsToFetch = coinIds.filter((id) => {
    const coin = COINS[id]
    return coin && coin.defaultPrice === null
  })

  // Tambahkan default prices
  const result: Record<string, number> = {}
  for (const id of coinIds) {
    const coin = COINS[id]
    if (coin?.defaultPrice !== null) {
      result[id] = coin!.defaultPrice!
    }
  }

  // Cek cache untuk coins yang perlu fetch
  if (
    priceCache &&
    Date.now() - priceCache.timestamp < CACHE_DURATION
  ) {
    const cachedPrices = coinsToFetch.filter((id) => {
      if (priceCache!.prices[id] !== undefined) {
        result[id] = priceCache!.prices[id]
        return false
      }
      return true
    })
    if (cachedPrices.length === 0) return result
  }

  // Fetch dari CoinGecko
  if (coinsToFetch.length > 0) {
    const fetchedPrices = await fetchMultipleFromCoingecko(coinsToFetch)
    Object.assign(result, fetchedPrices)
  }

  return result
}

async function fetchFromCoingecko(coinId: string): Promise<number> {
  const coin = COINS[coinId]
  if (!coin?.coingeckoId) {
    throw new Error(`No CoinGecko ID for coin: ${coinId}`)
  }

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coin.coingeckoId}&vs_currencies=usd&precision=8`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`)
    }

    const data: CoingeckoResponse = await response.json()
    const price = data[coin.coingeckoId]?.usd

    if (price === undefined) {
      throw new Error(`No price data for ${coinId}`)
    }

    // Update cache
    if (!priceCache) {
      priceCache = { prices: {}, timestamp: Date.now() }
    }
    priceCache.prices[coinId] = price
    priceCache.timestamp = Date.now()

    return price
  } catch (error) {
    console.error(`Failed to fetch price for ${coinId}:`, error)
    throw error
  }
}

async function fetchMultipleFromCoingecko(
  coinIds: string[]
): Promise<Record<string, number>> {
  if (coinIds.length === 0) return {}

  try {
    const coingeckoIds = coinIds
      .map((id) => COINS[id]?.coingeckoId)
      .filter(Boolean)
      .join(',')

    if (!coingeckoIds) {
      return {}
    }

    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoIds}&vs_currencies=usd&precision=8`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`)
    }

    const data: CoingeckoResponse = await response.json()
    const result: Record<string, number> = {}

    for (const coinId of coinIds) {
      const coin = COINS[coinId]
      if (coin?.coingeckoId) {
        const price = data[coin.coingeckoId]?.usd
        if (price !== undefined) {
          result[coinId] = price
        }
      }
    }

    // Update cache
    if (!priceCache) {
      priceCache = { prices: {}, timestamp: Date.now() }
    }
    Object.assign(priceCache.prices, result)
    priceCache.timestamp = Date.now()

    return result
  } catch (error) {
    console.error('Failed to fetch prices from CoinGecko:', error)
    throw error
  }
}

// Invalidate cache manually jika diperlukan
export function invalidatePriceCache() {
  priceCache = null
}
