import 'server-only';

import { prisma } from '@nexora/db';

/**
 * Customer lookups used by the quoting flow.
 *
 * CPQ reads customers but never writes them — customer management belongs to
 * the Platform MFE (docs/MFE.md). Sharing the database while keeping write
 * ownership in one app is the boundary this package respects.
 */

export async function listCustomersForPicker() {
  return prisma.customer.findMany({
    // A quote cannot be raised against a customer nobody may sell to.
    where: { status: { in: ['PROSPECT', 'ACTIVE'] } },
    orderBy: { companyName: 'asc' },
    select: {
      id: true,
      companyName: true,
      industry: true,
      status: true,
      locations: {
        orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          city: true,
          serviceability: true,
          maxBandwidthMbps: true,
        },
      },
    },
  });
}

export type CustomerForPicker = Awaited<ReturnType<typeof listCustomersForPicker>>[number];
