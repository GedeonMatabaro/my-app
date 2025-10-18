// /components/id/IdOverlay.tsx
'use client';
import React from 'react';
import type { IdKind } from '@/data/idTypes';
import { TARGETS } from '@/data/idTypes';

type Props = { kind: IdKind; ok: boolean; widthPx?: number };
const IdOverlay = React.forwardRef<HTMLDivElement, Props>(function IdOverlay(
  { kind, ok, widthPx }, ref
) {
  const spec = TARGETS[kind];
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div
        ref={ref}
        className={[
          'rounded-xl ring-4',
          ok ? 'ring-teal-600' : 'ring-orange-500',
          'shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]',
        ].join(' ')}
        style={{
          width: widthPx ? `${widthPx}px` : undefined,
          aspectRatio: String(spec.aspect),
        }}
        title={`Align the ${spec.label} fully inside the frame`}
      />
    </div>
  );
});
export default IdOverlay;
