import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import type { Center } from "../types";
import CenterTable from "./CenterTable";

const center: Center = {
  id: "center-1",
  name: "San Isidro Community Lending Center With A Long Name",
  collectionDay: "Friday",
  address: "A long operational address used to verify readable wrapping",
  leader: "Maria Santos",
};

function renderTable(
  overrides: Partial<React.ComponentProps<typeof CenterTable>> = {},
) {
  const props = {
    centers: [center],
    onEdit: vi.fn(),
    onDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(
    <ThemeProvider theme={theme}>
      <CenterTable {...props} />
    </ThemeProvider>,
  );
  return props;
}

describe("CenterTable", () => {
  it("keeps every center column and exposes restrained row actions", () => {
    const props = renderTable();

    expect(screen.getByRole("table", { name: "Centers" })).toBeInTheDocument();
    for (const header of [
      "Center name",
      "Collection day",
      "Address",
      "Center leader",
      "Actions",
    ]) {
      expect(
        screen.getByRole("columnheader", { name: header }),
      ).toBeInTheDocument();
    }
    expect(screen.getByText(center.name)).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: `Edit ${center.name}` }),
    );
    expect(props.onEdit).toHaveBeenCalledWith(center);
  });

  it("keeps delete behind a center-specific confirmation", async () => {
    const props = renderTable();

    fireEvent.click(
      screen.getByRole("button", { name: `Delete ${center.name}` }),
    );
    const dialog = screen.getByRole("dialog", { name: "Delete center" });
    expect(dialog).toHaveClass("MuiDialog-paperWidthXs");
    expect(dialog).toHaveTextContent(center.name);
    expect(
      screen.getByRole("button", {
        name: "Close delete center confirmation",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(props.onDelete).toHaveBeenCalledWith(center.id));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("renders a quiet empty state without changing data behavior", () => {
    renderTable({ centers: [] });
    expect(screen.getByText("No centers found")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
