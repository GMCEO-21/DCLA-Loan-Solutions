import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { classifyApiError } from "./apiError";

function responseError(status: number, data: unknown) {
  return new AxiosError("request failed", undefined, undefined, undefined, {
    status,
    statusText: "Error",
    headers: {},
    config: { headers: new AxiosHeaders() },
    data,
  });
}

describe("classifyApiError", () => {
  it.each([
    [403, "forbidden", "permission"],
    [404, "not-found", "not found"],
    [500, "server", "server"],
  ] as const)("classifies HTTP %i", (status, kind, message) => {
    const result = classifyApiError(
      responseError(status, { message: "raw detail" }),
    );
    expect(result.kind).toBe(kind);
    expect(result.message.toLowerCase()).toContain(message);
    expect(result.message).not.toContain("raw detail");
  });

  it("retains safe backend validation messages", () => {
    const result = classifyApiError(
      responseError(422, { message: ["Amount must be greater than zero"] }),
    );
    expect(result).toMatchObject({
      kind: "validation",
      message: "Amount must be greater than zero",
    });
  });

  it("distinguishes connection failures", () => {
    const result = classifyApiError(new AxiosError("Network Error"));
    expect(result.kind).toBe("network");
    expect(result.message).toContain("connect");
  });
});
