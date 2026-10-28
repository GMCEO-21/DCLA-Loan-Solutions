import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import type { Center } from "../types";
import CenterModal from "./CenterModal";

function renderModal(
  overrides: Partial<React.ComponentProps<typeof CenterModal>> = {},
) {
  const props = {
    open: true,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  render(
    <ThemeProvider theme={theme}>
      <CenterModal {...props} />
    </ThemeProvider>,
  );
  return props;
}

describe("CenterModal", () => {
  it("submits the unchanged create payload from the responsive form", async () => {
    const props = renderModal();
    fireEvent.change(screen.getByLabelText(/Center Name/), {
      target: { value: "North Center" },
    });
    fireEvent.change(screen.getByLabelText("Center Leader"), {
      target: { value: "Ana Cruz" },
    });
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: /Collection Day/ }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Tuesday" }));
    fireEvent.change(screen.getByLabelText("Address"), {
      target: { value: "Main Road" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Center" }));

    await waitFor(() =>
      expect(props.onSubmit).toHaveBeenCalledWith({
        name: "North Center",
        collectionDay: "Tuesday",
        address: "Main Road",
        leader: "Ana Cruz",
      }),
    );
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("retains required-field validation", async () => {
    renderModal();
    fireEvent.submit(document.getElementById("center-form")!);
    expect(
      await screen.findByText("Center name is required"),
    ).toBeInTheDocument();
    expect(screen.getByText("Collection day is required")).toBeInTheDocument();
  });

  it("loads edit values and preserves the loading close guard", () => {
    const existing: Center = {
      id: "center-2",
      name: "Existing Center",
      collectionDay: "Monday",
      address: "Old address",
      leader: "Old leader",
    };
    const props = renderModal({ center: existing, loading: true });

    expect(screen.getByDisplayValue(existing.name)).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Close center form" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onClose).not.toHaveBeenCalled();
  });
});
