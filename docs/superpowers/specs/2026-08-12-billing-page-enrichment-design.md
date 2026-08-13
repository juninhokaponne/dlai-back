# Billing page enrichment — design

Date: 2026-08-12
Repos affected: `dlai-back` (API/data model), `dlai-web` (Settings > Billing UI)

## Context

The billing settings page today (`dlai-web` `billing-tab.tsx`) shows only a raw
credit balance number and plan cards with an "Upgrade" button. There is no
payment history, no visibility into the next charge, no way to see real
per-cycle credit usage, and no way to cancel a subscription. This spec covers
enriching that page end to end.

Confirmed as already correct and unaffected by this work: checkout uses
Stripe subscription mode with a monthly recurring Price, so billing is
already genuinely recurring — Stripe auto-charges every month until the
subscription is canceled. This spec adds the missing cancel path.

## Decisions

- **Cancellation timing:** `cancel_at_period_end: true`, not immediate. The
  user keeps plan access through the period they already paid for; Stripe
  stops billing after that and the subscription later transitions to
  `canceled` on its own (the existing `customer.subscription.deleted`
  webhook handler already covers that transition — no change needed there).
- **Payment history source:** fetched live from Stripe
  (`stripe.invoices.list`) on each page load. No local invoices table, no
  migration, no sync code to maintain. Stripe is the durable source of
  truth for this data.
- **Credit usage bar:** shows real consumption for the current cycle, not
  just remaining balance (credits roll over and never reset, so "balance vs
  plan quota" alone would be misleading once someone accumulates credits
  across months). "Cycle start" = the most recent `credit_transactions` row
  with reason `subscription_grant` or `trial_grant` for that user. Usage =
  net of `generation_debit` / `generation_refund` transactions at or after
  that timestamp. No new table.
- **Trial-eligible plan cards still show price.** The 14-day-free badge is
  additive, not a replacement: eligible cards show a "14 dias grátis" badge
  above the normal price line, so the user always sees what they'll
  eventually pay.
- **Trial eligibility on the frontend** is inferred from the existing
  `GET /api/billing/subscription` response being `null` — that already
  matches the backend's own eligibility check in `checkout()` (any prior
  `subscriptions` row, including a canceled one, disqualifies a repeat
  trial), so no new field is needed for this.

## Backend changes (dlai-back)

**Schema migration** — add one column:
- `subscriptions.cancel_at_period_end` (boolean, default `false`). Synced in
  `syncSubscription()` from `Stripe.Subscription.cancel_at_period_end`
  alongside the existing `status`/`currentPeriodEnd` sync — same function,
  one more field, no new webhook case.

**`GET /api/billing/subscription`** (extend existing endpoint):
- Add `cancelAtPeriodEnd: boolean`.
- Add `planCredits: number` — the credit allotment for the user's plan
  (from `PLANS`), or `TRIAL_CREDITS` if there's no subscription row (covers
  brand-new signups who only have the one-time signup grant).
- Add `creditsUsedThisCycle: number` — computed as described above: find
  the latest `subscription_grant`/`trial_grant` transaction timestamp for
  the user (fall back to account `createdAt` if somehow none exists), sum
  `generation_debit` + `generation_refund` amounts at or after it, negate
  (debits are stored negative).

**`GET /api/billing/plans`** (extend existing endpoint):
- Add `trialPeriodDays: number` (the existing `TRIAL_PERIOD_DAYS` constant),
  so the frontend doesn't hardcode "14" separately from the backend value.

**`GET /api/billing/invoices`** (new endpoint):
- Requires auth. Loads the user's `stripeCustomerId`; if none, return
  `{ invoices: [] }`.
- Calls `stripe.invoices.list({ customer, limit: 12 })`.
- Maps to `{ id, amountBrlCents, status, createdAt, hostedInvoiceUrl }[]`
  (`status` is Stripe's own invoice status: `paid`, `open`, `void`,
  `uncollectible`; `hostedInvoiceUrl` is Stripe's hosted receipt page, used
  as the "view receipt" link — no need to generate or store PDFs ourselves).

**`POST /api/billing/cancel`** (new endpoint):
- Requires auth. Loads the user's subscription row; 404 if none, or if
  `status` is already `canceled`.
- Calls `stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true })`.
- Updates the local row's `cancelAtPeriodEnd` to `true` immediately (so the
  response is consistent without waiting on the webhook round-trip); the
  webhook's `customer.subscription.updated` handler will also sync it
  moments later — harmless, idempotent no-op if it already matches.
- Returns the updated `{ cancelAtPeriodEnd, currentPeriodEnd }`.

## Frontend changes (dlai-web)

All in `billing-tab.tsx` (and a couple of small additions alongside it);
reuses the existing `Modal` component (`src/components/ui/modal.tsx`) for
the cancel confirmation — no new modal primitive.

- **Financial summary card** (new): current plan status badge (Em trial /
  Ativo / Cancela em `{date}` / Sem plano), next charge — amount + date, or
  during trial "Trial termina em `{days}` dias, primeira cobrança de
  `R${amount}` em `{date}`" — and lifetime total paid (sum of `paid`
  invoices from `/billing/invoices`).
- **Credit usage bar**: thin rounded progress bar under the credit balance
  number, `creditsUsedThisCycle / planCredits`, with the raw "`X` de `Y`
  usados neste ciclo" text next to it. Color shifts from blue to amber past
  ~80% usage. No sparkline, no history graph — just the bar.
- **Plan cards**: price always shown. When the user has never subscribed
  (`subscription === null`), non-current cards get a "14 dias grátis" badge
  above the price and their CTA reads "Testar `{plan}` grátis" instead of
  "Fazer upgrade para `{plan}`"; once they've ever subscribed, cards look
  as they do today.
- **Cancel flow**: a "Cancelar assinatura" text button, visible only when
  there's an active paid subscription that isn't already
  `cancelAtPeriodEnd`. Opens the existing `Modal` with a confirmation
  message stating the exact date access continues until and that no
  further charge will occur. On confirm, calls `POST /billing/cancel`,
  shows a toast, and re-fetches the subscription so the summary card and
  button state update.
- **Payment history list**: below the plan cards, up to 12 most recent
  invoices — date, plan/description, amount, a status badge (paid /
  failed / refunded, with distinct icon per state), and a "ver recibo"
  link opening `hostedInvoiceUrl` in a new tab. No pagination for now.

## Error handling

- `/billing/invoices` and the new fields on `/billing/subscription` degrade
  gracefully: if the Stripe call fails, the invoices list renders an inline
  "não foi possível carregar" message rather than blocking the rest of the
  page (mirrors the existing `loadError` pattern already used in
  `pricing.tsx`).
- `/billing/cancel` surfaces Stripe/API errors as a toast; the modal stays
  open on failure so the user can retry instead of silently losing the
  action.

## Testing / verification

This codebase has no existing automated tests for billing (no test files
under `src/modules/billing`), and Stripe is live-mode only (no sandbox
credentials configured) — following existing project convention, this
ships without new automated tests and is verified manually: `npx tsc
--noEmit` on both repos, then a real end-to-end pass in production (fresh
signup → trial checkout shows correct price + badge → cancel flow actually
flips `cancel_at_period_end` in the Stripe dashboard → invoice list matches
the Stripe dashboard's own invoice list for that customer).
