import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ThemeProvider } from "@mui/material";
import { theme } from "../../theme/theme";
import { useAuthStore } from "@features/auth/authStore";
import { authService } from "@features/auth/api";
import Header from "./Header";

vi.mock("@features/auth/api", () => ({ authService: { logout: vi.fn() } }));

function Path() {
  return <output aria-label="Current path">{useLocation().pathname}</output>;
}
function setup(role = "manager", desktop = true, path = "/dashboard") {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => ({
      matches: desktop,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
  useAuthStore.setState({
    user: {
      id: "fixture",
      email: "user@example.com",
      firstName: "Alexandria Catherine",
      lastName: "Montgomery-Santos",
      role,
    },
  });
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter initialEntries={[path]}>
        <Header />
        <Path />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("Application navigation", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([
    ["superadmin", ["User Management"]],
    [
      "admin",
      [
        "Dashboard",
        "Members",
        "Centers",
        "Collections",
        "Portfolio",
        "Transactions",
        "Approvals",
        "Waivers",
      ],
    ],
    [
      "manager",
      ["Dashboard", "Portfolio", "Transactions", "Approvals", "Waivers"],
    ],
    ["cashier", ["Collections", "Transactions"]],
    ["loan processor", ["Members", "Centers", "Transactions"]],
  ])("preserves authorized desktop navigation for %s", (role, labels) => {
    const { container } = setup(role as string);
    const logo = container.querySelector<HTMLImageElement>('img[alt=""]');
    expect(logo?.src).toContain("dcla-logo.png");
    expect(logo).toHaveStyle({ objectFit: "contain" });
    expect(
      within(screen.getByRole("navigation"))
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(labels);
    expect(
      screen.queryByRole("button", { name: "Open navigation" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("banner")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "account of current user" }),
    ).not.toBeInTheDocument();
    const account = screen.getByLabelText("Signed in user");
    expect(account).toHaveTextContent("Alexandria Catherine Montgomery-Santos");
    expect(account).toHaveTextContent(
      role.replace(/\b\w/g, (letter) => letter.toUpperCase()),
    );
  });
  it("marks the exact current route and updates on navigation", () => {
    setup();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    fireEvent.click(screen.getByRole("link", { name: "Transactions" }));
    expect(screen.getByLabelText("Current path")).toHaveTextContent(
      "/transactions",
    );
    expect(screen.getByRole("link", { name: "Transactions" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
  it("opens the mobile drawer and closes it after selecting a route", async () => {
    setup("manager", false);
    expect(screen.getByRole("banner")).toHaveTextContent("Dashboard");
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByLabelText("Signed in user")).toHaveTextContent(
      "Manager",
    );
    expect(screen.getByRole("button", { name: "Logout" })).toBeVisible();
    fireEvent.click(screen.getByRole("link", { name: "Transactions" }));
    expect(screen.getByLabelText("Current path")).toHaveTextContent(
      "/transactions",
    );
    await waitFor(() =>
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument(),
    );
  });
  it("closes the drawer on Escape", async () => {
    setup("cashier", false, "/collections");
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    fireEvent.keyDown(screen.getByRole("navigation"), { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument(),
    );
  });
  it("preserves the logout service and redirect", async () => {
    vi.mocked(authService.logout).mockResolvedValue(undefined);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Current path")).toHaveTextContent("/login"),
    );
    expect(authService.logout).toHaveBeenCalledOnce();
  });
  it("uses the same logout path from the mobile drawer", async () => {
    vi.mocked(authService.logout).mockResolvedValue(undefined);
    setup("cashier", false, "/collections");
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Current path")).toHaveTextContent("/login"),
    );
    expect(authService.logout).toHaveBeenCalledOnce();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
