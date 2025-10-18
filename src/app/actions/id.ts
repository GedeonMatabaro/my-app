// /app/actions/id.ts
/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';
import { randomUUID } from 'crypto';
import { fromIni } from '@aws-sdk/credential-providers';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const REGION = process.env.AWS_REGION || 'eu-west-1';
const s3 = new S3Client({
  region: REGION,
  credentials: process.env.NODE_ENV === 'development' ? fromIni({ profile: process.env.AWS_PROFILE || 'amplify-dev' }) : undefined,
});

const IDS_BUCKET =  process.env.LIVENESS_BUCKET;
const IDS_PREFIX = process.env.IDS_PREFIX || 'ids/';
const IDS_PRESIGN = (process.env.IDS_PRESIGN ?? 'true') === 'true';

const ALLOWED = new Set(['image/jpeg','image/png','image/webp']);
const MAX_BYTES = 12 * 1024 * 1024; // 12MB

export type UploadResult = { bucket: string; key: string; url: string; kind: string; contentType: string; bytes: number };

export async function uploadIdServer(form: FormData): Promise<UploadResult> {
  if (!IDS_BUCKET) throw new Error('IDS_BUCKET not configured');
  const file = form.get('file') as File | null; if (!file) throw new Error('Missing file');
  if (!ALLOWED.has(file.type)) throw new Error('Unsupported type');
  if (file.size > MAX_BYTES) throw new Error('File too large');

  const kind = (form.get('kind') as string) || 'national_id';
  const userId = (form.get('userId') as string) || 'anon';
  const contentType = file.type;
  const ext = contentType === 'image/png' ? '.png' : contentType === 'image/webp' ? '.webp' : '.jpg';

  const key = `${IDS_PREFIX}${encodeURIComponent(userId)}/${kind}/${Date.now()}-${randomUUID()}${ext}`;
  const body = Buffer.from(await file.arrayBuffer());

  await s3.send(new PutObjectCommand({
    Bucket: IDS_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: 'private, max-age=0, no-cache',
  }));

  const url = IDS_PRESIGN
    ? await getSignedUrl(s3, new GetObjectCommand({ Bucket: IDS_BUCKET, Key: key }), { expiresIn: 90 })
    : `https://${IDS_BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

  return { bucket: IDS_BUCKET, key, url, kind, contentType, bytes: body.length };
}
