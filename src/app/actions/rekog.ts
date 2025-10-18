/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import {
  RekognitionClient,
  CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand,
  type GetFaceLivenessSessionResultsCommandOutput,
} from '@aws-sdk/client-rekognition';
import { fromIni } from '@aws-sdk/credential-providers';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const REGION = process.env.AWS_REGION || 'eu-west-1';

// --- AWS clients ---
const rekog = new RekognitionClient({
  region: REGION,
  credentials:
    process.env.NODE_ENV === 'development'
      ? fromIni({ profile: process.env.AWS_PROFILE || 'amplify-dev' })
      : undefined,
});
const s3 = new S3Client({
  region: REGION,
  credentials:
    process.env.NODE_ENV === 'development'
      ? fromIni({ profile: process.env.AWS_PROFILE || 'amplify-dev' })
      : undefined,
});

// Read bucket name from env (simplest). You can also pull from amplify_outputs.json if you prefer.
const LIVENESS_BUCKET = process.env.LIVENESS_BUCKET; // set this to the Amplify Storage bucket name
const LIVENESS_PREFIX = process.env.LIVENESS_PREFIX || 'liveness/';
const PRESIGN = process.env.LIVENESS_PRESIGN === 'true';

// --- Helpers ---
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
async function waitForResults(sessionId: string, maxTries = 10, delayMs = 400) {
  for (let i = 0; i < maxTries; i++) {
    const out = await rekog.send(
      new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId })
    );
    console.log('[getResults][poll]', {
      i,
      status: out.Status,
      confidence: out.Confidence,
      hasRefBytes: !!out.ReferenceImage?.Bytes,
      hasRefS3: !!out.ReferenceImage?.S3Object,
      auditCount: out.AuditImages?.length || 0,
    });
    if (out.Status && out.Status !== 'IN_PROGRESS') return out;
    await sleep(delayMs);
  }
  // Final attempt
  return await rekog.send(
    new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId })
  );
}

// --- API: Create session with OutputConfig (primary path) ---
export async function createSessionServer() {
  const Settings: any = { AuditImagesLimit: 2,
    ChallengePreferences: [
      { Type: 'FaceMovementChallenge', MaxRetries:5 },
    ],
   }; // default is 0; bump so you get audits if needed

  // Primary: ask Rekognition to write images straight to your Amplify bucket
  if (process.env.LIVENESS_BUCKET) {
    Settings.OutputConfig = {
      S3Bucket: process.env.LIVENESS_BUCKET,
      S3KeyPrefix: process.env.LIVENESS_PREFIX || 'liveness/',
    };
  } else {
    console.warn('[server] LIVENESS_BUCKET not set or bucket missing — skipping OutputConfig; will fallback to bytes upload.');
  }


  const out = await rekog.send(new CreateFaceLivenessSessionCommand({ Settings }));
  console.log('[createSession] raw', out); // <-- log the whole return
  if (!out.SessionId) throw new Error('No SessionId');
  return { sessionId: out.SessionId };
}

// --- API: Get results with storage fallbacks ---
export async function getResultsServer(sessionId: string) {
  const out = (await waitForResults(sessionId)) as GetFaceLivenessSessionResultsCommandOutput;

  const status = out.Status ?? 'UNKNOWN';
  const confidence = out.Confidence ?? 0;

  // Prefer ReferenceImage first
  const ref = out.ReferenceImage;
  const refS3 = ref?.S3Object;
  const refBytes = ref?.Bytes;

  // Fallback to first audit image if needed
  const audit0 = out.AuditImages?.[0];
  const auditBytes = audit0?.Bytes;

  console.log('[getResults][final]', {
    status,
    confidence,
    hasRefBytes: !!refBytes,
    hasAuditBytes: !!auditBytes,
    refS3, // logs bucket/key if present
  });

  // If Rekognition already wrote to S3 via OutputConfig, return a URL
  if (refS3?.Bucket && refS3.Name) {
    const url = PRESIGN
      ? await getSignedUrl(s3, new GetObjectCommand({ Bucket: refS3.Bucket, Key: refS3.Name }), { expiresIn: 60 })
      : `https://${refS3.Bucket}.s3.${REGION}.amazonaws.com/${refS3.Name}`;

    console.log('[getResults] using Rekognition S3 object', { url });
    return { status, confidence, referenceImageUrl: url };
  }

  // Fallback 1: no S3Object -> upload the bytes we got into your Amplify bucket
  if (LIVENESS_BUCKET && (refBytes || auditBytes)) {
    const key = `${LIVENESS_PREFIX}${sessionId}/reference.jpg`;
    const body = Buffer.from((refBytes || auditBytes) as Uint8Array);

    await s3.send(
      new PutObjectCommand({
        Bucket: LIVENESS_BUCKET,
        Key: key,
        Body: body,
        ContentType: 'image/jpeg',
      })
    );
    const url = PRESIGN
      ? await getSignedUrl(s3, new GetObjectCommand({ Bucket: LIVENESS_BUCKET, Key: key }), { expiresIn: 60 })
      : `https://${LIVENESS_BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

    console.log('[getResults] uploaded fallback to Amplify Storage', { key, url });
    return { status, confidence, referenceImageUrl: url };
  }

  // Fallback 2: return base64 to at least show something
  if (refBytes || auditBytes) {
    const base64 = Buffer.from((refBytes || auditBytes) as Uint8Array).toString('base64');
    console.log('[getResults] returning base64 (no S3 available)', { length: base64.length });
    return { status, confidence, referenceImageBase64: base64 };
  }

  // Fallback 3: no image available
  console.log('[getResults] no image available');
  return { status, confidence, referenceImageUrl: null, referenceImageBase64: null };
}
