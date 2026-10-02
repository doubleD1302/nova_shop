import express from 'express'
import helmet from 'helmet'
import systemRouter from './routes/system.routes.js'
import authRouter from './routes/auth.routes.js'
import { serviceAuthMiddleware } from './middlewares/auth.middleware.js'
import { notFoundHandler } from './middlewares/not-found.middleware.js'
import { errorHandler } from './middlewares/error.middleware.js'

// Khởi tạo instance ứng dụng Express cho Data API
const app = express()

// 1. Thiết lập các header bảo mật HTTP cơ bản
app.use(helmet())

// 2. Phân tích cú pháp dữ liệu JSON từ body request (giới hạn tối đa 1MB)
app.use(express.json({ limit: '1mb' }))

// 3. Khai báo các API routes nội bộ với tiền tố /internal/v1
// Bắt buộc xác thực dịch vụ bằng header x-service-key cho toàn bộ route /internal/v1/*
app.use('/internal/v1', serviceAuthMiddleware, systemRouter, authRouter)

// 4. Middleware xử lý khi client gọi route không tồn tại (404)
app.use(notFoundHandler)

// 5. Middleware xử lý lỗi tập trung (bắt buộc đặt cuối cùng sau routes và 404)
app.use(errorHandler)

export default app
export { app }
