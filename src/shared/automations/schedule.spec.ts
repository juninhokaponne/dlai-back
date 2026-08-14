import { computeNextRunAt, type RecurringSchedule } from "./schedule.js";

describe("computeNextRunAt", () => {
  it("returns null when no days are selected", () => {
    const schedule: RecurringSchedule = { time: "09:00", days: [] };
    expect(computeNextRunAt(schedule, "America/Sao_Paulo", new Date("2026-08-14T12:00:00Z"))).toBeNull();
  });

  it("returns later today when the time hasn't passed yet, same timezone day", () => {
    // 2026-08-14 is a Friday. 09:00 America/Sao_Paulo (UTC-3) = 12:00 UTC.
    const schedule: RecurringSchedule = { time: "09:00", days: ["fri"] };
    const from = new Date("2026-08-14T10:00:00Z"); // 07:00 in Sao Paulo
    const next = computeNextRunAt(schedule, "America/Sao_Paulo", from);
    expect(next?.toISOString()).toBe("2026-08-14T12:00:00.000Z");
  });

  it("rolls over to next week when today's time already passed and only today is selected", () => {
    const schedule: RecurringSchedule = { time: "09:00", days: ["fri"] };
    const from = new Date("2026-08-14T13:00:00Z"); // 10:00 in Sao Paulo, past 09:00
    const next = computeNextRunAt(schedule, "America/Sao_Paulo", from);
    expect(next?.toISOString()).toBe("2026-08-21T12:00:00.000Z");
  });

  it("picks the nearest of several selected weekdays", () => {
    // Friday 2026-08-14, past today's 09:00 -> next should be Monday 2026-08-17.
    const schedule: RecurringSchedule = { time: "09:00", days: ["mon", "wed", "fri"] };
    const from = new Date("2026-08-14T13:00:00Z");
    const next = computeNextRunAt(schedule, "America/Sao_Paulo", from);
    expect(next?.toISOString()).toBe("2026-08-17T12:00:00.000Z");
  });

  it("computes correctly in a different timezone (UTC+9)", () => {
    const schedule: RecurringSchedule = { time: "09:00", days: ["fri"] };
    const from = new Date("2026-08-14T00:00:00Z"); // 09:00 in Asia/Tokyo already
    const next = computeNextRunAt(schedule, "Asia/Tokyo", from);
    // 09:00 Asia/Tokyo (UTC+9) same day = 00:00 UTC, equal to "from" - not strictly after, so rolls to next Friday.
    expect(next?.toISOString()).toBe("2026-08-21T00:00:00.000Z");
  });

  it("supports every day of the week (daily)", () => {
    const schedule: RecurringSchedule = {
      time: "06:00",
      days: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
    };
    const from = new Date("2026-08-14T20:00:00Z"); // 17:00 Sao Paulo, past today's 06:00
    const next = computeNextRunAt(schedule, "America/Sao_Paulo", from);
    expect(next?.toISOString()).toBe("2026-08-15T09:00:00.000Z");
  });
});
