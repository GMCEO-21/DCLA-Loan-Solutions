const DEVELOPMENT_API_URL = "http://localhost:3000/api";

export function resolveApiBaseUrl(
  configuredUrl: string | undefined,
  isProduction: boolean,
): string {
  const value = configuredUrl?.trim();

  if (!value) {
    if (isProduction) {
      throw new Error("VITE_API_URL is required for production builds.");
    }
    return DEVELOPMENT_API_URL;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("VITE_API_URL must be a valid absolute URL.");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("VITE_API_URL must use HTTP or HTTPS.");
  }
  if (isProduction && parsed.protocol !== "https:") {
    throw new Error("VITE_API_URL must use HTTPS in production.");
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error(
      "VITE_API_URL must not contain credentials, query parameters, or a fragment.",
    );
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  if (!normalizedPath.endsWith("/api")) {
    throw new Error("VITE_API_URL must end with /api.");
  }

  parsed.pathname = normalizedPath;
  return parsed.toString().replace(/\/$/, "");
}
