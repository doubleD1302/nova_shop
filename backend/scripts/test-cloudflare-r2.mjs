import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'

// Nạp file .env từ thư mục backend
const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

console.log('=== KIỂM TRA KẾT NỐI CLOUDFLARE R2 (OBJECT STORAGE) ===\n')

const uploadStorage = (process.env.UPLOAD_STORAGE || 'local').trim().toLowerCase()
const s3Bucket = (process.env.S3_BUCKET || '').trim()
const s3Region = (process.env.S3_REGION || 'auto').trim()
const s3Endpoint = (process.env.S3_ENDPOINT || '').trim()
const s3AccessKeyId = (process.env.S3_ACCESS_KEY_ID || '').trim()
const s3SecretAccessKey = (process.env.S3_SECRET_ACCESS_KEY || '').trim()
const s3ForcePathStyle = (process.env.S3_FORCE_PATH_STYLE || 'false').trim().toLowerCase() === 'true'

console.log('Cấu hình hiện tại trong backend/.env:')
console.log(`- UPLOAD_STORAGE:       ${uploadStorage}`)
console.log(`- S3_BUCKET:            ${s3Bucket || '(chưa điền)'}`)
console.log(`- S3_REGION:            ${s3Region}`)
console.log(`- S3_ENDPOINT:          ${s3Endpoint || '(chưa điền)'}`)
console.log(`- S3_ACCESS_KEY_ID:     ${s3AccessKeyId ? s3AccessKeyId.slice(0, 6) + '...' : '(chưa điền)'}`)
console.log(`- S3_FORCE_PATH_STYLE:  ${s3ForcePathStyle}\n`)

if (uploadStorage !== 's3') {
  console.log('⚠️  LƯU Ý: UPLOAD_STORAGE hiện tại đang là "local", chưa bật chế độ "s3".')
  console.log('    Để sử dụng Cloudflare R2, vui lòng đặt UPLOAD_STORAGE=s3 trong file backend/.env\n')
}

if (!s3Bucket || !s3Endpoint || !s3AccessKeyId || !s3SecretAccessKey) {
  console.log('❌ THIẾU CẤU HÌNH:')
  if (!s3Bucket) console.log('   - Thiếu S3_BUCKET')
  if (!s3Endpoint) console.log('   - Thiếu S3_ENDPOINT (vd: https://<account_id>.r2.cloudflarestorage.com)')
  if (!s3AccessKeyId) console.log('   - Thiếu S3_ACCESS_KEY_ID')
  if (!s3SecretAccessKey) console.log('   - Thiếu S3_SECRET_ACCESS_KEY')
  console.log('\nVui lòng điền đầy đủ các biến trên vào backend/.env rồi chạy lại script này.')
  process.exit(1)
}

const client = new S3Client({
  region: s3Region,
  endpoint: s3Endpoint,
  forcePathStyle: s3ForcePathStyle,
  credentials: {
    accessKeyId: s3AccessKeyId,
    secretAccessKey: s3SecretAccessKey,
  },
})

async function runTest() {
  const testKey = `test-connection-${Date.now()}.txt`
  const testContent = 'ShopNova Cloudflare R2 Connection Test - ' + new Date().toISOString()

  try {
    console.log(`1. Kiểm tra kết nối và liệt kê danh sách Bucket [${s3Bucket}]...`)
    const listRes = await client.send(new ListObjectsV2Command({
      Bucket: s3Bucket,
      MaxKeys: 1,
    }))
    console.log('   ✓ Kết nối thành công! Đọc danh mục bucket hợp lệ.')

    console.log(`2. Thử nghiệm tải lên (Upload) file kiểm tra: ${testKey}...`)
    await client.send(new PutObjectCommand({
      Bucket: s3Bucket,
      Key: testKey,
      Body: Buffer.from(testContent, 'utf-8'),
      ContentType: 'text/plain',
      CacheControl: 'public, max-age=3600',
    }))
    console.log('   ✓ Ghi file lên Cloudflare R2 thành công!')

    console.log(`3. Thử nghiệm đọc lại (Download) file kiểm tra...`)
    const getRes = await client.send(new GetObjectCommand({
      Bucket: s3Bucket,
      Key: testKey,
    }))
    const downloadedText = await getRes.Body.transformToString()
    if (downloadedText === testContent) {
      console.log('   ✓ Đọc dữ liệu chính xác 100%!')
    } else {
      throw new Error('Dữ liệu tải về không khớp nội dung tải lên.')
    }

    console.log(`4. Dọn dẹp (Delete) file kiểm tra...`)
    await client.send(new DeleteObjectCommand({
      Bucket: s3Bucket,
      Key: testKey,
    }))
    console.log('   ✓ Đã xóa file kiểm tra trên Cloudflare R2 thành công!')

    console.log('\n🎉 XÁC NHẬN: TÀI KHOẢN CLOUDFLARE R2 ĐÃ ĐƯỢC KẾT NỐI VÀ HOẠT ĐỘNG HOÀN HẢO!')
  } catch (err) {
    console.error('\n❌ KẾT NỐI THẤT BẠI:')
    console.error(`- Mã lỗi: ${err.name || err.Code || 'UNKNOWN_ERROR'}`)
    console.error(`- Chi tiết: ${err.message}`)
    console.error('\nGợi ý khắc phục:')
    console.error('1. Kiểm tra S3_ENDPOINT xem đã đúng định dạng https://<account_id>.r2.cloudflarestorage.com chưa.')
    console.error('2. Kiểm tra tên Bucket có bị sai chính tả hoặc thừa khoảng trắng không.')
    console.error('3. Kiểm tra API Token trên Cloudflare có quyền Admin Read & Write trên Bucket này không.')
    process.exit(1)
  } finally {
    client.destroy()
  }
}

runTest()
