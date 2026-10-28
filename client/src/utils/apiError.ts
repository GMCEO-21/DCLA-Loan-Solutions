import axios from "axios";

export type ApiErrorKind =
  | "forbidden"
  | "not-found"
  | "validation"
  | "server"
  | "network"
  | "unknown";

export type ApiErrorInfo = {
  kind: ApiErrorKind;
  message: string;
  status?: number;
};

type ErrorPayload = {
  code?: unknown;
  message?: unknown;
};

const fallbackMessages: Record<ApiErrorKind, string> = {
  forbidden: "You do not have permission to perform this action.",
  "not-found": "The requested resource was not found.",
  validation: "Please review the information and try again.",
  server: "The server could not complete the request. Please try again.",
  network:
    "Unable to connect to the server. Check your connection and try again.",
  unknown: "The request could not be completed. Please try again.",
};

export function classifyApiError(error: unknown): ApiErrorInfo {
  if (!axios.isAxiosError<ErrorPayload>(error)) {
    return {
      kind: "unknown",
      message:
        error instanceof Error && error.message
          ? error.message
          : fallbackMessages.unknown,
    };
  }

  if (!error.response) {
    return { kind: "network", message: fallbackMessages.network };
  }

  const status = error.response.status;
  const payload = error.response.data;
  const safeMessage = extractSafeMessage(payload?.message);

  if (status === 403) {
    return {
      kind: "forbidden",
      status,
      message:
        payload?.code === "PASSWORD_CHANGE_REQUIRED"
          ? safeMessage || "Password change is required before continuing."
          : fallbackMessages.forbidden,
    };
  }
  if (status === 404) {
    return {
      kind: "not-found",
      status,
      message: fallbackMessages["not-found"],
    };
  }
  if (status === 400 || status === 422) {
    return {
      kind: "validation",
      status,
      message: safeMessage || fallbackMessages.validation,
    };
  }
  if (status >= 500) {
    return { kind: "server", status, message: fallbackMessages.server };
  }

  return {
    kind: "unknown",
    status,
    message: safeMessage || fallbackMessages.unknown,
  };
}

export function getApiErrorMessage(error: unknown): string {
  return classifyApiError(error).message;
}

function extractSafeMessage(message: unknown): string | null {
  const values = Array.isArray(message) ? message : [message];
  const safe = values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.replace(/[\r\n\t]+/g, " ").trim())
    .filter(Boolean)
    .map((value) => value.slice(0, 240));
  return safe.length ? safe.join(" ") : null;
}
