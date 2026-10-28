import { fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import CollectionsPage from "./CollectionsPage";

const useCollectionsMock = vi.hoisted(() => vi.fn());

vi.mock("../hooks/useCollections", () => ({
  useCollections: useCollectionsMock,
}));
vi.mock("@components/layout/PrivateLayout", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../components/DailyCollectionsView", () => ({
  default: ({
    data,
    datasetDate,
    isDaily,
  }: {
    data: unknown[];
    datasetDate: string;
    isDaily?: boolean;
  }) => (
    <div data-testid="collection-view">
      <span>{data.length} groups</span>
      <span>Collection Summary for {datasetDate}</span>
      <span>
        {isDaily
          ? `${data.length} scheduled center${data.length !== 1 ? "s" : ""} shown`
          : `${data.length} center${data.length !== 1 ? "s" : ""} shown`}
      </span>
      <button>Export Current Results</button>
    </div>
  ),
}));
vi.mock("../components/CollectionDetailsModal", () => ({
  default: () => null,
}));
vi.mock("../components/CollectionUpdateModal", () => ({
  default: () => null,
}));

const dailyGroup = {
  centerId: "center-daily",
  centerName: "Daily Center",
  collectionDay: "Monday",
  collectionDate: "2026-09-07",
  totalAmount: 1000,
  totalReceived: 500,
  totalMembers: 1,
  pendingCollections: 0,
  collections: [],
};

const actions = {
  setSearch: vi.fn(),
  setAllDate: vi.fn(),
  updateCollection: vi.fn(),
  refetchDaily: vi.fn(),
  refetchAll: vi.fn(),
  syncDailyDate: vi.fn(),
};

const stateFor = (activeTab: 0 | 1) => ({
  dailyCollections: activeTab === 0 ? [] : [dailyGroup],
  allCollections: activeTab === 1 ? [dailyGroup] : [],
  dailyHasData: true,
  allHasData: activeTab === 1,
  loading: false,
  loadingDaily: false,
  loadingAll: false,
  errors: { daily: null, all: null, update: null },
  search: "",
  dailyDate: "2026-09-07",
  allDate: "2026-09-07",
  ...actions,
});

function renderPage() {
  return render(
    <ThemeProvider theme={theme}>
      <CollectionsPage />
    </ThemeProvider>,
  );
}

describe("CollectionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCollectionsMock.mockImplementation((activeTab: 0 | 1) =>
      stateFor(activeTab),
    );
  });

  it("uses the center search and preserves active refresh wiring", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: "Collections", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Manage scheduled collections and repayments."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Collection filters" }),
    ).toBeInTheDocument();

    const search = screen.getByLabelText("Search centers");
    expect(search).toHaveAttribute("placeholder", "Search by center name");
    expect(
      screen.queryByPlaceholderText("Search centers or members"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Filter displayed centers"),
    ).not.toBeInTheDocument();

    fireEvent.change(search, {
      target: { value: "north" },
    });
    expect(actions.setSearch).toHaveBeenCalledWith("north");

    fireEvent.click(screen.getByRole("button", { name: "Refresh Data" }));
    expect(actions.refetchDaily).toHaveBeenCalledOnce();
    expect(actions.refetchAll).not.toHaveBeenCalled();
  });

  it("hides unfetched counts, displays a fetched zero, and loads All on activation", () => {
    renderPage();

    const dailyTab = screen.getByRole("tab", { name: /Daily Collections/ });
    const allTab = screen.getByRole("tab", { name: /Collections by Date/ });
    expect(
      screen.queryByRole("tab", { name: /All Collections/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Collection Summary for 2026-09-07"),
    ).toBeInTheDocument();
    expect(screen.getByText("0 scheduled centers shown")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Export Current Results" }),
    ).toBeInTheDocument();
    expect(
      within(dailyTab).getByLabelText("0 scheduled collection centers"),
    ).toBeInTheDocument();
    expect(
      within(allTab).queryByLabelText(/collection centers for selected date/),
    ).not.toBeInTheDocument();
    expect(useCollectionsMock).toHaveBeenLastCalledWith(0);

    fireEvent.click(allTab);

    expect(useCollectionsMock).toHaveBeenLastCalledWith(1);
    expect(
      within(
        screen.getByRole("tab", { name: /Collections by Date/ }),
      ).getByLabelText("1 collection centers for selected date"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Collection date")).toBeInTheDocument();
    expect(
      screen.getByText("Collection Summary for 2026-09-07"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 center shown")).toBeInTheDocument();
    expect(
      screen.queryByText(/scheduled for collection today/),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Collection date"), {
      target: { value: "2026-09-03" },
    });
    expect(actions.setAllDate).toHaveBeenCalledWith("2026-09-03");

    fireEvent.click(screen.getByRole("tab", { name: /Daily Collections/ }));
    expect(actions.syncDailyDate).toHaveBeenCalledOnce();
  });

  it("keeps request failures separate from empty results and preserves retry", () => {
    useCollectionsMock.mockReturnValue({
      ...stateFor(0),
      dailyHasData: false,
      errors: {
        daily: "Unable to load collections.",
        all: null,
        update: null,
      },
    });

    renderPage();
    expect(screen.getByText("Unable to load collections.")).toBeInTheDocument();
    expect(
      screen.queryByText("No Collections Scheduled Today"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(actions.refetchDaily).toHaveBeenCalledOnce();
  });
});
