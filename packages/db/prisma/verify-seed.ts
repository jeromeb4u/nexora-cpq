import './load-env';

import { formatMoney, formatRate, bpsToRate, cents } from '@nexora/types';
import { prisma } from '../src/client';

/**
 * Post-seed verification.
 *
 * Confirms the seeded database actually tells the story the demo claims:
 * the flagship quote exists, has real version history, and sits in a genuine
 * pending-approval state with figures that came from the pricing engine.
 */
async function main(): Promise<void> {
  const quote = await prisma.quote.findUnique({
    where: { quoteNumber: 'QT-10482' },
    include: {
      customer: true,
      location: true,
      owner: true,
      currentVersion: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
      versions: { orderBy: { versionNumber: 'asc' } },
      approvals: { include: { requestedBy: true } },
    },
  });

  if (!quote) throw new Error('QT-10482 not found');
  const v = quote.currentVersion;
  if (!v) throw new Error('QT-10482 has no current version');

  console.log(`${quote.quoteNumber} — ${quote.customer.companyName} (${quote.location?.name})`);
  console.log(`  status      ${quote.status}`);
  console.log(`  owner       ${quote.owner.name} (${quote.owner.role})`);
  console.log(`  term        ${v.contractMonths} months`);
  console.log(`  discount    ${formatRate(bpsToRate(v.discountBps))} requested`);
  console.log('');
  console.log('  Line items:');
  for (const item of v.items) {
    const qty = item.quantity > 1 ? ` x${item.quantity}` : '';
    console.log(
      `    ${item.skuSnapshot.padEnd(15)} ${item.nameSnapshot.padEnd(32)}${qty.padEnd(5)} ${formatMoney(cents(item.monthlyCents)).padStart(12)}/mo`,
    );
  }
  console.log('');
  console.log(`  Gross MRR   ${formatMoney(cents(v.grossMonthlyCents)).padStart(14)}`);
  console.log(`  Discount    ${('-' + formatMoney(cents(v.discountMonthlyCents))).padStart(14)}  (effective ${formatRate(bpsToRate(v.effectiveDiscountBps))})`);
  console.log(`  Final MRR   ${formatMoney(cents(v.mrrCents)).padStart(14)}`);
  console.log(`  One-time    ${formatMoney(cents(v.otcCents)).padStart(14)}`);
  console.log(`  TCV         ${formatMoney(cents(v.tcvCents)).padStart(14)}  (MRR x ${v.contractMonths} + OTC)`);
  console.log('');

  // Arithmetic must hold exactly — this is the whole point of integer cents.
  const expectedTcv = v.mrrCents * v.contractMonths + v.otcCents;
  console.log(`  TCV arithmetic exact: ${expectedTcv === v.tcvCents ? 'YES' : 'NO (' + expectedTcv + ' vs ' + v.tcvCents + ')'}`);
  console.log(`  Gross - discount = MRR: ${v.grossMonthlyCents - v.discountMonthlyCents === v.mrrCents ? 'YES' : 'NO'}`);
  console.log('');

  console.log('  Version history:');
  for (const version of quote.versions) {
    const marker = version.id === v.id ? ' <- current' : '';
    console.log(
      `    v${version.versionNumber}  ${formatRate(bpsToRate(version.discountBps)).padStart(6)}  ${formatMoney(cents(version.mrrCents)).padStart(13)}/mo${marker}`,
    );
  }
  console.log('');

  for (const approval of quote.approvals) {
    console.log(`  Approval: ${approval.decision} — ${approval.reason}`);
    console.log(`    requested by ${approval.requestedBy.name}`);
    console.log(`    ${formatRate(bpsToRate(approval.requestedDiscountBps))} requested vs ${formatRate(bpsToRate(approval.allowedDiscountBps))} allowed`);
  }

  const byStatus = await prisma.quote.groupBy({ by: ['status'], _count: true });
  console.log('\n  Quotes by status:');
  for (const row of byStatus.sort((a, b) => a.status.localeCompare(b.status))) {
    console.log(`    ${row.status.padEnd(20)} ${row._count}`);
  }

  const locations = await prisma.customerLocation.count();
  console.log(`\n  Locations: ${locations}`);

  /*
   * Credential sanity.
   *
   * Better Auth looks a credential up with
   *   providerId === 'credential' && accountId === user.id
   * so an account row keyed by email authenticates against nothing. That was a
   * real seeding bug here, and it is invisible until someone tries to sign in —
   * which is exactly why it is asserted rather than assumed.
   */
  const accounts = await prisma.account.findMany({
    select: {
      accountId: true,
      userId: true,
      providerId: true,
      password: true,
      user: { select: { email: true, role: true } },
    },
    orderBy: { user: { email: 'asc' } },
  });

  console.log('\n  Sign-in credentials:');
  let credentialsOk = true;
  for (const account of accounts) {
    const keyedCorrectly = account.accountId === account.userId;
    const hasHash = Boolean(account.password);
    const ok = account.providerId === 'credential' && keyedCorrectly && hasHash;
    if (!ok) credentialsOk = false;
    console.log(
      `    ${ok ? 'OK  ' : 'FAIL'} ${account.user.email.padEnd(28)} ${account.user.role}`,
    );
  }
  if (!credentialsOk) {
    throw new Error('At least one account cannot be authenticated against.');
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
