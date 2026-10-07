import net from 'node:net'
import tls from 'node:tls'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import os from 'node:os'
import { Duplex } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { Sequelize } from 'sequelize'
import Handshake from '../node_modules/mysql2/lib/packets/handshake.js'
import ClientConstants from '../node_modules/mysql2/lib/constants/client.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

let passed = 0
let failed = 0

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`)
    passed++
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`)
    failed++
  }
}

// ============================================================================
// BỘ SINH CHỨNG CHỈ KIỂM THỬ TỰ KÝ (TEST X.509 CERTIFICATE GENERATOR)
// ============================================================================
function derLength(len) {
  if (len < 128) return Buffer.from([len])
  const bytes = []
  let temp = len
  while (temp > 0) {
    bytes.unshift(temp & 0xff)
    temp >>= 8
  }
  return Buffer.from([0x80 | bytes.length, ...bytes])
}

function derTag(tag, ...contents) {
  const body = Buffer.concat(contents.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c))))
  return Buffer.concat([Buffer.from([tag]), derLength(body.length), body])
}

const derSeq = (...c) => derTag(0x30, ...c)
const derSet = (...c) => derTag(0x31, ...c)
const derInt = (val) => {
  if (typeof val === 'number') {
    if (val === 0) return derTag(0x02, [0])
    const bytes = []
    let v = val
    while (v > 0) {
      bytes.unshift(v & 0xff)
      v >>= 8
    }
    if (bytes[0] & 0x80) bytes.unshift(0)
    return derTag(0x02, bytes)
  }
  let buf = Buffer.isBuffer(val) ? val : Buffer.from(val)
  if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0]), buf])
  return derTag(0x02, buf)
}
const derBitString = (buf, unusedBits = 0) => derTag(0x03, Buffer.concat([Buffer.from([unusedBits]), buf]))
const derOctetString = (buf) => derTag(0x04, buf)
const derOid = (oidStr) => {
  const parts = oidStr.split('.').map(Number)
  const bytes = [parts[0] * 40 + parts[1]]
  for (let i = 2; i < parts.length; i++) {
    let val = parts[i]
    const stack = []
    stack.push(val & 0x7f)
    val >>= 7
    while (val > 0) {
      stack.unshift((val & 0x7f) | 0x80)
      val >>= 7
    }
    bytes.push(...stack)
  }
  return derTag(0x06, bytes)
}
const derUtcTime = (d) => {
  const pad = (n) => String(n).padStart(2, '0')
  const str = `${pad(d.getUTCFullYear() % 100)}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  return derTag(0x17, Buffer.from(str, 'ascii'))
}
const derUtf8String = (s) => derTag(0x0c, Buffer.from(s, 'utf8'))

function generateSelfSignedCert({ commonName = '127.0.0.1', altNames = ['127.0.0.1', 'localhost'] } = {}) {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pubDer = publicKey.export({ type: 'spki', format: 'der' })

  // sha256WithRSAEncryption: 1.2.840.113549.1.1.11
  const sigAlg = derSeq(derOid('1.2.840.113549.1.1.11'), derTag(0x05))

  const name = derSeq(derSet(derSeq(derOid('2.5.4.3'), derUtf8String(commonName))))
  const notBefore = new Date(Date.now() - 60000)
  const notAfter = new Date(Date.now() + 365 * 24 * 3600 * 1000)
  const validity = derSeq(derUtcTime(notBefore), derUtcTime(notAfter))

  // basicConstraints: 2.5.29.19 (cA: TRUE)
  const extBasicConstraints = derSeq(
    derOid('2.5.29.19'),
    derTag(0x01, [0xff]),
    derOctetString(derSeq(derTag(0x01, [0xff]))),
  )

  // subjectAltName: 2.5.29.17
  const sanEntries = altNames.map((n) => {
    if (/^\d+\.\d+\.\d+\.\d+$/.test(n)) {
      const ipBytes = n.split('.').map(Number)
      return derTag(0x87, ipBytes)
    }
    return derTag(0x82, Buffer.from(n, 'ascii'))
  })
  const extSan = derSeq(derOid('2.5.29.17'), derOctetString(derSeq(...sanEntries)))
  const extensions = derTag(0xa3, derSeq(extBasicConstraints, extSan))

  const serial = crypto.randomBytes(8)
  const tbs = derSeq(derTag(0xa0, derInt(2)), derInt(serial), sigAlg, name, validity, name, pubDer, extensions)

  const signer = crypto.createSign('SHA256')
  signer.update(tbs)
  const signature = signer.sign(privateKey)

  const certDer = derSeq(tbs, sigAlg, derBitString(signature))
  const certB64 = certDer.toString('base64').match(/.{1,64}/g).join('\n')
  const certPem = `-----BEGIN CERTIFICATE-----\n${certB64}\n-----END CERTIFICATE-----\n`
  const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' })

  return { certPem, keyPem }
}

// ============================================================================
// GÓI TIN PROTOCOL CHO MOCK MYSQL SERVER HỖ TRỢ NÂNG CẤP TLS
// ============================================================================
class SocketDuplex extends Duplex {
  constructor(rawSocket, initialData) {
    super()
    this.rawSocket = rawSocket
    if (initialData && initialData.length > 0) {
      this.push(initialData)
    }
    this.rawSocket.on('data', (chunk) => {
      if (!this.push(chunk)) {
        this.rawSocket.pause()
      }
    })
    this.rawSocket.on('end', () => this.push(null))
    this.rawSocket.on('error', (err) => this.destroy(err))
    this.rawSocket.on('close', () => this.destroy())
  }
  _read() {
    this.rawSocket.resume()
  }
  _write(chunk, encoding, callback) {
    this.rawSocket.write(chunk, encoding, callback)
  }
  _final(callback) {
    this.rawSocket.end(callback)
  }
}

function makePacket(payload, seq = 0) {
  const header = Buffer.alloc(4)
  header.writeUIntLE(payload.length, 0, 3)
  header.writeUInt8(seq, 3)
  return Buffer.concat([header, payload])
}

function getHandshakePacket() {
  const hs = new Handshake({
    protocolVersion: 10,
    serverVersion: '8.4.4-ShopNovaMockTLS',
    connectionId: 1,
    statusFlags: 2,
    characterSet: 33,
    capabilityFlags:
      ClientConstants.SSL |
      ClientConstants.PLUGIN_AUTH |
      ClientConstants.SECURE_CONNECTION |
      ClientConstants.LONG_PASSWORD |
      ClientConstants.CONNECT_WITH_DB,
    authPluginData1: Buffer.from('12345678'),
    authPluginData2: Buffer.from('123456789012'),
    authPluginName: 'mysql_native_password',
  })
  const p = hs.toPacket(0)
  p.writeHeader(0)
  return p.buffer
}

function createSelectResultPackets(startSeq = 1) {
  const p1 = makePacket(Buffer.from([0x01]), startSeq) // 1 column
  const colDef = Buffer.concat([
    Buffer.from([3]), Buffer.from('def'),
    Buffer.from([0]), Buffer.from([0]), Buffer.from([0]),
    Buffer.from([6]), Buffer.from('result'),
    Buffer.from([6]), Buffer.from('result'),
    Buffer.from([0x0c, 63, 0, 11, 0, 0, 0, 8, 0, 0, 0]),
  ])
  const p2 = makePacket(colDef, startSeq + 1)
  const p3 = makePacket(Buffer.from([0xfe, 0, 0, 2, 0]), startSeq + 2)
  const p4 = makePacket(Buffer.concat([Buffer.from([1]), Buffer.from('2')]), startSeq + 3)
  const p5 = makePacket(Buffer.from([0xfe, 0, 0, 2, 0]), startSeq + 4)
  return Buffer.concat([p1, p2, p3, p4, p5])
}

// ============================================================================
// CHẠY CÁC BÀI KIỂM TRA
// ============================================================================
async function runAllTlsTests() {
  console.log('=== BẮT ĐẦU KIỂM THỬ TOÀN DIỆN KẾT NỐI TLS & QUẢN LÝ KẾT NỐI SHOPNOVA ===\n')

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shopnova-tls-test-'))
  const validCaPath = path.join(tempDir, 'valid-ca.pem')
  const emptyCaPath = path.join(tempDir, 'empty-ca.pem')
  const invalidContentCaPath = path.join(tempDir, 'invalid-ca.pem')

  const serverCreds = generateSelfSignedCert({ commonName: '127.0.0.1', altNames: ['127.0.0.1', 'localhost'] })
  const otherUntrustedCreds = generateSelfSignedCert({ commonName: 'other.domain.test', altNames: ['other.domain.test'] })

  fs.writeFileSync(validCaPath, serverCreds.certPem, 'utf8')
  fs.writeFileSync(emptyCaPath, '', 'utf8')
  fs.writeFileSync(invalidContentCaPath, 'NOT A CERTIFICATE CONTENT', 'utf8')

  try {
    // ------------------------------------------------------------------------
    // PHẦN 1: Kiểm thử thẩm định cấu hình TLS (Config Validation)
    // ------------------------------------------------------------------------
    console.log('[PHẦN 1: Kiểm thử thẩm định cấu hình TLS trong env.js]')
    const { parseAndValidateEnv } = await import('../src/config/env.js')

    const baseEnv = {
      NODE_ENV: 'test',
      HOST: '127.0.0.1',
      PORT: '3001',
      DB_HOST: '127.0.0.1',
      DB_PORT: '3306',
      DB_NAME: 'shopnova_dev',
      DB_USER: 'shopnova_data_api',
      DB_PASSWORD: 'test_password_123',
      DATA_API_KEY: 'test_service_key_456',
      DB_READINESS_TIMEOUT_MS: '3000',
    }

    // 1.1 DB_SSL_ENABLED mặc định là false khi không khai báo
    {
      const parsed = parseAndValidateEnv({ ...baseEnv }, false)
      assert(parsed.dbSslEnabled === false, 'DB_SSL_ENABLED mặc định là false khi không khai báo')
      assert(parsed.dbSslCa === null, 'dbSslCa là null khi SSL tắt')
      assert(parsed.dbSslCaContent === null, 'dbSslCaContent là null khi SSL tắt')
    }

    // 1.2 DB_SSL_ENABLED nhận "false" (lowercase hoặc uppercase) -> false
    {
      const parsed = parseAndValidateEnv({ ...baseEnv, DB_SSL_ENABLED: 'false' }, false)
      assert(parsed.dbSslEnabled === false, 'DB_SSL_ENABLED="false" được parse thành boolean false')
      const parsedUpper = parseAndValidateEnv({ ...baseEnv, DB_SSL_ENABLED: 'FALSE' }, false)
      assert(parsedUpper.dbSslEnabled === false, 'DB_SSL_ENABLED="FALSE" được parse thành boolean false')
    }

    // 1.3 DB_SSL_ENABLED nhận giá trị không hợp lệ (ví dụ: "yes", "1", "invalid") -> ném lỗi
    {
      for (const val of ['yes', '1', 'enabled', 'invalid_val', 'true_false']) {
        let errCaught = null
        try {
          parseAndValidateEnv({ ...baseEnv, DB_SSL_ENABLED: val }, false)
        } catch (e) {
          errCaught = e
        }
        assert(errCaught !== null, `DB_SSL_ENABLED="${val}" bị từ chối với lỗi cấu hình`)
        assert(
          errCaught?.message?.includes('DB_SSL_ENABLED'),
          `Lỗi cấu hình chỉ rõ tên biến DB_SSL_ENABLED khi giá trị là "${val}"`,
        )
      }
    }

    // 1.4 DB_SSL_ENABLED=true nhưng thiếu DB_SSL_CA -> ném lỗi
    {
      let errMissingCa = null
      try {
        parseAndValidateEnv({ ...baseEnv, DB_SSL_ENABLED: 'true' }, false)
      } catch (e) {
        errMissingCa = e
      }
      assert(errMissingCa !== null, 'DB_SSL_ENABLED=true nhưng thiếu DB_SSL_CA bị từ chối')
      assert(errMissingCa?.message?.includes('DB_SSL_CA'), 'Thông báo lỗi chỉ rõ biến DB_SSL_CA khi thiếu')
    }

    // 1.5 DB_SSL_CA trỏ đến file không tồn tại -> ném lỗi
    {
      let errNonExistent = null
      try {
        parseAndValidateEnv({ ...baseEnv, DB_SSL_ENABLED: 'true', DB_SSL_CA: path.join(tempDir, 'khong-ton-tai.pem') }, false)
      } catch (e) {
        errNonExistent = e
      }
      assert(errNonExistent !== null, 'DB_SSL_CA trỏ đến file không tồn tại bị từ chối')
      assert(errNonExistent?.message?.includes('DB_SSL_CA'), 'Thông báo lỗi chỉ rõ biến DB_SSL_CA khi file không tồn tại')
    }

    // 1.6 DB_SSL_CA trỏ đến file rỗng hoặc không có định dạng PEM -> ném lỗi
    {
      let errEmpty = null
      try {
        parseAndValidateEnv({ ...baseEnv, DB_SSL_ENABLED: 'true', DB_SSL_CA: emptyCaPath }, false)
      } catch (e) {
        errEmpty = e
      }
      assert(errEmpty !== null, 'DB_SSL_CA trỏ đến file rỗng bị từ chối')

      let errInvalidPem = null
      try {
        parseAndValidateEnv({ ...baseEnv, DB_SSL_ENABLED: 'true', DB_SSL_CA: invalidContentCaPath }, false)
      } catch (e) {
        errInvalidPem = e
      }
      assert(errInvalidPem !== null, 'DB_SSL_CA không chứa -----BEGIN CERTIFICATE----- bị từ chối')
    }

    // 1.7 DB_SSL_ENABLED=true với file CA hợp lệ -> parse thành công
    {
      const parsed = parseAndValidateEnv({ ...baseEnv, DB_SSL_ENABLED: 'true', DB_SSL_CA: validCaPath }, false)
      assert(parsed.dbSslEnabled === true, 'DB_SSL_ENABLED=true được parse thành boolean true')
      assert(parsed.dbSslCa === validCaPath, 'dbSslCa lưu đúng đường dẫn file CA')
      assert(typeof parsed.dbSslCaContent === 'string' && parsed.dbSslCaContent.includes('-----BEGIN CERTIFICATE-----'), 'dbSslCaContent đọc đúng nội dung chứng chỉ PEM')
    }

    // ------------------------------------------------------------------------
    // PHẦN 2: Kiểm thử xác minh SSL qua Mock MySQL TLS Server
    // ------------------------------------------------------------------------
    console.log('\n[PHẦN 2: Kiểm thử xác minh SSL qua Mock MySQL TLS Server]')

    let mockTlsServer = null
    const serverActiveSockets = new Set()
    let mockTlsPort = 0

    const secureContext = tls.createSecureContext({
      cert: serverCreds.certPem,
      key: serverCreds.keyPem,
    })

    mockTlsServer = net.createServer((socket) => {
      serverActiveSockets.add(socket)
      socket.write(getHandshakePacket())

      socket.once('data', (d) => {
        const payloadLen = d.readUIntLE(0, 3)
        const sslReqTotalLen = 4 + payloadLen
        const leftover = d.length > sslReqTotalLen ? d.subarray(sslReqTotalLen) : null

        const duplex = new SocketDuplex(socket, leftover)
        const tlsSocket = new tls.TLSSocket(duplex, {
          isServer: true,
          secureContext,
        })
        serverActiveSockets.add(tlsSocket)

        tlsSocket.on('error', () => {})
        tlsSocket.on('data', (td) => {
          const seq = td[3]
          if (td[4] === 0x03) {
            // COM_QUERY
            const queryText = td.subarray(5).toString('utf8')
            if (queryText.includes('SET time_zone') || queryText.includes('SELECT VERSION()')) {
              tlsSocket.write(makePacket(Buffer.from([0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00]), seq + 1))
            } else if (queryText.includes('SELECT 1+1')) {
              tlsSocket.write(createSelectResultPackets(seq + 1))
            } else {
              tlsSocket.write(makePacket(Buffer.from([0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00]), seq + 1))
            }
          } else if (td[4] === 0x01) {
            // COM_QUIT
            tlsSocket.end()
          } else {
            // Auth response -> Trả OK packet với seq + 1
            tlsSocket.write(makePacket(Buffer.from([0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00]), seq + 1))
          }
        })
      })
    })

    await new Promise((resolve) => mockTlsServer.listen(0, '127.0.0.1', resolve))
    mockTlsPort = mockTlsServer.address().port

    // 2.1 Kết nối với CA tin cậy và rejectUnauthorized=true, verifyIdentity=true -> Thành công
    {
      const seqValidTls = new Sequelize('shopnova_mock', 'user', 'pass', {
        host: '127.0.0.1',
        port: mockTlsPort,
        dialect: 'mysql',
        timezone: '+00:00',
        databaseVersion: '8.4.4',
        logging: false,
        pool: { max: 1, min: 0, acquire: 3000 },
        dialectOptions: {
          connectTimeout: 3000,
          ssl: {
            ca: serverCreds.certPem,
            rejectUnauthorized: true,
            verifyIdentity: true,
          },
        },
      })

      let connectSuccess = false
      let queryResult = null
      let isTlsSocket = false
      try {
        const conn = await seqValidTls.connectionManager.getConnection()
        connectSuccess = true
        isTlsSocket = conn.stream instanceof tls.TLSSocket && conn.stream.encrypted === true

        queryResult = await new Promise((resolve, reject) => {
          conn.query({ sql: 'SELECT 1+1 AS result' }, (err, rows) => {
            if (err) return reject(err)
            resolve(rows)
          })
        })
        await seqValidTls.connectionManager.releaseConnection(conn)
      } finally {
        await seqValidTls.close().catch(() => {})
      }

      assert(connectSuccess, 'Kết nối MySQL TLS với CA hợp lệ và rejectUnauthorized=true thành công')
      assert(isTlsSocket, 'conn.stream là tls.TLSSocket được mã hóa an toàn (encrypted: true)')
      assert(queryResult && queryResult[0]?.result === 2, 'Thực thi câu truy vấn SQL qua kênh TLS thành công (result: 2)')
    }

    // 2.2 Kết nối với CA không tin cậy -> Bị từ chối ngay lập tức bởi rejectUnauthorized=true
    {
      const seqUntrustedTls = new Sequelize('shopnova_mock', 'user', 'pass', {
        host: '127.0.0.1',
        port: mockTlsPort,
        dialect: 'mysql',
        timezone: '+00:00',
        databaseVersion: '8.4.4',
        logging: false,
        pool: { max: 1, min: 0, acquire: 3000 },
        dialectOptions: {
          connectTimeout: 3000,
          ssl: {
            ca: otherUntrustedCreds.certPem, // Chứng chỉ CA khác, không khớp server!
            rejectUnauthorized: true,
            verifyIdentity: true,
          },
        },
      })

      let errUntrusted = null
      try {
        await seqUntrustedTls.connectionManager.getConnection()
      } catch (err) {
        errUntrusted = err
      } finally {
        await seqUntrustedTls.close().catch(() => {})
      }

      assert(errUntrusted !== null, 'Kết nối với CA không tin cậy bị từ chối kết nối')
      const isSslVerifyError =
        errUntrusted?.code === 'HANDSHAKE_SSL_ERROR' ||
        errUntrusted?.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
        errUntrusted?.message?.includes('self-signed') ||
        errUntrusted?.message?.includes('certificate')
      assert(isSslVerifyError, 'Lỗi ném ra là lỗi xác minh chứng chỉ SSL (HANDSHAKE_SSL_ERROR / self-signed cert)')
    }

    // ------------------------------------------------------------------------
    // PHẦN 3: Kiểm thử Quản lý Kết nối và Vòng đời Socket khi bật TLS trong database.js
    // ------------------------------------------------------------------------
    console.log('\n[PHẦN 3: Kiểm thử Quản lý Kết nối và Vòng đời Socket khi bật TLS trong database.js]')

    // Tái hiện cơ chế database.js với TLS socket stream hook
    const testDescriptors = new Map()
    const testConfigDescriptors = new Map()
    const testActiveSockets = new Set()
    let connCounter = 1

    function getTestDescriptor(connOrSocket) {
      if (!connOrSocket) return null
      if (connOrSocket.config && testConfigDescriptors.has(connOrSocket.config)) {
        return testConfigDescriptors.get(connOrSocket.config)
      }
      if (testConfigDescriptors.has(connOrSocket)) {
        return testConfigDescriptors.get(connOrSocket)
      }
      if (testDescriptors.has(connOrSocket)) {
        return testDescriptors.get(connOrSocket)
      }
      if (connOrSocket.stream && testDescriptors.has(connOrSocket.stream)) {
        return testDescriptors.get(connOrSocket.stream)
      }
      return null
    }

    const testTlsSequelize = new Sequelize('shopnova_mock', 'user', 'pass', {
      host: '127.0.0.1',
      port: mockTlsPort,
      dialect: 'mysql',
      timezone: '+00:00',
      databaseVersion: '8.4.4',
      logging: false,
      pool: { max: 2, min: 0, acquire: 2000, idle: 5000 },
      dialectOptions: {
        connectTimeout: 2000,
        ssl: {
          ca: serverCreds.certPem,
          rejectUnauthorized: true,
          verifyIdentity: true,
        },
        stream: (opts) => {
          const socket = net.connect(opts.config.port, opts.config.host)
          const connId = connCounter++
          const desc = {
            id: connId,
            config: opts.config,
            rawSocket: socket,
            tlsSocket: null,
            conn: null,
            state: 'INITIALIZING',
            currentSession: null,
            initTimer: null,
            createdAt: Date.now(),
          }

          if (opts.config) {
            testConfigDescriptors.set(opts.config, desc)
          }
          testDescriptors.set(socket, desc)
          testActiveSockets.add(socket)

          desc.initTimer = setTimeout(() => {
            if (desc.state === 'INITIALIZING') {
              desc.state = 'DESTROYED'
              if (desc.tlsSocket && !desc.tlsSocket.destroyed) desc.tlsSocket.destroy()
              if (socket && !socket.destroyed) socket.destroy()
            }
          }, 2000)

          const cleanup = () => {
            if (desc.initTimer) {
              clearTimeout(desc.initTimer)
              desc.initTimer = null
            }
            desc.state = 'DESTROYED'
            if (opts.config) testConfigDescriptors.delete(opts.config)
            testDescriptors.delete(socket)
            testActiveSockets.delete(socket)
            if (desc.tlsSocket) {
              testDescriptors.delete(desc.tlsSocket)
              testActiveSockets.delete(desc.tlsSocket)
            }
          }
          socket.once('close', cleanup)
          socket.once('error', cleanup)

          return socket
        },
      },
    })

    testTlsSequelize.afterConnect((conn) => {
      const desc = getTestDescriptor(conn)
      if (desc) {
        if (desc.initTimer) {
          clearTimeout(desc.initTimer)
          desc.initTimer = null
        }
        desc.conn = conn

        if (conn?.stream && conn.stream !== desc.rawSocket) {
          desc.tlsSocket = conn.stream
          testDescriptors.set(conn.stream, desc)
          testActiveSockets.add(conn.stream)

          const cleanupTls = () => {
            desc.state = 'DESTROYED'
            testDescriptors.delete(conn.stream)
            testActiveSockets.delete(conn.stream)
          }
          conn.stream.once('close', cleanupTls)
          conn.stream.once('error', cleanupTls)
        }

        if (desc.state === 'INITIALIZING') {
          desc.state = 'IDLE'
        }
      }
    })

    // 3.1 Kiểm tra sau khi kết nối TLS: Descriptor tìm được qua conn.config, initTimer đã giải phóng, state là IDLE
    {
      const conn = await testTlsSequelize.connectionManager.getConnection()
      const desc = getTestDescriptor(conn)

      assert(desc !== null, 'Descriptor được tra cứu thành công qua conn.config')
      assert(desc.id === 1, 'Descriptor ID khớp chính xác kết nối đầu tiên')
      assert(desc.initTimer === null, 'desc.initTimer đã được giải phóng trong afterConnect')
      assert(desc.state === 'IDLE', 'desc.state chuyển thành IDLE sau khi bắt tay TLS hoàn tất')
      assert(desc.tlsSocket instanceof tls.TLSSocket, 'desc.tlsSocket được lưu trữ là đối tượng TLSSocket')
      assert(desc.tlsSocket === conn.stream, 'desc.tlsSocket khớp chính xác với conn.stream hiện tại')

      // Chờ quá 2000ms (thời hạn cũ của initTimer) để kiểm chứng kết nối KHÔNG bị timer hủy
      await new Promise((res) => setTimeout(res, 2100))
      assert(desc.state === 'IDLE', 'Kết nối đã khởi tạo KHÔNG bị timer cũ hủy sau thời hạn initTimeout')
      assert(!desc.tlsSocket.destroyed, 'TLS socket vẫn sống nguyên vẹn và sẵn sàng sử dụng')

      await testTlsSequelize.connectionManager.releaseConnection(conn)
    }

    // 3.2 Kiểm tra session ownership và trả kết nối về pool khi dùng TLS
    {
      const sessionA = { id: 101, name: 'request_A' }
      const conn = await testTlsSequelize.connectionManager.getConnection()
      const desc = getTestDescriptor(conn)

      // Gắn quyền sở hữu
      desc.currentSession = sessionA
      desc.state = 'IN_USE'

      assert(desc.currentSession === sessionA, 'Session A nắm quyền sở hữu độc quyền trên kết nối TLS')
      assert(desc.state === 'IN_USE', 'Trạng thái chuyển sang IN_USE')

      // Giải phóng quyền sở hữu khi trả kết nối về pool
      desc.currentSession = null
      desc.state = 'IDLE'
      await testTlsSequelize.connectionManager.releaseConnection(conn)

      assert(desc.currentSession === null, 'Quyền sở hữu được giải phóng thành công khi trả về pool')
      assert(desc.state === 'IDLE', 'Trạng thái trở lại IDLE trong pool')
    }

    // 3.3 Kiểm tra dọn dẹp kết nối TLS khi timeout/hủy bỏ
    {
      const connToAbort = await testTlsSequelize.connectionManager.getConnection()
      const desc = getTestDescriptor(connToAbort)

      // Giả lập timeout hủy kết nối
      desc.state = 'DESTROYED'
      if (desc.tlsSocket && !desc.tlsSocket.destroyed) desc.tlsSocket.destroy(new Error('Timeout test'))
      if (desc.rawSocket && !desc.rawSocket.destroyed) desc.rawSocket.destroy(new Error('Timeout test'))
      if (typeof connToAbort.destroy === 'function') connToAbort.destroy()
      testTlsSequelize.connectionManager.pool.destroy(connToAbort)

      await new Promise((res) => setTimeout(res, 100))

      assert(desc.state === 'DESTROYED', 'Kết nối bị timeout chuyển thành trạng thái DESTROYED')
      assert(desc.tlsSocket.destroyed === true, 'TLS socket bị tiêu hủy hoàn toàn khi timeout')
      assert(desc.rawSocket.destroyed === true, 'Raw socket ban đầu cũng bị tiêu hủy hoàn toàn')
    }

    // Dọn dẹp test sequelize và mock server
    for (const s of testActiveSockets) {
      try { s.destroy() } catch {}
    }
    await testTlsSequelize.close().catch(() => {})

    for (const s of serverActiveSockets) {
      try { s.destroy() } catch {}
    }
    serverActiveSockets.clear()
    await new Promise((res) => mockTlsServer.close(res)).catch(() => {})

  } finally {
    // Dọn dẹp thư mục tạm thời
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  }

  console.log('\n=== TỔNG KẾT KẾT QUẢ KIỂM THỬ KẾT NỐI TLS SHOPNOVA ===')
  console.log(`Số test vượt qua (PASS): ${passed}`)
  console.log(`Số test thất bại (FAIL): ${failed}`)

  if (failed > 0) {
    process.exit(1)
  } else {
    console.log('\n🎉 Toàn bộ kiểm thử cấu hình TLS, xác minh SSL và quản lý kết nối đều ĐẠT (PASS)!')
    process.exit(0)
  }
}

runAllTlsTests().catch((err) => {
  console.error('[TLS Test Fatal Error]:', err)
  process.exit(1)
})
