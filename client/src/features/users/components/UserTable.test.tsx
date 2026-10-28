import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import type { AdminUser } from "../types";
import UserTable from "./UserTable";

const users: AdminUser[] = [
  {
    id: "superadmin-1",
    email: "root@example.com",
    firstName: "System",
    lastName: "Owner",
    role: "superadmin",
    isActive: true,
  },
  {
    id: "manager-1",
    email: "manager@example.com",
    firstName: "Maria",
    lastName: "Santos",
    role: "manager",
    isActive: true,
  },
  {
    id: "cashier-1",
    email: "cashier@example.com",
    firstName: "Carlo",
    lastName: "Reyes",
    role: "cashier",
    isActive: false,
  },
];

function renderTable(
  overrides: Partial<React.ComponentProps<typeof UserTable>> = {},
) {
  const props = {
    users,
    currentUserId: "manager-1",
    onEdit: vi.fn(),
    onResetPassword: vi.fn(),
    onToggleStatus: vi.fn(),
    ...overrides,
  };
  const view = render(
    <ThemeProvider theme={theme}>
      <UserTable {...props} />
    </ThemeProvider>,
  );
  return { props, unmount: view.unmount };
}

describe("UserTable", () => {
  it("preserves all columns and the protected-user action matrix", () => {
    const { props } = renderTable();

    expect(
      screen.getByRole("table", { name: "System users" }),
    ).toBeInTheDocument();
    for (const header of ["Name", "Email", "Role", "Status", "Actions"]) {
      expect(
        screen.getByRole("columnheader", { name: header }),
      ).toBeInTheDocument();
    }
    expect(
      screen.getByRole("button", { name: "Edit System Owner" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Reset password for System Owner" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Deactivate System Owner" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Deactivate Maria Santos" }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Edit Carlo Reyes" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Reset password for Carlo Reyes" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Reactivate Carlo Reyes" }),
    );
    expect(props.onEdit).toHaveBeenCalledWith(users[2]);
    expect(props.onResetPassword).toHaveBeenCalledWith(users[2]);
    expect(props.onToggleStatus).toHaveBeenCalledWith(users[2]);
  });

  it("distinguishes an empty account list from a filtered empty result", () => {
    const view = renderTable({ users: [] });
    expect(screen.getByText("No users found")).toBeInTheDocument();

    view.unmount();
    renderTable({ users: [], filtered: true });
    expect(screen.getByText("No matching users")).toBeInTheDocument();
  });
});
