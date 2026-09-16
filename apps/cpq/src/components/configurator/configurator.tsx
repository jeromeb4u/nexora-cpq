'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, ChevronLeft, ChevronRight, Loader } from 'lucide-react';
import { Button } from '@nexora/ui';
import {
  type ConfigurationInput,
  type ConfigurationRule,
  type ContractTerm,
  type ProductSnapshot,
  type Serviceability,
  type ValidationFinding,
  CONTRACT_TERMS,
} from '@nexora/types';
import {
  approvedDiscountRate,
  calculatePrice,
  evaluateConfiguration,
  evaluateDiscount,
  requiredProductIds as computeRequiredIds,
} from '@nexora/cpq-engine';

import { saveConfiguration } from '@/lib/actions/quote-actions';
import { cn } from '../cn';
import { FindingsPanel } from './findings-panel';
import { PricingPanel } from './pricing-panel';
import { PricingStep } from './pricing-step';
import { ProductPicker } from './product-picker';
import { ReviewStep } from './review-step';
import { StepNav } from './step-nav';
import { SubmitStep } from './submit-step';
import { STEPS, StepId, stepIndex } from './steps';

export interface ConfiguratorProps {
  readonly quoteId: string;
  readonly quoteNumber: string;
  readonly customerName: string;
  readonly locationName: string | null;
  readonly serviceability: Serviceability;
  readonly ownerRole: 'SALES_REP' | 'SALES_MANAGER' | 'PRICING_ADMIN' | 'ADMIN';
  readonly catalogue: readonly ProductSnapshot[];
  readonly rules: readonly ConfigurationRule[];
  readonly initialSelections: readonly { readonly productId: string; readonly quantity: number }[];
  readonly initialContractMonths: ContractTerm;
  readonly initialDiscountBps: number;
  readonly initialDiscountReason: string;
  readonly initialSiteCount: number;
  readonly quoteStatus: string;
}

const AUTOSAVE_DELAY_MS = 1_500;

/**
 * The configuration experience.
 *
 * The engines are pure functions with no I/O, so the SAME code that prices a
 * quote on the server runs here in the browser. That is what makes feedback
 * instant (§14) without duplicating a single business rule — and it is why the
 * rule engine was built dependency-free in the first place.
 *
 * The browser's answer is a preview, never the truth. Every save posts
 * selections and a requested discount, and the server recomputes from the
 * database (§33). If the two ever disagreed, the server would win and the user
 * would see the corrected figures come back.
 */
export function Configurator(props: ConfiguratorProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [step, setStep] = useState<StepId>(
    props.initialSelections.length > 0 ? StepId.CONNECTIVITY : StepId.CUSTOMER,
  );
  const [selections, setSelections] = useState<ReadonlyMap<string, number>>(
    () => new Map(props.initialSelections.map((s) => [s.productId, s.quantity])),
  );
  const [contractMonths, setContractMonths] = useState<ContractTerm>(props.initialContractMonths);
  const [siteCount, setSiteCount] = useState(props.initialSiteCount);
  const [discountBps, setDiscountBps] = useState(props.initialDiscountBps);
  const [discountReason, setDiscountReason] = useState(props.initialDiscountReason);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const productById = useMemo(
    () => new Map(props.catalogue.map((product) => [product.id, product])),
    [props.catalogue],
  );
  const productNames = useMemo(
    () => new Map(props.catalogue.map((product) => [product.id, product.name])),
    [props.catalogue],
  );

  // --- Live evaluation, identical to the server's -------------------------

  const configuration: ConfigurationInput = useMemo(
    () => ({
      selections: [...selections.entries()].map(([productId, quantity]) => ({
        productId,
        quantity,
      })),
      contractMonths,
      serviceability: props.serviceability,
      siteCount,
    }),
    [selections, contractMonths, siteCount, props.serviceability],
  );

  const validation = useMemo(
    () => evaluateConfiguration(configuration, props.catalogue, props.rules),
    [configuration, props.catalogue, props.rules],
  );

  const selectedProducts = useMemo(
    () =>
      [...selections.keys()]
        .map((id) => productById.get(id))
        .filter((product): product is ProductSnapshot => product !== undefined),
    [selections, productById],
  );

  const listPrice = useMemo(
    () => calculatePrice({ configuration, catalogue: props.catalogue, approvedManualRate: 0 }),
    [configuration, props.catalogue],
  );

  const discountRequest = useMemo(
    () => ({
      requestedBps: discountBps,
      role: props.ownerRole,
      selectedProducts,
      tcv: listPrice.tcv,
    }),
    [discountBps, props.ownerRole, selectedProducts, listPrice.tcv],
  );

  const discount = useMemo(() => evaluateDiscount(discountRequest), [discountRequest]);

  const price = useMemo(
    () =>
      calculatePrice({
        configuration,
        catalogue: props.catalogue,
        approvedManualRate: approvedDiscountRate(discountRequest),
      }),
    [configuration, props.catalogue, discountRequest],
  );

  const requiredIds = useMemo(
    () => new Set(computeRequiredIds(configuration, props.catalogue, props.rules)),
    [configuration, props.catalogue, props.rules],
  );

  const conflictingIds = useMemo(() => {
    const ids = new Set<string>();
    for (const finding of validation.findings) {
      if (finding.blocking) {
        for (const id of finding.relatedProductIds) ids.add(id);
      }
    }
    return ids;
  }, [validation.findings]);

  // --- Autosave -----------------------------------------------------------

  /**
   * Save drafts automatically (§13) but only when the payload would actually
   * pass validation. Posting a knowingly invalid configuration every 1.5s would
   * fill the log with rejections and teach the user nothing.
   */
  const canSave =
    selections.size > 0 && validation.isValid && (discountBps === 0 || discountReason.length >= 10);

  const saveNow = useCallback(async () => {
    setSaveState('saving');

    const result = await saveConfiguration({
      quoteId: props.quoteId,
      selections: configuration.selections,
      contractMonths,
      siteCount,
      requestedDiscountBps: discountBps,
      discountReason: discountReason || undefined,
    });

    if (result.ok) {
      setSaveState('saved');
      setLastSavedAt(new Date().toLocaleTimeString('en-GB'));
      return true;
    }

    setSaveState('error');
    toast.error(result.message, { description: `Reference ${result.reference}` });
    return false;
  }, [props.quoteId, configuration.selections, contractMonths, siteCount, discountBps, discountReason]);

  const dirtyRef = useRef(false);
  const firstRenderRef = useRef(true);

  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
      return;
    }
    dirtyRef.current = true;

    if (!canSave) return;

    const timer = setTimeout(() => {
      void saveNow();
      dirtyRef.current = false;
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [canSave, saveNow]);

  // Warn before leaving with work that has not reached the server (§47).
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      event.preventDefault();
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // --- Mutations ----------------------------------------------------------

  const toggleProduct = useCallback((productId: string) => {
    setSelections((current) => {
      const next = new Map(current);
      if (next.has(productId)) next.delete(productId);
      else next.set(productId, 1);
      return next;
    });
  }, []);

  const setQuantity = useCallback((productId: string, quantity: number) => {
    setSelections((current) => {
      if (!current.has(productId)) return current;
      const next = new Map(current);
      next.set(productId, quantity);
      return next;
    });
  }, []);

  const applyRemedy = useCallback((finding: ValidationFinding) => {
    const remedy = finding.remedy;
    if (!remedy) return;

    if (remedy.kind === 'ADD_PRODUCT') {
      setSelections((current) => new Map(current).set(remedy.productId, 1));
    } else if (remedy.kind === 'REMOVE_PRODUCT') {
      setSelections((current) => {
        const next = new Map(current);
        next.delete(remedy.productId);
        return next;
      });
    } else if (remedy.kind === 'SET_CONTRACT_MONTHS') {
      const term = CONTRACT_TERMS.find((candidate) => candidate >= remedy.months);
      if (term) setContractMonths(term);
    }
  }, []);

  // --- Navigation ---------------------------------------------------------

  const index = stepIndex(step);
  const definition = STEPS[index];
  const isFirst = index === 0;
  const isLast = index === STEPS.length - 1;

  const goTo = useCallback(
    (target: StepId) => {
      setStep(target);
      // Long steps leave the user mid-page; start each step at the top.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [],
  );

  const categoryProducts = useMemo(() => {
    if (!definition?.category) return [];
    return props.catalogue.filter(
      (product) => product.category === definition.category && product.isActive,
    );
  }, [definition, props.catalogue]);

  if (!definition) return null;

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[16rem_minmax(0,1fr)_19rem]">
      <div className="xl:order-1">
        <StepNav
          current={step}
          onNavigate={goTo}
          hasSelections={selections.size > 0}
          isValid={validation.isValid}
        />
      </div>

      <div className="space-y-4 xl:order-2">
        <header>
          <p className="text-2xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
            Step {index + 1} of {STEPS.length}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">
            {definition.label}
          </h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{definition.description}</p>
        </header>

        {step === StepId.CUSTOMER ? (
          <SummaryCard
            rows={[
              { label: 'Customer', value: props.customerName },
              { label: 'Quote', value: props.quoteNumber },
              { label: 'Status', value: props.quoteStatus.replace(/_/g, ' ').toLowerCase() },
            ]}
            note="Customer and site were set when the quote was created. Change them from the quote's detail page."
          />
        ) : null}

        {step === StepId.LOCATION ? (
          <SummaryCard
            rows={[
              { label: 'Site', value: props.locationName ?? 'No site selected' },
              {
                label: 'Serviceability',
                value: props.serviceability.replace(/_/g, ' ').toLowerCase(),
              },
              { label: 'Sites on this quote', value: String(siteCount) },
            ]}
            note="Per-site products are billed once per site. Adjust the site count if this configuration covers more than one address."
          >
            <label className="mt-3 flex items-center gap-2 text-sm">
              <span className="text-[var(--text-secondary)]">Number of sites</span>
              <input
                type="number"
                min={1}
                max={99}
                value={siteCount}
                onChange={(event) =>
                  setSiteCount(Math.max(1, Math.min(99, Number(event.target.value) || 1)))
                }
                className="tabular w-20 rounded-md border border-[var(--border-default)] bg-[var(--surface-raised)] px-2 py-1 text-sm"
              />
            </label>
          </SummaryCard>
        ) : null}

        {definition.category ? (
          <ProductPicker
            products={categoryProducts}
            selections={selections}
            requiredProductIds={requiredIds}
            conflictingProductIds={conflictingIds}
            onToggle={toggleProduct}
            onQuantityChange={setQuantity}
          />
        ) : null}

        {step === StepId.PRICING ? (
          <PricingStep
            contractMonths={contractMonths}
            onContractMonthsChange={setContractMonths}
            discountBps={discountBps}
            onDiscountBpsChange={setDiscountBps}
            discountReason={discountReason}
            onDiscountReasonChange={setDiscountReason}
            evaluation={discount}
            price={price}
          />
        ) : null}

        {step === StepId.REVIEW ? (
          <ReviewStep
            customerName={props.customerName}
            locationName={props.locationName}
            price={price}
            findings={validation.findings}
            discountReason={discountReason}
            evaluation={discount}
          />
        ) : null}

        {step === StepId.SUBMIT ? (
          <SubmitStep
            quoteId={props.quoteId}
            quoteNumber={props.quoteNumber}
            canProceed={validation.canProceed}
            evaluation={discount}
            discountReason={discountReason}
            hasUnsavedWork={saveState !== 'saved' && canSave}
            onSaveFirst={saveNow}
            onDone={() => startTransition(() => router.push(`/quotes/${props.quoteId}`))}
          />
        ) : null}

        {definition.category || step === StepId.PRICING ? (
          <FindingsPanel
            findings={validation.findings}
            onApplyRemedy={applyRemedy}
            productNames={productNames}
          />
        ) : null}

        <nav className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
          <Button
            variant="ghost"
            disabled={isFirst}
            onClick={() => {
              const previous = STEPS[index - 1];
              if (previous) goTo(previous.id);
            }}
          >
            <ChevronLeft className="size-4" aria-hidden />
            Back
          </Button>

          <SaveIndicator state={saveState} lastSavedAt={lastSavedAt} canSave={canSave} />

          <Button
            disabled={isLast}
            onClick={() => {
              const next = STEPS[index + 1];
              if (next) goTo(next.id);
            }}
          >
            Next
            <ChevronRight className="size-4" aria-hidden />
          </Button>
        </nav>
      </div>

      <div className="xl:order-3 xl:sticky xl:top-4 xl:self-start">
        <PricingPanel price={price} evaluation={discount} isValid={validation.isValid} />
      </div>
    </div>
  );
}

function SaveIndicator({
  state,
  lastSavedAt,
  canSave,
}: {
  readonly state: 'idle' | 'saving' | 'saved' | 'error';
  readonly lastSavedAt: string | null;
  readonly canSave: boolean;
}) {
  if (state === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-2xs text-[var(--text-tertiary)]">
        <Loader className="size-3 animate-spin" aria-hidden />
        Saving…
      </span>
    );
  }

  if (state === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-2xs text-[var(--color-success-600)]">
        <Check className="size-3" aria-hidden />
        Draft saved{lastSavedAt ? ` at ${lastSavedAt}` : ''}
      </span>
    );
  }

  if (state === 'error') {
    return (
      <span className="text-2xs text-[var(--color-danger-600)]">
        Could not save — your changes are still here
      </span>
    );
  }

  return (
    <span className="text-2xs text-[var(--text-tertiary)]">
      {canSave ? 'Changes save automatically' : 'Not yet saveable'}
    </span>
  );
}

function SummaryCard({
  rows,
  note,
  children,
}: {
  readonly rows: readonly { readonly label: string; readonly value: string }[];
  readonly note?: string;
  readonly children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-4">
      <dl className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-4 text-sm">
            <dt className="text-[var(--text-tertiary)]">{row.label}</dt>
            <dd className={cn('text-right font-medium text-[var(--text-primary)]', 'capitalize')}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {children}
      {note ? (
        <p className="mt-3 border-t border-[var(--border-subtle)] pt-3 text-2xs leading-relaxed text-[var(--text-tertiary)]">
          {note}
        </p>
      ) : null}
    </div>
  );
}
