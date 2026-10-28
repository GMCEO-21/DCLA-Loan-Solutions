import axios from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@features/auth/authStore";
import type { User } from "../types/auth";
import { API_BASE_URL } from "../config/api-url";

const api = axios.create({
  baseURL: API_BASE_URL,
});

const refreshApi = axios.create({
  baseURL: API_BASE_URL,
});

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  const authStore = useAuthStore.getState();

  if (!authStore.refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = refreshApi
      .post("/auth/refresh", {
        refreshToken: authStore.refreshToken,
      })
      .then((response) => {
        const { access_token, refresh_token, user } = response.data as {
          access_token: string;
          refresh_token: string;
          user: User;
        };

        authStore.setRefreshedSession(access_token, refresh_token, user);
        return access_token;
      })
      .catch(() => {
        authStore.logout();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
};

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config as RetriableRequestConfig | undefined;
    const requestUrl = originalRequest?.url ?? "";
    const shouldSkipRefresh =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/refresh") ||
      requestUrl.includes("/auth/logout");

    if (
      status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !shouldSkipRefresh
    ) {
      originalRequest._retry = true;

      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
        return api(originalRequest);
      }
    }

    if (status === 401) {
      const authStore = useAuthStore.getState();
      authStore.logout();
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  },
);

export default api;
