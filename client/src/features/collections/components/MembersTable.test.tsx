import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import type { MemberWithLoans } from "../types";
import { MembersTable } from "./MembersTable";

const member = {
  id: "member-a",
  firstName: "Maria",
  lastName: "Santos",
  contactNumber: "09171234567",
  loans: [
    {
      id: "loan-a",
      status: "active",
      principalAmount: 10000,
      totalAmount: 12000,
      weeklyPaymentAmount: 500,
      termWeeks: 24,
      balance: 9000,
    },
  ],
  totalLoanAmount: 10000,
  overallAmount: 12000,
  totalTermWeeks: 24,
  weeklyPaymentAmount: 500,
  totalBalance: 9000,
  totalSavings: 0,
} as unknown as MemberWithLoans;

describe("MembersTable actions layout", () => {
  it("aligns payment, savings, reloan, and expansion controls", () => {
    render(
      <ThemeProvider theme={theme}>
        <MembersTable
          members={[member]}
          getStatusColor={() => "error"}
          getStatusLabel={() => "UNPAID"}
          getCollectionMetrics={() => ({ received: 0, due: 500 })}
          getPaymentInfo={() => ({
            weeklyDue: 500,
            shortfall: 500,
            totalPaid: 0,
            weeksCovered: 0,
          })}
          formatCurrency={(amount) => `PHP ${amount}`}
          onOpenPaymentDialog={vi.fn()}
          onOpenSavingsDialog={vi.fn()}
          onOpenReloanDialog={vi.fn()}
          canManageSavings
          canReloan
        />
      </ThemeProvider>,
    );

    const payment = screen.getByRole("button", { name: "Payment" });
    expect(
      screen.getByRole("button", { name: "Savings" }),
    ).toBeInTheDocument();
    const reloan = screen.getByRole("button", { name: "Process Reloan" });
    const actions = payment.parentElement?.parentElement;

    expect(reloan).toBeInTheDocument();
    expect(actions).not.toBeNull();
    expect(getComputedStyle(actions as HTMLElement).display).toBe("flex");
    expect(getComputedStyle(actions as HTMLElement).alignItems).toBe("center");
    expect(
      screen.getByRole("button", { name: /Maria Santos/ }),
    ).toBeInTheDocument();
  });

  it.each([
    ["past_due", "Past Due"],
    ["past_maturity", "Past Maturity"],
  ] as const)(
    "renders the %s condition beside the member name",
    (status, label) => {
      render(
        <ThemeProvider theme={theme}>
          <MembersTable
            members={[{ ...member, loanCondition: { status } }]}
            getStatusColor={() => "error"}
            getStatusLabel={() => "UNPAID"}
            getCollectionMetrics={() => ({ received: 0, due: 500 })}
            getPaymentInfo={() => ({
              weeklyDue: 500,
              shortfall: 500,
              totalPaid: 0,
              weeksCovered: 0,
            })}
            formatCurrency={(amount) => `PHP ${amount}`}
            onOpenPaymentDialog={vi.fn()}
            onOpenSavingsDialog={vi.fn()}
            onOpenReloanDialog={vi.fn()}
            canManageSavings
            canReloan
          />
        </ThemeProvider>,
      );

      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText("UNPAID")).toBeInTheDocument();
    },
  );

  it.each(["normal", "indeterminate"] as const)(
    "does not render a badge for %s",
    (status) => {
      render(
        <ThemeProvider theme={theme}>
          <MembersTable
            members={[{ ...member, loanCondition: { status } }]}
            getStatusColor={() => "error"}
            getStatusLabel={() => "UNPAID"}
            getCollectionMetrics={() => ({ received: 0, due: 500 })}
            getPaymentInfo={() => ({
              weeklyDue: 500,
              shortfall: 500,
              totalPaid: 0,
              weeksCovered: 0,
            })}
            formatCurrency={(amount) => `PHP ${amount}`}
            onOpenPaymentDialog={vi.fn()}
            onOpenSavingsDialog={vi.fn()}
            onOpenReloanDialog={vi.fn()}
            canManageSavings
            canReloan
          />
        </ThemeProvider>,
      );

      expect(screen.queryByText("Past Due")).not.toBeInTheDocument();
      expect(screen.queryByText("Past Maturity")).not.toBeInTheDocument();
      expect(screen.getByText("UNPAID")).toBeInTheDocument();
    },
  );

  it("opens savings posting when the role is allowed", () => {
    const onOpenSavingsDialog = vi.fn();

    render(
      <ThemeProvider theme={theme}>
        <MembersTable
          members={[member]}
          getStatusColor={() => "error"}
          getStatusLabel={() => "UNPAID"}
          getCollectionMetrics={() => ({ received: 0, due: 500 })}
          getPaymentInfo={() => ({
            weeklyDue: 500,
            shortfall: 500,
            totalPaid: 0,
            weeksCovered: 0,
          })}
          formatCurrency={(amount) => `PHP ${amount}`}
          onOpenPaymentDialog={vi.fn()}
          onOpenSavingsDialog={onOpenSavingsDialog}
          onOpenReloanDialog={vi.fn()}
          canManageSavings
          canReloan={false}
        />
      </ThemeProvider>,
    );

    screen.getByRole("button", { name: "Savings" }).click();

    expect(onOpenSavingsDialog).toHaveBeenCalledWith(member);
  });

  it("hides savings posting when the role is not allowed", () => {
    render(
      <ThemeProvider theme={theme}>
        <MembersTable
          members={[member]}
          getStatusColor={() => "error"}
          getStatusLabel={() => "UNPAID"}
          getCollectionMetrics={() => ({ received: 0, due: 500 })}
          getPaymentInfo={() => ({
            weeklyDue: 500,
            shortfall: 500,
            totalPaid: 0,
            weeksCovered: 0,
          })}
          formatCurrency={(amount) => `PHP ${amount}`}
          onOpenPaymentDialog={vi.fn()}
          onOpenSavingsDialog={vi.fn()}
          onOpenReloanDialog={vi.fn()}
          canManageSavings={false}
          canReloan={false}
        />
      </ThemeProvider>,
    );

    expect(
      screen.queryByRole("button", { name: "Savings" }),
    ).not.toBeInTheDocument();
  });
});
