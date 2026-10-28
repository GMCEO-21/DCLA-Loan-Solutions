export type AppRole =
  | "superadmin"
  | "admin"
  | "manager"
  | "cashier"
  | "loan processor";

const DEFAULT_ROUTE_BY_ROLE: Record<AppRole, string> = {
  superadmin: "/admin/users",
  admin: "/dashboard",
  manager: "/dashboard",
  cashier: "/collections",
  "loan processor": "/member-management",
};

const ROUTE_ACCESS: Record<string, AppRole[]> = {
  "/dashboard": ["admin", "manager"],
  "/member-management": ["admin", "loan processor"],
  "/centers": ["admin", "loan processor"],
  "/collections": ["admin", "cashier"],
  "/portfolio": ["admin", "manager"],
  "/transactions": ["admin", "manager", "cashier", "loan processor"],
  "/approvals": ["admin", "manager"],
  "/waivers": ["admin", "manager"],
  "/admin/users": ["superadmin"],
};

export function getDefaultRouteForRole(role?: string | null): string {
  if (!role) {
    return "/dashboard";
  }
  return DEFAULT_ROUTE_BY_ROLE[role as AppRole] ?? "/dashboard";
}

export function canAccessPath(
  role: string | null | undefined,
  path: string,
): boolean {
  if (!role) {
    return false;
  }
  const allowedRoles = ROUTE_ACCESS[path];
  if (!allowedRoles) {
    return true;
  }
  return allowedRoles.includes(role as AppRole);
}

export function canManageSavings(role?: string | null): boolean {
  return role === "admin" || role === "cashier";
}
