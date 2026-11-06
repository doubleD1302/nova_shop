import test from 'node:test'
import assert from 'node:assert/strict'

process.env.DB_USER = 'shopnova_test'
process.env.DB_PASSWORD = 'isolated_test_password_123'
process.env.DATA_API_KEY = 'isolated_test_service_key_123'
process.env.WEATHER_API_KEY = 'isolated_test_weather_key_123'
process.env.NODE_ENV = 'test'
const { getWeatherRisk } = await import('../src/services/weather.js')

test('phụ phí thời tiết chỉ dùng dữ liệu dự báo hợp lệ từ endpoint cố định', async () => {
  const fetchRain = async (url) => {
    assert.equal(url.hostname, 'customer-api.open-meteo.com')
    assert.equal(url.searchParams.get('current'), 'precipitation,wind_speed_10m')
    return { ok: true, json: async () => ({ current: { precipitation: 10, wind_speed_10m: 5 } }) }
  }
  assert.equal(await getWeatherRisk('Hà Nội', fetchRain), 'rain')
  assert.equal(await getWeatherRisk('Đà Nẵng', async () => ({ ok: true,
    json: async () => ({ current: { precipitation: 1, wind_speed_10m: 60 } }) })), 'severe')
  assert.equal(await getWeatherRisk('TP. Hồ Chí Minh', async () => ({ ok: true,
    json: async () => ({ current: { precipitation: 'bad', wind_speed_10m: 0 } }) })), 'normal')
  assert.equal(await getWeatherRisk('Không rõ', fetchRain), 'normal')
})
