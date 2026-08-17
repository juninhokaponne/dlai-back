import { describe, it, expect } from "@jest/globals";
import { rate, buildKpis, clampDays } from "./analytics.service.js";

describe("rate", () => {
  it("divides numerator by denominator", () => {
    expect(rate(50, 200)).toBe(0.25);
  });

  it("returns 0 when the denominator is 0 instead of dividing by zero", () => {
    expect(rate(5, 0)).toBe(0);
  });
});

describe("buildKpis", () => {
  it("computes rates and previous-period deltas for a full period", () => {
    const current = { sent: 200, delivered: 196, opened: 84, clicked: 16, bounced: 2 };
    const previous = { sent: 100, delivered: 95, opened: 38, clicked: 9, bounced: 2 };

    const kpis = buildKpis(current, previous);

    expect(kpis.sent).toEqual({ value: 200, previousValue: 100 });
    expect(kpis.deliveryRate.value).toBeCloseTo(0.98);
    expect(kpis.deliveryRate.previousValue).toBeCloseTo(0.95);
    expect(kpis.openRate.value).toBeCloseTo(0.42);
    expect(kpis.clickRate.value).toBeCloseTo(0.08);
    expect(kpis.bounceRate.value).toBeCloseTo(0.01);
  });

  it("never divides by zero when a period had no sends", () => {
    const current = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };
    const previous = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 };

    const kpis = buildKpis(current, previous);

    expect(kpis.deliveryRate).toEqual({ value: 0, previousValue: 0 });
    expect(kpis.openRate).toEqual({ value: 0, previousValue: 0 });
  });
});

describe("clampDays", () => {
  it("defaults to 30 when the input is missing or not a number", () => {
    expect(clampDays(undefined)).toBe(30);
    expect(clampDays("not-a-number")).toBe(30);
  });

  it("clamps below the 7-day floor", () => {
    expect(clampDays(1)).toBe(7);
    expect(clampDays(-5)).toBe(7);
  });

  it("clamps above the 90-day ceiling", () => {
    expect(clampDays(365)).toBe(90);
  });

  it("passes through a value within range", () => {
    expect(clampDays("14")).toBe(14);
  });
});
