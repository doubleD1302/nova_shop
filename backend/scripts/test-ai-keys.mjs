import assert from 'node:assert/strict'

Object.assign(process.env, {
  NODE_ENV: 'test', DOTENV_CONFIG_PATH: 'missing-ai-keys-test.env',
  DATA_API_KEY: 'test-service-key', JWT_SECRET: 'test-secret-at-least-32-characters-long',
  GEMINI_API_KEYS: 'first-key,second-key', GEMINI_API_KEY: '',
})
const { generateGeminiShoppingAdvice } = await import('../src/services/gemini.service.js')
const calls = []
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, options) => {
  calls.push({ url, headers: options.headers, body: options.body })
  if (calls.length === 1) return new Response('{}', { status: 429 })
  return Response.json({ candidates: [{ content: { parts: [{ text: 'Xin chào từ Gemini' }] } }] })
}
try {
  const result = await generateGeminiShoppingAdvice({ query: 'Tìm áo', conversationHistory: [{ userQuery: 'Tôi cần áo', aiReply: 'Bạn cần màu gì?' }] })
  assert.equal(result.reply, 'Xin chào từ Gemini')
  assert.equal(calls.length, 2)
  assert.equal(calls[0].headers['x-goog-api-key'], 'first-key')
  assert.equal(calls[1].headers['x-goog-api-key'], 'second-key')
  assert.equal(calls[0].body, calls[1].body)
  assert.ok(!calls.some((call) => call.url.includes('key=')))
  console.log('PASS: chuyển khóa sau 429, giữ nguyên ngữ cảnh, không đưa khóa vào URL (Gemini giả lập).')
} finally {
  globalThis.fetch = originalFetch
}
