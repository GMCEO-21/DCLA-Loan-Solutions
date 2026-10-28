import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import CentersPage from "./CentersPage";

const useCentersMock = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useCenters", () => ({ useCenters: useCentersMock }));
vi.mock("@components/layout/PrivateLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const baseState = {
  centers: [
    {
      id: "center-1",
      name: "North Center",
      collectionDay: "Monday",
      address: "Main Road",
      leader: "Ana Cruz",
    },
  ],
  total: 1,
  page: 1,
  limit: 3,
  setPage: vi.fn(),
  setLimit: vi.fn(),
  search: "",
  setSearch: vi.fn(),
  loading: false,
  error: null,
  createCenter: vi.fn(),
  updateCenter: vi.fn(),
  deleteCenter: vi.fn(),
  refetch: vi.fn(),
};

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <CentersPage />
    </ThemeProvider>,
  );
}

describe("CentersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCentersMock.mockReturnValue({ ...baseState });
  });

  it("uses the shared page header and labeled operational filters", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Centers", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Manage lending centers and their records."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Add Center" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Center filters" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Search centers"), {
      target: { value: "north" },
    });
    expect(baseState.setSearch).toHaveBeenCalledWith("north");
    expect(
      screen.getByRole("combobox", { name: "Rows per page" }),
    ).toBeInTheDocument();
  });

  it("preserves loading and retry error states", () => {
    useCentersMock.mockReturnValue({
      ...baseState,
      centers: [],
      loading: true,
    });
    const view = renderPage();
    expect(
      screen.getByRole("status", { name: "Loading centers" }),
    ).toBeInTheDocument();

    view.unmount();
    useCentersMock.mockReturnValue({
      ...baseState,
      error: "Unable to load centers.",
    });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(baseState.refetch).toHaveBeenCalledOnce();
  });
});
