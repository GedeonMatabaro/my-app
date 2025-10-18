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
import { IdDataDto, MockUserDto } from '@/lib/dtos/verification';

const FRONTEND = process.env.NEXT_PUBLIC_FRONTEND_LINK || '';
export interface VerifyIdProps {
  onSuccess: (data: IdDataDto) => void;
  onError: (error: string) => void;
  onLoading: (loading: boolean, message?: string) => void;
  mockUser: MockUserDto;
  initialCountry?: string;
}



export default function VerifyId(props: VerifyIdProps) {
  const {
    onSuccess,
    onError,
    onLoading,
    mockUser,
    initialCountry,
  } = props;
  // --- Default country: USA
  let defaultCountry = countries.find(c => c.cca2 === "US")?.name.common ?? "United States"
  let defaultCca2 = "US"
  if(initialCountry){
    defaultCountry = initialCountry
    const selected = countries.find(c => c.name.common === initialCountry)
    defaultCca2 = selected?.cca2.toUpperCase() ?? "US"
  }
  

  const [country, setCountry] = React.useState<string>(defaultCountry)   // full name
  const [countryCode, setCountryCode] = React.useState<string>(defaultCca2) // CCA2 code
  const [allowed, setAllowed] = React.useState<IdKind[]>(AllowedIdTypesFor(defaultCca2, CountryIdMap))
  const [kind, setKind] = React.useState<IdKind>(AllowedIdTypesFor(defaultCca2, CountryIdMap)[0])

  const [deviceId, setDeviceId] = React.useState<string | null>(null)
  
  const [step, setStep] = React.useState<'choose' | 'capture' | 'done'>('choose')
  const [localError, setLocalError] = React.useState<string | null>(null);
  const {userId, name} = mockUser; // inject from session

  // --- Update countryCode & allowed IDs when country (full name) changes
    React.useEffect(() => {
      const selected = countries.find(c => c.name.common === country)
      const cca2 = selected?.cca2.toUpperCase() ?? "US"

      setCountryCode(cca2)

      const ids = AllowedIdTypesFor(cca2, CountryIdMap)
      console.log("Allowed IDs for", cca2, ids)  // 🔍 ADD THIS
      setAllowed(ids)

      if (!ids.includes(kind)) setKind(ids[0])
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [country])

    const handleUploadResult = async (payload: {
      url?: string;
      urls?: string[];
      s3Key?: string;
      refId?: string;
    }) => {
      // Stop loader (child may have toggled it but ensure it's off)
      try {
        onLoading(false);
      } catch {
        setLocalError('Failed to stop loading state.');
      }
    const idUrl = payload.url ?? (payload.urls && payload.urls.length ? payload.urls[0] : undefined) ?? '';
    const refId = payload.refId ?? payload.s3Key ?? `local-${Date.now()}`;

    if (!idUrl) {
      const err = 'Uploaded ID returned no URL';
      console.error('[VerifyId] ', err, payload);
      setLocalError(err);
      onError(err);
      return;
    }
    const data: IdDataDto = {
      country: countryCode,
      idType: kind,
      idUrl,
      refId,
    };

    console.log('[VerifyId] onSuccess ->', data);

    // notify the parent
    onSuccess(data);

    // advance local step for UX consistency (parent owns canonical step change)
    setStep('done');
  };
  const handleStartUpload = () => {
    setLocalError(null);
    onLoading(true, 'Uploading ID...');
  };

  // Error wrapper from IdCapture
  const handleCaptureError = (err: string) => {
    onLoading(false);
    setLocalError(err);
    onError(err);
  };

  return (
    <div className="mx-auto max-w-3xl p-4 grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-teal-700">Dear, {name}, Verify your identity</h2>
          <p className="text-sm text-muted-foreground">Pick your country and document type, then choose capture method.</p>
        </div>
      </div>

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
            onStartUpload={handleStartUpload} // call to enable loader
            onUploaded={(payload) => handleUploadResult(payload)} // normalized above
            onError={(err) => handleCaptureError(err)}
          />
        </div>
      )}
      {
        step === 'done' && (
          <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
            <h2 className="text-xl font-semibold mb-2">Thank you!</h2>
            <p className="text-sm text-muted-foreground mb-4">
              We received your document. Proceed to face liveness verification.
            </p>
          </div>
        )}
        {localError && (
          <div className="text-sm text-red-600 mt-2">
            {localError}
          </div>
        )}
    </div>
  )
}

