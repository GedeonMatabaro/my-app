// /components/id/CameraPicker.tsx
'use client';
import React from 'react';
import { listVideoInputs, type CamItem } from '@/lib/cameras';

export default function CameraPicker({ value, onChange }: { value?: string|null; onChange: (deviceId: string)=>void }) {
  const [cams, setCams] = React.useState<CamItem[]>([]);

  React.useEffect(() => { (async () => setCams(await listVideoInputs()))(); }, []);

  const current = cams.find(c => c.deviceId === value);
  const switchFacing = () => {
    if (!cams.length) return;
    const target = (current?.kind !== 'back') ? cams.find(c=>c.kind==='back') : cams.find(c=>c.kind==='front');
    if (target) onChange(target.deviceId);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={switchFacing}
        className="inline-flex items-center rounded-lg border border-orange-600 text-orange-600 hover:bg-orange-50 px-3 py-2 text-sm"
      >
        Switch Camera
      </button>

      <select
        className="border rounded px-2 py-1 text-sm"
        value={value ?? ''}
        onChange={(e)=>onChange(e.target.value)}
      >
        {cams.map(c => (
          <option key={c.deviceId} value={c.deviceId}>
            {c.label || (c.kind==='back'?'Back Camera':c.kind==='front'?'Front Camera':'Camera')}
          </option>
        ))}
      </select>
    </div>
  );
}
