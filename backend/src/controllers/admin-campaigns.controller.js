import { callDataApi } from '../clients/data.client.js'
import { notifyUser } from '../services/notification.service.js'

// Quản trị viên lấy từ token; userId trong body hoặc query của client luôn bị bỏ qua.

export async function listAdminCampaigns(req, res, next) {
  try {
    const params = new URLSearchParams({ userId: String(req.user.id) })
    for (const key of ['limit', 'offset']) {
      if (req.query[key] !== undefined && req.query[key] !== '') params.set(key, String(req.query[key]))
    }
    const data = await callDataApi(`/internal/v1/admin/campaigns?${params}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

export async function createAdminCampaign(req, res, next) {
  try {
    const data = await callDataApi('/internal/v1/admin/campaigns', {
      method: 'POST',
      body: { ...(req.body || {}), userId: String(req.user.id) },
    })
    return res.status(201).json({ success: true, message: 'Đã tạo chiến dịch.', data })
  } catch (err) {
    return next(err)
  }
}

export async function updateAdminCampaign(req, res, next) {
  try {
    const data = await callDataApi(`/internal/v1/admin/campaigns/${encodeURIComponent(req.params.campaignId)}`, {
      method: 'PATCH',
      body: { ...(req.body || {}), userId: String(req.user.id) },
    })
    return res.status(200).json({ success: true, message: 'Đã cập nhật chiến dịch.', data })
  } catch (err) {
    return next(err)
  }
}

export async function listAdminCampaignRegistrations(req, res, next) {
  try {
    const params = new URLSearchParams({ userId: String(req.user.id) })
    for (const key of ['campaignId', 'status', 'limit', 'offset']) {
      if (req.query[key] !== undefined && req.query[key] !== '') params.set(key, String(req.query[key]))
    }
    const data = await callDataApi(`/internal/v1/admin/campaign-registrations?${params}`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

/**
 * Admin duyệt hoặc từ chối đăng ký chiến dịch của shop; chủ shop nhận thông báo trong ứng dụng.
 */
export async function reviewAdminCampaignRegistration(req, res, next) {
  try {
    const { status, note } = req.body || {}
    const data = await callDataApi(`/internal/v1/admin/campaign-registrations/${encodeURIComponent(req.params.registrationId)}`, {
      method: 'PATCH',
      body: { userId: String(req.user.id), status, note },
    })

    // Lỗi gửi thông báo không làm hỏng kết quả duyệt
    const approved = data.status === 'approved'
    notifyUser({
      userId: data.ownerId,
      title: approved ? 'Đăng ký chiến dịch đã được duyệt' : 'Đăng ký chiến dịch bị từ chối',
      content: approved
        ? `Sản phẩm "${data.productName}" đã được duyệt tham gia chiến dịch "${data.campaignName}".`
        : `Sản phẩm "${data.productName}" chưa được tham gia chiến dịch "${data.campaignName}". Lý do: ${data.note}`,
      type: 'system',
      link: '/nguoi-ban/quang-cao?tab=programs',
      metadata: { registrationId: data.id, campaignId: data.campaignId, productId: data.productId },
    }).catch(() => {})

    // ownerId chỉ dùng để gửi thông báo nên không trả cho admin
    const { ownerId, ...result } = data
    return res.status(200).json({
      success: true,
      message: approved ? 'Đã duyệt đăng ký.' : 'Đã từ chối đăng ký.',
      data: result,
    })
  } catch (err) {
    return next(err)
  }
}
