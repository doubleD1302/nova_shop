import net from 'node:net'
import tls from 'node:tls'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import os from 'node:os'
import { Duplex } from 'node:stream'
import { spawn } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
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
  _read() { this.rawSocket.resume() }
  _write(chunk, encoding, callback) { this.rawSocket.write(chunk, encoding, callback) }
  _final(callback) { this.rawSocket.end(callback) }
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

function createMockTlsServer(creds) {
  const serverActiveSockets = new Set()
  const secureContext = tls.createSecureContext({
    cert: creds.certPem,
    key: creds.keyPem,
  })

  const server = net.createServer((socket) => {
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
          if (queryText.includes('HANG_QUERY')) {
            // Cố tình treo query, không phản hồi để client kích hoạt deadline timeout
            return
          }
          if (queryText.includes('SET time_zone') || queryText.includes('SELECT VERSION()')) {
            tlsSocket.write(makePacket(Buffer.from([0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00]), seq + 1))
          } else if (queryText.includes('SELECT 1+1') || queryText.includes('SELECT 1')) {
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

  return { server, serverActiveSockets }
}

/**
 * Khởi chạy worker child process thực thi trực tiếp module runtime database.js
 */
function runRuntimeWorkerScript(workerScriptContent, customEnv = {}, tempDir) {
  return new Promise((resolve, reject) => {
    const workerFile = path.join(tempDir, `worker-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`)
    fs.writeFileSync(workerFile, workerScriptContent, 'utf8')

    let stdout = ''
    let stderr = ''
    const child = spawn(process.execPath, [workerFile], {
      cwd: rootDir,
      env: {
        ...process.env,
        ...customEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })

    const timeout = setTimeout(() => {
      try { child.kill('SIGKILL') } catch {}
      reject(new Error(`Worker timeout after 10000ms: ${stderr}`))
    }, 10000)

    child.on('exit', (code, sig) => {
      clearTimeout(timeout)
      try { fs.unlinkSync(workerFile) } catch {}
      resolve({ code, sig, stdout, stderr })
    })

    child.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
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
  const missingEndCaPath = path.join(tempDir, 'missing-end-ca.pem')
  const bundleCaPath = path.join(tempDir, 'bundle-ca.pem')
  const untrustedCaPath = path.join(tempDir, 'untrusted-ca.pem')

  const serverCreds = generateSelfSignedCert({ commonName: '127.0.0.1', altNames: ['127.0.0.1', 'localhost'] })
  const otherUntrustedCreds = generateSelfSignedCert({ commonName: 'other.domain.test', altNames: ['other.domain.test'] })
  const secondValidCreds = generateSelfSignedCert({ commonName: 'ca2.shopnova.test', altNames: ['ca2.shopnova.test'] })
  const mismatchServerCreds = generateSelfSignedCert({ commonName: 'other.domain.shopnova', altNames: ['other.domain.shopnova'] })
  const mismatchCaPath = path.join(tempDir, 'mismatch-ca.pem')
  fs.writeFileSync(mismatchCaPath, mismatchServerCreds.certPem, 'utf8')

  fs.writeFileSync(validCaPath, serverCreds.certPem, 'utf8')
  fs.writeFileSync(emptyCaPath, '', 'utf8')
  fs.writeFileSync(invalidContentCaPath, '-----BEGIN CERTIFICATE-----\nNOT_BASE64_CERT_CONTENT_HERE\n-----END CERTIFICATE-----\n', 'utf8')
  fs.writeFileSync(missingEndCaPath, serverCreds.certPem.replace('-----END CERTIFICATE-----', ''), 'utf8')
  fs.writeFileSync(bundleCaPath, `${serverCreds.certPem}\n${secondValidCreds.certPem}`, 'utf8')
  fs.writeFileSync(untrustedCaPath, otherUntrustedCreds.certPem, 'utf8')

  try {
    // ------------------------------------------------------------------------
    // PHẦN 1: Kiểm thử thẩm định cấu hình TLS (Config Validation) trong env.js
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

    // 1.3 DB_SSL_ENABLED nhận giá trị không hợp lệ (yes, 1, tru, enabled, invalid_val) -> ném lỗi
    {
      for (const val of ['yes', '1', 'tru', 'enabled', 'invalid_val', 'true_false']) {
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

    // 1.6 DB_SSL_CA trỏ đến file rỗng -> ném lỗi
    {
      let errEmpty = null
      try {
        parseAndValidateEnv({ ...baseEnv, DB_SSL_ENABLED: 'true', DB_SSL_CA: emptyCaPath }, false)
      } catch (e) {
        errEmpty = e
      }
      assert(errEmpty !== null, 'DB_SSL_CA trỏ đến file rỗng bị từ chối')
    }

    // 1.7 DB_SSL_CA thiếu thẻ END CERTIFICATE -> ném lỗi
    {
      let errMissingEnd = null
      try {
        parseAndValidateEnv({ ...baseEnv, DB_SSL_ENABLED: 'true', DB_SSL_CA: missingEndCaPath }, false)
      } catch (e) {
        errMissingEnd = e
      }
      assert(errMissingEnd !== null, 'DB_SSL_CA thiếu thẻ END CERTIFICATE bị từ chối')
      assert(errMissingEnd?.message?.includes('DB_SSL_CA'), 'Thông báo lỗi chỉ rõ biến DB_SSL_CA khi thiếu thẻ kết thúc')
    }

    // 1.8 DB_SSL_CA có nội dung không parse được bằng X.509 (chứng chỉ hỏng) -> ném lỗi an toàn
    {
      let errCorrupted = null
      try {
        parseAndValidateEnv({ ...baseEnv, DB_SSL_ENABLED: 'true', DB_SSL_CA: invalidContentCaPath }, false)
      } catch (e) {
        errCorrupted = e
      }
      assert(errCorrupted !== null, 'DB_SSL_CA có nội dung chứng chỉ X.509 bị hỏng bị từ chối')
      assert(errCorrupted?.message?.includes('DB_SSL_CA'), 'Thông báo lỗi chỉ rõ biến DB_SSL_CA khi chứng chỉ hỏng')
    }

    // 1.9 DB_SSL_ENABLED=true với file CA bundle hợp lệ (2 chứng chỉ) -> parse thành công
    {
      const parsedBundle = parseAndValidateEnv({ ...baseEnv, DB_SSL_ENABLED: 'true', DB_SSL_CA: bundleCaPath }, false)
      assert(parsedBundle.dbSslEnabled === true, 'DB_SSL_ENABLED=true với CA bundle được parse thành boolean true')
      assert(parsedBundle.dbSslCa === bundleCaPath, 'dbSslCa lưu đúng đường dẫn file CA bundle')
      assert(
        typeof parsedBundle.dbSslCaContent === 'string' &&
        parsedBundle.dbSslCaContent.includes(secondValidCreds.certPem.trim()),
        'dbSslCaContent đọc đầy đủ nội dung CA bundle hợp lệ'
      )
    }

    // 1.10 DB_SSL_ENABLED=true với file CA đơn hợp lệ -> parse thành công
    {
      const parsed = parseAndValidateEnv({ ...baseEnv, DB_SSL_ENABLED: 'true', DB_SSL_CA: validCaPath }, false)
      assert(parsed.dbSslEnabled === true, 'DB_SSL_ENABLED=true được parse thành boolean true')
      assert(parsed.dbSslCa === validCaPath, 'dbSslCa lưu đúng đường dẫn file CA')
      assert(typeof parsed.dbSslCaContent === 'string' && parsed.dbSslCaContent.includes('-----BEGIN CERTIFICATE-----'), 'dbSslCaContent đọc đúng nội dung chứng chỉ PEM')
    }

    // ------------------------------------------------------------------------
    // PHẦN 2: Kiểm thử xác minh TLS và Module Runtime Data API (database.js)
    // ------------------------------------------------------------------------
    console.log('\n[PHẦN 2: Kiểm thử Module Runtime Data API (src/config/database.js) qua Mock MySQL TLS Server]')

    // Khởi động Mock MySQL TLS Server chính (cấp chứng chỉ hợp lệ cho 127.0.0.1)
    const { server: mockTlsServer, serverActiveSockets } = createMockTlsServer(serverCreds)
    await new Promise((resolve) => mockTlsServer.listen(0, '127.0.0.1', resolve))
    const mockTlsPort = mockTlsServer.address().port

    // Khởi động Mock MySQL TLS Server phụ dùng cert mismatch (cấp chứng chỉ cho other.domain.shopnova)
    const { server: mismatchTlsServer, serverActiveSockets: mismatchSockets } = createMockTlsServer(mismatchServerCreds)
    await new Promise((resolve) => mismatchTlsServer.listen(0, '127.0.0.1', resolve))
    const mismatchTlsPort = mismatchTlsServer.address().port

    const dbModuleUrl = pathToFileURL(path.resolve(rootDir, 'src/config/database.js')).href

    const baseWorkerEnv = {
      DB_HOST: '127.0.0.1',
      DB_PORT: String(mockTlsPort),
      DB_NAME: 'shopnova_dev',
      DB_USER: 'shopnova_data_api',
      DB_PASSWORD: 'test_db_password_123',
      DATA_API_KEY: 'test_service_key_456',
      DB_SSL_ENABLED: 'true',
      DB_SSL_CA: validCaPath,
      DB_READINESS_TIMEOUT_MS: '2000',
      DOTENV_CONFIG_PATH: path.join(tempDir, 'empty.env'),
    }

    // 2.1 Truy vấn qua TLS thành công trên chính module runtime Data API
    {
      const workerCode = `
import { checkDatabaseReadiness, executeQuery, closeDatabase } from '${dbModuleUrl}'

try {
  const readyResult = await checkDatabaseReadiness()
  const rows = await executeQuery('SELECT 1+1 AS result')
  await closeDatabase()
  if (rows && rows[0]?.result === 2) {
    console.log('SUCCESS_QUERY_TLS')
    process.exit(0)
  }
  process.exit(2)
} catch (err) {
  console.error('ERROR:', err)
  process.exit(1)
}
`
      const res = await runRuntimeWorkerScript(workerCode, baseWorkerEnv, tempDir)
      assert(res.code === 0, 'Worker runtime kết thúc thành công với exit code 0')
      assert(res.stdout.includes('SUCCESS_QUERY_TLS'), 'Truy vấn qua TLS thành công bằng chính module runtime Data API (result: 2)')
    }

    // 2.2 Từ chối CA không tin cậy qua chính module runtime Data API
    {
      const workerCodeUntrusted = `
import { checkDatabaseReadiness, closeDatabase, isDatabaseUnavailableError } from '${dbModuleUrl}'

try {
  await checkDatabaseReadiness()
  await closeDatabase()
  process.exit(2) // Lẽ ra phải thất bại!
} catch (err) {
  await closeDatabase().catch(() => {})
  const isUnavailable = isDatabaseUnavailableError(err)
  const isSslHandshake =
    err.code === 'HANDSHAKE_SSL_ERROR' ||
    err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    (err.message && err.message.toLowerCase().includes('certificate'))
  if (isUnavailable && isSslHandshake) {
    console.log('REJECTED_UNTRUSTED_CA')
    process.exit(0)
  }
  console.error('Unexpected error details:', err)
  process.exit(1)
}
`
      const res = await runRuntimeWorkerScript(workerCodeUntrusted, { ...baseWorkerEnv, DB_SSL_CA: untrustedCaPath }, tempDir)
      assert(res.code === 0, 'Kết nối với CA không tin cậy bị từ chối bởi rejectUnauthorized: true trên runtime')
      assert(res.stdout.includes('REJECTED_UNTRUSTED_CA'), 'Lỗi xác minh CA không tin cậy được phân loại chuẩn xác thành DATABASE_UNAVAILABLE')
    }

    // 2.3 Từ chối hostname không khớp qua chính module runtime Data API
    {
      const workerCodeMismatch = `
import { checkDatabaseReadiness, closeDatabase, isDatabaseUnavailableError } from '${dbModuleUrl}'

try {
  await checkDatabaseReadiness()
  await closeDatabase()
  process.exit(2) // Lẽ ra phải thất bại!
} catch (err) {
  await closeDatabase().catch(() => {})
  const isUnavailable = isDatabaseUnavailableError(err)
  const isAltNameError =
    err.code === 'ERR_TLS_CERT_ALTNAME_INVALID' ||
    (err.original && err.original.code === 'ERR_TLS_CERT_ALTNAME_INVALID') ||
    (err.parent && err.parent.code === 'ERR_TLS_CERT_ALTNAME_INVALID') ||
    (err.message && (err.message.includes('altnames') || err.message.includes('Hostname') || err.message.includes('does not match')))
  if (isUnavailable && isAltNameError) {
    console.log('REJECTED_HOSTNAME_MISMATCH')
    process.exit(0)
  }
  console.error('Unexpected error details for hostname mismatch:', err)
  process.exit(1)
}
`
      const res = await runRuntimeWorkerScript(workerCodeMismatch, { ...baseWorkerEnv, DB_PORT: String(mismatchTlsPort), DB_SSL_CA: mismatchCaPath }, tempDir)
      assert(res.code === 0, 'Kết nối bị từ chối khi hostname không khớp cert SAN bởi verifyIdentity: true')
      assert(res.stdout.includes('REJECTED_HOSTNAME_MISMATCH'), 'Lỗi hostname không khớp (ERR_TLS_CERT_ALTNAME_INVALID) được phân loại chuẩn xác')
    }

    // 2.4 Kết nối khỏe vẫn hoạt động sau deadline khởi tạo trên chính module runtime Data API
    {
      const workerCodeInitTimer = `
import { executeQuery, closeDatabase } from '${dbModuleUrl}'

try {
  // 1. Truy vấn ban đầu để khởi tạo connection vào pool
  const rows1 = await executeQuery('SELECT 1+1 AS result')
  if (!rows1 || rows1[0]?.result !== 2) process.exit(2)

  // 2. Chờ 1800ms (vượt quá ngân sách khởi tạo DB_READINESS_TIMEOUT_MS = 1200ms)
  await new Promise((res) => setTimeout(res, 1800))

  // 3. Thực thi truy vấn tiếp theo trên connection sẵn có
  const rows2 = await executeQuery('SELECT 1+1 AS result')
  await closeDatabase()

  if (rows2 && rows2[0]?.result === 2) {
    console.log('ACTIVE_AFTER_INIT_DEADLINE')
    process.exit(0)
  }
  process.exit(3)
} catch (err) {
  console.error('Error in init deadline test:', err)
  await closeDatabase().catch(() => {})
  process.exit(1)
}
`
      const res = await runRuntimeWorkerScript(workerCodeInitTimer, { ...baseWorkerEnv, DB_READINESS_TIMEOUT_MS: '1200' }, tempDir)
      assert(res.code === 0, 'Kết nối khỏe vẫn hoạt động bình thường sau deadline khởi tạo trên runtime')
      assert(res.stdout.includes('ACTIVE_AFTER_INIT_DEADLINE'), 'Hook afterConnect đã giải phóng initTimer, kết nối không bị hủy nhầm')
    }

    // 2.5 Request timeout không hủy connection của request đồng thời
    // 2.6 Thu hồi connection lỗi và phục hồi trên cùng tiến trình
    {
      const workerCodeConcurrent = `
import { executeQuery, closeDatabase, isDatabaseUnavailableError } from '${dbModuleUrl}'

try {
  let reqATimedOut = false
  let reqBSuccess = false
  let reqCRecovered = false

  // Đồng thời chạy Request A (bị treo truy vấn ở Mock Server) và Request B (truy vấn bình thường)
  const promiseA = executeQuery('SELECT /* HANG_QUERY */ 1', [], 1000)
    .then(() => { process.exit(2) })
    .catch((err) => {
      if (isDatabaseUnavailableError(err)) {
        reqATimedOut = true
      }
    })

  const promiseB = executeQuery('SELECT 1+1 AS result', [], 3000)
    .then((rows) => {
      if (rows && rows[0]?.result === 2) {
        reqBSuccess = true
      }
    })

  await Promise.all([promiseA, promiseB])

  if (!reqATimedOut || !reqBSuccess) {
    console.error('ReqA or ReqB failed status:', { reqATimedOut, reqBSuccess })
    process.exit(3)
  }

  // Chạy Request C trên CÙNG TIẾN TRÌNH để xác nhận phục hồi hoàn toàn sau lỗi
  const rowsC = await executeQuery('SELECT 1+1 AS result', [], 3000)
  if (rowsC && rowsC[0]?.result === 2) {
    reqCRecovered = true
  }

  await closeDatabase()

  if (reqATimedOut && reqBSuccess && reqCRecovered) {
    console.log('CONCURRENT_ISOLATION_AND_RECOVERY_SUCCESS')
    process.exit(0)
  }
  process.exit(4)
} catch (err) {
  console.error('Concurrent test error:', err)
  await closeDatabase().catch(() => {})
  process.exit(1)
}
`
      const res = await runRuntimeWorkerScript(workerCodeConcurrent, baseWorkerEnv, tempDir)
      assert(res.code === 0, 'Kiểm thử đồng thời và phục hồi hoàn tất thành công')
      assert(
        res.stdout.includes('CONCURRENT_ISOLATION_AND_RECOVERY_SUCCESS'),
        'Request A timeout không hủy connection của Request B đồng thời; Request C phục hồi thành công trên cùng tiến trình'
      )
    }

    // Dọn dẹp Mock Servers
    for (const s of serverActiveSockets) {
      try { s.destroy() } catch {}
    }
    serverActiveSockets.clear()
    await new Promise((res) => mockTlsServer.close(res)).catch(() => {})

    for (const s of mismatchSockets) {
      try { s.destroy() } catch {}
    }
    mismatchSockets.clear()
    await new Promise((res) => mismatchTlsServer.close(res)).catch(() => {})

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
