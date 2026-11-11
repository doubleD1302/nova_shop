import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateCarriersShippingRates,
  dispatchOrderToCarrier,
  getCarrierName,
  getRegion,
  normalizeCarrierWebhookEvent,
  verifyCarrierWebhook,
} from '../src/services/third-party-logistics.js'

test('3PL Logistics: Phân vùng địa lý và tên hãng vận chuyển chính xác', () => {
  assert.equal(getRegion('Hà Nội'), 'north')
  assert.equal(getRegion('Đà Nẵng'), 'central')
  assert.equal(getRegion('TP. Hồ Chí Minh'), 'south')
  assert.equal(getCarrierName('GHN'), 'Giao Hàng Nhanh (GHN)')
  assert.equal(getCarrierName('GHTK'), 'Giao Hàng Tiết Kiệm (GHTK)')
  assert.equal(getCarrierName('ViettelPost'), 'Viettel Post')
})

test('3PL Logistics: Tính cước và thời gian giao hàng thực tế từ GHN, GHTK, ViettelPost', async () => {
  // Test 1: Cùng tỉnh nội thành (Hà Nội -> Hà Nội)
  const localRates = await calculateCarriersShippingRates({
    fromProvince: 'Hà Nội',
    toProvince: 'Hà Nội',
    weightGrams: 500,
    subtotal: 300000,
  })

  assert.equal(localRates.length, 3)
  const ghnLocal = localRates.find((r) => r.carrier === 'GHN')
  const ghtkLocal = localRates.find((r) => r.carrier === 'GHTK')
  const vtpLocal = localRates.find((r) => r.carrier === 'ViettelPost')

  assert.equal(ghnLocal.fee, 22000)
  assert.equal(ghnLocal.estimatedDeliveryDays, '1 ngày')
  assert.equal(ghtkLocal.fee, 18000)
  assert.equal(ghtkLocal.estimatedDeliveryDays, '1 - 2 ngày')
  assert.equal(vtpLocal.fee, 20000)

  // Test 2: Khác miền (Hồ Chí Minh -> Hà Nội), hàng nặng 3kg
  const interRates = await calculateCarriersShippingRates({
    fromProvince: 'Hồ Chí Minh',
    toProvince: 'Hà Nội',
    weightGrams: 3000,
    subtotal: 500000,
  })

  const ghnInter = interRates.find((r) => r.carrier === 'GHN')
  // 38000 + 2 * 5000 = 48000
  assert.equal(ghnInter.fee, 48000)
  assert.equal(ghnInter.estimatedDeliveryDays, '2 - 3 ngày')

  // Test 3: Miễn phí vận chuyển khi subtotal >= 1.000.000đ
  const freeRates = await calculateCarriersShippingRates({
    fromProvince: 'Hồ Chí Minh',
    toProvince: 'Hà Nội',
    weightGrams: 1000,
    subtotal: 1200000,
  })
  assert.equal(freeRates[0].fee, 0)
  assert.equal(freeRates[0].discount, freeRates[0].originalFee)
})

test('3PL Logistics: Tự động đẩy đơn, tạo mã vận đơn và lịch hẹn bưu tá lấy hàng', async () => {
  const dispatchRes = await dispatchOrderToCarrier({
    carrier: 'GHN',
    shopOrderId: '1024',
    orderData: {
      recipientName: 'Trần Văn A',
      recipientPhone: '0912345678',
      addressDetail: '123 Đường Láng, Hà Nội',
      shopPhone: '0987654321',
      shopAddress: 'Kho Quận 1, TP.HCM',
    },
    now: new Date('2026-11-11T09:00:00+07:00'),
  })

  assert.equal(dispatchRes.success, true)
  assert.equal(dispatchRes.carrier, 'GHN')
  assert.match(dispatchRes.trackingCode, /^GHN001024[A-F0-9]{6}VN$/)
  assert.equal(dispatchRes.pickupAppointment.shift, 'Ca chiều hôm nay (13:30 - 17:30)')
  assert.match(dispatchRes.pickupAppointment.note, /0987654321/)

  // Đẩy đơn GHTK ca tối -> hẹn sáng mai
  const ghtkDispatch = await dispatchOrderToCarrier({
    carrier: 'GHTK',
    shopOrderId: '2048',
    orderData: {
      recipientName: 'Lê Thị B',
      shopPhone: '0988888888',
    },
    now: new Date('2026-11-11T16:00:00+07:00'),
  })
  assert.equal(ghtkDispatch.carrier, 'GHTK')
  assert.match(ghtkDispatch.trackingCode, /^S02048\.BO\.[A-F0-9]{6}$/)
  assert.equal(ghtkDispatch.pickupAppointment.shift, 'Ca sáng ngày mai (08:00 - 12:00)')
})

test('3PL Logistics: Chuẩn hóa webhook hành trình bưu tá GHN và GHTK', () => {
  // 1. GHN webhook format: bưu tá đã lấy hàng
  const ghnPicked = normalizeCarrierWebhookEvent({
    carrier: 'GHN',
    body: {
      OrderCode: 'GHN123456VN',
      Status: 'picked',
      Warehouse: 'Bưu cục Quận 1',
      Description: 'Bưu tá Nguyễn Văn X đã lấy hàng',
    },
  })
  assert.equal(ghnPicked.trackingCode, 'GHN123456VN')
  assert.equal(ghnPicked.status, 'picked_up')
  assert.equal(ghnPicked.isDelivered, false)

  // 2. GHN webhook format: giao thành công
  const ghnDelivered = normalizeCarrierWebhookEvent({
    carrier: 'GHN',
    body: {
      OrderCode: 'GHN123456VN',
      Status: 'delivered',
      Warehouse: 'Bưu cục Cầu Giấy',
      Description: 'Người nhận đã ký nhận kiện hàng',
    },
  })
  assert.equal(ghnDelivered.status, 'delivered')
  assert.equal(ghnDelivered.isDelivered, true)

  // 3. GHTK webhook format: đang giao hàng (status 5)
  const ghtkDelivering = normalizeCarrierWebhookEvent({
    carrier: 'GHTK',
    body: {
      label_id: 'S001.BO.998877',
      status_id: 5,
      action_location: 'Trạm phát Đống Đa',
      reason: 'Bưu tá đang phát hàng',
    },
  })
  assert.equal(ghtkDelivering.trackingCode, 'S001.BO.998877')
  assert.equal(ghtkDelivering.status, 'out_for_delivery')
  assert.equal(ghtkDelivering.isDelivered, false)

  // 4. Webhook verification
  assert.equal(verifyCarrierWebhook({ carrier: 'GHN', config: {} }), true)
  assert.equal(verifyCarrierWebhook({ carrier: 'GHN', headers: { token: 'secret123' }, config: { ghn: { token: 'secret123' } } }), true)
  assert.equal(verifyCarrierWebhook({ carrier: 'GHN', headers: { token: 'wrong' }, config: { ghn: { token: 'secret123' } } }), false)
})
