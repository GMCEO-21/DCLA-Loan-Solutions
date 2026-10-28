import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import collectionsService from "../api";
import type { MemberWithLoans } from "../types";
import { PaymentDialog } from "./PaymentDialog";

vi.mock("../api", () => ({
  default: { createRepayment: vi.fn() },
}));
vi.mock("@mui/icons-material", () => ({
  AccountBalance: () => <span aria-hidden="true" />,
  Close: () => <span aria-hidden="true" />,
  Payment: () => <span aria-hidden="true" />,
  Savings: () => <span aria-hidden="true" />,
}));

const member: MemberWithLoans = {
  id: "member-1",
  firstName: "Test",
  lastName: "Member",
  middleName: "",
  contactNumber: "09170000000",
  address: "Test Address",
  createdAt: "2026-09-05T00:00:00.000Z",
  updatedAt: "2026-09-05T00:00:00.000Z",
  loans: [
    {
      id: "loan-1",
      amount: 1000,
      balance: 900,
      status: "active",
      dueDate: "2026-09-12",
    },
  ],
  totalLoanAmount: 1000,
  totalBalance: 900,
  weeklyPaymentAmount: 100,
};

describe("PaymentDialog errors", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows safe backend validation feedback", async () => {
    vi.mocked(collectionsService.createRepayment).mockRejectedValue(
      new AxiosError("validation", undefined, undefined, undefined, {
        status: 422,
        statusText: "Unprocessable Entity",
        headers: {},
        config: { headers: new AxiosHeaders() },
        data: { message: ["Payment exceeds the allowed amount"] },
      }),
    );

    render(
      <PaymentDialog
        open
        member={member}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        formatCurrency={(amount) => `PHP ${amount}`}
        centerId="center-1"
        collectionDate="2026-09-05"
      />,
    );

    fireEvent.change(screen.getByLabelText(/payment amount/i), {
      target: { value: "100" },
    });
    fireEvent.click(screen.getByRole("button", { name: /process payment/i }));

    await waitFor(() =>
      expect(
        screen.getByText("Payment exceeds the allowed amount"),
      ).toBeInTheDocument(),
    );
  });
});
