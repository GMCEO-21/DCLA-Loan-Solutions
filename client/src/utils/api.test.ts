import axios, {
  AxiosError,
  type AxiosAdapter,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "@features/auth/authStore";

type AdapterHandler = (config: AxiosRequestConfig) => Promise<AxiosResponse>;

let api: typeof import("./api").default;
let handler: AdapterHandler;
const originalAdapter = axios.defaults.adapter;

const response = (
  config: AxiosRequestConfig,
  data: unknown,
  status = 200,
): AxiosResponse => ({
  data,
  status,
  statusText: status === 200 ? "OK" : "Error",
  headers: {},
  config: config as AxiosResponse["config"],
});

const reject = (config: AxiosRequestConfig, status: number, data = {}) => {
  const result = response(config, data, status);
  throw new AxiosError(
    `Request failed with status ${status}`,
    AxiosError.ERR_BAD_REQUEST,
    config as AxiosError["config"],
    undefined,
    result,
  );
};

describe("shared authenticated Axios client", () => {
  beforeAll(async () => {
    axios.defaults.adapter = ((config) => handler(config)) as AxiosAdapter;
    api = (await import("./api")).default;
  });

  afterAll(() => {
    axios.defaults.adapter = originalAdapter;
  });

  beforeEach(() => {
    window.history.replaceState({}, "", "/login");
    useAuthStore.getState().setSession("expired-access", "current-refresh", {
      id: "user-a",
      email: "a@example.com",
      role: "manager",
    });
  });

  it("uses one refresh rotation for concurrent expired requests", async () => {
    let refreshCalls = 0;
    const attempts = new Map<string, number>();
    handler = async (config) => {
      const url = config.url ?? "";
      if (url === "/auth/refresh") {
        refreshCalls += 1;
        return response(config, {
          access_token: "new-access",
          refresh_token: "new-refresh",
          user: {
            id: "user-a",
            email: "a@example.com",
            role: "manager",
          },
        });
      }

      const count = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, count);
      if (count === 1) return reject(config, 401);
      return response(config, { url });
    };

    const [first, second] = await Promise.all([
      api.get("/transactions"),
      api.get("/savings/member/member-a"),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(refreshCalls).toBe(1);
    expect(attempts.get("/transactions")).toBe(2);
    expect(attempts.get("/savings/member/member-a")).toBe(2);
    expect(useAuthStore.getState().token).toBe("new-access");
  });

  it("clears auth once and does not retry forever when refresh fails", async () => {
    let refreshCalls = 0;
    let resourceCalls = 0;
    handler = async (config) => {
      if (config.url === "/auth/refresh") {
        refreshCalls += 1;
        return reject(config, 401);
      }
      resourceCalls += 1;
      return reject(config, 401);
    };

    await expect(api.get("/transactions")).rejects.toBeInstanceOf(AxiosError);

    expect(refreshCalls).toBe(1);
    expect(resourceCalls).toBe(1);
    expect(useAuthStore.getState().token).toBeNull();
  });

  it("preserves the session for PASSWORD_CHANGE_REQUIRED responses", async () => {
    handler = async (config) =>
      reject(config, 403, { code: "PASSWORD_CHANGE_REQUIRED" });

    await expect(api.get("/members")).rejects.toBeInstanceOf(AxiosError);
    expect(useAuthStore.getState().token).toBe("expired-access");
  });
});
