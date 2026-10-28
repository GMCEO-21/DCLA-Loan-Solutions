import { resolveApiBaseUrl } from "./resolve-api-url";

export const API_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_URL,
  import.meta.env.PROD,
);
