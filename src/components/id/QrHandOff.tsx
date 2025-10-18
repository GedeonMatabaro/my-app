// /components/id/QrHandOff.tsx
'use client';
import React from 'react';
import QRCode from 'react-qr-code';
import type { IdKind } from '@/data/idTypes';

export default function QrHandOff({
  baseUrl, country, kind
}: { baseUrl: string; country: string; kind: IdKind }) {
  const href = `${baseUrl.replace(/\/$/,'')}/verify?country=${encodeURIComponent(country)}&kind=${encodeURIComponent(kind)}`;
  return (
    <div className="grid gap-2">
      <div className="rounded-xl border p-3 bg-white dark:bg-neutral-900 w-fit">
        <QRCode value={href} size={192} />
      </div>
      <a href={href} className="text-blue-600 underline break-all" target="_blank" rel="noreferrer">
        {href}
      </a>
      <p className="text-xs text-muted-foreground">Scan with your phone to capture on another device.</p>
    </div>
  );
}
