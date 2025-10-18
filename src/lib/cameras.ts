// /lib/cameras.ts
export type CamItem = { deviceId: string; label: string; kind: 'front'|'back'|'unknown' };

const BAD_SENSOR_TOKENS = ['infrared','ir','depth','tof','true depth','biometric'];

export async function listVideoInputs(): Promise<CamItem[]> {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter(d => d.kind === 'videoinput')
    .filter(d => {
      const l = (d.label || '').toLowerCase();
      return !BAD_SENSOR_TOKENS.some(t => l.includes(t));
    })
    .map(d => {
      const l = (d.label || '').toLowerCase();
      const kind: CamItem['kind'] = (
        l.includes('back') || l.includes('rear') || l.includes('environment') || l.includes('world')
      ) ? 'back' : (
        l.includes('front') || l.includes('user') || l.includes('self') || l.includes('webcam')
      ) ? 'front' : 'unknown';
      return { deviceId: d.deviceId, label: d.label || 'Camera', kind };
    });
}
