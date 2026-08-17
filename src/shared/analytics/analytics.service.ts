export type SendStatsRaw = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
};

export type KpiMetric = {
  value: number;
  previousValue: number;
};

export type AnalyticsKpis = {
  sent: KpiMetric;
  deliveryRate: KpiMetric;
  openRate: KpiMetric;
  clickRate: KpiMetric;
  bounceRate: KpiMetric;
};

export function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export function buildKpis(current: SendStatsRaw, previous: SendStatsRaw): AnalyticsKpis {
  return {
    sent: { value: current.sent, previousValue: previous.sent },
    deliveryRate: {
      value: rate(current.delivered, current.sent),
      previousValue: rate(previous.delivered, previous.sent),
    },
    openRate: {
      value: rate(current.opened, current.sent),
      previousValue: rate(previous.opened, previous.sent),
    },
    clickRate: {
      value: rate(current.clicked, current.sent),
      previousValue: rate(previous.clicked, previous.sent),
    },
    bounceRate: {
      value: rate(current.bounced, current.sent),
      previousValue: rate(previous.bounced, previous.sent),
    },
  };
}

const MIN_DAYS = 7;
const MAX_DAYS = 90;
const DEFAULT_DAYS = 30;

// Bounds the date-range picker to a sane window - wide enough to be useful,
// narrow enough that the trend/newsletter queries stay cheap.
export function clampDays(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return DEFAULT_DAYS;
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.round(parsed)));
}
