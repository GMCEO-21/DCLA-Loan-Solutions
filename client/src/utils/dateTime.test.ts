import { describe, expect, it } from "vitest";
import { formatRecordedTimestamp, getManilaBusinessDate } from "./dateTime";

describe("getManilaBusinessDate", () => {
  it("advances at the Asia/Manila date boundary", () => {
    expect(getManilaBusinessDate(new Date("2026-09-07T16:30:00.000Z"))).toBe(
      "2026-09-08",
    );
  });

  it("keeps the prior date before the Asia/Manila boundary", () => {
    expect(getManilaBusinessDate(new Date("2026-09-07T15:30:00.000Z"))).toBe(
      "2026-09-07",
    );
  });
});

describe("formatRecordedTimestamp", () => {
  it("formats recorded timestamps explicitly in Asia/Manila", () => {
    expect(formatRecordedTimestamp("2026-09-03T15:14:29.683Z")).toBe(
      "Sep 3, 2026, 11:14 PM",
    );
  });

  it("handles a Manila date boundary independently of the host timezone", () => {
    expect(formatRecordedTimestamp("2026-09-03T16:30:00.000Z")).toBe(
      "Sep 4, 2026, 12:30 AM",
    );
  });

  it("preserves invalid values", () => {
    expect(formatRecordedTimestamp("not-a-timestamp")).toBe("not-a-timestamp");
  });
});
