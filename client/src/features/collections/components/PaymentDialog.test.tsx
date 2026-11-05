import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AxiosError, AxiosHeaders } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";
import collectionsService from "../api";
import type { MemberWithLoans } from "../types";
import { PaymentDialog } from "./PaymentDialog";

vi.mock("../api", () => ({
  default: { createRepayment: vi.fn(), getPaymentLimit: vi.fn() },
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(collectionsService.getPaymentLimit).mockResolvedValue({
      loanId: "loan-1", loanStatus: "active", balance: 900, chargesOutstanding: 0,
      pendingAmount: 0, maximumCashAmount: 900, weeklyPaymentTarget: 100,
      availableSavings: 500, asOfDate: "2026-10-29",
    });
  });

  const renderPayment = () => render(<PaymentDialog open member={member}
    onClose={vi.fn()} onSuccess={vi.fn()} formatCurrency={(amount) => `PHP ${amount}`}
    centerId="center-1" collectionDate="2026-10-29" />);

  it("blocks excess cash before submitting but allows exact balance and advance payment", async () => {
    renderPayment();
    await screen.findByText(/Maximum cash payment: PHP 900/);
    const input = screen.getByLabelText(/payment amount/i);
    const submit = screen.getByRole("button", { name: /process payment/i });
    fireEvent.change(input, { target: { value: "900.01" } });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/Payment exceeds the remaining payable amount/)).toBeInTheDocument();
    fireEvent.click(submit);
    expect(collectionsService.createRepayment).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "900" } });
    expect(submit).toBeEnabled();
    fireEvent.change(input, { target: { value: "200" } });
    expect(submit).toBeEnabled();
    fireEvent.change(input, { target: { value: "200.001" } });
    expect(submit).toBeDisabled();
  });

  it("fails closed when the limit cannot load and supports retry", async () => {
    vi.mocked(collectionsService.getPaymentLimit).mockRejectedValueOnce(new Error("Limit temporarily unavailable"));
    renderPayment();
    await screen.findByText("Limit temporarily unavailable");
    fireEvent.change(screen.getByLabelText(/payment amount/i), { target: { value: "100" } });
    expect(screen.getByRole("button", { name: /process payment/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await screen.findByText(/Maximum cash payment: PHP 900/);
    expect(screen.getByRole("button", { name: /process payment/i })).toBeEnabled();
  });

  it("uses the remaining final installment for savings instead of the full weekly amount", async () => {
    vi.mocked(collectionsService.getPaymentLimit).mockResolvedValueOnce({
      loanId: "loan-1", loanStatus: "active", balance: 50, chargesOutstanding: 0,
      pendingAmount: 0, maximumCashAmount: 50, weeklyPaymentTarget: 50,
      availableSavings: 500, asOfDate: "2026-10-29",
    });
    vi.mocked(collectionsService.createRepayment).mockResolvedValue({ id: "payment" } as never);
    renderPayment();
    await screen.findByText(/Maximum cash payment: PHP 50/);
    fireEvent.change(screen.getByLabelText(/payment amount/i), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(screen.getByText("Use PHP 25 from savings")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /process payment/i }));
    await waitFor(() => expect(collectionsService.createRepayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 25, useSavings: true })));
  });

  it("allows cash above the contractual balance when charges are payable", async () => {
    vi.mocked(collectionsService.getPaymentLimit).mockResolvedValueOnce({
      loanId: "loan-1", loanStatus: "active", balance: 450, chargesOutstanding: 100,
      pendingAmount: 0, maximumCashAmount: 550, weeklyPaymentTarget: 200,
      availableSavings: 0, asOfDate: "2026-10-29",
    });
    renderPayment();
    await screen.findByText(/Maximum cash payment: PHP 550/);
    fireEvent.change(screen.getByLabelText(/payment amount/i), { target: { value: "550" } });
    expect(screen.getByRole("button", { name: /process payment/i })).toBeEnabled();
  });

  it("clears savings selection when changing to a cash advance", async () => {
    renderPayment();
    await screen.findByText(/Maximum cash payment: PHP 900/);
    fireEvent.change(screen.getByLabelText(/payment amount/i), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText(/payment amount/i), { target: { value: "200" } });
    expect(screen.getByRole("button", { name: /process payment/i })).toBeEnabled();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("blocks cash and savings when pending payments reserve the full balance", async () => {
    vi.mocked(collectionsService.getPaymentLimit).mockResolvedValueOnce({
      loanId: "loan-1", loanStatus: "active", balance: 450, chargesOutstanding: 0,
      pendingAmount: 450, maximumCashAmount: 0, weeklyPaymentTarget: 0,
      availableSavings: 500, asOfDate: "2026-10-29",
    });
    renderPayment();
    expect(screen.getByRole("button", { name: /process payment/i })).toBeDisabled();
    await screen.findByText(/Maximum cash payment: PHP 0/);
    fireEvent.change(screen.getByLabelText(/payment amount/i), { target: { value: "1" } });
    expect(screen.getByRole("button", { name: /process payment/i })).toBeDisabled();
    expect(collectionsService.createRepayment).not.toHaveBeenCalled();
  });

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
    await screen.findByText(/Maximum cash payment: PHP 900/);
    fireEvent.click(screen.getByRole("button", { name: /process payment/i }));

    await waitFor(() =>
      expect(
        screen.getByText("Payment exceeds the allowed amount"),
      ).toBeInTheDocument(),
    );
  });
});
