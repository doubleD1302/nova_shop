import { callDataApi } from '../clients/data.client.js'
import { getEmailServiceStatus, sendViolationEmail } from '../services/email.service.js'

const routes = {
  stats: '/internal/v1/admin/stats',
  orders: '/internal/v1/admin/orders',
  users: '/internal/v1/admin/users',
  shops: '/internal/v1/admin/shops',
  products: '/internal/v1/admin/products',
  reviews: '/internal/v1/admin/reviews',
  reports: '/internal/v1/admin/reports',
}

// Bộ nhớ chống trùng lặp gửi email khi người dùng nhấn nút nhiều lần đồng thời
const activeEmailTasks = new Set()

export async function listAdminResource(req, res, next) {
  try {
    const resource = req.params.resource
    const path = routes[resource]
    if (!path) return res.status(404).json({ success: false, message: 'Not found.' })
    const data = await callDataApi(path)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

export async function updateAdminResource(req, res, next) {
  try {
    const { resource, id } = req.params
    const path = routes[resource]
    if (!path || !/^\d{1,20}$/.test(id)) return res.status(400).json({ success: false, message: 'Invalid request.' })
    const data = await callDataApi(`${path}/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      body: { ...(req.body || {}), userId: req.user.id },
    })

    // Xử lý gửi email cảnh cáo / thông báo khóa shop thật khi Admin xác nhận vi phạm
    if (resource === 'reports' && req.body?.status === 'confirmed_violation' && data?.isNewViolation) {
      try {
        const emailResult = await sendViolationEmail({
          to: data.ownerEmail,
          shopName: data.shopName,
          ownerName: data.ownerName,
          productName: data.productName,
          reason: data.reason,
          details: data.details,
          violationNumber: data.violationNumber,
          actionTaken: data.actionTaken,
          reportId: data.reportId,
          timestamp: new Date().toISOString(),
        })

        // Lưu trạng thái gửi email vào cơ sở dữ liệu qua Data API
        await callDataApi(`/internal/v1/admin/violations/${encodeURIComponent(data.violationId)}/email-status`, {
          method: 'PATCH',
          body: {
            emailStatus: emailResult.status,
            emailError: emailResult.error || null,
            emailContent: emailResult.emailContent || null,
            emailSentTo: data.ownerEmail,
            emailSentAt: emailResult.sentAt || null,
          },
        })

        data.emailStatus = emailResult.status
        data.emailSentTo = data.ownerEmail
        data.emailSentAt = emailResult.sentAt || null
        data.emailError = emailResult.error || null
      } catch (mailErr) {
        console.error('[ShopNova Backend] Lỗi tiến trình gửi email cảnh cáo:', mailErr.message)
        data.emailStatus = 'failed'
        data.emailError = mailErr.message
      }
    }

    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

export async function retryViolationEmail(req, res, next) {
  try {
    const { id } = req.params
    if (!/^\d{1,20}$/.test(id)) {
      return res.status(400).json({ success: false, message: 'Mã vi phạm không hợp lệ.' })
    }

    // Chống gửi trùng lặp / spam đồng thời khi Admin bấm nút nhiều lần
    if (activeEmailTasks.has(id)) {
      return res.status(429).json({
        success: false,
        message: 'Hệ thống đang tiến hành gửi email cho vi phạm này, vui lòng không nhấn liên tục.',
        error: { code: 'CONCURRENT_REQUEST' },
      })
    }
    activeEmailTasks.add(id)

    try {
      const violation = await callDataApi(`/internal/v1/admin/violations/${encodeURIComponent(id)}`)
      if (!violation) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ vi phạm.' })
      }

      // Đánh dấu trạng thái 'sending' để đồng bộ giao diện
      await callDataApi(`/internal/v1/admin/violations/${encodeURIComponent(id)}/email-status`, {
        method: 'PATCH',
        body: { emailStatus: 'sending' },
      }).catch(() => null)

      const emailResult = await sendViolationEmail({
        to: violation.ownerEmail,
        shopName: violation.shopName,
        ownerName: violation.ownerName,
        productName: violation.productName,
        reason: violation.reason,
        details: violation.emailContent,
        violationNumber: violation.violationNumber,
        actionTaken: violation.actionTaken,
        reportId: violation.reportId,
        timestamp: violation.createdAt,
      })

      await callDataApi(`/internal/v1/admin/violations/${encodeURIComponent(id)}/email-status`, {
        method: 'PATCH',
        body: {
          emailStatus: emailResult.status,
          emailError: emailResult.error || null,
          emailContent: emailResult.emailContent || null,
          emailSentTo: violation.ownerEmail,
          emailSentAt: emailResult.sentAt || null,
        },
      })

      return res.status(200).json({
        success: true,
        message: emailResult.status === 'sent'
          ? `Đã gửi email thành công tới ${violation.ownerEmail}.`
          : emailResult.status === 'not_configured'
            ? 'Chưa cấu hình dịch vụ email SMTP trên Backend.'
            : `Gửi email thất bại: ${emailResult.error || 'Lỗi kết nối mail server.'}`,
        data: {
          violationId: id,
          emailStatus: emailResult.status,
          emailError: emailResult.error || null,
          emailSentTo: violation.ownerEmail,
          emailSentAt: emailResult.sentAt || null,
          ownerEmail: violation.ownerEmail,
        },
      })
    } finally {
      activeEmailTasks.delete(id)
    }
  } catch (err) {
    return next(err)
  }
}

export async function listShopViolations(req, res, next) {
  try {
    const { shopId } = req.params
    if (!/^\d{1,20}$/.test(shopId)) {
      return res.status(400).json({ success: false, message: 'Mã gian hàng không hợp lệ.' })
    }
    const data = await callDataApi(`/internal/v1/admin/shops/${encodeURIComponent(shopId)}/violations`)
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

export async function getEmailStatus(req, res, next) {
  try {
    const status = getEmailServiceStatus()
    return res.status(200).json({ success: true, data: status })
  } catch (err) {
    return next(err)
  }
}

export async function updateAdminProductFlashSale(req, res, next) {
  try {
    const { id } = req.params
    const enabled = req.body?.enabled
    if (!/^\d{1,20}$/.test(id) || typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Invalid request.' })
    }
    const data = await callDataApi(`/internal/v1/admin/products/${encodeURIComponent(id)}/flash-sale`, {
      method: 'PATCH',
      body: { enabled, userId: req.user.id },
    })
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

export async function createContentReport(req, res, next) {
  try {
    const data = await callDataApi('/internal/v1/reports', {
      method: 'POST',
      body: { ...(req.body || {}), userId: req.user.id },
    })
    return res.status(201).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}

export async function updateAdminProductApproval(req, res, next) {
  try {
    const { id } = req.params
    const { approvalStatus, rejectionReason } = req.body || {}
    if (!/^\d{1,20}$/.test(id) || !['approved', 'rejected'].includes(approvalStatus)) {
      return res.status(400).json({ success: false, message: 'Yêu cầu kiểm duyệt không hợp lệ.' })
    }
    const data = await callDataApi(`/internal/v1/admin/products/${encodeURIComponent(id)}/approval`, {
      method: 'PATCH',
      body: { approvalStatus, rejectionReason, userId: req.user.id },
    })
    return res.status(200).json({ success: true, data })
  } catch (err) {
    return next(err)
  }
}
