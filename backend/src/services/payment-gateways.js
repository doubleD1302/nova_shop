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

export function vnpayDate(date) {
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

// ==========================================
// ZALOPAY GATEWAY INTEGRATION
// ==========================================

export function createZalopayPayload({ amount, reference, config, now = new Date() }) {
  const appTime = now.getTime()
  const transPrefix = vnpayDate(now).slice(2, 8)
  const appTransId = `${transPrefix}_${reference}`
  const embedData = JSON.stringify({ redirecturl: config.redirectUrl })
  const item = '[]'
  const appUser = 'ShopNova'
  const description = `Thanh toan don hang ${reference}`
  const bankCode = ''

  const dataToSign = `${config.appId}|${appTransId}|${appUser}|${amount}|${appTime}|${embedData}|${item}`
  const mac = crypto.createHmac('sha256', config.key1).update(dataToSign).digest('hex')

  return {
    app_id: Number(config.appId),
    app_user: appUser,
    app_trans_id: appTransId,
    app_time: appTime,
    amount,
    item,
    description,
    embed_data: embedData,
    bank_code: bankCode,
    callback_url: config.callbackUrl,
    mac,
  }
}

export async function requestZalopayPayment({ amount, reference, config, fetchImpl = fetch }) {
  const payload = createZalopayPayload({ amount, reference, config })
  const endpoint = config.endpoint || 'https://sb-openapi.zalopay.vn/v2/create'

  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(35000),
  })

  if (![200, 201].includes(response.status)) throw new Error('ZALOPAY_UNAVAILABLE')
  const body = await response.json()

  if (body.return_code !== 1 || typeof body.order_url !== 'string') {
    throw new Error(body.return_message || 'ZALOPAY_BAD_RESPONSE')
  }

  const orderUrl = new URL(body.order_url)
  if (orderUrl.protocol !== 'https:' || !/(^|\.)zalopay\.vn$/i.test(orderUrl.hostname)) {
    throw new Error('ZALOPAY_BAD_RESPONSE')
  }

  return orderUrl.toString()
}

export function verifyZalopayCallback(body, config) {
  if (!body || typeof body.data !== 'string' || typeof body.mac !== 'string') return null
  const expectedMac = crypto.createHmac('sha256', config.key2).update(body.data).digest('hex')
  if (!equalsHex(body.mac, expectedMac)) return null

  let dataObj
  try {
    dataObj = JSON.parse(body.data)
  } catch {
    return null
  }

  const { app_trans_id, zp_trans_id, amount } = dataObj
  if (!app_trans_id || !zp_trans_id || !Number.isSafeInteger(amount) || amount < 1000) return null

  const reference = String(app_trans_id).includes('_')
    ? String(app_trans_id).split('_').slice(1).join('_')
    : String(app_trans_id)

  return {
    provider: 'zalopay',
    reference,
    amount,
    transactionId: String(zp_trans_id),
    success: true,
    resultCode: '1',
  }
}

// ==========================================
// AUTOMATED REFUNDS (HOÀN TIỀN TỰ ĐỘNG)
// ==========================================

export async function refundVnpayPayment({
  amount,
  reference,
  transactionId,
  transactionDate = new Date(),
  reason = 'Hoàn tiền hủy đơn ShopNova',
  user = 'ShopNova_System',
  config,
  fetchImpl = fetch,
}) {
  const requestId = `REF_${Date.now()}_${reference}`.slice(0, 32)
  const vnpAmount = String(amount * 100)
  const vnpCommand = 'refund'
  const vnpVersion = '2.1.0'
  const vnpTxnType = '02'
  const vnpCreateDate = vnpayDate(new Date())
  const vnpTxnDate = vnpayDate(new Date(transactionDate))
  const vnpIpAddr = '127.0.0.1'
  const vnpOrderInfo = String(reason || 'Hoan tien ShopNova').slice(0, 255)

  const checksumData = `${requestId}|${vnpVersion}|${vnpCommand}|${config.tmnCode}|${vnpTxnType}|${reference}|${vnpAmount}|${transactionId || ''}|${vnpTxnDate}|${user}|${vnpCreateDate}|${vnpIpAddr}|${vnpOrderInfo}`
  const secureHash = crypto.createHmac('sha512', config.hashSecret).update(checksumData).digest('hex')

  const requestBody = {
    vnp_RequestId: requestId,
    vnp_Version: vnpVersion,
    vnp_Command: vnpCommand,
    vnp_TmnCode: config.tmnCode,
    vnp_TransactionType: vnpTxnType,
    vnp_TxnRef: reference,
    vnp_Amount: vnpAmount,
    vnp_OrderInfo: vnpOrderInfo,
    vnp_TransactionNo: transactionId || '',
    vnp_TransactionDate: vnpTxnDate,
    vnp_CreateBy: user,
    vnp_CreateDate: vnpCreateDate,
    vnp_IpAddr: vnpIpAddr,
    vnp_SecureHash: secureHash,
  }

  const endpoint = config.refundUrl || 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction'
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(35000),
  })

  if (![200, 201].includes(response.status)) throw new Error('VNPAY_REFUND_UNAVAILABLE')
  const resBody = await response.json()

  return {
    provider: 'vnpay',
    success: resBody.vnp_ResponseCode === '00',
    refundTransactionId: String(resBody.vnp_ResponseId || resBody.vnp_TransactionNo || requestId),
    resultCode: String(resBody.vnp_ResponseCode),
    message: resBody.vnp_Message || (resBody.vnp_ResponseCode === '00' ? 'Hoàn tiền VNPay thành công' : 'Hoàn tiền VNPay thất bại'),
  }
}

export async function refundMomoPayment({
  amount,
  reference,
  transactionId,
  reason = 'Hoàn tiền hủy đơn ShopNova',
  config,
  fetchImpl = fetch,
}) {
  const orderId = `REFUND_${reference}_${Date.now()}`.slice(0, 50)
  const requestId = `REQ_${reference}_${Date.now()}`.slice(0, 50)
  const description = String(reason || 'Hoan tien ShopNova').slice(0, 200)

  const rawFields = {
    accessKey: config.accessKey,
    amount: String(amount),
    description,
    orderId,
    partnerCode: config.partnerCode,
    requestId,
    transId: String(transactionId),
  }

  const signature = crypto.createHmac('sha256', config.secretKey)
    .update(`accessKey=${rawFields.accessKey}&amount=${rawFields.amount}&description=${rawFields.description}&orderId=${rawFields.orderId}&partnerCode=${rawFields.partnerCode}&requestId=${rawFields.requestId}&transId=${rawFields.transId}`)
    .digest('hex')

  const requestBody = {
    partnerCode: config.partnerCode,
    orderId,
    requestId,
    amount,
    transId: Number(transactionId),
    lang: 'vi',
    description,
    signature,
  }

  const endpoint = config.refundUrl || 'https://test-payment.momo.vn/v2/gateway/api/refund'
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(35000),
  })

  if (![200, 201].includes(response.status)) throw new Error('MOMO_REFUND_UNAVAILABLE')
  const resBody = await response.json()

  return {
    provider: 'momo',
    success: resBody.resultCode === 0,
    refundTransactionId: String(resBody.transId || orderId),
    resultCode: String(resBody.resultCode),
    message: resBody.message || (resBody.resultCode === 0 ? 'Hoàn tiền MoMo thành công' : 'Hoàn tiền MoMo thất bại'),
  }
}

export async function refundZalopayPayment({
  amount,
  reference,
  transactionId,
  reason = 'Hoàn tiền hủy đơn ShopNova',
  config,
  fetchImpl = fetch,
}) {
  const now = new Date()
  const mRefundId = `${vnpayDate(now).slice(2, 8)}_${config.appId}_${Date.now().toString().slice(-6)}`
  const timestamp = now.getTime()
  const description = String(reason || 'Hoan tien ShopNova').slice(0, 250)

  const dataToSign = `${config.appId}|${transactionId}|${amount}|${description}|${timestamp}`
  const mac = crypto.createHmac('sha256', config.key1).update(dataToSign).digest('hex')

  const requestBody = {
    app_id: Number(config.appId),
    m_refund_id: mRefundId,
    zp_trans_id: String(transactionId),
    amount,
    timestamp,
    description,
    mac,
  }

  const endpoint = config.refundEndpoint || 'https://sb-openapi.zalopay.vn/v2/refund'
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(35000),
  })

  if (![200, 201].includes(response.status)) throw new Error('ZALOPAY_REFUND_UNAVAILABLE')
  const resBody = await response.json()

  return {
    provider: 'zalopay',
    success: resBody.return_code === 1,
    refundTransactionId: String(resBody.refund_id || mRefundId),
    resultCode: String(resBody.return_code),
    message: resBody.return_message || (resBody.return_code === 1 ? 'Hoàn tiền ZaloPay thành công' : 'Hoàn tiền ZaloPay thất bại'),
  }
}

export async function refundPaymentGateway({
  provider,
  reference,
  transactionId,
  amount,
  reason,
  transactionDate,
  config,
  fetchImpl = fetch,
}) {
  if (provider === 'vnpay') {
    return refundVnpayPayment({ amount, reference, transactionId, transactionDate, reason, config: config.vnpay, fetchImpl })
  }
  if (provider === 'momo') {
    return refundMomoPayment({ amount, reference, transactionId, reason, config: config.momo, fetchImpl })
  }
  if (provider === 'zalopay') {
    return refundZalopayPayment({ amount, reference, transactionId, reason, config: config.zalopay, fetchImpl })
  }
  throw new Error(`UNSUPPORTED_PROVIDER_${provider}`)
}

// ==========================================
// ĐỐI SOÁT GIAO DỊCH TỰ ĐỘNG (RECONCILIATION)
// ==========================================

export async function queryVnpayTransaction({ reference, transactionDate = new Date(), config, fetchImpl = fetch }) {
  const requestId = `QRY_${Date.now()}_${reference}`.slice(0, 32)
  const vnpCommand = 'querydr'
  const vnpVersion = '2.1.0'
  const vnpCreateDate = vnpayDate(new Date())
  const vnpTxnDate = vnpayDate(new Date(transactionDate))
  const vnpIpAddr = '127.0.0.1'
  const vnpOrderInfo = `Truy van don ${reference}`

  const checksumData = `${requestId}|${vnpVersion}|${vnpCommand}|${config.tmnCode}|${reference}|${vnpTxnDate}|${vnpCreateDate}|${vnpIpAddr}|${vnpOrderInfo}`
  const secureHash = crypto.createHmac('sha512', config.hashSecret).update(checksumData).digest('hex')

  const requestBody = {
    vnp_RequestId: requestId,
    vnp_Version: vnpVersion,
    vnp_Command: vnpCommand,
    vnp_TmnCode: config.tmnCode,
    vnp_TxnRef: reference,
    vnp_OrderInfo: vnpOrderInfo,
    vnp_TransactionDate: vnpTxnDate,
    vnp_CreateDate: vnpCreateDate,
    vnp_IpAddr: vnpIpAddr,
    vnp_SecureHash: secureHash,
  }

  const endpoint = config.refundUrl || 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction'
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(35000),
  })

  if (![200, 201].includes(response.status)) throw new Error('VNPAY_QUERY_UNAVAILABLE')
  const resBody = await response.json()

  const isPaid = resBody.vnp_ResponseCode === '00' && resBody.vnp_TransactionStatus === '00'
  const isPending = ['01', '02'].includes(resBody.vnp_TransactionStatus)

  return {
    provider: 'vnpay',
    reference,
    amount: resBody.vnp_Amount ? Number(resBody.vnp_Amount) / 100 : null,
    transactionId: String(resBody.vnp_TransactionNo || ''),
    status: isPaid ? 'paid' : isPending ? 'pending' : 'failed',
    resultCode: `${resBody.vnp_ResponseCode || ''}:${resBody.vnp_TransactionStatus || ''}`,
    raw: resBody,
  }
}

export async function queryMomoTransaction({ reference, config, fetchImpl = fetch }) {
  const requestId = `QRY_${reference}_${Date.now()}`.slice(0, 50)
  const signature = crypto.createHmac('sha256', config.secretKey)
    .update(`accessKey=${config.accessKey}&orderId=${reference}&partnerCode=${config.partnerCode}&requestId=${requestId}`)
    .digest('hex')

  const requestBody = {
    partnerCode: config.partnerCode,
    orderId: reference,
    requestId,
    lang: 'vi',
    signature,
  }

  const endpoint = config.queryUrl || config.apiUrl?.replace('/create', '/query') || 'https://test-payment.momo.vn/v2/gateway/api/query'
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(35000),
  })

  if (![200, 201].includes(response.status)) throw new Error('MOMO_QUERY_UNAVAILABLE')
  const resBody = await response.json()

  const isPaid = resBody.resultCode === 0
  const isPending = resBody.resultCode === 1000

  return {
    provider: 'momo',
    reference,
    amount: resBody.amount ? Number(resBody.amount) : null,
    transactionId: String(resBody.transId || ''),
    status: isPaid ? 'paid' : isPending ? 'pending' : 'failed',
    resultCode: String(resBody.resultCode),
    raw: resBody,
  }
}

export async function queryZalopayTransaction({ reference, appTransId, config, fetchImpl = fetch }) {
  const transId = appTransId || `${vnpayDate(new Date()).slice(2, 8)}_${reference}`
  const dataToSign = `${config.appId}|${transId}|${config.key1}`
  const mac = crypto.createHmac('sha256', config.key1).update(dataToSign).digest('hex')

  const requestBody = {
    app_id: Number(config.appId),
    app_trans_id: transId,
    mac,
  }

  const endpoint = config.queryEndpoint || 'https://sb-openapi.zalopay.vn/v2/query'
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(requestBody),
    signal: AbortSignal.timeout(35000),
  })

  if (![200, 201].includes(response.status)) throw new Error('ZALOPAY_QUERY_UNAVAILABLE')
  const resBody = await response.json()

  const isPaid = resBody.return_code === 1
  const isPending = resBody.is_processing === true

  return {
    provider: 'zalopay',
    reference,
    amount: resBody.amount ? Number(resBody.amount) : null,
    transactionId: String(resBody.zp_trans_id || ''),
    status: isPaid ? 'paid' : isPending ? 'pending' : 'failed',
    resultCode: String(resBody.return_code),
    raw: resBody,
  }
}

export async function queryGatewayTransaction({ provider, reference, transactionId, transactionDate, config, fetchImpl = fetch }) {
  if (provider === 'vnpay') {
    return queryVnpayTransaction({ reference, transactionDate, config: config.vnpay, fetchImpl })
  }
  if (provider === 'momo') {
    return queryMomoTransaction({ reference, config: config.momo, fetchImpl })
  }
  if (provider === 'zalopay') {
    return queryZalopayTransaction({ reference, appTransId: transactionId, config: config.zalopay, fetchImpl })
  }
  throw new Error(`UNSUPPORTED_PROVIDER_${provider}`)
}
