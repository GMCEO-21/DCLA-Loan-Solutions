import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ManagerActionsPanel from "./ManagerActionsPanel";

describe("ManagerActionsPanel", () => {
  it("omits the waiver action while preserving other manager actions", () => {
    const onOpenApprovals = vi.fn();
    const onOpenTransactions = vi.fn();

    render(
      <ManagerActionsPanel
        onOpenApprovals={onOpenApprovals}
        onOpenTransactions={onOpenTransactions}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Review Loan Waivers" })
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Open Collection Approvals" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Audit Transaction History" })
    );

    expect(onOpenApprovals).toHaveBeenCalledTimes(1);
    expect(onOpenTransactions).toHaveBeenCalledTimes(1);
  });

  it("renders a functional waiver action when capability is supplied", () => {
    const onOpenWaivers = vi.fn();

    render(
      <ManagerActionsPanel
        onOpenApprovals={vi.fn()}
        onOpenWaivers={onOpenWaivers}
        onOpenTransactions={vi.fn()}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Review Loan Waivers" })
    );
    expect(onOpenWaivers).toHaveBeenCalledTimes(1);
  });
});
