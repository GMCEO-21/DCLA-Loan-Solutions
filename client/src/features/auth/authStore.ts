import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthState, User } from "../../types/auth";
import { queryClient } from "../../queryClient";

type PersistedAuthState = Pick<AuthState, "user" | "token" | "refreshToken">;

export const useAuthStore = create<AuthState>()(
  persist<AuthState, [], [], PersistedAuthState>(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isInitialized: false,
      setInitialized: (isInitialized: boolean) => {
        set({ isInitialized });
      },
      setSession: (token: string, refreshToken: string, user: User) => {
        set({
          user,
          token,
          refreshToken,
          isAuthenticated: true,
          isInitialized: true,
        });
      },
      setRefreshedSession: (
        token: string,
        refreshToken: string,
        user: User,
      ) => {
        set({
          user,
          token,
          refreshToken,
          isAuthenticated: true,
        });
      },
      setUser: (user: User) => {
        set({
          user,
          isAuthenticated: true,
          isInitialized: true,
        });
      },
      setAccessToken: (token: string) => {
        set({
          token,
          isAuthenticated: true,
        });
      },
      logout: () => {
        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isInitialized: true,
        });
        queryClient.clear();
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: ({ user, token, refreshToken }) => ({
        user,
        token,
        refreshToken,
      }),
      migrate: (persistedState) => {
        const state = persistedState as Partial<PersistedAuthState>;
        return {
          user: state.user ?? null,
          token: state.token ?? null,
          refreshToken: state.refreshToken ?? null,
        };
      },
      merge: (persistedState, currentState) => {
        const state = (persistedState ?? {}) as Partial<PersistedAuthState>;
        return {
          ...currentState,
          user: state.user ?? null,
          token: state.token ?? null,
          refreshToken: state.refreshToken ?? null,
          isAuthenticated: false,
          isInitialized: false,
        };
      },
    },
  ),
);
