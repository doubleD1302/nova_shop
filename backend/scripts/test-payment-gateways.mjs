import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import {
  buildVnpayUrl,
  createMomoRequest,
  createZalopayPayload,
  queryGatewayTransaction,
  queryMomoTransaction,
  queryVnpayTransaction,
  queryZalopayTransaction,
  refundMomoPayment,
  refundPaymentGateway,
  refundVnpayPayment,
  refundZalopayPayment,
  requestMomoPayment,
  requestZalopayPayment,
  verifyMomoIpn,
  verifyVnpayIpn,
  verifyZalopayCallback,
} from '../src/services/payment-gateways.js'

const hmac = (algorithm, key, value) => crypto.createHmac(algorithm, key).update(value).digest('hex')

const vnConfig = {
  tmnCode: 'TESTSHOP',
  hashSecret: 'test_hash_secret_1234567890',
  paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl: 'https://example.test/payment-return',
  refundUrl: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
}

const momoConfig = {
  partnerCode: 'TESTSHOP',
  accessKey: 'test_access_key',
  secretKey: 'test_momo_secret_123456',
  apiUrl: 'https://test-payment.momo.vn/v2/gateway/api/create',
  redirectUrl: 'https://example.test/payment-return',
  ipnUrl: 'https://example.test/api/v1/payments/momo/ipn',
  refundUrl: 'https://test-payment.momo.vn/v2/gateway/api/refund',
  queryUrl: 'https://test-payment.momo.vn/v2/gateway/api/query',
}

const zalopayConfig = {
  appId: '2553',
  key1: 'test_zalopay_key1_123456',
  key2: 'test_zalopay_key2_654321',
  endpoint: 'https://sb-openapi.zalopay.vn/v2/create',
  redirectUrl: 'https://example.test/payment-return',
  callbackUrl: 'https://example.test/api/v1/payments/zalopay/ipn',
  refundEndpoint: 'https://sb-openapi.zalopay.vn/v2/refund',
  queryEndpoint: 'https://sb-openapi.zalopay.vn/v2/query',
}

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

test('ZaloPay tạo yêu cầu thanh toán chuẩn và chỉ nhận callback đúng MAC', async () => {
  const payload = createZalopayPayload({ amount: 150000, reference: 'SN999ZALO', config: zalopayConfig, now: new Date('2026-11-11T03:00:00Z') })
  assert.equal(payload.app_id, 2553)
  assert.equal(payload.amount, 150000)
  assert.match(payload.app_trans_id, /_SN999ZALO$/)
  assert.equal(payload.mac.length, 64)

  const fetchMock = async (url, opts) => {
    assert.equal(url, zalopayConfig.endpoint)
    return {
      status: 200,
      json: async () => ({
        return_code: 1,
        return_message: 'Giao dịch thành công',
        order_url: 'https://qcgateway.zalopay.vn/openinapp.html?token=demo123',
      }),
    }
  }

  const payUrl = await requestZalopayPayment({ amount: 150000, reference: 'SN999ZALO', config: zalopayConfig, fetchImpl: fetchMock })
  assert.match(payUrl, /^https:\/\/qcgateway\.zalopay\.vn/)

  // Callback testing
  const callbackData = JSON.stringify({
    app_id: 2553,
    app_trans_id: '261111_SN999ZALO',
    app_time: 1793934000000,
    app_user: 'ShopNova',
    amount: 150000,
    embed_data: '{}',
    item: '[]',
    zp_trans_id: 99887766,
    server_time: 1793934001000,
  })
  const callbackMac = hmac('sha256', zalopayConfig.key2, callbackData)

  const verified = verifyZalopayCallback({ data: callbackData, mac: callbackMac, type: 1 }, zalopayConfig)
  assert.deepEqual(verified, {
    provider: 'zalopay',
    reference: 'SN999ZALO',
    amount: 150000,
    transactionId: '99887766',
    success: true,
    resultCode: '1',
  })

  // Sai MAC
  assert.equal(verifyZalopayCallback({ data: callbackData, mac: 'wrong_mac', type: 1 }, zalopayConfig), null)
})

test('Automated Refunds: VNPay, MoMo và ZaloPay ký và gửi API hoàn tiền', async () => {
  // 1. VNPay Refund
  const vnpayFetchMock = async (url, opts) => {
    const body = JSON.parse(opts.body)
    assert.equal(body.vnp_Command, 'refund')
    assert.equal(body.vnp_Amount, '12000000')
    assert.equal(body.vnp_TmnCode, vnConfig.tmnCode)
    return {
      status: 200,
      json: async () => ({
        vnp_ResponseCode: '00',
        vnp_ResponseId: 'REF_VNP_001',
        vnp_Message: 'Refund success',
      }),
    }
  }

  const vnpRefund = await refundVnpayPayment({
    amount: 120000,
    reference: 'SN123ABC',
    transactionId: '987654321',
    reason: 'Khách hàng hủy đơn',
    config: vnConfig,
    fetchImpl: vnpayFetchMock,
  })
  assert.equal(vnpRefund.success, true)
  assert.equal(vnpRefund.refundTransactionId, 'REF_VNP_001')

  // 2. MoMo Refund
  const momoFetchMock = async (url, opts) => {
    const body = JSON.parse(opts.body)
    assert.equal(body.partnerCode, momoConfig.partnerCode)
    assert.equal(body.amount, 120000)
    assert.equal(body.transId, 123456789)
    assert.equal(body.signature.length, 64)
    return {
      status: 200,
      json: async () => ({
        resultCode: 0,
        transId: 888999,
        message: 'Thành công',
      }),
    }
  }

  const momoRefund = await refundMomoPayment({
    amount: 120000,
    reference: 'SN123ABC',
    transactionId: '123456789',
    reason: 'Shop hết hàng',
    config: momoConfig,
    fetchImpl: momoFetchMock,
  })
  assert.equal(momoRefund.success, true)
  assert.equal(momoRefund.refundTransactionId, '888999')

  // 3. ZaloPay Refund
  const zaloFetchMock = async (url, opts) => {
    const body = JSON.parse(opts.body)
    assert.equal(body.app_id, 2553)
    assert.equal(body.amount, 150000)
    assert.equal(body.zp_trans_id, '99887766')
    assert.equal(body.mac.length, 64)
    return {
      status: 200,
      json: async () => ({
        return_code: 1,
        refund_id: 'ZALO_REF_123',
        return_message: 'Hoàn tiền thành công',
      }),
    }
  }

  const zaloRefund = await refundZalopayPayment({
    amount: 150000,
    reference: 'SN999ZALO',
    transactionId: '99887766',
    reason: 'Đổi trả hàng thành công',
    config: zalopayConfig,
    fetchImpl: zaloFetchMock,
  })
  assert.equal(zaloRefund.success, true)
  assert.equal(zaloRefund.refundTransactionId, 'ZALO_REF_123')

  // 4. Dispatcher refundPaymentGateway
  const unified = await refundPaymentGateway({
    provider: 'vnpay',
    reference: 'SN123ABC',
    transactionId: '987654321',
    amount: 120000,
    config: { vnpay: vnConfig },
    fetchImpl: vnpayFetchMock,
  })
  assert.equal(unified.success, true)
})

test('Reconciliation: Query trạng thái giao dịch VNPay, MoMo, ZaloPay phát hiện đơn treo hoặc sai lệch', async () => {
  // 1. VNPay querydr
  const vnpFetch = async () => ({
    status: 200,
    json: async () => ({
      vnp_ResponseCode: '00',
      vnp_TransactionStatus: '00',
      vnp_Amount: '12000000',
      vnp_TransactionNo: '999888',
    }),
  })
  const vnpQuery = await queryVnpayTransaction({ reference: 'SN123ABC', config: vnConfig, fetchImpl: vnpFetch })
  assert.equal(vnpQuery.status, 'paid')
  assert.equal(vnpQuery.amount, 120000)

  // 2. MoMo query
  const momoFetch = async () => ({
    status: 200,
    json: async () => ({
      resultCode: 0,
      amount: 120000,
      transId: 777666,
    }),
  })
  const momoQuery = await queryMomoTransaction({ reference: 'SN123ABC', config: momoConfig, fetchImpl: momoFetch })
  assert.equal(momoQuery.status, 'paid')
  assert.equal(momoQuery.amount, 120000)

  // 3. ZaloPay query
  const zaloFetch = async () => ({
    status: 200,
    json: async () => ({
      return_code: 1,
      amount: 150000,
      zp_trans_id: 555444,
      is_processing: false,
    }),
  })
  const zaloQuery = await queryZalopayTransaction({ reference: 'SN999ZALO', config: zalopayConfig, fetchImpl: zaloFetch })
  assert.equal(zaloQuery.status, 'paid')
  assert.equal(zaloQuery.amount, 150000)

  // 4. Unified queryGatewayTransaction
  const unifiedRes = await queryGatewayTransaction({
    provider: 'zalopay',
    reference: 'SN999ZALO',
    config: { zalopay: zalopayConfig },
    fetchImpl: zaloFetch,
  })
  assert.equal(unifiedRes.status, 'paid')
  assert.equal(unifiedRes.transactionId, '555444')
})
