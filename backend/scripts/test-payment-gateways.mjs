import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { buildVnpayUrl, createMomoRequest, requestMomoPayment, verifyMomoIpn, verifyVnpayIpn } from '../src/services/payment-gateways.js'

const hmac = (algorithm, key, value) => crypto.createHmac(algorithm, key).update(value).digest('hex')
const vnConfig = { tmnCode: 'TESTSHOP', hashSecret: 'test_hash_secret_1234567890',
  paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl: 'https://example.test/payment-return' }
const momoConfig = { partnerCode: 'TESTSHOP', accessKey: 'test_access_key', secretKey: 'test_momo_secret_123456',
  apiUrl: 'https://test-payment.momo.vn/v2/gateway/api/create',
  redirectUrl: 'https://example.test/payment-return', ipnUrl: 'https://example.test/api/v1/payments/momo/ipn' }

test('VNPay ký URL và chỉ chấp nhận IPN đúng chữ ký, mã đối tác và số tiền', () => {
  const url = new URL(buildVnpayUrl({ amount: 120000, reference: 'SN123ABC',
    createdAt: '2026-11-06T03:00:00Z', ipAddress: '127.0.0.1', config: vnConfig }))
  assert.equal(url.searchParams.get('vnp_Amount'), '12000000')
  assert.equal(url.searchParams.get('vnp_CreateDate'), '20261106100000')
  const values = Object.fromEntries(url.searchParams)
  delete values.vnp_SecureHash
  Object.assign(values, { vnp_ResponseCode: '00', vnp_TransactionStatus: '00', vnp_TransactionNo: '987654321' })
  const signedData = new URLSearchParams(Object.entries(values).sort(([a], [b]) => a.localeCompare(b, 'en'))).toString()
  values.vnp_SecureHash = hmac('sha512', vnConfig.hashSecret, signedData)
  assert.deepEqual(verifyVnpayIpn(values, vnConfig), { provider: 'vnpay', reference: 'SN123ABC',
    amount: 120000, transactionId: '987654321', success: true, resultCode: '00:00' })
  assert.equal(verifyVnpayIpn({ ...values, vnp_Amount: '12000100' }, vnConfig), null)
  assert.equal(verifyVnpayIpn({ ...values, vnp_TmnCode: 'OTHER' }, vnConfig), null)
})

test('MoMo ký yêu cầu và từ chối IPN sai chữ ký hoặc số tiền', () => {
  const request = createMomoRequest({ amount: 120000, reference: 'SN123ABC', config: momoConfig })
  assert.equal(request.requestType, 'captureWallet')
  assert.equal(request.signature.length, 64)
  const ipn = { amount: 120000, extraData: '', message: 'Successful.', orderId: 'SN123ABC',
    orderInfo: 'Thanh toan don SN123ABC', orderType: 'momo_wallet', partnerCode: 'TESTSHOP',
    payType: 'qr', requestId: 'SN123ABC', responseTime: 1793934000000, resultCode: 0, transId: 123456789 }
  const fields = { accessKey: momoConfig.accessKey, ...ipn }
  ipn.signature = hmac('sha256', momoConfig.secretKey,
    Object.entries(fields).map(([key, value]) => `${key}=${value}`).join('&'))
  assert.equal(verifyMomoIpn(ipn, momoConfig)?.success, true)
  assert.equal(verifyMomoIpn({ ...ipn, amount: 120001 }, momoConfig), null)
  assert.equal(verifyMomoIpn({ ...ipn, signature: '0'.repeat(64) }, momoConfig), null)
})

test('MoMo chỉ trả liên kết HTTPS của MoMo khi phản hồi được ký', async () => {
  const body = { partnerCode: 'TESTSHOP', orderId: 'SN123ABC', requestId: 'SN123ABC', amount: 120000,
    message: 'Successful.', payUrl: 'https://test-payment.momo.vn/v2/gateway/pay?token=demo',
    responseTime: 1793934000000, resultCode: 0 }
  const fields = { accessKey: momoConfig.accessKey, amount: body.amount, message: body.message,
    orderId: body.orderId, partnerCode: body.partnerCode, payUrl: body.payUrl,
    requestId: body.requestId, responseTime: body.responseTime, resultCode: body.resultCode }
  body.signature = hmac('sha256', momoConfig.secretKey,
    Object.entries(fields).map(([key, value]) => `${key}=${value}`).join('&'))
  const fetchImpl = async () => ({ status: 200, json: async () => body })
  assert.match(await requestMomoPayment({ amount: 120000, reference: 'SN123ABC', config: momoConfig, fetchImpl }), /^https:\/\/test-payment\.momo\.vn/)
  await assert.rejects(requestMomoPayment({ amount: 120000, reference: 'SN123ABC', config: momoConfig,
    fetchImpl: async () => ({ status: 200, json: async () => ({ ...body, payUrl: 'https://evil.example/pay' }) }) }))
})
