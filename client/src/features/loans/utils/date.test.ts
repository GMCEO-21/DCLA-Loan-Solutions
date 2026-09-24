import { describe, expect, it } from "vitest";
import { formatCollectionDate, toDateOnlyString } from "./date";

describe("toDateOnlyString", () => {
  it("serializes the selected local calendar date without a UTC shift", () => {
    expect(toDateOnlyString(new Date(2026, 8, 7, 23, 30))).toBe("2026-09-07");
  });

  it("rejects an invalid date", () => {
    expect(() => toDateOnlyString(new Date(Number.NaN))).toThrow(RangeError);
  });
});

describe("formatCollectionDate", () => {
  it("formats a valid date-only collection date as a local calendar date", () => {
    expect(formatCollectionDate("2026-09-05")).toBe("Sep 5, 2026");
  });

  it.each([undefined, null, "", "not-a-date", "2026-02-31"])(
    "returns a placeholder for invalid collection date %s",
    (value) => {
      expect(formatCollectionDate(value)).toBe("—");
    },
  );

  it("does not reinterpret a timestamp as a collection date", () => {
    expect(formatCollectionDate("2026-09-04T16:00:00.000Z")).toBe("—");
  });
});
