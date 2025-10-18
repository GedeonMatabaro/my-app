// /components/id/IdTypeSelect.tsx
'use client';
import React from 'react';
import type { IdKind } from '@/data/idTypes';
import { TARGETS } from '@/data/idTypes';

export default function IdTypeSelect({ kinds, value, onChange }: { kinds: IdKind[]; value: IdKind; onChange: (k: IdKind)=>void }) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-sm">ID Type</label>
      <select className="border rounded px-2 py-1" value={value} onChange={(e)=>onChange(e.target.value as IdKind)}>
        {kinds.map(k => <option key={k} value={k}>{TARGETS[k].label}</option>)}
      </select>
    </div>
  );
}
