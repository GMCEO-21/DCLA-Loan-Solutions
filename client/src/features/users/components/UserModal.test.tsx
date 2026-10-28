import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import type { AdminUser } from "../types";
import UserModal from "./UserModal";

function renderModal(
  overrides: Partial<React.ComponentProps<typeof UserModal>> = {},
) {
  const props = {
    open: true,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(
    <ThemeProvider theme={theme}>
      <UserModal {...props} />
    </ThemeProvider>,
  );
  return props;
}

describe("UserModal", () => {
  it("groups fields responsively without changing their keyboard order", () => {
    renderModal();

    const email = screen.getByLabelText(/Email/);
    const role = screen.getByRole("combobox", { name: /Role/ });
    const firstName = screen.getByLabelText(/First Name/);
    const middleName = screen.getByLabelText("Middle Name");
    const lastName = screen.getByLabelText(/Last Name/);
    const fields = [email, role, firstName, middleName, lastName];

    fields.slice(0, -1).forEach((field, index) => {
      expect(
        field.compareDocumentPosition(fields[index + 1]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
    expect(email.closest(".MuiGrid-item")).toHaveClass("MuiGrid-grid-sm-8");
    expect(role.closest(".MuiGrid-item")).toHaveClass("MuiGrid-grid-sm-4");
    expect(firstName.closest(".MuiGrid-item")).toHaveClass(
      "MuiGrid-grid-sm-6",
      "MuiGrid-grid-md-4",
    );
    expect(middleName.closest(".MuiGrid-item")).toHaveClass(
      "MuiGrid-grid-sm-6",
      "MuiGrid-grid-md-4",
    );
    expect(lastName.closest(".MuiGrid-item")).toHaveClass(
      "MuiGrid-grid-sm-12",
      "MuiGrid-grid-md-4",
    );
  });

  it("submits the unchanged create-user payload", async () => {
    const props = renderModal();
    fireEvent.change(screen.getByLabelText(/Email/), {
      target: { value: " admin@example.com " },
    });
    fireEvent.mouseDown(screen.getByRole("combobox", { name: /Role/ }));
    fireEvent.click(screen.getByRole("option", { name: "Admin" }));
    fireEvent.change(screen.getByLabelText(/First Name/), {
      target: { value: " Ana " },
    });
    fireEvent.change(screen.getByLabelText("Middle Name"), {
      target: { value: " Maria " },
    });
    fireEvent.change(screen.getByLabelText(/Last Name/), {
      target: { value: " Cruz " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create User" }));

    await waitFor(() =>
      expect(props.onSubmit).toHaveBeenCalledWith({
        email: "admin@example.com",
        firstName: "Ana",
        middleName: "Maria",
        lastName: "Cruz",
        role: "admin",
      }),
    );
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("preserves required-field validation", async () => {
    renderModal();
    fireEvent.submit(document.getElementById("user-form")!);

    expect(await screen.findByText("Email is required")).toBeInTheDocument();
    expect(screen.getByText("First name is required")).toBeInTheDocument();
    expect(screen.getByText("Last name is required")).toBeInTheDocument();
    expect(screen.getByText("Role is required")).toBeInTheDocument();
  });

  it("loads edit values and preserves the loading close guard", () => {
    const user: AdminUser = {
      id: "user-1",
      email: "manager@example.com",
      firstName: "Maria",
      middleName: null,
      lastName: "Santos",
      role: "manager",
      isActive: true,
    };
    const props = renderModal({ user, loading: true });

    expect(screen.getByDisplayValue(user.email)).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Close user form" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
