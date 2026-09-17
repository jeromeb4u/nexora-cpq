import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { bpsToRate, cents, formatMoney, formatRate } from '@nexora/types';

import { type QuoteDocumentModel, isBindingOffer } from './document-model';

/**
 * The quote as a customer receives it: an A4 commercial document.
 *
 * Laid out the way telecom proposals actually are — parties first, then a
 * summary a buyer can take to their finance team, then the line detail, the
 * commercial terms, and an acceptance block. Everything is drawn in the PDF
 * standard Helvetica family so no font files need to be fetched at render time.
 */

const INK = '#171c24';
const MUTED = '#5b6474';
const FAINT = '#8a93a3';
const RULE = '#dfe3ea';
const BAND = '#f4f6f9';
const BRAND = '#2449d6';

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 64,
    paddingHorizontal: 44,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: INK,
    lineHeight: 1.35,
  },
  watermark: {
    position: 'absolute',
    top: 330,
    left: 70,
    fontSize: 88,
    fontFamily: 'Helvetica-Bold',
    color: '#e9ecf2',
    transform: 'rotate(-30deg)',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 22 },
  brand: { flexDirection: 'row', alignItems: 'flex-end' },
  brandName: { fontSize: 20, lineHeight: 1, fontFamily: 'Helvetica-Bold', color: INK },
  brandSuffix: {
    fontSize: 7,
    lineHeight: 1,
    letterSpacing: 2,
    color: MUTED,
    marginLeft: 6,
    marginBottom: 2,
  },
  brandAddress: { fontSize: 8, color: MUTED, marginTop: 8 },
  docTitle: {
    fontSize: 16,
    lineHeight: 1,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
    color: BRAND,
    marginBottom: 6,
  },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 2 },
  metaLabel: { color: MUTED, width: 70, textAlign: 'right', marginRight: 8 },
  metaValue: { fontFamily: 'Helvetica-Bold', width: 92, textAlign: 'right' },
  parties: { flexDirection: 'row', marginBottom: 16 },
  party: { flex: 1, paddingRight: 16 },
  sectionLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    color: FAINT,
    marginBottom: 4,
  },
  strong: { fontFamily: 'Helvetica-Bold' },
  muted: { color: MUTED },
  summary: {
    flexDirection: 'row',
    backgroundColor: BAND,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 18,
  },
  summaryCell: { flex: 1 },
  summaryValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  sectionTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  table: { borderTopWidth: 1, borderTopColor: INK, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingVertical: 5,
  },
  headRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: INK,
  },
  headCell: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 0.5 },
  colSku: { width: 78 },
  colName: { flex: 1, paddingRight: 6 },
  colQty: { width: 28, textAlign: 'right' },
  colMoney: { width: 72, textAlign: 'right' },
  totals: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 18 },
  totalsBox: { width: 240 },
  totalsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  totalsGrand: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: INK,
    paddingTop: 5,
    marginTop: 3,
  },
  twoColumn: { flexDirection: 'row', marginBottom: 16 },
  column: { flex: 1, paddingRight: 16 },
  box: { borderWidth: 0.75, borderColor: RULE, borderRadius: 4, padding: 10 },
  term: { flexDirection: 'row', marginBottom: 2 },
  termNumber: { width: 12, fontSize: 8, color: MUTED },
  termText: { flex: 1, fontSize: 8, color: MUTED },
  signatures: { flexDirection: 'row', marginTop: 4 },
  signature: { flex: 1, paddingRight: 24 },
  signatureLine: { borderBottomWidth: 0.75, borderBottomColor: INK, height: 26, marginBottom: 3 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 44,
    right: 44,
    fontSize: 7,
    color: FAINT,
  },
  // Anchored from the top: react-pdf 4 drops bottom-anchored text that uses a
  // render prop, because its height is unknown at first layout.
  pageNumber: {
    position: 'absolute',
    top: 808,
    left: 44,
    right: 44,
    fontSize: 7,
    color: FAINT,
    textAlign: 'right',
  },
});

/** Intl may emit a narrow no-break space, which the standard PDF fonts lack. */
function pdfSafe(value: string): string {
  return value.replaceAll(String.fromCharCode(0x202f), String.fromCharCode(0x00a0));
}

function money(value: number): string {
  return pdfSafe(formatMoney(cents(value)));
}

function rate(bps: number): string {
  return pdfSafe(formatRate(bpsToRate(bps)));
}

function longDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const TERMS: readonly string[] = [
  'Prices are in euro and exclude VAT, which is charged at the prevailing rate.',
  'Monthly charges are invoiced in advance from the service activation date of each site.',
  'One-time charges are invoiced on service activation.',
  'The minimum term runs from activation of the last service at each site. Early termination incurs the remaining monthly charges for the minimum term.',
  'Service delivery is subject to a completed site survey. Where a survey reveals excess construction costs, Nexora will quote them separately before proceeding.',
  'Service levels, fault handling and service credits are as set out in the Nexora Business Service Level Agreement for the support tier ordered.',
  'This offer is valid until the date shown above and is governed by the laws of the Federal Republic of Germany.',
];

function ApprovalStatement({ approval }: { readonly approval: QuoteDocumentModel['approval'] }) {
  switch (approval.kind) {
    case 'APPROVED':
      return (
        <Text>
          Commercial terms approved by <Text style={styles.strong}>{approval.approverName}</Text> on{' '}
          {longDate(approval.decidedAt)}, including a negotiated discount of{' '}
          {rate(approval.discountBps)}.
        </Text>
      );
    case 'WITHIN_AUTHORITY':
      return (
        <Text>
          Commercial terms are within standard sales authority. No escalation was required.
        </Text>
      );
    case 'PENDING':
      return (
        <Text>
          Commercial terms are awaiting internal approval. This document is not yet an offer.
        </Text>
      );
    case 'NOT_APPROVED':
    default:
      return <Text>Commercial terms have not been approved. This document is not an offer.</Text>;
  }
}

export function QuoteDocument({ model }: { readonly model: QuoteDocumentModel }) {
  const binding = isBindingOffer(model.status);
  const reference = `${model.quoteNumber} v${model.versionNumber}`;

  return (
    <Document
      title={`Nexora quote ${reference}`}
      author="Nexora Telecom"
      subject={`Quotation for ${model.customer.companyName}`}
      creator="Nexora CPQ"
      producer="Nexora CPQ"
    >
      <Page size="A4" style={styles.page}>
        {binding ? null : (
          <Text style={styles.watermark} fixed>
            DRAFT
          </Text>
        )}

        <View style={styles.header}>
          <View>
            <View style={styles.brand}>
              <Text style={styles.brandName}>Nexora</Text>
              <Text style={styles.brandSuffix}>TELECOM</Text>
            </View>
            <Text style={styles.brandAddress}>
              Nexora Telecom GmbH · Friedrichstraße 88 · 10117 Berlin
            </Text>
          </View>
          <View>
            <Text style={styles.docTitle}>{binding ? 'Quotation' : 'Draft quotation'}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Reference</Text>
              <Text style={styles.metaValue}>{reference}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Issued</Text>
              <Text style={styles.metaValue}>{longDate(model.issuedAt)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Valid until</Text>
              <Text style={styles.metaValue}>
                {model.validUntil ? longDate(model.validUntil) : 'On approval'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.sectionLabel}>PREPARED FOR</Text>
            <Text style={styles.strong}>{model.customer.legalName}</Text>
            <Text>VAT ID {model.customer.vatNumber}</Text>
            <Text style={styles.muted}>{model.customer.email}</Text>
            <Text style={styles.muted}>{model.customer.phone}</Text>
          </View>
          <View style={styles.party}>
            <Text style={styles.sectionLabel}>INSTALLATION SITE</Text>
            {model.site ? (
              <>
                <Text style={styles.strong}>{model.site.name}</Text>
                {model.site.addressLines.map((line) => (
                  <Text key={line}>{line}</Text>
                ))}
                <Text style={styles.muted}>
                  Site contact: {model.site.contactName}
                  {model.site.contactPhone ? `, ${model.site.contactPhone}` : ''}
                </Text>
              </>
            ) : (
              <Text style={styles.muted}>To be confirmed</Text>
            )}
          </View>
          <View style={styles.party}>
            <Text style={styles.sectionLabel}>YOUR NEXORA CONTACT</Text>
            <Text style={styles.strong}>{model.representative.name}</Text>
            <Text style={styles.muted}>{model.representative.email}</Text>
          </View>
        </View>

        {model.title ? (
          <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>{model.title}</Text>
        ) : null}

        <View style={styles.summary}>
          <View style={styles.summaryCell}>
            <Text style={styles.sectionLabel}>MONTHLY CHARGES</Text>
            <Text style={styles.summaryValue}>{money(model.totals.mrrCents)}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.sectionLabel}>ONE-TIME CHARGES</Text>
            <Text style={styles.summaryValue}>{money(model.totals.otcCents)}</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.sectionLabel}>CONTRACT TERM</Text>
            <Text style={styles.summaryValue}>{model.contractMonths} months</Text>
          </View>
          <View style={styles.summaryCell}>
            <Text style={styles.sectionLabel}>TOTAL CONTRACT VALUE</Text>
            <Text style={styles.summaryValue}>{money(model.totals.tcvCents)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Services and equipment</Text>
        <View style={styles.table}>
          <View style={styles.headRow} fixed>
            <Text style={[styles.headCell, styles.colSku]}>SKU</Text>
            <Text style={[styles.headCell, styles.colName]}>DESCRIPTION</Text>
            <Text style={[styles.headCell, styles.colQty]}>QTY</Text>
            <Text style={[styles.headCell, styles.colMoney]}>UNIT / MONTH</Text>
            <Text style={[styles.headCell, styles.colMoney]}>MONTHLY</Text>
            <Text style={[styles.headCell, styles.colMoney]}>ONE-TIME</Text>
          </View>
          {model.lines.map((line) => (
            <View key={line.sku} style={styles.row} wrap={false}>
              <Text style={[styles.colSku, styles.muted]}>{line.sku}</Text>
              <Text style={styles.colName}>{line.name}</Text>
              <Text style={styles.colQty}>{line.quantity}</Text>
              <Text style={styles.colMoney}>{money(line.unitMonthlyCents)}</Text>
              <Text style={styles.colMoney}>{money(line.monthlyCents)}</Text>
              <Text style={styles.colMoney}>
                {line.setupCents > 0 ? money(line.setupCents) : '—'}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.totals} wrap={false}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.muted}>Monthly charges at list price</Text>
              <Text>{money(model.totals.grossMonthlyCents)}</Text>
            </View>
            {model.discounts.map((discount) => (
              <View key={discount.label} style={styles.totalsRow}>
                <Text style={styles.muted}>
                  {discount.label} ({pdfSafe(formatRate(discount.rate))})
                </Text>
                <Text>-{money(discount.amountCents)}</Text>
              </View>
            ))}
            <View style={styles.totalsRow}>
              <Text style={styles.muted}>
                Total monthly discount ({rate(model.effectiveDiscountBps)} effective)
              </Text>
              <Text>-{money(model.totals.discountMonthlyCents)}</Text>
            </View>
            <View style={styles.totalsGrand}>
              <Text style={styles.strong}>Net monthly charges</Text>
              <Text style={styles.strong}>{money(model.totals.mrrCents)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.muted}>One-time charges</Text>
              <Text>{money(model.totals.otcCents)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.muted}>Total over {model.contractMonths} months</Text>
              <Text style={styles.strong}>{money(model.totals.tcvCents)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.twoColumn} wrap={false}>
          <View style={styles.column}>
            <Text style={styles.sectionTitle}>Terms</Text>
            {TERMS.map((term, index) => (
              <View key={term} style={styles.term}>
                <Text style={styles.termNumber}>{index + 1}.</Text>
                <Text style={styles.termText}>{term}</Text>
              </View>
            ))}
          </View>
          <View style={{ width: 190 }}>
            <Text style={styles.sectionTitle}>Approval</Text>
            <View style={styles.box}>
              <ApprovalStatement approval={model.approval} />
            </View>
          </View>
        </View>

        <View wrap={false}>
          <Text style={styles.sectionTitle}>Acceptance</Text>
          <Text style={styles.muted}>
            Signed for {model.customer.legalName}, accepting this quotation on the terms above.
          </Text>
          <View style={styles.signatures}>
            {['Name and position', 'Signature', 'Date'].map((label) => (
              <View key={label} style={styles.signature}>
                <View style={styles.signatureLine} />
                <Text style={styles.muted}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {reference} · Nexora Telecom is a fictional company; this document was produced by a
          portfolio demonstration.
        </Text>
        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      </Page>
    </Document>
  );
}
