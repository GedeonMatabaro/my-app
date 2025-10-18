// /app/(protected)/verify/page.tsx
'use client';
import React from 'react';
import CountrySelect from '@/components/Counties'; 
import countries from "world-countries"
import { CountryIdMap, AllowedIdTypesFor } from '@/data/countryIdTypes';
import type { IdKind } from '@/data/idTypes';
import CameraPicker from '@/components/id/CameraPicker';
import IdTypeSelect from '@/components/id/IdTypeSelect';
import IdCapture from '@/components/id/IdCapture';
import QrHandOff from '@/components/id/QrHandOff';

const FRONTEND = process.env.NEXT_PUBLIC_FRONTEND_LINK || '';
export type VerifyIdPublicResult = {
  country: string;       // CCA2 or name – you decide; page will just persist/display
  idType: string;        // e.g., 'PASSPORT' | 'ID_CARD' | etc.
  url?: string;          // primary link (if single)
  urls?: string[];       // multiple images if you emit them
  s3Key?: string;        // optional storage key
};

export type VerifyIdProps = {
  onComplete?: (p: VerifyIdPublicResult) => void; 
  onPendingChange?: (pending: boolean, message?: string) => void; // optional
  initialCountry?: string;  // preselect country (name or CCA2)
  initialIdType?: string;   // preselect ID type
  className?: string;
  style?: React.CSSProperties;
};

export default function VerifyId() {
  // --- Default country: USA
  const defaultCountry = countries.find(c => c.cca2 === "US")?.name.common ?? "United States"
  const defaultCca2 = "US"

  const [country, setCountry] = React.useState<string>(defaultCountry)   // full name
  const [countryCode, setCountryCode] = React.useState<string>(defaultCca2) // CCA2 code
  const [allowed, setAllowed] = React.useState<IdKind[]>(AllowedIdTypesFor(defaultCca2, CountryIdMap))
  const [kind, setKind] = React.useState<IdKind>(AllowedIdTypesFor(defaultCca2, CountryIdMap)[0])

  const [deviceId, setDeviceId] = React.useState<string | null>(null)
  
  const [step, setStep] = React.useState<'choose' | 'capture' | 'done'>('choose')
  const userId = 'current-user-id' // inject from session

  // --- Update countryCode & allowed IDs when country (full name) changes
    React.useEffect(() => {
    const selected = countries.find(c => c.name.common === country)
    const cca2 = selected?.cca2.toUpperCase() ?? "US"

    setCountryCode(cca2)

    const ids = AllowedIdTypesFor(cca2, CountryIdMap)
    console.log("Allowed IDs for", cca2, ids)  // 🔍 ADD THIS
    setAllowed(ids)

    if (!ids.includes(kind)) setKind(ids[0])
    }, [country])

  return (
    <div className="mx-auto max-w-3xl p-4 grid gap-6">
      <h1 className="text-2xl font-semibold">Verify your identity</h1>

      {step === 'choose' && (
        <div className="grid gap-4">
          <p className="text-sm text-muted-foreground">
            Pick your country and document type, then choose to capture on this device or scan a QR to capture on another device.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <CountrySelect value={country} onChange={setCountry} />
            <IdTypeSelect kinds={allowed} value={kind} onChange={setKind} />
          </div>

          <div className="flex flex-wrap items-start gap-6">
            <button
              type="button"
              onClick={() => setStep('capture')}
              className="inline-flex items-center rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 py-2"
            >
              Capture on this device
            </button>

            {FRONTEND && (
              <div>
                <div className="text-sm font-medium mb-2">Or capture on another device</div>
                <QrHandOff baseUrl={FRONTEND} country={countryCode} kind={kind} />
              </div>
            )}
          </div>
        </div>
      )}

      {step === 'capture' && (
        <div className="grid gap-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Frame fills full width minus 15px; image is cropped to the frame.
            </div>
            <button
              type="button"
              onClick={() => setStep('choose')}
              className="inline-flex items-center rounded-lg border border-orange-600 text-orange-600 hover:bg-orange-50 px-3 py-2 text-sm"
            >
              Back
            </button>
          </div>

          <CameraPicker value={deviceId} onChange={setDeviceId} />

          <IdCapture
            userId={userId}
            kind={kind}
            deviceId={deviceId}
            country={countryCode} // send CCA2 to backend
            onUploaded={(p) => {console.log('Uploaded', p) ; setStep('done')}}
          />
        </div>
      )}
      {
        step === 'done' && (
          <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
            <h2 className="text-xl font-semibold mb-2">Thank you!</h2>
            <p className="text-sm text-muted-foreground">
              Your ID has been successfully uploaded. Click below to continue with the verification process.
            </p>
            <button
              type="button"
              onClick={() => alert('Continue to next step')}
              className="inline-flex items-center rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 py-2"
            >
              Continue
            </button>
          </div>
        )}
    </div>
  )
}

