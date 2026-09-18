# CPQ rules, pricing and approvals

Everything the business can argue about lives in `packages/cpq-engine`: four
pure modules with no database, React or I/O dependency.

| Module             | Answers                                                       |
| ------------------ | ------------------------------------------------------------- |
| `configuration.ts` | Is this combination of products valid for this site and term? |
| `pricing.ts`       | What does it cost, line by line?                              |
| `discount.ts`      | Is this discount allowed, and if not, who may approve it?     |
| `quote-state.ts`   | May this person move this quote to that status?               |
| `policy.ts`        | The numbers: authority limits, term discounts, thresholds.    |

The same functions run in the configurator for instant feedback and on the
server as the authority ([ADR-008](adr/ADR-008-isomorphic-engine.md)). The
browser's answer is a preview; the server recomputes from database rows on every
save ([ADR-004](adr/ADR-004-server-authoritative-pricing.md)).

---

## Compatibility rules

### Rules are data

A rule is a row in `product_rule`: a **trigger** (when does it apply) and an
**effect** (what it asserts), with a severity and a message written for the
salesperson. One interpreter evaluates all of them
([ADR-005](adr/ADR-005-rules-as-data.md)). Adding a rule is an insert, not a code
change.

| Trigger                  | Fires when                                              |
| ------------------------ | ------------------------------------------------------- |
| `PRODUCT_SELECTED`       | a specific product is in the configuration              |
| `CATEGORY_SELECTED`      | any product of a category (e.g. SD-WAN) is selected     |
| `BANDWIDTH_AT_LEAST`     | the highest selected connectivity bandwidth is ≥ N Mbps |
| `CONTRACT_TERM_AT_LEAST` | the term is ≥ N months                                  |
| `ALWAYS`                 | unconditionally                                         |

| Effect                      | Asserts                                            |
| --------------------------- | -------------------------------------------------- |
| `REQUIRES_PRODUCT`          | product X must also be selected                    |
| `REQUIRES_ONE_OF`           | at least one of products X, Y… must be selected    |
| `INCOMPATIBLE_WITH_PRODUCT` | product X must not be selected                     |
| `RECOMMENDS_PRODUCT`        | product X should be considered                     |
| `AT_MOST_ONE_OF`            | no more than one of X, Y…                          |
| `MIN_CONTRACT_MONTHS`       | the term must be at least N months                 |
| `MIN_SERVICEABILITY`        | the site's serviceability must be at least a level |

Triggers and effects are TypeScript discriminated unions, and the interpreter
ends every `switch` with an exhaustiveness guard, so adding a kind to the enum
without handling it is a compile error.

### Severities

| Severity         | Blocks saving and submission? | Used for                                                 |
| ---------------- | ----------------------------- | -------------------------------------------------------- |
| `ERROR`          | **Yes**                       | incompatible or incomplete configurations                |
| `REQUIRED`       | No                            | information the rep must act on before the customer does |
| `WARNING`        | No                            | risky but permitted choices                              |
| `RECOMMENDATION` | No                            | upsell and best-practice suggestions                     |
| `INFORMATION`    | No                            | context                                                  |

Only `ERROR` blocks. Everything else is shown with its own styling and, where a
fix is a single product, a one-click remedy ("Add Enterprise Router").

### Intrinsic checks

Some checks come from the product and site rather than from rule rows, and
always apply:

- the site's serviceability is `UNAVAILABLE` (error) or `PENDING_CHECK` (warning);
- a selected product's own `minContractMonths` exceeds the term (error);
- a selected product has been withdrawn from the catalogue, or no longer exists (error);
- nothing providing connectivity has been selected (error).

### The seeded rule set

| Rule                                                                          | Severity       |
| ----------------------------------------------------------------------------- | -------------- |
| 10 Gbps requires an **AVAILABLE** site                                        | error          |
| 10 Gbps requires the **Enterprise Router**                                    | error          |
| 10 Gbps is incompatible with the **Managed Router**                           | error          |
| ≥ 1 Gbps requires **a** managed routing device (Managed or Enterprise Router) | error          |
| 10 Gbps requires a **36-month** minimum term                                  | error          |
| SD-WAN requires the **SD-WAN Edge Device**                                    | error          |
| SD-WAN is incompatible with the Managed Router                                | error          |
| SD-WAN Orchestration requires an SD-WAN service                               | error          |
| DDoS Protection requires the **Secure Internet Gateway**                      | error          |
| Zero Trust Network Access requires the Secure Internet Gateway                | error          |
| A SIP Trunk requires business internet (wireless backup alone is not enough)  | error          |
| A Technical Account Manager requires Premium or 24/7 support                  | error          |
| At most one support tier                                                      | error          |
| Legacy IDS alongside Managed Firewall                                         | warning        |
| ≥ 1 Gbps: consider a 4G/5G wireless backup                                    | recommendation |
| Managed Detection & Response: consider Premium Support                        | recommendation |
| SD-WAN: consider a Managed Firewall                                           | recommendation |
| (one deliberately inactive rule, to prove inactive rules never fire)          | —              |

**A specification conflict, resolved.** The brief stated "≥ 1 Gbps requires the
Managed Router" and also "10 Gbps requires the Enterprise Router and is
incompatible with the Managed Router". Taken literally, a 10 Gbps circuit would
both require and forbid the Managed Router — no valid configuration could exist.
The 1 Gbps rule is therefore modelled as `REQUIRES_ONE_OF [Managed Router,
Enterprise Router]`: "a routing device", which is what the rule is for.

---

## Pricing

For each selected product:

1. **Billable quantity** from the pricing model: `PER_UNIT` uses the quantity,
   `FLAT` is always 1, `PER_SITE` uses the number of sites.
2. **Line subtotals**: unit monthly price × quantity, unit setup price × quantity.
3. **Line discount**, applied to the monthly subtotal only:
   - the **term discount** first, then the **negotiated** discount on top;
   - the combined rate is **capped at that product's own `maxDiscountBps`**.

Then for the quote:

```
gross monthly = Σ line monthly subtotals
discount      = Σ line discount amounts   (each rounded individually)
MRR           = gross monthly − discount
OTC           = Σ line setup subtotals
TCV           = MRR × term months + OTC
```

### Term discounts

| Term     | 12  | 24  | 36  | 48   | 60 months |
| -------- | --- | --- | --- | ---- | --------- |
| Discount | 0%  | 2%  | 5%  | 6.5% | 8%        |

### Decisions worth knowing

- **Ceilings are per line, not per bundle.** A router capped at 10% in a quote
  negotiated at 18% gets 10% while every other line gets 18%. Capping the whole
  quote at its least flexible product was an earlier implementation; it made
  almost every hardware-plus-service quote undiscountable and produced identical
  totals for different requested discounts. A regression test pins this down.
- **Setup fees are never discounted.** They are cost recovery at Nexora; this is
  policy, not an omission.
- **Rounding is half away from zero, per line.** The discount total is the sum of
  rounded line discounts, so the line breakdown on a quote document always adds
  up to the total printed beneath it.
- **The effective discount can differ from the requested one** in either
  direction: lower where product ceilings cap lines, higher where the term
  discount stacks on top of the negotiated rate.

---

## Discount authority and approvals

| Role                  | May grant up to |
| --------------------- | --------------- |
| Sales Representative  | 10%             |
| Sales Manager         | 20%             |
| Pricing Administrator | 35%             |
| Administrator         | 35%             |

Nothing above **35%** can be approved by anyone; the server clamps a larger
request to 35% before pricing and storing it.

A quote **requires approval** when either:

- the negotiated discount exceeds the requester's authority, or
- the total contract value is **€500,000 or more**, even within authority.

Approval rules the server enforces:

1. **Nobody approves their own quote** — enforced by both the permission layer
   and the state machine, independently.
2. **An approver may only approve within their own authority.** A Sales Manager
   can reject a 26% request but not approve it; only approvers whose authority
   covers the request are notified of it.
3. **Approval is for a version.** If the quote is revised while a request is
   pending, the request can no longer be decided; withdrawing or revising marks
   it `WITHDRAWN`.
4. **A rejection needs a reason** of at least ten characters, which the rep sees.
5. **Approval starts a 30-day validity period.** A quote whose validity has
   lapsed cannot be sent.
6. **One decision wins.** A decision is a conditional update on
   `decision = 'PENDING'`, so two approvers clicking at once cannot both succeed.
7. **Review is not a way around escalation.** An approver may approve a quote in
   `READY_FOR_REVIEW` directly only if its owner could have granted the discount.

---

## The quote state machine

Transitions are a table (`QUOTE_TRANSITIONS`), each with the roles allowed to
make it and whether the quote's owner is excluded
([ADR-006](adr/ADR-006-declarative-state-machine.md)). The table is typed as
exhaustive over `QuoteStatus`, so a new status does not compile until its
transitions are declared.

| From                | To                                                | Who                         |
| ------------------- | ------------------------------------------------- | --------------------------- |
| Draft               | Configuring, Cancelled                            | anyone with edit rights     |
| Configuring         | Ready for review, Draft, Cancelled                | editor                      |
| Ready for review    | Approval required, Configuring, Cancelled         | editor                      |
| Ready for review    | Approved                                          | approver, **not the owner** |
| Approval required   | Approved, Rejected                                | approver, **not the owner** |
| Approval required   | Configuring (withdraw), Cancelled                 | editor                      |
| Approved            | Sent to customer, Configuring (reopen), Cancelled | editor                      |
| Rejected            | Configuring, Cancelled                            | editor                      |
| Sent to customer    | Accepted, Expired, Cancelled                      | editor                      |
| Expired             | Configuring (revive as a new version)             | editor                      |
| Accepted, Cancelled | —                                                 | terminal                    |

Saving a configuration on a draft or rejected quote moves it to Configuring.
"Send for approval" from Configuring passes through Ready for review in the same
request, and both hops are checked.

## Versioning

Every save creates a new `quote_version`; the previous one gets `supersededAt`
and is otherwise never touched ([ADR-007](adr/ADR-007-append-only-versioning.md)).
"Restore" copies an old version into a **new** version on top of the history —
it does not rewind — and returns the quote to Configuring so any approval must
be obtained again for the figures it carries.

---

## Managing the catalogue and rules

Products and rules are data, so a Pricing Administrator edits them in the app
(`/products` and `/products/rules`) rather than through a migration. Both live
in the CPQ zone, gated on `PRODUCT_MANAGE` and `RULE_MANAGE`; every action is
re-authorized server-side.

**Products.** Prices are entered in euro and stored as integer cents; the
per-product discount ceiling is entered as a percentage and stored as basis
points. Withdrawing a product asks for confirmation and then reports how many
in-progress quotes still include it — those quotes keep their prices but show
the product as withdrawn until a rep removes it. Editing a price changes what
the _next_ quote version costs and never what an existing version says, because
versions snapshot their own prices, SKUs and names
([ADR-007](adr/ADR-007-append-only-versioning.md)).

**Rules.** The editor is the rule model: choose a trigger, choose an effect,
fill in only the parameters that pair needs, and read the rule back as the
sentence a salesperson would see — "When connectivity of 10 Gbps or more is
selected, require Enterprise Router." Rules can be enabled and disabled from the
list without opening the editor, and a disabled rule never fires.

Two things the editor cannot express, on purpose:

- **`type` is derived from the effect** (`ruleTypeForEffect`), so a rule whose
  declared type contradicts its effect cannot exist.
- **A rule cannot make a product require, recommend or forbid itself**, and a
  "one of" group needs at least two distinct members — a group of one is not a
  choice. Product references are checked against the database before the rule is
  stored.

Rule and catalogue changes take effect on the next configuration: the
configurator loads the active rule set per request, and the server re-evaluates
it on every save. Quotes that were already priced keep their stored figures;
their configuration is re-checked only when a document is generated, and then
only blocks quotes that are still being edited
([ADR-012](adr/ADR-012-on-demand-documents-with-sse.md)).

Discount authority limits, the contract-value threshold and the term-discount
ladder are **not** editable here — they are policy in `cpq-engine/policy.ts`,
changed by a deployment rather than by a form.
