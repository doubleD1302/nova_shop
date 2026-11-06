import crypto from 'node:crypto'

function equalsHex(actual, expected) {
  if (typeof actual !== 'string' || !/^[0-9a-f]+$/i.test(actual) || actual.length !== expected.length) return false
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'))
}

function vnpayData(params) {
  const pairs = Object.entries(params).filter(([key, value]) =>
    key.startsWith('vnp_') && !['vnp_SecureHash', 'vnp_SecureHashType'].includes(key) && typeof value === 'string')
  pairs.sort(([a], [b]) => a.localeCompare(b, 'en'))
  return new URLSearchParams(pairs).toString()
}

function vnpayDate(date) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23' }).formatToParts(date)
  const get = (type) => parts.find((part) => part.type === type).value
  return `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}${get('second')}`
}

export function buildVnpayUrl({ amount, reference, createdAt, ipAddress, config }) {
  const params = {
    vnp_Amount: String(amount * 100), vnp_Command: 'pay', vnp_CreateDate: vnpayDate(new Date(createdAt)),
    vnp_CurrCode: 'VND', vnp_ExpireDate: vnpayDate(new Date(new Date(createdAt).getTime() + 15 * 60000)),
    vnp_IpAddr: ipAddress || '127.0.0.1', vnp_Locale: 'vn', vnp_OrderInfo: `Thanh toan don ${reference}`,
    vnp_OrderType: 'other', vnp_ReturnUrl: config.returnUrl, vnp_TmnCode: config.tmnCode,
    vnp_TxnRef: reference, vnp_Version: '2.1.0',
  }
  const data = vnpayData(params)
  const hash = crypto.createHmac('sha512', config.hashSecret).update(data).digest('hex')
  return `${config.paymentUrl}?${data}&vnp_SecureHash=${hash}`
}

export function verifyVnpayIpn(query, config) {
  if (!query || Object.values(query).some((value) => typeof value !== 'string') ||
      query.vnp_TmnCode !== config.tmnCode || !/^[A-Za-z0-9_-]{1,64}$/.test(query.vnp_TxnRef || '') ||
      !/^[1-9]\d*$/.test(query.vnp_Amount || '') || !/^\d{2}$/.test(query.vnp_ResponseCode || '') ||
      !/^\d{2}$/.test(query.vnp_TransactionStatus || '') || !/^\d{1,20}$/.test(query.vnp_TransactionNo || '')) return null
  const expected = crypto.createHmac('sha512', config.hashSecret).update(vnpayData(query)).digest('hex')
  if (!equalsHex(query.vnp_SecureHash, expected)) return null
  const cents = Number(query.vnp_Amount)
  if (!Number.isSafeInteger(cents) || cents % 100 !== 0) return null
  return { provider: 'vnpay', reference: query.vnp_TxnRef, amount: cents / 100,
    transactionId: query.vnp_TransactionNo,
    success: query.vnp_ResponseCode === '00' && query.vnp_TransactionStatus === '00',
    resultCode: `${query.vnp_ResponseCode}:${query.vnp_TransactionStatus}` }
}

function momoSignature(fields, secretKey) {
  return crypto.createHmac('sha256', secretKey).update(Object.entries(fields).map(([key, value]) => `${key}=${value}`).join('&')).digest('hex')
}

export function createMomoRequest({ amount, reference, config }) {
  const fields = {
    accessKey: config.accessKey, amount: String(amount), extraData: '', ipnUrl: config.ipnUrl,
    orderId: reference, orderInfo: `Thanh toan don ${reference}`, partnerCode: config.partnerCode,
    redirectUrl: config.redirectUrl, requestId: reference, requestType: 'captureWallet',
  }
  const { accessKey, ...body } = fields
  return { ...body, lang: 'vi', signature: momoSignature(fields, config.secretKey) }
}

export function verifyMomoIpn(body, config) {
  if (!body || body.partnerCode !== config.partnerCode ||
      !/^[A-Za-z0-9_-]{1,64}$/.test(body.orderId || '') || body.requestId !== body.orderId ||
      !Number.isSafeInteger(body.amount) || body.amount < 1000 ||
      !Number.isSafeInteger(body.resultCode) || !Number.isSafeInteger(body.responseTime) ||
      !/^[0-9]+$/.test(String(body.transId || ''))) return null
  const fields = {
    accessKey: config.accessKey, amount: body.amount, extraData: body.extraData,
    message: body.message, orderId: body.orderId, orderInfo: body.orderInfo,
    orderType: body.orderType, partnerCode: body.partnerCode, payType: body.payType,
    requestId: body.requestId, responseTime: body.responseTime,
    resultCode: body.resultCode, transId: body.transId,
  }
  if (Object.values(fields).some((value) => value === undefined || value === null)) return null
  if (!equalsHex(body.signature, momoSignature(fields, config.secretKey))) return null
  return { provider: 'momo', reference: body.orderId, amount: body.amount,
    transactionId: String(body.transId), success: body.resultCode === 0, resultCode: String(body.resultCode) }
}

export async function requestMomoPayment({ amount, reference, config, fetchImpl = fetch }) {
  const response = await fetchImpl(config.apiUrl, { method: 'POST', redirect: 'manual',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(createMomoRequest({ amount, reference, config })),
    signal: AbortSignal.timeout(35000) })
  if (![200, 201].includes(response.status)) throw new Error('MOMO_UNAVAILABLE')
  const body = await response.json()
  if (body.resultCode !== 0 || body.partnerCode !== config.partnerCode || body.orderId !== reference ||
      body.requestId !== reference || Number(body.amount) !== amount || typeof body.payUrl !== 'string' ||
      !Number.isSafeInteger(body.responseTime) || typeof body.message !== 'string') {
    throw new Error('MOMO_BAD_RESPONSE')
  }
  const responseFields = { accessKey: config.accessKey, amount: body.amount, message: body.message,
    orderId: body.orderId, partnerCode: body.partnerCode, payUrl: body.payUrl,
    requestId: body.requestId, responseTime: body.responseTime, resultCode: body.resultCode }
  if (!equalsHex(body.signature, momoSignature(responseFields, config.secretKey))) throw new Error('MOMO_BAD_RESPONSE')
  const payUrl = new URL(body.payUrl)
  if (payUrl.protocol !== 'https:' || !/(^|\.)momo\.vn$/i.test(payUrl.hostname)) throw new Error('MOMO_BAD_RESPONSE')
  return payUrl.toString()
}
