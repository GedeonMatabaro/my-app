export type IdKind = 'passport' | 'nationalId' | 'driverLicense';
// Aspect ratios for overlays
export const TARGETS: Record<IdKind, { aspect: number; label: string }> = {
    nationalId: { aspect: 85.60 / 53.98, label: 'National ID' }, // ID-1
    driverLicense: { aspect: 85.60 / 53.98, label: 'Driving Licence' }, // ID-1
    passport: { aspect: 125.0 / 88.0, label: 'Passport Photo Page' } // ID-3
};
