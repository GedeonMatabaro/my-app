// /data/CountryIdTypes.ts
import wc from "world-countries";
import type { IdKind } from "./idTypes";

/**
 * Country-based Identification Policy
 * ------------------------------------
 * Default: All countries accept 'passport'.
 * Trusted countries may also accept 'nationalId' and/or 'driverLicense'.
 */

// Countries that accept National ID
const TrustedNationalId = new Set<string>([
  // East Africa
  "RW", "KE", "UG", "TZ",
  // Congo(s)
  "CD", "CG",
  // EU
  "FR", "DE", "ES", "IT", "NL", "BE", "SE", "FI", "DK", "PT", "AT",
  "PL", "CZ", "SK", "HU", "SI", "HR", "RO", "BG", "GR", "EE", "LV", "LT", "LU", "CY", "MT",
  // Other trusted countries
  "NO", "IS", "CH", "TR", "AE", "QA", "SA", "IL", "JP", "KR", "SG", "HK",
]);

// Countries that accept Driver License
const TrustedDriverLicense = new Set<string>([
  // Example: Rwanda supports all
  "RW",
  // Americas, EU, ANZ
  "US", "CA", "MX", "AR", "BR", "CL",
  "GB", "IE", "FR", "DE", "ES", "IT", "NL", "BE", "SE", "FI", "DK", "PT",
  "AT", "PL", "CZ", "SK", "HU", "SI", "HR", "RO", "BG", "GR",
  "AU", "NZ",
  // Others
  "NO", "IS", "CH", "JP", "KR", "SG", "AE", "QA", "SA",
]);

export type CountryDocumentMap = Record<string, IdKind[]>;

export function BuildCountryDocumentMap(): CountryDocumentMap {
  const countryMap: CountryDocumentMap = {};

  for (const country of wc) {
    const code = country.cca2.toUpperCase();
    const allowed: IdKind[] = ["passport"];

    if (TrustedNationalId.has(code)) allowed.push("nationalId");
    if (TrustedDriverLicense.has(code)) allowed.push("driverLicense");

    countryMap[code] = allowed;
  }

  return countryMap;
}

/**
 * Returns allowed ID types for a given country.
 */
export function AllowedIdTypesFor(cca2: string, map: CountryDocumentMap): IdKind[] {
    if (!cca2) return ["passport"];
    const key = cca2.trim().toUpperCase();

    // Normalize map keys just once
    const normalizedMap = Object.fromEntries(
        Object.entries(map).map(([k, v]) => [k.toUpperCase(), v])
    );

    return normalizedMap[key] ?? ["passport"];

}

/**
 * Prebuilt constant map to reuse globally.
 */
export const CountryIdMap: CountryDocumentMap = BuildCountryDocumentMap();
