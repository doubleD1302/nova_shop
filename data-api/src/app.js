import addressesRouter from './routes/addresses.routes.js'
import express from 'express'
import helmet from 'helmet'
import systemRouter from './routes/system.routes.js'
import authRouter from './routes/auth.routes.js'
import productsRouter from './routes/products.routes.js'
import ordersRouter from './routes/orders.routes.js'
import shopsRouter from './routes/shops.routes.js'
import adminRouter from './routes/admin.routes.js'
import vouchersRouter from './routes/vouchers.routes.js'
import demoPayoutRouter from './routes/demo-payout.routes.js'
import cartRouter from './routes/cart.routes.js'
import returnsRouter from './routes/returns.routes.js'
import shippingRouter from './routes/shipping.routes.js'
import chatRouter from './routes/chat.routes.js'
import paymentsRouter from './routes/payments.routes.js'
import settingsRouter from './routes/settings.routes.js'
import marketingRouter from './routes/marketing.routes.js'
import reportsRouter from './routes/reports.routes.js'
import favoritesRouter from './routes/favorites.routes.js'
import bannersRouter from './routes/banners.routes.js'
import { serviceAuthMiddleware } from './middlewares/auth.middleware.js'
import { notFoundHandler } from './middlewares/not-found.middleware.js'
import { errorHandler } from './middlewares/error.middleware.js'
import { validateQuery } from './middlewares/input.middleware.js'

// Khởi tạo instance ứng dụng Express cho Data API
const app = express()

// 1. Thiết lập các header bảo mật HTTP cơ bản
app.use(helmet())

// 2. Phân tích cú pháp dữ liệu JSON từ body request (giới hạn tối đa 1MB)
app.use(express.json({ limit: '1mb' }))
app.use(['/internal/v1/admin/shops/:shopId/identity-access', '/internal/v1/admin/shops/:shopId/identity-access-events'], (req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// 3. Khai báo các API routes nội bộ với tiền tố /internal/v1
// Bắt buộc xác thực dịch vụ bằng header x-service-key cho toàn bộ route /internal/v1/*
app.use(
  '/internal/v1',
  serviceAuthMiddleware,
  validateQuery,
  bannersRouter,
  favoritesRouter,
  systemRouter,
  authRouter,
  addressesRouter,
  productsRouter,
  ordersRouter,
  settingsRouter,
  shopsRouter,
  adminRouter,
  vouchersRouter,
  demoPayoutRouter,
  cartRouter,
  returnsRouter,
  shippingRouter,
  chatRouter,
  paymentsRouter,
  marketingRouter,
  reportsRouter,
)

// 4. Middleware xử lý khi client gọi route không tồn tại (404)
app.use(notFoundHandler)

// 5. Middleware xử lý lỗi tập trung (bắt buộc đặt cuối cùng sau routes và 404)
app.use(errorHandler)

export default app
export { app }
