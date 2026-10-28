import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../queryClient";
import { useAuthStore } from "./authStore";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("axios", () => ({
  default: {
    create: () => ({
      interceptors: { request: { use: vi.fn() } },
      get: vi.fn(),
      put: vi.fn(),
      post,
    }),
  },
}));
vi.mock("../../utils/api", () => ({
  default: { get: vi.fn(), put: vi.fn() },
}));

import { authService } from "./api";

describe("authService logout", () => {
  beforeEach(() => {
    post.mockReset();
    queryClient.clear();
    useAuthStore.getState().setSession("access", "refresh", {
      id: "user-a",
      email: "a@example.com",
      role: "manager",
    });
  });

  it("sends the refresh token and always clears local state and cache", async () => {
    queryClient.setQueryData(["transactions"], ["User A data"]);
    post.mockRejectedValue(new Error("network unavailable"));

    await expect(authService.logout()).resolves.toBeUndefined();

    expect(post).toHaveBeenCalledWith("/logout", { refreshToken: "refresh" });
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
    });
    expect(queryClient.getQueryData(["transactions"])).toBeUndefined();
  });
});
