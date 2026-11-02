/**
 * Egyptian Agricultural Land Unit Converter
 * Official Egyptian Surveying Standard:
 * 1 Feddan (فدان) = 24 Qirat (قيراط) = 4200.8335 m²
 * 1 Qirat (قيراط) = 24 Sahm (سهم) = 175.0347 m²
 * 1 Sahm (سهم) = 7.2931 m²
 */

export const FEDDAN_TO_SQM = 4200.8335;
export const QIRAT_TO_SQM = 175.0347;
export const SAHM_TO_SQM = 7.2931;

export interface EgyptianLandUnits {
  feddan: number;
  qirat: number;
  sahm: number;
}

/**
 * Converts Feddan, Qirat, and Sahm to Square Meters (m²)
 */
export function convertEgyptianUnitsToSqm(units: Partial<EgyptianLandUnits>): number {
  const f = Math.max(0, units.feddan || 0);
  const q = Math.max(0, units.qirat || 0);
  const s = Math.max(0, units.sahm || 0);

  const totalSqm = f * FEDDAN_TO_SQM + q * QIRAT_TO_SQM + s * SAHM_TO_SQM;
  return Math.round(totalSqm * 100) / 100;
}

/**
 * Converts Square Meters (m²) to closest Feddan, Qirat, and Sahm
 */
export function convertSqmToEgyptianUnits(sqm: number): {
  feddan: number;
  qirat: number;
  sahm: number;
  summaryArabic: string;
} {
  if (!sqm || sqm <= 0) {
    return { feddan: 0, qirat: 0, sahm: 0, summaryArabic: "" };
  }

  const feddan = Math.floor(sqm / FEDDAN_TO_SQM);
  let remainder = sqm % FEDDAN_TO_SQM;

  const qirat = Math.floor(remainder / QIRAT_TO_SQM);
  remainder = remainder % QIRAT_TO_SQM;

  const sahm = Math.round((remainder / SAHM_TO_SQM) * 10) / 10;

  const parts: string[] = [];
  if (feddan > 0) parts.push(`${feddan} فدان`);
  if (qirat > 0) parts.push(`${qirat} قيراط`);
  if (sahm > 0) parts.push(`${sahm} سهم`);

  const summaryArabic = parts.length > 0 ? parts.join(" و ") : `${sqm} م²`;

  return { feddan, qirat, sahm, summaryArabic };
}
