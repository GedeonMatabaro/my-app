/* eslint-disable @typescript-eslint/no-explicit-any */
// /components/id/IdCapture.tsx
'use client';
import React from 'react';
import type { IdKind } from '@/data/idTypes';
// import { TARGETS } from '@/data/idTypes';
import { evaluateGate, type Gate } from '@/lib/gating';
import { startVideoStream, stopStream } from '@/lib/media';
import IdOverlay from './IdOverlay';
import IdHints from './IdHints';
import { uploadIdServer } from '@/app/actions/id';
import Image from 'next/image';

export default function IdCapture({
  userId, kind, deviceId, country, onUploaded, onStartUpload, onError
}: {
  userId: string;
  kind: IdKind;
  deviceId?: string|null;
  country: string; // CCA2
  onUploaded?: (p: { url: string; s3Key: string; kind: IdKind; country: string }) => void;
  onStartUpload?: () => void;
  onError?: (error: string) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const processCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream|null>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const rafRef = React.useRef<number|undefined>(undefined);

  const [gate, setGate] = React.useState<Gate>({ framed: 0, brightnessOk: false, glareOk: false, sharpOk: false, ok: false });
  const [busy, setBusy] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string|null>(null);
  //TODO: save uploadedUrl in the db for 
  const [uploadedUrl, setUploadedUrl] = React.useState<string|null>(null);
  const [overlayWidthPx, setOverlayWidthPx] = React.useState<number|undefined>(undefined);
  const [cameraActive, setCameraActive] = React.useState(false); // for clarity/debug
  const [done, setDone] = React.useState(false);                 // <- NEW: after successful upload

  // ---- Camera lifecycle
  const cancelRAF = () => {
    if (rafRef.current !== undefined) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = undefined;
    }
  };

  const tick = () => {
    // If preview is open or we've finished, don't keep processing frames
    if (previewUrl || done) return;
    const v = videoRef.current, c = processCanvasRef.current, f = overlayRef.current;
    if (!v || !c || !f || !v.videoWidth) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    // Draw full frame
    c.width = v.videoWidth; c.height = v.videoHeight;
    const ctx = c.getContext('2d')!; ctx.drawImage(v, 0, 0, c.width, c.height);

    // Compute crop rect from DOM overlay
    const vRect = v.getBoundingClientRect();
    const fRect = f.getBoundingClientRect();
    const scaleX = v.videoWidth / vRect.width;
    const scaleY = v.videoHeight / vRect.height;

    const x = Math.max(0, (fRect.left - vRect.left) * scaleX);
    const y = Math.max(0, (fRect.top - vRect.top) * scaleY);
    const w = Math.min(v.videoWidth - x,  fRect.width  * scaleX);
    const h = Math.min(v.videoHeight - y, fRect.height * scaleY);
    if (w <= 0 || h <= 0) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    // Sample only inside the frame (sub-image)
    const sub = ctx.getImageData(Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h));

    // Keep your existing loosened overrides (you can tweak if needed)
    const loosen = { frameCoverage: 0.64, minSharp: 5.6, glareMax: 0.072, brightnessMin: 0.2, brightnessMax: 0.92 };
    setGate(evaluateGate(sub, (w / h), loosen));

    rafRef.current = requestAnimationFrame(tick);
  };

  const startCam = async () => {
    if (previewUrl || done) return; // don't start if previewing or after completion
    cancelRAF();
    stopStream(streamRef.current);
    setCameraActive(false);

    const stream = await startVideoStream(deviceId || undefined);
    streamRef.current = stream;

    const v = videoRef.current!;
    v.srcObject = stream;
    await v.play();
    setCameraActive(true);

    computeOverlayWidth();
    rafRef.current = requestAnimationFrame(tick);
  };

  const stopCam = () => {
    cancelRAF();
    stopStream(streamRef.current);
    streamRef.current = null;
    const v = videoRef.current;
    if (v) v.srcObject = null;
    setCameraActive(false);
  };

  // Start/stop with device/kind/preview/done state
  React.useEffect(() => {
    (async () => {
      if (previewUrl || done) {
        stopCam();                 // close camera while previewing or after success
      } else {
        await startCam();          // (re)open when not previewing and not done
      }
    })().catch(console.error);

    return () => stopCam();        // cleanup on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, kind, previewUrl, done]);

  // Recompute overlay width on resize
  React.useEffect(() => {
    function onResize() { computeOverlayWidth(); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  React.useEffect(() => { computeOverlayWidth(); });

  function computeOverlayWidth() {
    const v = videoRef.current;
    if (!v) return;
    const vw = v.getBoundingClientRect().width;
    if (!vw) return;
    // fill width minus 15px padding on each side (30 total); keep >= 300px if space allows
    let w = Math.max(vw - 30, 0);
    if (vw >= 330) w = Math.max(w, 300);
    setOverlayWidthPx(w);
  }

  // ---- Capture (cropped to frame)
  async function onCapture() {
    const v = videoRef.current, f = overlayRef.current; if (!v || !f) return;

    // Draw full video to canvas
    const work = document.createElement('canvas');
    work.width = v.videoWidth; work.height = v.videoHeight;
    const wctx = work.getContext('2d')!;
    wctx.drawImage(v, 0, 0, work.width, work.height);

    // Compute same crop rect as in tick
    const vRect = v.getBoundingClientRect();
    const fRect = f.getBoundingClientRect();
    const scaleX = v.videoWidth / vRect.width;
    const scaleY = v.videoHeight / vRect.height;
    const x = Math.max(0, (fRect.left - vRect.left) * scaleX);
    const y = Math.max(0, (fRect.top  - vRect.top)  * scaleY);
    const w = Math.min(v.videoWidth  - x, fRect.width  * scaleX);
    const h = Math.min(v.videoHeight - y, fRect.height * scaleY);

    const crop = document.createElement('canvas');
    crop.width = Math.floor(w); crop.height = Math.floor(h);
    const cctx = crop.getContext('2d')!;
    cctx.drawImage(work, Math.floor(x), Math.floor(y), Math.floor(w), Math.floor(h), 0, 0, Math.floor(w), Math.floor(h));

    const blob: Blob = await new Promise(r => crop.toBlob(b => r(b!), 'image/jpeg', 0.96));
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);     // opening preview (effect will close the camera)
  }

  function closePreview(){
    if(previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);    // effect will restart camera (unless done)
  }

  async function confirmUpload(){
    if(!previewUrl) return; 
    setBusy(true);
    onStartUpload?.();
    try{
      const blob = await fetch(previewUrl).then(r=>r.blob());
      const fd = new FormData();
      fd.append('file', new File([blob], 'id-crop.jpg', { type: 'image/jpeg' }));
      fd.append('kind', kind); fd.append('userId', userId);
      const res = await uploadIdServer(fd);

      // Success -> stop camera, clear preview, mark done, notify parent
      stopCam();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setUploadedUrl(res.url); // keep for potential logging
      setDone(true);
      onUploaded?.({ url: res.url, s3Key: res.key, kind, country });
      console.log('Uploaded ID URL:', uploadedUrl);
    } catch(err:any){
      console.error('ID upload failed:', err);
      onError?.( 'ID upload failed');
    } finally { setBusy(false); }
     
  }

  const badge = (ok: boolean) =>
    `inline-flex items-center rounded-full px-2 py-1 text-xs ${ok ? 'bg-teal-600 text-white' : 'bg-orange-100 text-orange-700'}`;

  // After successful upload: show simple success message (no camera UI)
  if (done) {
    return (
      <div className="grid gap-3">
        <div className="rounded-xl border border-teal-200 bg-teal-50 text-teal-800 px-4 py-3">
          ID uploaded successfully.
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="relative rounded-xl overflow-hidden bg-black/10">
        <video ref={videoRef} playsInline muted className="w-full" />
        <IdOverlay kind={kind} ok={gate.ok} widthPx={overlayWidthPx} ref={overlayRef} />
      </div>

      <div className="text-xs text-muted-foreground">
        {cameraActive ? 'Camera on' : 'Camera off'} • {gate.ok ? 'Ready to capture' : 'Align and reduce glare'}
      </div>

      <IdHints kind={kind} ok={gate.ok} />

      <div className="flex gap-2 text-xs">
        <span className={badge(gate.brightnessOk)}>Light</span>
        <span className={badge(gate.glareOk)}>No Glare</span>
        <span className={badge(gate.sharpOk)}>Sharp</span>
        <span className={badge(gate.framed > 0.64)}>Framed</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onCapture}
          disabled={!gate.ok || busy || !cameraActive}
          className="inline-flex items-center rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold px-4 py-2"
        >
          {busy ? 'Working…' : gate.ok ? 'Capture' : 'Hold steady…'}
        </button>
      </div>

      {/* hidden processing canvas for gate sampling */}
      <canvas ref={processCanvasRef} className="hidden" />

      {previewUrl && (
        <div className="fixed inset-0 z-[999] bg-black/60 grid place-items-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-[92vw] w-[680px] p-4 grid gap-3">
            <div className="text-sm font-medium">Preview </div>
            <Image
            src={previewUrl}
            alt="Preview"
            className="rounded-lg object-contain 
                        w-[300px] sm:w-[300px] md:w-[550px] lg:w-[500px] 
                        max-h-[70vh] mx-auto"
            width={0}
            height={0}
            style={{ maxHeight: "70vh" }}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closePreview}
                className="inline-flex items-center rounded-lg border border-orange-600 text-orange-600 hover:bg-orange-50 px-3 py-2 text-sm"
              >
                Retake
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmUpload}
                className="inline-flex items-center rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold px-4 py-2"
              >
                {busy ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* (kept) uploadedUrl state for logging/debug; not shown per your request */}
      <>
      
      </>
    </div>
  );
}
