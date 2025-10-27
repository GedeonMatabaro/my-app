'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import LoaderOverlay from '@/components/LoaderOverlay';
import VerifyId from '@/app/VerifyId';
import LivenessWidget from '@/app/LivenessWidget';
import type {
  IdDataDto,
  LivenessResultDto,
  VerificationSummaryDto,
  MockUserDto,
} from '@/lib/dtos/verification';


import { CheckIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';


export default function VerifyPage() {
  // ---------------------------------------------------
  // 🧠 States
  // ---------------------------------------------------
  const [step, setStep] = useState<'id' | 'liveness' | 'summary'>('id');
  const [loader, setLoader] = useState<{ show: boolean; message?: string }>({ show: false });
  const [idData, setIdData] = useState<IdDataDto | null>(null);
  const [livenessResults, setLivenessResults] = useState<LivenessResultDto[]>([]);
  const [livenessAttempts, setLivenessAttempts] = useState<number>(0);
  const [finalStatus, setFinalStatus] = useState<'success' | 'fail' | null>(null);
  const [summary, setSummary] = useState<VerificationSummaryDto | null>(null);
  const router = useRouter();

  // Mock authentication (replace later)
  const mockUser: MockUserDto = { userId: 'mock123', name: 'John Doe' };

  // ---------------------------------------------------
  // 🪪 ID Capture Handlers
  // ---------------------------------------------------
  const handleIdSuccess = (data: IdDataDto) => {
    console.log('ID upload success:', data);
    setIdData(data);
    setStep('liveness');
  };

  const handleIdError = (err: string) => {
    console.error(' ID upload failed:', err);
  };

  // ---------------------------------------------------
  // 🧍‍♂️ Liveness Handlers
  // ---------------------------------------------------
  const handleLivenessSuccess = (data: LivenessResultDto) => {
    console.log('Liveness success:', data);

    const updatedResults = [...livenessResults, data];
    setLivenessResults(updatedResults);

    const summaryData: VerificationSummaryDto = {
      idData: idData!,
      livenessResults: updatedResults,
      finalStatus: 'success',
    };
    setSummary(summaryData);
    setFinalStatus('success');
    setStep('summary');

    console.log('📦 Final verification data:', summaryData);
  };

  const handleLivenessFail = (data: LivenessResultDto) => {
    console.warn(' Liveness failed:', data);
    const updatedResults = [...livenessResults, data];
    setLivenessResults(updatedResults);
    setLivenessAttempts(prev => prev + 1);

    if (livenessAttempts + 1 >= 3) {
      handleMaxFail();
    }
  };

  const handleMaxFail = () => {
    console.error(' Maximum liveness attempts reached.');
    const summaryData: VerificationSummaryDto = {
      idData: idData!,
      livenessResults,
      finalStatus: 'fail',
    };
    setSummary(summaryData);
    setFinalStatus('fail');
    setStep('summary');
  };
  const goHome = async () => { 
        // Reset all states
        setStep('id');
        setIdData(null);
        setLivenessResults([]);
        setLivenessAttempts(0);
        setFinalStatus(null);
        setSummary(null);
        //redirect to home page
        router.replace('/');
    }

  // ---------------------------------------------------
  //  Retry
  // ---------------------------------------------------
  const handleRetry = () => {
    setStep('id');
    setIdData(null);
    setLivenessResults([]);
    setLivenessAttempts(0);
    setFinalStatus(null);
    setSummary(null);
  };

  // ---------------------------------------------------
  //  UI Layout
  // ---------------------------------------------------
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-teal-50 via-white to-orange-50 p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-teal-700">Globy Verify</h1>
        <p className="text-sm text-gray-600 mt-2">
           <span className="font-semibold">Trust. Secure. Effortless.</span>
          <br />
          <span className="text-orange-500 font-semibold">
            Do not refresh this page during verification.
          </span>
        </p>
      </div>

      {/* Step Container */}
      <div className="relative w-full max-w-xl bg-white/70 shadow-xl rounded-3xl p-6 border border-gray-100">
        <AnimatePresence mode="wait">
          {/* Step 1: ID Upload */}
          {step === 'id' && (
            <motion.div
              key="id-step"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4 }}
            >
              <VerifyId
                onSuccess={handleIdSuccess}
                onError={handleIdError}
                onLoading={(loading: boolean, message?: string) =>
                  setLoader({ show: loading, message })
                }
                mockUser={mockUser}
              />
            </motion.div>
          )}

          {/* Step 2: Liveness */}
          {/* {step === 'liveness' && idData && ( */}
          {step === 'liveness' &&  (
            <motion.div
              key="liveness-step lv-scope lv-hide-overlays"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.4 }}
            >
              <LivenessWidget
              // mock idData for testing without ID step
              idData={{
                country: 'US',
                idType: 'passport',
                idUrl: 'https://example.com/mock-id.jpg',
                refId: 'MOCK123456',
              }}
                // idData={idData}
                onSuccess={handleLivenessSuccess}
                onFail={handleLivenessFail}
                onMaxFail={handleMaxFail}
                onLoading={(loading: boolean, message?: string) =>
                  setLoader({ show: loading, message })
                }
                mockUser={mockUser}
              />
            </motion.div>
          )}

          {/* Step 3: Summary */}
          {step === 'summary' && summary && (
            <motion.div
              key="summary-step"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.4 }}
              className="text-center space-y-6"
            >
              {finalStatus === 'success' ? (
                <>
                  <h2 className="text-2xl font-semibold text-teal-600">
                    {/* shadcn check icon in teal */}
                    <CheckIcon className="inline-block mr-2" />
                    Verification Successful
                  </h2>
                  <p className="text-gray-700">
                    Your identity has been securely verified.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-semibold text-orange-600">
                    <XIcon className="inline-block mr-2" />
                     Verification Failed
                  </h2>
                  <p className="text-gray-700">
                    We couldn’t complete your verification after 3 attempts. Please try again later.
                  </p>
                </>
              )}

              <div className="text-left text-sm bg-white/80 rounded-lg shadow-inner p-4 max-h-[320px] overflow-y-auto">
                <h3 className="font-semibold text-teal-700 mb-2">
                  Verification Data Snapshot:
                </h3>
                <pre className="text-xs text-gray-800 overflow-x-auto">
                  {JSON.stringify(summary, null, 2)}
                </pre>
              </div>
              {finalStatus === 'success' ? (
                <Button
                  onClick={goHome}
                  variant="outline"
                  className="mt-4 text-teal-600 border-teal-500 hover:bg-teal-50"
                >
                  GoHome
                </Button>
              ) : (
                <Button
                  onClick={handleRetry}
                  variant="outline"
                  className="mt-4 text-teal-600 border-teal-500 hover:bg-teal-50"
                >
                  Retry Verification
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Global Loader */}
      <LoaderOverlay show={loader.show} message={loader.message} />
    </div>
  );
}
