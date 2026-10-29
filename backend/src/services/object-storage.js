import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { env } from '../config/env.js'

const client = env.uploadStorage === 's3'
  ? new S3Client({
      region: env.s3Region,
      ...(env.s3Endpoint ? { endpoint: env.s3Endpoint } : {}),
      forcePathStyle: env.s3ForcePathStyle,
      credentials: {
        accessKeyId: env.s3AccessKeyId,
        secretAccessKey: env.s3SecretAccessKey,
      },
    })
  : null

export async function saveUploadedImage(filename, body, contentType) {
  if (!client) throw new Error('Object storage is not enabled.')
  await client.send(new PutObjectCommand({
    Bucket: env.s3Bucket,
    Key: filename,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }))
}

export async function getUploadedImage(filename) {
  if (!client) throw new Error('Object storage is not enabled.')
  const result = await client.send(new GetObjectCommand({
    Bucket: env.s3Bucket,
    Key: filename,
  }))
  if (!result.Body) throw new Error('Object storage returned an empty image.')
  return {
    body: Buffer.from(await result.Body.transformToByteArray()),
    contentType: result.ContentType,
  }
}

export function closeObjectStorage() {
  client?.destroy()
}
