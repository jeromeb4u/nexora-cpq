import type { PricingModel, ProductCategory } from '@nexora/types';

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  CONNECTIVITY: 'Connectivity',
  SD_WAN: 'SD-WAN',
  SECURITY: 'Security',
  HARDWARE: 'Hardware',
  VOICE: 'Voice',
  SUPPORT: 'Support',
};

export const PRICING_MODEL_LABELS: Record<PricingModel, string> = {
  PER_UNIT: 'Per unit',
  FLAT: 'Flat',
  PER_SITE: 'Per site',
};

/**
 * Render a bandwidth in Mbps the way a sales rep would say it out loud:
 * "1 Gbps", not "1000 Mbps". Only whole-Gbps values drop the decimal — a
 * value like 1500 Mbps still reads as "1.5 Gbps" rather than rounding away
 * real information.
 */
export function formatBandwidth(mbps: number): string {
  if (mbps < 1000) return `${mbps} Mbps`;

  const gbps = mbps / 1000;
  const rounded = Math.round(gbps * 10) / 10;
  return `${rounded} Gbps`;
}
