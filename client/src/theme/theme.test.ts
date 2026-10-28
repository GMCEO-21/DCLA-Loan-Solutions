import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import Dialog, { type DialogProps } from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import {
  getContrastRatio,
  getLuminance,
  ThemeProvider,
} from "@mui/material/styles";
import { theme } from "./theme";

const renderDialog = (props: Partial<DialogProps>) => {
  render(
    createElement(
      ThemeProvider,
      { theme },
      createElement(
        Dialog,
        { open: true, ...props },
        createElement(DialogTitle, null, "Dialog sizing test"),
      ),
    ),
  );

  return screen.getByRole("dialog");
};

describe("UI foundation", () => {
  it("keeps predictable geometry and existing spacing compatibility", () => {
    expect(theme.shape.borderRadius).toBe(4);
    expect(theme.spacing(0.5)).toBe("4px");
    expect(theme.spacing(2)).toBe("16px");
    expect(theme.breakpoints.values.lg).toBe(1200);
  });
  it("uses a genuinely darker primary interaction color", () => {
    expect(getLuminance(theme.palette.primary.dark)).toBeLessThan(
      getLuminance(theme.palette.primary.main),
    );
  });
  it.each([
    "primary",
    "secondary",
    "success",
    "warning",
    "error",
    "info",
  ] as const)("provides readable %s contained foregrounds", (color) => {
    const palette = theme.palette[color];
    expect(
      getContrastRatio(palette.main, palette.contrastText),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ["xs", "444px"],
    ["sm", "600px"],
    ["md", "900px"],
  ] as const)("preserves the MUI %s dialog cap", (maxWidth, expected) => {
    const paper = renderDialog({ fullWidth: true, maxWidth });
    const sizeClass = `${maxWidth[0].toUpperCase()}${maxWidth.slice(1)}`;

    expect(paper).toHaveClass(`MuiDialog-paperWidth${sizeClass}`);
    expect(getComputedStyle(paper).maxWidth).toBe(expected);
  });

  it.each([640, 720])("preserves a local %ipx dialog cap", (maxWidth) => {
    const paper = renderDialog({
      fullWidth: true,
      maxWidth: false,
      PaperProps: {
        sx: { width: "calc(100% - 32px)", maxWidth },
      },
    });

    expect(getComputedStyle(paper).maxWidth).toBe(`${maxWidth}px`);
  });

  it("preserves full-screen dialog geometry", () => {
    const paper = renderDialog({ fullScreen: true });
    const styles = getComputedStyle(paper);

    expect(paper).toHaveClass("MuiDialog-paperFullScreen");
    expect(styles.margin).toBe("0px");
    expect(styles.width).toBe("100%");
    expect(styles.maxWidth).toBe("100%");
    expect(styles.height).toBe("100%");
    expect(styles.maxHeight).toBe("none");
    expect(Number.parseFloat(styles.borderRadius)).toBe(0);
  });

  it("uses 16px gutters below sm without replacing dialog max-width", () => {
    const paperOverride = theme.components?.MuiDialog?.styleOverrides?.paper;
    expect(typeof paperOverride).toBe("function");

    const styles = (
      paperOverride as (input: {
        ownerState: Partial<DialogProps>;
        theme: typeof theme;
      }) => Record<string, unknown>
    )({ ownerState: { fullScreen: false, fullWidth: true }, theme });

    expect(styles).not.toHaveProperty("maxWidth");
    expect(styles[theme.breakpoints.down("sm")]).toEqual({
      width: "calc(100% - 32px)",
    });
  });
});
