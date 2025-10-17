'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ensureAmplifyConfigured } from '@/lib/amplifyClient'; // remove if using Core+STS
import { Modal } from 'react-responsive-modal';
/*Eslint ignore ts*/
import 'react-responsive-modal/styles.css';
import {useRouter} from 'next/navigation';



import {
  Card,
  View,
  Heading,
  Flex,
  Button,
  Alert,
  ThemeProvider,
  useTheme,
} from '@aws-amplify/ui-react';

import { createSessionServer, getResultsServer } from '@/app/actions/rekog';
import { X } from 'lucide-react';


const FaceLivenessDetector = dynamic(
  () => import('@aws-amplify/ui-react-liveness').then((m) => m.FaceLivenessDetector),
  { ssr: false, loading: () => <p>Loading camera…</p> }
);

// Configure Amplify once (only if you’re using Amplify Identity Pool guest creds)
ensureAmplifyConfigured();

type Phase = 'idle' | 'recording' | 'verifying' | 'done' | 'failed';

export default function LivenessWidget() {
  const { tokens } = useTheme();

  const [sessionId, setSessionId] = React.useState<string | null>(null);

  const router = useRouter();

  // Keep numeric/status data separate
  const [imageData, setImageData] = React.useState<{
    Confidence?: number;
    userSelectedConfidence?: number;
    Status?: string;
  } | null>(null);

  // Single place to read from for display/storage
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  // UI + flow control
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [showDetector, setShowDetector] = React.useState<boolean>(false);

  // Initialize with safe defaults, then read localStorage in useEffect
  const [userSelectedConfidence, setUserSelectedConfidence] = React.useState<number>(80);
  const [openConsent, setOpenConsent] = React.useState<boolean>(true);

  const region = process.env.NEXT_PUBLIC_AWS_REGION || 'eu-west-1';

  // Helper to start a fresh session
  const startSession = React.useCallback(async () => {
    setPhase('idle');
    setImageUrl(null);
    setImageData(null);
    setSessionId(null);

    const out = await createSessionServer();
    console.log('[client] createSessionServer ->', out);

    if ('sessionId' in out && out.sessionId) {
      setSessionId(out.sessionId!);
      setShowDetector(true);   // mount the detector
      setPhase('recording');   // user is doing the challenge now
    } else {
      console.error('[client] Failed to create session', out);
      setPhase('failed');
    }
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = 70;
    if (stored) setUserSelectedConfidence(Number(stored));

    const consent = window.localStorage.getItem('userConsent');
    setOpenConsent(!consent);

    // start a fresh session once on mount (after consent, we’ll start again)
    (async () => {
      await startSession();
    })();
  }, [startSession]);
  
  // inside LivenessWidget
    React.useEffect(() => {
    const html = document.documentElement;
    const styleId = 'lv-force-color-style';
    if (showDetector) {
        html.classList.add('lv-recording');
        document.body.classList.add('lv-recording');
        if (!document.getElementById(styleId)) {
        const s = document.createElement('style');
        s.id = styleId;
        s.textContent = `
            html.lv-recording, html.lv-recording * {
            -webkit-filter: none !important;
            filter: none !important;
            -webkit-backdrop-filter: none !important;
            backdrop-filter: none !important;
            mix-blend-mode: normal !important;
            forced-color-adjust: none !important;
            }
            html.lv-recording, html.lv-recording body { background: #fff !important; }
        `;
        document.head.appendChild(s);
        }
    } else {
        html.classList.remove('lv-recording');
        document.body.classList.remove('lv-recording');
        const s = document.getElementById(styleId);
        if (s) s.remove();
    }
    return () => {
        html.classList.remove('lv-recording');
        document.body.classList.remove('lv-recording');
        const s = document.getElementById(styleId);
        if (s) s.remove();
    };
    }, [showDetector]);


    const goHome = async () => { 
        // Reset all states
        setPhase('idle');
        setImageUrl(null);
        setImageData(null);
        setSessionId(null);
        setShowDetector(false);
        setOpenConsent(true);
        //redirect to home page
        router.replace('/');
    }
  const handleConsent = async () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('userConsent', 'true');
    }
    setOpenConsent(false);
    await startSession();
  };

  const onUserCancel = async () => {
    console.log('[client] user cancelled — restarting session');
    await startSession();
  };

  const onAnalysisComplete = async () => {
    if (!sessionId) return;
    console.log('[client] onAnalysisComplete — fetching results for', sessionId);

    setPhase('verifying');
    const res = await getResultsServer(sessionId);
    console.log('[client] getResultsServer ->', res);

    // 🔑 Unmount the detector immediately so no overlay lingers
    setShowDetector(false);

    const confidence = res.confidence ?? 0;
    setImageData({
      Confidence: confidence,
      userSelectedConfidence,
      Status: res.status,
    });

    // Prefer a durable URL from the server (e.g., S3 object URL)
    if (res.referenceImageUrl) {
      setImageUrl(res.referenceImageUrl);

      // If you want to store it in your DB, call your API here:
      // try {
      //   await fetch('/api/audit-images', {
      //     method: 'POST',
      //     headers: { 'Content-Type': 'application/json' },
      //     body: JSON.stringify({ sessionId, confidence, url: res.referenceImageUrl }),
      //   });
      //   console.log('[client] stored audit url in DB');
      // } catch (e) { console.error('[client] failed to store audit url', e); }
    } else if (res.referenceImageBase64) {
      // Fallback: still show it; if needed, you can upload this to Storage from server
      setImageUrl(`data:image/jpeg;base64,${res.referenceImageBase64}`);
    } else {
      setImageUrl(null);
    }

    if (res.status === 'SUCCEEDED' && confidence >= userSelectedConfidence) {
      setPhase('done');
    } else {
      setPhase('failed');
    }
  };

  return (
    <ThemeProvider>
      {openConsent ? (
        <View>
          <Modal open={openConsent} showCloseIcon={false} onClose={() => {}}>
            <Alert hasIcon isDismissible={false}>
              <Heading level={6} marginBottom={tokens.space.small} fontWeight={tokens.fontWeights.light}>
                This feature uses AWS technology to perform liveness verification. By continuing, you consent to the processing of your image for identity verification and fraud prevention by Globiexplore.
              </Heading>
              <Flex justifyContent="center" gap="1rem">
                <Button variation="primary" onClick={handleConsent}>OK</Button>
              </Flex>
            </Alert>
          </Modal>
        </View>
      ) : sessionId ? (
        <>
          {/* Status & threshold */}
          <Alert variation="info" hasIcon>
            <Flex alignItems="center" justifyContent="space-between" width="100%">
                <Heading level={6} margin="0">
                Verification Session
                {imageData?.Status && <> — Status: {imageData.Status}</>}
                </Heading>

                <Button size="small" variation="link" onClick={goHome} ariaLabel="Close Alert">
                <X size={16} />
                </Button>
            </Flex>
          </Alert>

          {/* {phase !== 'done' && phase !== 'failed' && (
            <Flex justifyContent="center" gap="2rem">
              <SliderField
                label="Set liveness score:"
                value={userSelectedConfidence}
                onChange={(v) => {
                  if (typeof window !== 'undefined') {
                    window.localStorage.setItem('userSelectedConfidence', String(v));
                  }
                  setUserSelectedConfidence(Number(v));
                }}
                formatValue={(v) => `${v}`}
              />
            </Flex>
          )} */}

          <Card>
            <Flex justifyContent="center">
              {/* Keep a predictable box; helps the internal overlay place controls correctly */}
              {showDetector ? (
                <View as="div" style={{ height: 600, width: 740, maxWidth: '100%' }}>
                  <FaceLivenessDetector
                    sessionId={sessionId}
                    region={region}
                    onUserCancel={onUserCancel}
                    onAnalysisComplete={onAnalysisComplete}
                    onError={(e) => {
                      console.error('[client] Detector error', e);
                      setShowDetector(false);
                      setPhase('failed');
                    }}
                  />
                </View>
              ) : (
                <View as="div" style={{ padding: 16, textAlign: 'center' }}>
                  {phase === 'verifying' && (
                    <div style={{ display: 'grid', placeItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 34, height: 34, borderRadius: '50%',
                          border: '3px solid #d6d6d6', borderTopColor: '#7b3f00',
                          animation: 'spin .9s linear infinite'
                        }}
                      />
                      <p>Verifying results…</p>
                      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  )}

                  {(phase === 'done' || phase === 'failed') && (
                    <>
                      <Alert variation={phase === 'done' ? 'success' : 'error'} hasIcon>
                        {phase === 'done'
                          ? <> Verified. </>
                          : <>Not verified. Try again.</>}
                      </Alert>
                    {phase === 'done'
                          ? (
                      <div style={{ marginTop: 12 }}>
                        <Button onClick={goHome}>Rerun Home</Button>
                      </div>
                     ) : (
                      <div style={{ marginTop: 12 }}>
                        <Button onClick={startSession}>New check</Button>
                      </div>
                    )} </>
                )} 
                </View>
              )}
            </Flex>
          </Card>
        </>
      ) : (
        <Button isLoading loadingText="Loading..." variation="primary" />
      )}
    </ThemeProvider>
  );
}
