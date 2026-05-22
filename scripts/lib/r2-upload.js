import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

export function getR2Config() {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_PUBLIC_URL,
  } = process.env;

  const missing = [
    ['R2_ACCOUNT_ID', R2_ACCOUNT_ID],
    ['R2_ACCESS_KEY_ID', R2_ACCESS_KEY_ID],
    ['R2_SECRET_ACCESS_KEY', R2_SECRET_ACCESS_KEY],
    ['R2_BUCKET_NAME', R2_BUCKET_NAME],
    ['R2_PUBLIC_URL', R2_PUBLIC_URL],
  ]
    .filter(([, v]) => !v || String(v).includes('your_'))
    .map(([k]) => k);

  if (missing.length) {
    return { ok: false, missing };
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });

  return {
    ok: true,
    client,
    bucket: R2_BUCKET_NAME,
    publicBase: R2_PUBLIC_URL.replace(/\/$/, ''),
  };
}

export async function uploadBufferToR2(client, bucket, publicBase, key, buffer, contentType) {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000',
    })
  );
  return `${publicBase}/${key}`;
}
