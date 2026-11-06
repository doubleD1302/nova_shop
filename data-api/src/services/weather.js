import { env } from '../config/env.js'
import { getShippingRegion } from '../utils/shipping.js'

// Điểm đại diện vùng để đánh giá rủi ro thời tiết; không đại diện thời tiết tại từng địa chỉ.
const CENTERS = Object.freeze({ north: [21.0285, 105.8542], central: [16.0471, 108.2068], south: [10.8231, 106.6297] })
const cache = new Map()

export async function getWeatherRisk(province, fetchImpl = fetch) {
  const region = getShippingRegion(province)
  if (!env.weatherApiKey || !region) return 'normal'
  const cached = cache.get(region)
  if (cached && cached.until > Date.now()) return cached.risk
  const [latitude, longitude] = CENTERS[region]
  const url = new URL('https://customer-api.open-meteo.com/v1/forecast')
  url.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude),
    current: 'precipitation,wind_speed_10m', apikey: env.weatherApiKey }).toString()
  try {
    const response = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(800) })
    if (!response.ok) return 'normal'
    const current = (await response.json()).current
    const rain = Number(current?.precipitation)
    const wind = Number(current?.wind_speed_10m)
    if (!Number.isFinite(rain) || !Number.isFinite(wind) || rain < 0 || wind < 0) return 'normal'
    const risk = rain >= 20 || wind >= 50 ? 'severe' : rain >= 5 || wind >= 30 ? 'rain' : 'normal'
    cache.set(region, { risk, until: Date.now() + 10 * 60 * 1000 })
    return risk
  } catch { return 'normal' }
}
