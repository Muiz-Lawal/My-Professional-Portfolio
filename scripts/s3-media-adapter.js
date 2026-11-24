import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

const required = ['S3_REGION', 'S3_BUCKET', 'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY']
const missing = required.filter((key) => !process.env[key])
if (missing.length) {
  throw new Error(`Missing S3 environment variables: ${missing.join(', ')}`)
}

export const s3 = new S3Client({
  region: process.env.S3_REGION,
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  },
})

export async function putMedia(key, body, contentType) {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'public, max-age=86400',
  }))
  return process.env.S3_PUBLIC_BASE_URL
    ? `${process.env.S3_PUBLIC_BASE_URL.replace(/\/+$/, '')}/${key}`
    : `s3://${process.env.S3_BUCKET}/${key}`
}

export async function deleteMedia(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }))
}

export async function getMedia(key) {
  return s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }))
}
