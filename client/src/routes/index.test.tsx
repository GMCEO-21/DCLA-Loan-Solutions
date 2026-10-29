import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "@features/auth/authStore";
import { theme } from "../theme/theme";
import AppRouter from "./index";

function renderRoute(path: string) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[path]}>
        <AppRouter />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("AppRouter public routes", () => {
  beforeEach(() => {
    useAuthStore.setState({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isInitialized: true,
    });
  });

  it("renders the landing page at the public root without authentication", async () => {
    renderRoute("/");

    expect(
      await screen.findByRole("heading", {
        name: "Financial support for women and growing businesses.",
      }),
    ).toBeInTheDocument();
  });

  it("preserves the existing login route for signed-out visitors", async () => {
    renderRoute("/login");

    expect(
      await screen.findByRole("heading", { name: "Welcome Back" }),
    ).toBeInTheDocument();
  });

  it("continues redirecting signed-out visitors from protected routes", async () => {
    renderRoute("/dashboard");

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Welcome Back" }),
      ).toBeInTheDocument(),
    );
  });
});
