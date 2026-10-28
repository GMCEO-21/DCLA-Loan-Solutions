import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import UserManagementPage from "./UserManagementPage";

const useUsersMock = vi.hoisted(() => vi.fn());
const useAuthStoreMock = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useUsers", () => ({ useUsers: useUsersMock }));
vi.mock("@features/auth/authStore", () => ({ useAuthStore: useAuthStoreMock }));
vi.mock("@components/layout/PrivateLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const manager = {
  id: "manager-1",
  email: "manager@example.com",
  firstName: "Maria",
  lastName: "Santos",
  role: "manager",
  isActive: true,
};

const cashier = {
  id: "cashier-1",
  email: "cashier@example.com",
  firstName: "Carlo",
  lastName: "Reyes",
  role: "cashier",
  isActive: false,
};

const actions = {
  createUser: vi.fn(),
  updateUser: vi.fn(),
  updateStatus: vi.fn(),
  resetPassword: vi.fn(),
  refetch: vi.fn(),
};

const baseState = {
  users: [manager, cashier],
  loading: false,
  error: null,
  ...actions,
};

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <UserManagementPage />
    </ThemeProvider>,
  );
}

describe("UserManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStoreMock.mockReturnValue({
      user: { id: "superadmin-current", role: "superadmin" },
    });
    useUsersMock.mockReturnValue({ ...baseState });
    actions.updateStatus.mockResolvedValue(manager);
    actions.resetPassword.mockResolvedValue({ tempPassword: "TempPass123" });
  });

  it("uses the shared header and keeps local name, email, and role search", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "User Management", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Manage system users, roles, and account access."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add User" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search users"), {
      target: { value: "cashier" },
    });
    expect(screen.getByText("Carlo Reyes")).toBeInTheDocument();
    expect(screen.queryByText("Maria Santos")).not.toBeInTheDocument();
  });

  it("shows request failures without a false empty state and retains retry", () => {
    useUsersMock.mockReturnValue({
      ...baseState,
      users: [],
      error: "Failed to load users.",
    });
    renderPage();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Failed to load users.",
    );
    expect(screen.queryByText("No users found")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(actions.refetch).toHaveBeenCalledOnce();
  });

  it("preserves status confirmation and reset-password mutation sequencing", async () => {
    renderPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Deactivate Maria Santos" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Deactivate" }));
    await waitFor(() =>
      expect(actions.updateStatus).toHaveBeenCalledWith(manager.id, false),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Deactivate User" }),
      ).not.toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Reset password for Maria Santos" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Reset Password" }));
    await waitFor(() =>
      expect(actions.resetPassword).toHaveBeenCalledWith(manager.id),
    );
    expect(await screen.findByLabelText("Temporary password")).toHaveValue(
      "TempPass123",
    );
  });
});
