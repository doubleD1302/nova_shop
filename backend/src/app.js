import addressesRouter from './routes/addresses.routes.js'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env.js'
import healthRouter from './routes/health.routes.js'
import authRouter from './routes/auth.routes.js'
import productsRouter from './routes/products.routes.js'
import ordersRouter from './routes/orders.routes.js'
import sellerRouter from './routes/seller.routes.js'
import shopsRouter from './routes/shops.routes.js'
import uploadsRouter from './routes/uploads.routes.js'
import { serveUploadedImage } from './controllers/uploads.controller.js'
import settingsRouter from './routes/settings.routes.js'
import adminRouter from './routes/admin.routes.js'
import aiRouter from './routes/ai.routes.js'
import vouchersRouter from './routes/vouchers.routes.js'
import cartRouter from './routes/cart.routes.js'
import returnsRouter from './routes/returns.routes.js'
import shippingRouter from './routes/shipping.routes.js'
import chatRouter from './routes/chat.routes.js'
import paymentsRouter from './routes/payments.routes.js'
import bannersRouter from './routes/banners.routes.js'
import favoritesRouter from './routes/favorites.routes.js'
import reviewsRouter from './routes/reviews.routes.js'
import { notFoundHandler } from './middlewares/not-found.middleware.js'
import { errorHandler } from './middlewares/error.middleware.js'
import { validateQuery } from './middlewares/input.middleware.js'

// Khởi tạo instance ứng dụng Express
const app = express()

// 1. Thiết lập các header bảo mật HTTP cơ bản (cho phép tải ảnh tĩnh cross-origin)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

// 2. Cấu hình CORS (Cross-Origin Resource Sharing)
const corsOptions = {
  origin: (origin, callback) => {
    // Cho phép các yêu cầu không có header Origin (curl, Postman, ứng dụng di động Flutter/native)
    if (!origin) {
      return callback(null, true)
    }

    // Cho phép các web client có nguồn gốc nằm trong danh sách env.corsOrigins
    if (env.corsOrigins.includes(origin)) {
      return callback(null, true)
    }

    // Nguồn không hợp lệ: không thêm header cho phép CORS
    return callback(null, false)
  },
  credentials: true,
}
app.use(cors(corsOptions))

// 3. Phân tích cú pháp JSON và ảnh tải lên đã mã hóa base64 (giới hạn 8MB)
app.use(express.json({ limit: '8mb' }))
app.use('/api/v1', validateQuery)

if (env.uploadStorage === 's3') {
  app.get('/uploads/:filename', serveUploadedImage)
} else {
  app.use('/uploads', express.static(env.uploadDir, { maxAge: '1y', immutable: true }))
  app.get('/uploads/:filename', (req, res) => {
    res.redirect(302, `https://novashop-api-952u.onrender.com/uploads/${encodeURIComponent(req.params.filename)}`)
  })
}

// 4. Khai báo các API routes với tiền tố /api/v1
app.use('/api/v1', healthRouter)
app.use('/api/v1', settingsRouter)
app.use('/api/v1', bannersRouter)
app.use('/api/v1/favorites', favoritesRouter)
app.use('/api/v1/reviews', reviewsRouter)
app.use('/api/v1/auth', authRouter)
app.use('/api/v1/addresses', addressesRouter)
app.use('/api/v1', shopsRouter)
app.use('/api/v1', uploadsRouter)
app.use('/api/v1', paymentsRouter)
app.use('/api/v1', adminRouter)
app.use('/api/v1/products', productsRouter)
app.use('/api/v1/orders', ordersRouter)
app.use('/api/v1/seller', sellerRouter)
app.use('/api/v1/ai', aiRouter)
app.use('/api/v1/vouchers', vouchersRouter)
app.use('/api/v1/cart', cartRouter)
app.use('/api/v1', returnsRouter)
app.use('/api/v1', shippingRouter)
app.use('/api/v1/chat', chatRouter)

// 5. Middleware xử lý khi client gọi route không tồn tại (404)
app.use(notFoundHandler)

// 6. Middleware xử lý lỗi tập trung (bắt buộc đặt cuối cùng sau routes và 404)
app.use(errorHandler)

export default app
export { app }
