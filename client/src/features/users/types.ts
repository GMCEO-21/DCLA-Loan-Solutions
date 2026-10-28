export type UserRole = "admin" | "loan processor" | "cashier" | "manager";

export const USER_ROLE_OPTIONS: Array<{ label: string; value: UserRole }> = [
  { label: "Admin", value: "admin" },
  { label: "Loan Processor", value: "loan processor" },
  { label: "Cashier", value: "cashier" },
  { label: "Manager", value: "manager" },
];

export interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  middleName?: string | null;
  lastName?: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateUserPayload {
  email: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  email?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  role?: UserRole;
}

export type CreateUserResponse = {
  user: AdminUser;
  tempPassword: string;
};
