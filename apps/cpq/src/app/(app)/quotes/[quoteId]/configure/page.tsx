import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Breadcrumbs, PageHeader } from '@nexora/ui';
import { Permission } from '@nexora/auth/permissions';
import { ErrorCode, isAppError } from '@nexora/observability';
import { type ContractTerm, CONTRACT_TERMS } from '@nexora/types';
import { isEditable } from '@nexora/cpq-engine';

import { requirePagePermission } from '@/lib/session';
import { getQuoteDetail } from '@/lib/quotes';
import { loadCatalogue, loadRules } from '@/lib/catalogue';
import { Configurator } from '@/components/configurator/configurator';

export const metadata: Metadata = { title: 'Configure' };

/**
 * The configuration page.
 *
 * Loads the catalogue and the rule set on the server and hands both to the
 * client as plain data. That is what lets the browser run the very same engine
 * the server runs — the rules are data, and the engine has no dependencies, so
 * "the same logic on both sides" costs one prop rather than a duplicated
 * implementation (ADR-008).
 */
export default async function ConfigurePage({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const actor = await requirePagePermission(Permission.QUOTE_READ_OWN);
  const { quoteId } = await params;

  let detail;
  try {
    detail = await getQuoteDetail(actor, quoteId);
  } catch (error) {
    if (isAppError(error, ErrorCode.NOT_FOUND)) notFound();
    throw error;
  }

  const { quote, canEdit } = detail;
  if (!canEdit) notFound();
  // Quotes in review, approval or with the customer are reopened from the
  // detail page first, so the state machine records it; the configurator never
  // edits them in place.
  if (!isEditable(quote.status)) redirect(`/quotes/${quote.id}`);

  const [catalogue, rules] = await Promise.all([loadCatalogue(), loadRules()]);

  const version = quote.currentVersion;
  const contractMonths: ContractTerm =
    version && (CONTRACT_TERMS as readonly number[]).includes(version.contractMonths)
      ? (version.contractMonths as ContractTerm)
      : 36;

  const snapshot = version?.configSnapshot as { siteCount?: number } | null;

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Quotes', href: '/quotes' },
          { label: quote.quoteNumber, href: `/quotes/${quote.id}` },
          { label: 'Configure' },
        ]}
      />

      <PageHeader
        title={`Configure ${quote.quoteNumber}`}
        description={
          quote.location
            ? `${quote.customer.companyName} · ${quote.location.name}`
            : quote.customer.companyName
        }
      />

      <Configurator
        quoteId={quote.id}
        quoteNumber={quote.quoteNumber}
        customerName={quote.customer.companyName}
        locationName={quote.location?.name ?? null}
        serviceability={quote.location?.serviceability ?? 'PENDING_CHECK'}
        ownerRole={actor.role}
        catalogue={catalogue}
        rules={rules}
        initialSelections={
          version?.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })) ?? []
        }
        initialContractMonths={contractMonths}
        initialDiscountBps={version?.discountBps ?? 0}
        initialDiscountReason={version?.discountReason ?? ''}
        initialSiteCount={snapshot?.siteCount ?? 1}
        quoteStatus={quote.status}
      />
    </div>
  );
}
