const IS_REDIS_ENABLED = !!process.env.REDIS_URL
const IS_DEV = process.env.NODE_ENV === 'development'

const globalForCache = globalThis as unknown as {
  memoryCache: Map<string, { data: unknown, expires: number }> | undefined
}

const memoryCache = globalForCache.memoryCache ?? new Map<string, { data: unknown, expires: number }>()

if (process.env.NODE_ENV !== 'production') {
  globalForCache.memoryCache = memoryCache
}

export async function getCache<T>(key: string): Promise<T | null> {
  if (IS_DEV && !IS_REDIS_ENABLED) return null // Disable cache in dev unless Redis is used
  if (IS_REDIS_ENABLED) {
    // Upstash integration goes here
    return null
  } else {
    const item = memoryCache.get(key)
    if (!item) return null
    if (item.expires < Date.now()) {
      memoryCache.delete(key)
      return null
    }
    return item.data as T
  }
}

export async function setCache(key: string, data: unknown, ttlSeconds: number) {
  if (IS_DEV && !IS_REDIS_ENABLED) return // Don't set cache in dev unless Redis is used
  if (IS_REDIS_ENABLED) {
    // Upstash integration
  } else {
    memoryCache.set(key, {
      data,
      expires: Date.now() + (ttlSeconds * 1000)
    })
  }
}

export async function invalidateCache(key: string) {
  if (IS_REDIS_ENABLED) {
    // Upstash integration
  } else {
    memoryCache.delete(key)
  }
}

export async function invalidateDashboardCache() {
  if (IS_REDIS_ENABLED) {
    // Redis logic
  } else {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.startsWith('dashboard:')) {
        memoryCache.delete(key)
      }
    }
  }
}
