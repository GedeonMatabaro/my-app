// /lib/dtos/verification.ts

/** Basic authenticated user info (mock for now) */
export interface MockUserDto {
  userId: string;
  name: string;
}

/** Data returned after ID upload */
export interface IdDataDto {
  country: string;
  idType: string;
  idUrl: string;
  refId: string;
}

/** Each liveness verification attempt result */
export interface LivenessResultDto {
  score: number;
  refUrl: string;
  status: 'success' | 'fail';
  timestamp: string; // ISO string, useful for logs and future audit
}

/** Wrapper summary of all verification data */
export interface VerificationSummaryDto {
  idData: IdDataDto;
  livenessResults: LivenessResultDto[];
  finalStatus: 'success' | 'fail' | null;
}
