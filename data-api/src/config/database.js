import net from 'node:net'
import { AsyncLocalStorage } from 'node:async_hooks'
import { Sequelize } from 'sequelize'
import { env } from './env.js'

/**
 * Ngữ cảnh bất đồng bộ lưu trữ tài nguyên riêng của từng yêu cầu readiness.
 */
const readinessContext = new AsyncLocalStorage()

/**
 * Danh sách toàn cục theo dõi mọi socket kết nối của tiến trình (phục vụ Graceful Shutdown).
 */
const allActiveSockets = new Set()

/**
 * Bảng theo dõi trạng thái và quyền sở hữu (ownership) chi tiết của từng socket/connection theo vòng đời:
 * - INITIALIZING: Đang mở TCP, bắt tay handshake hoặc chạy 'SET time_zone'. Có deadline khởi tạo riêng.
 * - IDLE: Kết nối khỏe, đã khởi tạo xong và đang rảnh rỗi trong pool.
 * - IN_USE: Đang được một request cụ thể sử dụng độc quyền (currentSession trỏ tới request đó).
 * - DESTROYED: Đã bị đóng hoặc hủy.
 */
const socketDescriptors = new Map()

/**
 * Tập hợp theo dõi các session readiness đang hoạt động đồng thời trên tiến trình.
 */
const activeReadinessSessions = new Set()

let socketCounter = 1
let sessionCounter = 1

/**
 * Khởi tạo Sequelize instance dùng chung duy nhất cho mỗi tiến trình Data API.
 * - Pool nhỏ (max: 5, min: 0).
 * - acquire và connectTimeout được giới hạn bởi dbReadinessTimeoutMs (< 5000ms).
 * - Timezone cố định UTC (+00:00).
 * - Khai báo databaseVersion '8.4.4' cố định để Sequelize không bao giờ cần tạo versionPromise.
 */
export const sequelize = new Sequelize(env.dbName, env.dbUser, env.dbPassword, {
  host: env.dbHost,
  port: env.dbPort,
  dialect: 'mysql',
  timezone: '+00:00',
  databaseVersion: '8.4.4',
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: env.dbReadinessTimeoutMs,
    idle: 10000,
  },
  dialectOptions: {
    connectTimeout: env.dbReadinessTimeoutMs,
    stream: (opts) => {
      const socket = net.connect(opts.config.port, opts.config.host)
      const connId = socketCounter++

      const desc = {
        id: connId,
        socket,
        conn: null,
        state: 'INITIALIZING',
        currentSession: null,
        initTimer: null,
        createdAt: Date.now(),
      }
      socketDescriptors.set(socket, desc)
      allActiveSockets.add(socket)

      // Deadline khởi tạo độc lập cho mọi kết nối mới (bao phủ TCP connect, handshake và SET time_zone)
      const initTimeoutMs = env.dbReadinessTimeoutMs
      desc.initTimer = setTimeout(() => {
        if (desc.state === 'INITIALIZING') {
          desc.state = 'DESTROYED'
          if (!socket.destroyed) {
            socket.destroy(new Error('Connection initialization deadline exceeded'))
          }
        }
      }, initTimeoutMs)

      const cleanupSocket = () => {
        if (desc.initTimer) {
          clearTimeout(desc.initTimer)
          desc.initTimer = null
        }
        desc.state = 'DESTROYED'
        if (desc.currentSession) {
          if (desc.currentSession.conn === desc.conn) {
            desc.currentSession.conn = null
          }
          desc.currentSession = null
        }
        socketDescriptors.delete(socket)
        allActiveSockets.delete(socket)
      }

      socket.once('close', cleanupSocket)
      socket.once('error', cleanupSocket)

      return socket
    },
  },
})

// Hook afterConnect: giải phóng timer khởi tạo ngay khi kết nối hoàn tất SET time_zone
sequelize.afterConnect((conn) => {
  const socket = conn?.stream
  const desc = socket ? socketDescriptors.get(socket) : null
  if (desc) {
    if (desc.initTimer) {
      clearTimeout(desc.initTimer)
      desc.initTimer = null
    }
    desc.conn = conn
    if (desc.state === 'INITIALIZING') {
      desc.state = 'IDLE'
    }
  }
})

// Bọc pool.acquire để liên kết trực tiếp hàng đợi deferred với request hiện tại
const origPoolAcquire = sequelize.connectionManager.pool.acquire.bind(sequelize.connectionManager.pool)
sequelize.connectionManager.pool.acquire = function (...args) {
  const currentSession = readinessContext.getStore()
  const promise = origPoolAcquire(...args)
  if (currentSession && !currentSession.isDone) {
    const lastDef = this._pendingAcquires[this._pendingAcquires.length - 1]
    if (lastDef) {
      currentSession.deferred = lastDef
    }
  }
  return promise
}

/**
 * Thực thi kiểm tra readiness trong phạm vi một session độc lập.
 */
async function executeReadinessCheck(session, timeoutMs) {
  const startTime = Date.now()
  const deadline = startTime + timeoutMs
  let timer = null

  // Tạo lỗi chuẩn DATABASE_UNAVAILABLE
  const createUnavailableError = (msg = 'Database readiness timeout') => {
    const err = new Error(msg)
    err.code = 'DATABASE_UNAVAILABLE'
    return err
  }

  // Hàm dọn dẹp tài nguyên cô lập: chỉ hủy tài nguyên thuộc quyền sở hữu của session này
  const abortSessionResources = () => {
    // 1. Hủy bỏ hàng đợi acquire trong pool nếu request hết hạn khi chưa nhận được kết nối
    if (session.deferred) {
      const def = session.deferred
      session.deferred = null
      sequelize.connectionManager.pool._pendingAcquires = sequelize.connectionManager.pool._pendingAcquires.filter((p) => p !== def)
      try {
        def.reject(createUnavailableError('Readiness deadline exceeded while waiting for pool connection'))
      } catch {}
    }

    // 2. CHỈ hủy connection nếu connection đó ĐANG THUỘC QUYỀN SỞ HỮU của session này
    if (session.conn) {
      const connToDestroy = session.conn
      session.conn = null

      const socket = connToDestroy.stream
      const desc = socket ? socketDescriptors.get(socket) : null

      if (!desc || desc.currentSession === session) {
        if (desc) {
          desc.state = 'DESTROYED'
          desc.currentSession = null
        }
        try {
          if (socket && !socket.destroyed) {
            socket.destroy(new Error('Readiness deadline exceeded'))
          }
        } catch {}
        try {
          if (typeof connToDestroy.destroy === 'function') connToDestroy.destroy()
          sequelize.connectionManager.pool.destroy(connToDestroy)
        } catch {}
      }
    }

    // 3. Thu hồi các kết nối đang khởi tạo bị bỏ rơi nếu KHÔNG CÒN request nào khác đang đợi
    const hasOtherActiveSessions = Array.from(activeReadinessSessions).some((s) => s !== session && !s.isDone)
    if (!hasOtherActiveSessions) {
      for (const [sock, desc] of socketDescriptors) {
        if (desc.state === 'INITIALIZING') {
          desc.state = 'DESTROYED'
          if (desc.initTimer) {
            clearTimeout(desc.initTimer)
            desc.initTimer = null
          }
          try {
            if (!sock.destroyed) {
              sock.destroy(new Error('Abandoned connection initialization after session timeout'))
            }
          } catch {}
        }
      }
    }
  }

  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      if (session.isDone) return
      session.isDone = true
      activeReadinessSessions.delete(session)
      abortSessionResources()
      reject(createUnavailableError())
    }, timeoutMs)
  })

  const acquirePromise = sequelize.connectionManager
    .getConnection()
    .then((acquiredConn) => {
      session.deferred = null
      if (session.isDone) {
        // Đã hết deadline trước khi acquire xong: tiêu hủy ngay kết nối đến muộn
        try {
          const sock = acquiredConn.stream
          const desc = sock ? socketDescriptors.get(sock) : null
          if (desc) {
            desc.state = 'DESTROYED'
            desc.currentSession = null
          }
          if (sock && !sock.destroyed) sock.destroy(new Error('Late connection after deadline'))
          if (typeof acquiredConn.destroy === 'function') acquiredConn.destroy()
          sequelize.connectionManager.pool.destroy(acquiredConn)
        } catch {}
        return null
      }

      // Gắn quyền sở hữu độc quyền cho session hiện tại
      session.conn = acquiredConn
      const sock = acquiredConn.stream
      const desc = sock ? socketDescriptors.get(sock) : null
      if (desc) {
        if (desc.currentSession && desc.currentSession !== session) {
          if (desc.currentSession.conn === acquiredConn) {
            desc.currentSession.conn = null
          }
        }
        desc.currentSession = session
        desc.state = 'IN_USE'
        desc.conn = acquiredConn
      }
      return acquiredConn
    })
    .catch((err) => {
      session.deferred = null
      if (session.isDone) return null
      throw err
    })

  try {
    const conn = await Promise.race([acquirePromise, timeoutPromise])
    if (!conn || session.isDone) {
      throw createUnavailableError('Failed to acquire connection within deadline')
    }

    // Tính toán chính xác thời gian còn lại cho câu query ping từ ngân sách chung
    const remainingTime = deadline - Date.now()
    if (remainingTime <= 30) {
      throw createUnavailableError('Readiness deadline exhausted before query')
    }

    // Thực hiện truy vấn ping 'SELECT 1+1 AS result' với thời gian còn lại
    const pingPromise = new Promise((resolve, reject) => {
      conn.query({ sql: 'SELECT 1+1 AS result', timeout: remainingTime }, (err, rows) => {
        if (err) return reject(err)
        resolve(rows)
      })
    })

    await Promise.race([pingPromise, timeoutPromise])

    session.isDone = true
    if (timer) clearTimeout(timer)
    activeReadinessSessions.delete(session)

    // Giải phóng quyền sở hữu khi trả kết nối về pool
    const connToRelease = session.conn
    session.conn = null
    session.deferred = null

    if (connToRelease) {
      const sock = connToRelease.stream
      const desc = sock ? socketDescriptors.get(sock) : null
      if (desc && desc.currentSession === session) {
        desc.currentSession = null
        desc.state = 'IDLE' // trở về trạng thái rảnh rỗi trong pool
      }
      await sequelize.connectionManager.releaseConnection(connToRelease)
    }

    return true
  } catch (err) {
    session.isDone = true
    if (timer) clearTimeout(timer)
    activeReadinessSessions.delete(session)
    abortSessionResources()
    // Chuẩn hóa mã lỗi thành DATABASE_UNAVAILABLE khi ném ra controller
    if (!err.code || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED' || err.name === 'SequelizeConnectionError') {
      err.code = 'DATABASE_UNAVAILABLE'
    }
    throw err
  }
}

/**
 * Kiểm tra readiness của cơ sở dữ liệu với ngân sách thời gian giới hạn nghiêm ngặt.
 * Cơ chế bảo đảm dứt điểm:
 * 1. Mỗi lần kiểm tra chạy trong một session cô lập qua AsyncLocalStorage.
 * 2. Một ngân sách chung duy nhất (master deadline) bao trùm toàn bộ các bước.
 * 3. Quản lý trạng thái và quyền sở hữu (ownership) rõ ràng cho từng socket/connection theo vòng đời pool.
 * 4. Thu hồi tài nguyên chính xác: chỉ hủy kết nối thuộc session lỗi; không hủy kết nối của session khác.
 * 5. Mọi kết nối đang khởi tạo đều có deadline hữu hạn, tự động thu hồi khi treo hoặc bị bỏ rơi.
 * 6. Giữ nguyên một Sequelize/pool dùng chung, không đóng hay tạo mới instance mỗi request.
 */
export async function checkDatabaseReadiness(timeoutMs = env.dbReadinessTimeoutMs) {
  const session = {
    id: sessionCounter++,
    conn: null,
    deferred: null,
    isDone: false,
    timeoutMs,
    startTime: Date.now(),
    deadline: Date.now() + timeoutMs,
  }
  activeReadinessSessions.add(session)
  return readinessContext.run(session, () => executeReadinessCheck(session, timeoutMs))
}

/**
 * Đóng kết nối Sequelize an toàn khi tiến trình dừng (Graceful Shutdown)
 */
export async function closeDatabase() {
  try {
    for (const socket of allActiveSockets) {
      try {
        if (!socket.destroyed) socket.destroy()
      } catch {}
    }
    allActiveSockets.clear()
    socketDescriptors.clear()
    activeReadinessSessions.clear()
    await sequelize.close()
  } catch {
    // Bỏ qua lỗi đóng DB khi dừng
  }
}
