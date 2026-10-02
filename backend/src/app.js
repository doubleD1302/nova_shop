import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { env } from './config/env.js'
import healthRouter from './routes/health.routes.js'
import { notFoundHandler } from './middlewares/not-found.middleware.js'
import { errorHandler } from './middlewares/error.middleware.js'

// Khởi tạo instance ứng dụng Express
const app = express()

// 1. Thiết lập các header bảo mật HTTP cơ bản
app.use(helmet())

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

// 3. Phân tích cú pháp dữ liệu JSON từ body request (giới hạn tối đa 1MB)
app.use(express.json({ limit: '1mb' }))

// 4. Khai báo các API routes với tiền tố /api/v1
app.use('/api/v1', healthRouter)

// 5. Middleware xử lý khi client gọi route không tồn tại (404)
app.use(notFoundHandler)

// 6. Middleware xử lý lỗi tập trung (bắt buộc đặt cuối cùng sau routes và 404)
app.use(errorHandler)

export default app
export { app }
