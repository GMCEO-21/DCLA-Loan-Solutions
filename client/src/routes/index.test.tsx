import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "@features/auth/authStore";
import { theme } from "../theme/theme";
import AppRouter from "./index";

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="route-location">{location.pathname}</output>;
}

function renderRoute(path: string) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[path]}>
        <AppRouter />
        <LocationProbe />
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
      await screen.findByRole(
        "heading",
        {
          name: "Financial support for women and growing businesses.",
        },
        { timeout: 10_000 },
      ),
    ).toBeInTheDocument();
    expect(document.title).toBe(
      "DCLA Business Solutions | Financial Support in Valencia City",
    );
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      "content",
      "index,follow",
    );
    expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
      "href",
      "https://dclasolutions.com/",
    );
    expect(document.getElementById("dcla-home-structured-data")).toHaveAttribute(
      "type",
      "application/ld+json",
    );
  });

  it("preserves the existing login route for signed-out visitors", async () => {
    renderRoute("/login");

    expect(
      await screen.findByRole("heading", { name: "Welcome Back" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("Sign In | DCLA Business Solutions");
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex,nofollow",
    );
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it("continues redirecting authenticated visitors away from login", async () => {
    useAuthStore.setState({
      token: "access-token",
      refreshToken: "refresh-token",
      user: {
        id: "admin-1",
        email: "admin@dcla.test",
        firstName: "Admin",
        lastName: "User",
        role: "admin",
      },
      isAuthenticated: true,
      isInitialized: true,
    });

    renderRoute("/login");

    await waitFor(() =>
      expect(screen.getByTestId("route-location")).toHaveTextContent(
        "/dashboard",
      ),
    );
  });

  it("continues redirecting signed-out visitors from protected routes", async () => {
    renderRoute("/dashboard");

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { name: "Welcome Back" }),
      ).toBeInTheDocument(),
    );
  });

  it("renders a noindex Not Found page for unknown routes", async () => {
    renderRoute("/missing-page");

    expect(
      await screen.findByRole("heading", { name: "Page Not Found" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(document.title).toBe("Page Not Found | DCLA Business Solutions");
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex,nofollow",
    );
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
