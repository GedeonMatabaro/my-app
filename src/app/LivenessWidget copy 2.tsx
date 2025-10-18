/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ensureAmplifyConfigured } from '@/lib/amplifyClient';
import { Modal } from 'react-responsive-modal';
import 'react-responsive-modal/styles.css';
import { useRouter } from 'next/navigation';

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
import { X, Camera as CameraIcon, Check as CheckIcon } from 'lucide-react';

// ⬇️ shadcn dropdown & button
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button as ShButton } from '@/components/ui/button';

const FaceLivenessDetector = dynamic(
  () => import('@aws-amplify/ui-react-liveness').then((m) => m.FaceLivenessDetector),
  { ssr: false, loading: () => <p>Loading camera…</p> }
);

// Configure Amplify once (only if you’re using Amplify Identity Pool guest creds)
ensureAmplifyConfigured();

type Phase = 'idle' | 'recording' | 'verifying' | 'done' | 'failed';

export default function LivenessWidget() {
  const { tokens } = useTheme();
  const router = useRouter();

  // ----- existing state -----
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [showDetector, setShowDetector] = React.useState<boolean>(false);
  const [imageData, setImageData] = React.useState<{ Confidence?: number; userSelectedConfidence?: number; Status?: string } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [openConsent, setOpenConsent] = React.useState<boolean>(true);
  const region = process.env.NEXT_PUBLIC_AWS_REGION || 'eu-west-1';

  // ----- camera selection (outside Amplify) -----
  const [cameras, setCameras] = React.useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = React.useState<string | null>(null);
  const [hasPermission, setHasPermission] = React.useState<boolean>(false);

  // keep original getUserMedia so we can restore on unmount
  const originalGUMRef = React.useRef<typeof navigator.mediaDevices.getUserMedia | null>(null);

  // score cameras to avoid IR/ToF, prefer front/user/selfie
  const scoreDevice = (d: MediaDeviceInfo) => {
    const L = (d.label || '').toLowerCase();
    let s = 0;
    if (/front|user|selfie/.test(L)) s += 2;
    if (/back|rear|environment/.test(L)) s -= 1;
    if (/ir|infrared|depth|tof|biometric/.test(L)) s -= 100;
    return s;
    // fallback: first device if labels are empty
  };

  const stopTracks = (ms?: MediaStream | null) => {
    ms?.getTracks().forEach((t) => t.stop());
  };

  // Request permission (to reveal labels) and enumerate devices
  const ensurePermission = React.useCallback(async () => {
    if (!navigator?.mediaDevices?.getUserMedia) return;
    try {
      const pre = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' } }, audio: false });
      stopTracks(pre);
      setHasPermission(true);
    } catch (e) {
      setHasPermission(false);
      throw e;
    }
  }, []);

  const enumerateCameras = React.useCallback(async () => {
    if (!navigator?.mediaDevices?.enumerateDevices) return;
    const list = await navigator.mediaDevices.enumerateDevices();
    const vids = list.filter((d) => d.kind === 'videoinput');
    // prefer non-IR
    const sorted = [...vids].sort((a, b) => scoreDevice(b) - scoreDevice(a));
    setCameras(sorted.length ? sorted : vids);
    if (!selectedCamera) {
      const pick = (sorted[0] || vids[0] || null)?.deviceId ?? null;
      setSelectedCamera(pick);
    }
  }, [selectedCamera]);

  // Monkey-patch getUserMedia to always use our selected camera (outside Amplify)
  const applyGumPatch = React.useCallback(
    (deviceId: string | null) => {
      if (!navigator?.mediaDevices?.getUserMedia) return;
      if (!originalGUMRef.current) {
        originalGUMRef.current = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      }
      const orig = originalGUMRef.current;

      navigator.mediaDevices.getUserMedia = async (constraints: MediaStreamConstraints) => {
        // If no selection, defer to original
        if (!deviceId) return orig(constraints);

        // Clone constraints and inject deviceId
        const c: MediaStreamConstraints = constraints ? { ...constraints } : { video: true };
        if (c.video) {
          const v: MediaTrackConstraints =
            typeof c.video === 'boolean' ? {} : { ...(c.video as MediaTrackConstraints) };

          // Always enforce our chosen device
          (v as any).deviceId = { exact: deviceId };

          // strip facingMode to avoid conflicts
          if ('facingMode' in v) delete (v as any).facingMode;

          c.video = v;
        } else {
          c.video = { deviceId: { exact: deviceId } };
        }
        return orig(c);
      };
    },
    []
  );

  const removeGumPatch = React.useCallback(() => {
    if (originalGUMRef.current) {
      navigator.mediaDevices.getUserMedia = originalGUMRef.current;
      originalGUMRef.current = null;
    }
  }, []);

  // Prime the chosen device (open+close exact stream once) and restart session
  const primeAndRestart = React.useCallback(
    async (deviceId: string | null) => {
      try {
        if (deviceId) {
          const s = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId } },
            audio: false,
          });
          stopTracks(s);
        }
      } catch (e) {
        console.warn('[camera] priming failed, continuing:', e);
      }
      // Unmount the widget and start a fresh session so Amplify calls gUM again (now patched)
      setShowDetector(false);
      setPhase('idle');
      await startSession();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // ----- session helpers -----
  const startSession = React.useCallback(async () => {
    setPhase('idle');
    setImageUrl(null);
    setImageData(null);
    setSessionId(null);

    const out = await createSessionServer();
    console.log('[client] createSessionServer ->', out);

    if ('sessionId' in out && out.sessionId) {
      setSessionId(out.sessionId!);
      setShowDetector(true);
      setPhase('recording');
    } else {
      console.error('[client] Failed to create session', out);
      setPhase('failed');
    }
  }, []);

  const goHome = React.useCallback(() => {
    setPhase('idle');
    setImageUrl(null);
    setImageData(null);
    setSessionId(null);
    setShowDetector(false);
    setOpenConsent(true);
    removeGumPatch();
    router.replace('/');
  }, [removeGumPatch, router]);

  // Mount: wait for consent → ask permission → enumerate → patch → start
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const consent = window.localStorage.getItem('userConsent');
    if (consent) {
      (async () => {
        try {
          await ensurePermission();
        } catch {}
        await enumerateCameras();
        applyGumPatch(selectedCamera); // may be null on first run; OK
        await startSession();
      })();
    } else {
      setOpenConsent(true);
    }
    return () => removeGumPatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConsent = async () => {
    if (typeof window !== 'undefined') window.localStorage.setItem('userConsent', 'true');
    setOpenConsent(false);
    try {
      await ensurePermission();
    } catch {}
    await enumerateCameras();
    applyGumPatch(selectedCamera);
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

    setShowDetector(false);

    const confidence = res.confidence ?? 0;
    setImageData({
      Confidence: confidence,
      userSelectedConfidence: 80,
      Status: res.status,
    });

    if (res.referenceImageUrl) setImageUrl(res.referenceImageUrl);
    else if (res.referenceImageBase64) setImageUrl(`data:image/jpeg;base64,${res.referenceImageBase64}`);
    else setImageUrl(null);

    if (res.status === 'SUCCEEDED' && confidence >= 80) setPhase('done');
    else setPhase('failed');
  };

  // Color-fidelity guard (keep)
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

  // ——— Header camera dropdown (shadcn) ———
  const CameraDropdown = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ShButton variant="ghost" size="icon" aria-label="Select camera" title="Select camera">
          <CameraIcon size={18} />
        </ShButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="bottom" className="w-64">
        {!hasPermission && (
          <DropdownMenuItem
            onClick={async () => {
              try {
                await ensurePermission();
                await enumerateCameras();
              } catch {
                // noop
              }
            }}
          >
            Grant camera access
          </DropdownMenuItem>
        )}
        {cameras.length === 0 && hasPermission && (
          <DropdownMenuItem disabled>No cameras found</DropdownMenuItem>
        )}
        {cameras.map((d, i) => {
          const label = d.label || `Camera ${i + 1}`;
          const active = selectedCamera === d.deviceId;
          return (
            <DropdownMenuItem
              key={d.deviceId || i}
              onClick={async () => {
                setSelectedCamera(d.deviceId);
                applyGumPatch(d.deviceId);     // force future gUM to use this device
                await primeAndRestart(d.deviceId); // unmount + restart session
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {active ? <CheckIcon size={16} /> : <span style={{ width: 16 }} />}
                <span>{label}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );

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
          {/* Header: title | camera dropdown | close */}
          <Alert variation="info" hasIcon>
            <Flex alignItems="center" justifyContent="space-between" width="100%" gap="0.75rem">
              <Heading level={6} margin="0" style={{ whiteSpace: 'nowrap' }}>
                Verification Session
              </Heading>

              <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                {CameraDropdown}
              </div>

              <Button size="small" variation="link" onClick={goHome} ariaLabel="Close Alert">
                <X size={16} />
              </Button>
            </Flex>
          </Alert>

          <Card>
            <Flex justifyContent="center">
              {showDetector ? (
                <View as="div" style={{ height: 600, width: 740, maxWidth: '100%' }}>
                  <FaceLivenessDetector
                    key={selectedCamera || 'default'} // remount on switch
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
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          border: '3px solid #d6d6d6',
                          borderTopColor: '#7b3f00',
                          animation: 'spin .9s linear infinite',
                        }}
                      />
                      <p>Verifying results…</p>
                      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                    </div>
                  )}

                  {(phase === 'done' || phase === 'failed') && (
                    <>
                      <Alert variation={phase === 'done' ? 'success' : 'error'} hasIcon>
                        {phase === 'done' ? <>Verified.</> : <>Not verified. Try again.</>}
                      </Alert>

                      {phase === 'done' ? (
                        <div style={{ marginTop: 12 }}>
                          <Button onClick={goHome}>Rerun Home</Button>
                        </div>
                      ) : (
                        <div style={{ marginTop: 12 }}>
                          <Button onClick={startSession}>New check</Button>
                        </div>
                      )}
                    </>
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
