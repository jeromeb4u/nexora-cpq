import type { CustomerStatus, Industry } from '@nexora/types';

/** Every `Industry` member is required — an unmapped value fails to compile. */
export const INDUSTRY_LABELS: Record<Industry, string> = {
  MANUFACTURING: 'Manufacturing',
  FINANCIAL_SERVICES: 'Financial services',
  HEALTHCARE: 'Healthcare',
  RETAIL: 'Retail',
  LOGISTICS: 'Logistics',
  PUBLIC_SECTOR: 'Public sector',
  TECHNOLOGY: 'Technology',
  ENERGY_UTILITIES: 'Energy & utilities',
  PROFESSIONAL_SERVICES: 'Professional services',
  EDUCATION: 'Education',
};

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  PROSPECT: 'Prospect',
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended',
  INACTIVE: 'Inactive',
};

/**
 * Render a bandwidth in Mbps the way a sales rep would say it out loud:
 * "10 Gbps", not "10000 Mbps". Only whole-Gbps values drop the decimal — a
 * value like 1500 Mbps still reads as "1.5 Gbps" rather than rounding away
 * real information.
 */
export function formatBandwidth(mbps: number): string {
  if (mbps < 1000) return `${mbps} Mbps`;

  const gbps = mbps / 1000;
  const rounded = Math.round(gbps * 10) / 10;
  return `${rounded} Gbps`;
}
