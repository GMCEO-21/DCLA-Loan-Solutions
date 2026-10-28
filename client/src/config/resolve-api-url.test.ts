import { describe, expect, it } from "vitest";
import { resolveApiBaseUrl } from "./resolve-api-url";

describe("resolveApiBaseUrl", () => {
  it("retains the localhost fallback in development", () => {
    expect(resolveApiBaseUrl(undefined, false)).toBe(
      "http://localhost:3000/api",
    );
  });

  it("fails a production build when VITE_API_URL is missing", () => {
    expect(() => resolveApiBaseUrl(undefined, true)).toThrow(
      "VITE_API_URL is required for production builds.",
    );
  });

  it("normalizes a valid production API URL", () => {
    expect(resolveApiBaseUrl("https://api.example.com/api/", true)).toBe(
      "https://api.example.com/api",
    );
  });

  it.each([
    "http://api.example.com/api",
    "https://user:password@api.example.com/api",
    "https://api.example.com",
    "https://api.example.com/api?debug=true",
  ])("rejects an unsafe production API URL: %s", (value) => {
    expect(() => resolveApiBaseUrl(value, true)).toThrow("VITE_API_URL");
  });
});
