import nodemailer from 'nodemailer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { env } from '../config/env.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendEnvPath = path.resolve(__dirname, '../../.env')

let transporterCache = null
let currentTransportSignature = null

/**
 * Đọc động và chuẩn hóa cấu hình SMTP từ môi trường thực thi.
 */
export function getEmailConfig() {
  try {
    dotenv.config({ path: backendEnvPath, override: true })
  } catch {
    // ignore
  }

  const smtpHost = (process.env.SMTP_HOST || env.smtpHost || '').trim()
  const rawPort = (process.env.SMTP_PORT || String(env.smtpPort) || '587').trim()
  const smtpPort = Number(rawPort) || 587
  const smtpSecure = (process.env.SMTP_SECURE || String(env.smtpSecure) || 'false').trim().toLowerCase() === 'true'
  const smtpUser = (process.env.SMTP_USER || env.smtpUser || '').trim()
  const rawPass = (process.env.SMTP_PASS || env.smtpPass || '').trim()
  const smtpPass = rawPass.replace(/^["']|["']$/g, '').replace(/\s+/g, '')
  const smtpFrom = (process.env.SMTP_FROM || env.smtpFrom || 'NOVA SHOP <no-reply@novashop.vn>').trim()

  const isPlaceholder = [
    'your_email@gmail.com',
    'xxxx xxxx xxxx xxxx',
    'your_password_here',
    'secret',
    'change_me',
  ].includes(smtpPass.toLowerCase())

  const isConfigured = Boolean(smtpHost && smtpUser && smtpPass && !isPlaceholder)

  return { smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpFrom, isConfigured }
}

/**
 * Khởi tạo hoặc lấy transporter gửi email qua SMTP an toàn từ cấu hình server.
 */
function getTransporter() {
  const config = getEmailConfig()
  if (!config.isConfigured) {
    transporterCache = null
    currentTransportSignature = null
    return null
  }

  const sig = `${config.smtpHost}:${config.smtpPort}:${config.smtpSecure}:${config.smtpUser}:${config.smtpPass}`
  if (!transporterCache || currentTransportSignature !== sig) {
    currentTransportSignature = sig
    transporterCache = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpSecure,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass.replace(/\s+/g, ''), // Chuẩn hóa mã Google App Password 16 ký tự
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })
  }
  return { transporter: transporterCache, config }
}

/**
 * Kiểm tra trạng thái cấu hình dịch vụ email.
 */
export function getEmailServiceStatus() {
  const config = getEmailConfig()
  return {
    isConfigured: config.isConfigured,
    host: config.smtpHost || null,
    port: config.smtpPort || null,
    secure: config.smtpSecure,
    from: config.smtpFrom,
    user: config.smtpUser ? `${config.smtpUser.slice(0, 3)}***@${config.smtpUser.split('@')[1] || ''}` : null,
  }
}

/**
 * Tạo nội dung HTML email chuẩn phong cách Nova Shop (Terracotta & Cream).
 */
export function buildViolationEmailTemplate({
  shopName,
  ownerName,
  productName,
  reason,
  details,
  violationNumber,
  actionTaken,
  reportId,
  timestamp,
}) {
  const isSuspension = violationNumber >= 2 || actionTaken === 'shop_suspended'
  const timeFormatted = timestamp ? new Date(timestamp).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : new Date().toLocaleString('vi-VN')

  const title = isSuspension
    ? `[NOVA SHOP] THÔNG BÁO TẠM KHÓA GIAN HÀNG DO TÁI PHẠM (LẦN ${violationNumber})`
    : `[NOVA SHOP] CẢNH BÁO VI PHẠM LẦN ${violationNumber} — HÀNG HÓA NGHI HÀNG GIẢ / VI PHẠM THƯƠNG HIỆU`

  const alertBadge = isSuspension
    ? '<span style="display:inline-block;background-color:#B93832;color:#ffffff;font-size:12px;font-weight:bold;padding:4px 12px;border-radius:9999px;">TÁI PHẠM — ĐÃ TẠM KHÓA GIAN HÀNG</span>'
    : '<span style="display:inline-block;background-color:#BD6E49;color:#ffffff;font-size:12px;font-weight:bold;padding:4px 12px;border-radius:9999px;">CẢNH BÁO VI PHẠM LẦN 1</span>'

  const html = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#FBF3E8;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#49352D;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#FBF3E8;padding:30px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:620px;background-color:#FFFCF7;border:1px solid #E6D5C2;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(73,53,45,0.06);">
          <!-- Header -->
          <tr>
            <td style="background-color:#80513B;padding:24px 30px;text-align:left;">
              <h1 style="margin:0;font-size:22px;color:#FFFCF7;font-weight:800;letter-spacing:0.5px;">NOVA SHOP</h1>
              <p style="margin:4px 0 0;font-size:12px;color:#F5E7D4;">Ban Quản Trị & Kiểm Soát Chất Lượng Sàn Thương Mại Điện Tử</p>
            </td>
          </tr>

          <!-- Banner status -->
          <tr>
            <td style="padding:24px 30px 10px;">
              ${alertBadge}
              <h2 style="margin:14px 0 6px;font-size:18px;color:#49352D;line-height:1.4;">
                ${isSuspension ? 'Gian hàng của bạn đã bị tạm khóa do tái phạm chính sách' : 'Cảnh báo vi phạm chính sách hàng hóa lần đầu'}
              </h2>
              <p style="margin:0;font-size:13px;color:#8B7566;line-height:1.6;">
                Kính gửi Chủ gian hàng <strong>${shopName}</strong> (Chủ tài khoản: ${ownerName || 'Quý đối tác'}),
              </p>
            </td>
          </tr>

          <!-- Details Table -->
          <tr>
            <td style="padding:10px 30px 20px;">
              <table role="presentation" width="100%" style="border-collapse:collapse;background-color:#FBF3E8;border-radius:12px;border:1px solid #E6D5C2;font-size:13px;">
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #E6D5C2;color:#8B7566;width:35%;">Gian hàng:</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #E6D5C2;color:#49352D;font-weight:bold;">${shopName}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #E6D5C2;color:#8B7566;">Sản phẩm liên quan:</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #E6D5C2;color:#49352D;font-weight:bold;">${productName || 'Toàn bộ gian hàng'}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #E6D5C2;color:#8B7566;">Mã hồ sơ báo cáo:</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #E6D5C2;color:#49352D;">#${reportId || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #E6D5C2;color:#8B7566;">Thời điểm xác minh:</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #E6D5C2;color:#49352D;">${timeFormatted}</td>
                </tr>
                <tr>
                  <td style="padding:10px 14px;border-bottom:1px solid #E6D5C2;color:#8B7566;">Lý do vi phạm:</td>
                  <td style="padding:10px 14px;border-bottom:1px solid #E6D5C2;color:#B93832;font-weight:bold;">${reason}</td>
                </tr>
                ${details ? `
                <tr>
                  <td style="padding:10px 14px;color:#8B7566;vertical-align:top;">Chi tiết thẩm định:</td>
                  <td style="padding:10px 14px;color:#49352D;line-height:1.5;">${details}</td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>

          <!-- Guidance / Action items -->
          <tr>
            <td style="padding:0 30px 24px;font-size:13px;line-height:1.6;color:#49352D;">
              ${isSuspension ? `
              <div style="background-color:#F5E7D4;border-left:4px solid #B93832;padding:14px;border-radius:4px;margin-bottom:16px;">
                <p style="margin:0 0 6px;font-weight:bold;color:#80513B;">HẬU QUẢ VÀ HƯỚNG DẪN MỞ KHÓA:</p>
                <ul style="margin:0;padding-left:18px;color:#49352D;">
                  <li>Gian hàng đã bị <strong>tạm ngừng hoạt động</strong>. Toàn bộ sản phẩm của gian hàng đã được ẩn khỏi sàn công khai.</li>
                  <li>Bạn tạm thời <strong>không thể đăng bán hoặc chỉnh sửa</strong> sản phẩm mới cho đến khi hoàn tất giải trình.</li>
                  <li>Các đơn hàng đã phát sinh trước thời điểm khóa vẫn cần được thực hiện giao nhận đúng hạn để bảo vệ quyền lợi người mua.</li>
                  <li>Để khiếu nại hoặc gửi hồ sơ giải trình (hóa đơn GTGT, giấy ủy quyền phân phối chính hãng), vui lòng phản hồi email này hoặc liên hệ hotline Quản trị viên NOVA SHOP.</li>
                </ul>
              </div>
              ` : `
              <div style="background-color:#F5E7D4;border-left:4px solid #BD6E49;padding:14px;border-radius:4px;margin-bottom:16px;">
                <p style="margin:0 0 6px;font-weight:bold;color:#80513B;">HƯỚNG DẪN KHẮC PHỤC (TRONG VÒNG 24 GIỜ):</p>
                <ul style="margin:0;padding-left:18px;color:#49352D;">
                  <li>Vui lòng kiểm tra và <strong>chủ động gỡ bỏ/ẩn</strong> ngay sản phẩm có dấu hiệu vi phạm nêu trên khỏi gian hàng.</li>
                  <li>Nếu sản phẩm là chính hãng, vui lòng cung cấp giấy tờ chứng minh nguồn gốc xuất xứ về địa chỉ hỗ trợ của chúng tôi.</li>
                  <li style="color:#B93832;font-weight:bold;">LƯU Ý QUAN TRỌNG: Nếu gian hàng tiếp tục ghi nhận vi phạm lần thứ 2 đã được xác minh, hệ thống sẽ TỰ ĐỘNG KHÓA GIAN HÀNG theo chính sách bảo vệ người tiêu dùng.</li>
                </ul>
              </div>
              `}
              <p style="margin:12px 0 0;font-size:12px;color:#8B7566;">
                Email này được gửi tự động từ hệ thống Quản lý Vi phạm & Hàng giả của NOVA SHOP. Vui lòng không chia sẻ email này cho bên thứ ba.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#FBF3E8;border-top:1px solid #E6D5C2;padding:16px 30px;font-size:11px;color:#8B7566;text-align:center;">
              © 2026 NOVA SHOP — Sàn Thương Mại Điện Tử Đa Người Bán Uy Tín.<br>
              Địa chỉ liên hệ hỗ trợ: support@novashop.vn | Hotline: 1900-NOVA-SHOP
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()

  const plainText = `
[NOVA SHOP] ${title}

Kính gửi Chủ gian hàng: ${shopName} (${ownerName || 'Chủ tài khoản'})
Thời gian xác minh: ${timeFormatted}
Mã hồ sơ báo cáo: #${reportId || 'N/A'}
Sản phẩm liên quan: ${productName || 'Toàn bộ gian hàng'}
Lý do vi phạm: ${reason}
Chi tiết thẩm định: ${details || 'Không có ghi chú thêm'}

${isSuspension
  ? 'HẬU QUẢ: Gian hàng đã bị TẠM KHÓA do tái phạm lần 2. Toàn bộ sản phẩm đã bị ẩn khỏi sàn công khai. Vui lòng liên hệ support@novashop.vn để gửi hồ sơ giải trình.'
  : 'YÊU CẦU: Vui lòng kiểm tra và gỡ bỏ sản phẩm vi phạm trong vòng 24 giờ. Nếu tái phạm lần 2, gian hàng sẽ bị tạm khóa toàn bộ theo quy định của NOVA SHOP.'
}

© 2026 NOVA SHOP
  `.trim()

  return { subject: title, html, text: plainText }
}

/**
 * Gửi email cảnh cáo hoặc khóa gian hàng tới địa chỉ email của chủ shop.
 */
export async function sendViolationEmail({
  to,
  shopName,
  ownerName,
  productName,
  reason,
  details,
  violationNumber,
  actionTaken,
  reportId,
  timestamp,
}) {
  if (!to || typeof to !== 'string' || !to.includes('@')) {
    return {
      success: false,
      status: 'failed',
      error: 'Chủ gian hàng chưa có địa chỉ email hợp lệ trong hồ sơ tài khoản.',
    }
  }

  const emailContent = buildViolationEmailTemplate({
    shopName,
    ownerName,
    productName,
    reason,
    details,
    violationNumber,
    actionTaken,
    reportId,
    timestamp,
  })

  const transportResult = getTransporter()
  if (!transportResult) {
    return {
      success: false,
      status: 'not_configured',
      error: 'Dịch vụ SMTP chưa được cấu hình biến môi trường trên Backend (cần SMTP_HOST, SMTP_USER, SMTP_PASS).',
      emailContent: emailContent.text,
      subject: emailContent.subject,
    }
  }

  const { transporter, config } = transportResult

  try {
    const info = await transporter.sendMail({
      from: config.smtpFrom,
      to,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    })

    return {
      success: true,
      status: 'sent',
      messageId: info.messageId,
      accepted: info.accepted,
      sentAt: new Date().toISOString(),
      emailContent: emailContent.text,
      subject: emailContent.subject,
    }
  } catch (err) {
    console.error('[ShopNova Email] Gửi email thất bại:', err.message)
    transporterCache = null
    currentTransportSignature = null
    return {
      success: false,
      status: 'failed',
      error: `Lỗi kết nối máy chủ gửi mail: ${err.message}`,
      emailContent: emailContent.text,
      subject: emailContent.subject,
    }
  }
}

