import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RevenueView from "./RevenueView";

vi.mock("./ExpectedRevenueView", () => ({
  default: () => <div>Expected revenue content</div>,
}));
vi.mock("./ActualRevenueView", () => ({
  default: () => <div>Actual revenue content</div>,
}));

describe("RevenueView", () => {
  it("mounts only the selected revenue mode", () => {
    render(<RevenueView />);

    expect(screen.getByText("Expected revenue content")).toBeInTheDocument();
    expect(
      screen.queryByText("Actual revenue content"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Actual" }));

    expect(screen.getByText("Actual revenue content")).toBeInTheDocument();
    expect(
      screen.queryByText("Expected revenue content"),
    ).not.toBeInTheDocument();
  });
});
