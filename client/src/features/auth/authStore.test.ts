import { beforeEach, describe, expect, it } from "vitest";
import { queryClient } from "../../queryClient";
import type { User } from "../../types/auth";
import { useAuthStore } from "./authStore";

const user = (id: string): User => ({
  id,
  email: `${id}@example.com`,
  role: "manager",
  mustChangePassword: false,
});

describe("authStore session isolation", () => {
  beforeEach(() => {
    localStorage.clear();
    queryClient.clear();
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isInitialized: false,
    });
  });

  it("persists only credentials and never trusts initialization state", () => {
    useAuthStore.getState().setSession("access-a", "refresh-a", user("a"));

    const stored = JSON.parse(localStorage.getItem("auth-storage") ?? "{}");
    expect(stored.state).toEqual({
      user: user("a"),
      token: "access-a",
      refreshToken: "refresh-a",
    });
    expect(stored.state).not.toHaveProperty("isInitialized");
    expect(stored.state).not.toHaveProperty("isAuthenticated");
  });

  it("migrates legacy persisted state back to an unverified startup state", async () => {
    localStorage.setItem(
      "auth-storage",
      JSON.stringify({
        version: 0,
        state: {
          user: user("a"),
          token: "access-a",
          refreshToken: "refresh-a",
          isAuthenticated: true,
          isInitialized: true,
        },
      }),
    );

    await useAuthStore.persist.rehydrate();

    expect(useAuthStore.getState()).toMatchObject({
      token: "access-a",
      refreshToken: "refresh-a",
      isAuthenticated: false,
      isInitialized: false,
    });
  });

  it("does not complete startup initialization during token rotation", () => {
    useAuthStore.setState({ isInitialized: false });

    useAuthStore
      .getState()
      .setRefreshedSession("new-access", "new-refresh", user("a"));

    expect(useAuthStore.getState()).toMatchObject({
      token: "new-access",
      refreshToken: "new-refresh",
      isAuthenticated: true,
      isInitialized: false,
    });
  });

  it("clears authenticated queries so User B cannot observe User A data", () => {
    useAuthStore.getState().setSession("access-a", "refresh-a", user("a"));
    queryClient.setQueryData(["transactions"], [{ memberName: "User A" }]);
    queryClient.setQueryData(["savings", "member-a"], { balance: 500 });

    useAuthStore.getState().logout();
    useAuthStore.getState().setSession("access-b", "refresh-b", user("b"));

    expect(queryClient.getQueryData(["transactions"])).toBeUndefined();
    expect(queryClient.getQueryData(["savings", "member-a"])).toBeUndefined();
    expect(useAuthStore.getState().user?.id).toBe("b");
  });
});
