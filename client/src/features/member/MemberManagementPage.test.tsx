import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { AxiosError } from "axios";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CentersAPI } from "@features/centers/api";
import { useMembers } from "./hooks/useMember";
import MemberManagementPage from "./MemberManagementPage";

vi.mock("@mui/icons-material", () => ({
  PersonAdd: () => <span aria-hidden="true" />,
  Close: () => <span aria-hidden="true" />,
  Edit: () => <span aria-hidden="true" />,
  Group: () => <span aria-hidden="true" />,
}));
vi.mock("@components/layout/PrivateLayout", () => ({
  default: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("./components/MemberCards", () => ({
  default: () => <div>Member cards</div>,
}));
vi.mock("@features/auth/authStore", () => ({
  useAuthStore: (selector: (state: { user: { role: string } }) => unknown) =>
    selector({ user: { role: "loan processor" } }),
}));
vi.mock("./hooks/useMember", () => ({ useMembers: vi.fn() }));
vi.mock("@features/centers/api", () => ({
  CentersAPI: { getOptions: vi.fn() },
}));

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberManagementPage />
    </QueryClientProvider>,
  );
};

describe("MemberManagementPage error states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMembers).mockReturnValue({
      members: [],
      total: 0,
      page: 1,
      limit: 4,
      setPage: vi.fn(),
      setLimit: vi.fn(),
      loading: false,
      error: "You do not have permission to perform this action.",
      createMember: vi.fn(),
      updateMember: vi.fn(),
      deleteMember: vi.fn(),
      refetch: vi.fn(),
    });
  });

  it("renders an explicit access-denied request state", () => {
    vi.mocked(CentersAPI.getOptions).mockResolvedValue([]);

    renderPage();
    expect(
      screen.getByRole("heading", { name: "Members", level: 1 }),
    ).toBeVisible();
    expect(
      screen.getByRole("textbox", { name: "Search members" }),
    ).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      /do not have permission/i,
    );
  });

  it("shows degraded information when center filters cannot load", async () => {
    vi.mocked(CentersAPI.getOptions).mockRejectedValue(
      new AxiosError("Network Error"),
    );

    renderPage();

    await waitFor(() =>
      expect(screen.getByText(/center filters are unavailable/i)).toBeVisible(),
    );
    expect(screen.getByText(/unable to connect/i)).toBeVisible();
  });

  it("keeps a long center list selectable and closes it on click away", async () => {
    const centers = Array.from({ length: 24 }, (_, index) => ({
      id: `center-${index + 1}`,
      name: `Center ${String(index + 1).padStart(2, "0")}`,
      collectionDay: "Friday",
    }));

    vi.mocked(useMembers).mockReturnValue({
      members: [],
      total: 0,
      page: 1,
      limit: 4,
      setPage: vi.fn(),
      setLimit: vi.fn(),
      loading: false,
      error: null,
      createMember: vi.fn(),
      updateMember: vi.fn(),
      deleteMember: vi.fn(),
      refetch: vi.fn(),
    });
    vi.mocked(CentersAPI.getOptions).mockResolvedValue(centers);

    renderPage();

    const centerSelect = await screen.findByRole("combobox", {
      name: "Center",
    });
    fireEvent.mouseDown(centerSelect);
    let listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option")).toHaveLength(
      centers.length + 1,
    );

    fireEvent.click(within(listbox).getByRole("option", { name: "Center 18" }));
    await waitFor(() => expect(centerSelect).toHaveTextContent("Center 18"));

    fireEvent.mouseDown(centerSelect);
    listbox = await screen.findByRole("listbox");
    expect(listbox).toBeInTheDocument();
    const backdrop = document.querySelector<HTMLElement>(".MuiBackdrop-root");
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop!);
    await waitFor(() =>
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument(),
    );
  }, 15_000);
});
