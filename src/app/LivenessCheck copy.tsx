'use client';
import React, { Suspense, useState } from 'react';
import dynamic from 'next/dynamic';
import { ensureAmplifyConfigured } from '@/lib/amplifyClient';
import { createSessionServer, getResultsServer } from './actions/rekog';

ensureAmplifyConfigured();

const FaceLivenessDetector = dynamic(
  () =>
    import('@aws-amplify/ui-react-liveness').then(
      (m) => m.FaceLivenessDetector
    ),
  { ssr: false, loading: () => <p>Loading camera…</p> }
);

export default function LivenessCheck() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle'|'in-progress'|'success'|'failed'>('idle');
  const [confidence, setConfidence] = useState<number | null>(null);
  const [img, setImg] = useState<string | null>(null);

  async function start() {
    const { sessionId } = await createSessionServer();
    setSessionId(sessionId);
    setStatus('in-progress');
  }

  async function handleComplete() {
    if (!sessionId) return;
    const res = await getResultsServer(sessionId);
    setConfidence(res.confidence ?? 0);
    if ((res.confidence ?? 0) > 80) {
      setImg(res.referenceImageBase64 ? `data:image/jpeg;base64,${res.referenceImageBase64}` : null);
      setStatus('success');
    } else {
      setStatus('failed');
    }
  }

  if (status === 'idle') {
    return <button onClick={start} className="px-4 py-2 rounded bg-black text-white">Start Liveness Check</button>;
  }

  if (status === 'in-progress') {
    return (
      <Suspense fallback={<p>Loading…</p>}>
        <FaceLivenessDetector
          sessionId={sessionId!}
          region={process.env.NEXT_PUBLIC_AWS_REGION || 'eu-west-1'}
          onAnalysisComplete={handleComplete}
          onError={() => setStatus('failed')}
        />
      </Suspense>
    );
  }

  if (status === 'success') {
    return (
      <div>
        <p>✅ Verified — Confidence: {confidence}%</p>
        {img && <img src={img} alt="audit" width={200} style={{borderRadius:8}} />}
        <button onClick={() => location.reload()} className="mt-3 border px-3 py-1 rounded">New check</button>
      </div>
    );
  }

  return (
    <div>
      <p>❌ Verification failed (score {confidence ?? 'N/A'}%).</p>
      <button onClick={() => location.reload()} className="mt-3 border px-3 py-1 rounded">Retry</button>
    </div>
  );
}
