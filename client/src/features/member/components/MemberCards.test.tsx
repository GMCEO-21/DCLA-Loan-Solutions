import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MemberCards from "./MemberCards";
import type { Member } from "../types";

vi.mock("@mui/icons-material", () => ({
  Edit: () => null,
  Delete: () => null,
  Phone: () => null,
  LocationOn: () => null,
  CalendarToday: () => null,
  Person: () => null,
  MoreVert: () => null,
  Business: () => null,
  ReceiptLong: () => null,
  Savings: () => null,
  Close: () => null,
}));

const member = {
  id: "member-a",
  firstName: "Evelyn",
  lastName: "Abordo",
  contactNumber: "09171234567",
  address: "Davao City",
} as Member;

describe("MemberCards savings entry point", () => {
  it("keeps the loan and edit actions bound to the selected member", () => {
    const onViewLoan = vi.fn();
    const onEdit = vi.fn();
    render(
      <MemberCards
        members={[member]}
        onEdit={onEdit}
        onDelete={vi.fn()}
        onViewLoan={onViewLoan}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "View Loan" }));
    expect(onViewLoan).toHaveBeenCalledWith(member);
    fireEvent.click(screen.getByRole("button", { name: /Open actions/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    expect(onEdit).toHaveBeenCalledWith(member);
  });
  it("keeps delete behind confirmation", () => {
    const onDelete = vi.fn();
    render(
      <MemberCards members={[member]} onEdit={vi.fn()} onDelete={onDelete} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Open actions/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onDelete).not.toHaveBeenCalled();
  });
  it("keeps the existing Savings action wired to the selected member", () => {
    const onAddSavings = vi.fn();
    render(
      <MemberCards
        members={[member]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onViewLoan={vi.fn()}
        onAddSavings={onAddSavings}
      />,
    );

    const savingsButton = screen.getByRole("button", { name: "Savings" });
    expect(savingsButton).toHaveClass("MuiButton-outlined");
    fireEvent.click(savingsButton);
    expect(onAddSavings).toHaveBeenCalledWith(member);
  });

  it("does not expose Savings when the caller is not authorized", () => {
    render(
      <MemberCards
        members={[member]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onViewLoan={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Savings" }),
    ).not.toBeInTheDocument();
  });
});
