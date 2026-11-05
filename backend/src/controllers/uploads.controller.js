import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { env } from '../config/env.js'
import { getUploadedImage, saveUploadedImage } from '../services/object-storage.js'

const IMAGE_LIMITS = Object.freeze({ product: 5, shop: 5, review: 2, avatar: 1, legacy: 5 })
const IMAGE_TYPES = Object.freeze({
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
})

function detectImage(buffer) {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { mime: 'image/png', ext: '.png' }
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: '.jpg' }
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: '.webp' }
  }
  return null
}

export async function uploadSellerImage(req, res, next) {
  try {
    const dataUrl = req.body?.dataUrl
    // Client cũ chưa gửi purpose; giữ mức 5 MiB để không phá luồng upload hiện có.
    const purpose = req.body?.purpose === undefined ? 'legacy' : req.body.purpose
    if (typeof purpose !== 'string' || !Object.hasOwn(IMAGE_LIMITS, purpose) || purpose === 'legacy' && req.body?.purpose !== undefined) {
      return res.status(400).json({ success: false, message: 'Mục đích tải ảnh không hợp lệ.', error: { code: 'INVALID_IMAGE_PURPOSE' } })
    }
    if ((purpose === 'product' || purpose === 'shop') && !['seller', 'admin'].includes(req.user?.role)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền tải ảnh cho gian hàng.', error: { code: 'FORBIDDEN' } })
    }
    const match = typeof dataUrl === 'string' && dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/)
    if (!match) {
      return res.status(400).json({ success: false, message: 'Chỉ chấp nhận ảnh PNG, JPG hoặc WebP hợp lệ.', error: { code: 'INVALID_IMAGE' } })
    }
    const bytes = Buffer.from(match[2], 'base64')
    const image = detectImage(bytes)
    if (!image || image.mime !== match[1] || bytes.toString('base64') !== match[2] || bytes.length > IMAGE_LIMITS[purpose] * 1024 * 1024) {
      return res.status(400).json({ success: false, message: `Ảnh phải là PNG, JPG hoặc WebP hợp lệ và không vượt quá ${IMAGE_LIMITS[purpose]} MiB.`, error: { code: 'INVALID_IMAGE' } })
    }
    try {
      const decoder = sharp(bytes, { failOn: 'warning', limitInputPixels: 16_000_000, animated: true })
      const metadata = await decoder.metadata()
      if (!metadata.width || !metadata.height || metadata.width > 4096 || metadata.height > 4096 || (metadata.pages || 1) !== 1) {
        throw new Error('Kích thước hoặc số khung hình không hợp lệ')
      }
      await decoder.raw().toBuffer()
    } catch {
      return res.status(400).json({ success: false, message: 'Ảnh không thể giải mã hoặc vượt quá giới hạn kích thước.', error: { code: 'INVALID_IMAGE' } })
    }
    // Legacy <= 1 MiB tiếp tục dùng được cho avatar của client cũ.
    // Tên do server cấp gắn mục đích và chủ sở hữu, không nhận từ client.
    const avatarImage = purpose === 'avatar' || (purpose === 'legacy' && bytes.length <= 1024 * 1024)
    const filename = `${avatarImage ? `avatar-${req.user.id}-` : ''}${randomUUID()}${image.ext}`
    if (env.uploadStorage === 's3') {
      await saveUploadedImage(filename, bytes, image.mime)
    } else {
      await mkdir(env.uploadDir, { recursive: true })
      await writeFile(path.join(env.uploadDir, filename), bytes, { flag: 'wx' })
    }
    return res.status(201).json({ success: true, data: { url: `/uploads/${filename}`, mimeType: image.mime } })
  } catch (err) {
    return next(err)
  }
}

export async function serveUploadedImage(req, res, next) {
  const filename = req.params.filename
  if (!/^(?:avatar-[1-9]\d{0,19}-)?[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:png|jpg|webp)$/i.test(filename)) {
    return res.status(404).end()
  }

  try {
    const image = await getUploadedImage(filename)
    res.set({
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': IMAGE_TYPES[path.extname(filename).toLowerCase()],
      'X-Content-Type-Options': 'nosniff',
    })
    return res.status(200).send(image.body)
  } catch (err) {
    if (err?.name === 'NoSuchKey' || err?.name === 'NotFound' || err?.$metadata?.httpStatusCode === 404) {
      return res.status(404).end()
    }
    return next(err)
  }
}
