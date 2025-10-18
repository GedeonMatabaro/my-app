/* eslint-disable @typescript-eslint/no-explicit-any */
// /lib/media.ts
export async function startVideoStream(deviceId?: string) {
  const constraints: MediaStreamConstraints = {
    video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' } },
    audio: false,
  } as any;
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  return stream;
}

export function stopStream(stream?: MediaStream | null) {
  stream?.getTracks().forEach(t => t.stop());
}
