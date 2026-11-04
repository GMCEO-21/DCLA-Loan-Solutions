import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import { authService } from "../api";
import { useAuthStore } from "../authStore";
import LoginPage from "./LoginPage";

vi.mock("../api", () => ({
  authService: { login: vi.fn() },
}));

function renderLoginPage() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<div>Dashboard destination</div>} />
          <Route path="/" element={<div>Public home</div>} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.mocked(authService.login).mockReset();
    useAuthStore.setState({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isInitialized: true,
    });
  });

  it("renders the DCLA Business Solutions login experience", () => {
    const { container } = renderLoginPage();

    expect(screen.getByRole("heading", { name: "Welcome Back" })).toBeVisible();
    expect(screen.getByLabelText("Email Address")).toBeVisible();
    expect(screen.getByLabelText("Password")).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeVisible();
    expect(screen.getAllByText("DCLA Business Solutions")).not.toHaveLength(0);
    expect(screen.getByText("SECURE INTERNAL ACCESS")).toBeVisible();
    expect(container.querySelectorAll(".login-orbit-photo")).toHaveLength(10);
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("preserves the accessible password visibility toggle", () => {
    renderLoginPage();
    const password = screen.getByLabelText("Password");

    expect(password).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(password).toHaveAttribute("type", "text");
    expect(
      screen.getByRole("button", { name: "Hide password" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("submits through the existing auth service and preserves the role redirect", async () => {
    vi.mocked(authService.login).mockResolvedValue({
      access_token: "access-token",
      refresh_token: "refresh-token",
      user: {
        id: "admin-1",
        email: "admin@dcla.test",
        firstName: "Admin",
        lastName: "User",
        role: "admin",
        isActive: true,
        mustChangePassword: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    renderLoginPage();

    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "admin@dcla.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secure-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign In" }));

    await waitFor(() =>
      expect(authService.login).toHaveBeenCalledWith({
        email: "admin@dcla.test",
        password: "secure-password",
      }),
    );
    expect(await screen.findByText("Dashboard destination")).toBeVisible();
    expect(useAuthStore.getState()).toMatchObject({
      token: "access-token",
      refreshToken: "refresh-token",
      isAuthenticated: true,
    });
  });
});
