// /components/id/IdHints.tsx
'use client';
import React from 'react';
import type { IdKind } from '@/data/idTypes';

export default function IdHints({ kind, ok }: { kind: IdKind; ok: boolean }) {
  return (
    <div className="text-xs text-muted-foreground">
      {ok ? 'Hold steady… ready to capture' : (
        kind === 'passport'
          ? 'Open the photo page flat. Keep the MRZ (two lines) visible; avoid reflections.'
          : 'Hold the card straight; all 4 corners visible; avoid glare.'
      )}
    </div>
  );
}
