import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import DailyCollectionsView from "./DailyCollectionsView";
import {
  formatCollectionDatasetDate,
  getCollectionWeekRange,
} from "../utils/date";
import type { DailyCollectionGroup, MemberWithLoans } from "../types";

const getCenterMembers = vi.hoisted(() => vi.fn());
const getPendingRepaymentsForCollection = vi.hoisted(() => vi.fn());
const exportAllCollectionsToExcel = vi.hoisted(() => vi.fn());

vi.mock("../api", () => ({
  default: { getCenterMembers, getPendingRepaymentsForCollection },
}));
vi.mock("../utils/exportUtils", () => ({ exportAllCollectionsToExcel }));
vi.mock("@mui/icons-material", () => ({
  CalendarToday: () => <span aria-hidden="true" />,
  LocationOn: () => <span aria-hidden="true" />,
  People: () => <span aria-hidden="true" />,
  CheckCircle: () => <span aria-hidden="true" />,
  Schedule: () => <span aria-hidden="true" />,
  Warning: () => <span aria-hidden="true" />,
  HourglassEmpty: () => <span aria-hidden="true" />,
  Visibility: () => <span aria-hidden="true" />,
  FileDownload: () => <span aria-hidden="true" />,
}));

type LoanConditionStatus = NonNullable<
  MemberWithLoans["loanCondition"]
>["status"];

const createConditionMember = (
  id: string,
  status: LoanConditionStatus,
  loanStatuses: string[] = ["active"],
) => ({
  id,
  loans: loanStatuses.map((loanStatus, index) => ({
    id: `${id}-loan-${index}`,
    status: loanStatus,
  })),
  weeklyPaid: false,
  weeklyHasAllocation: false,
  weeklyFinancial: {
    kind: "scheduled_week",
    amountDue: 1500,
    amountApplied: 0,
    postMaturityLoanCount: 0,
    incompleteScheduleLoanCount: 0,
  },
  loanCondition: { status },
});

const renderConditionCard = async (members: unknown[], isDaily = true) => {
  const group = {
    centerId: "condition-center",
    centerName: "Condition Center",
    collectionDay: "Tuesday",
    collectionDate: "2026-10-20",
    totalMembers: members.length,
    collections: [],
  } as unknown as DailyCollectionGroup;
  getCenterMembers.mockResolvedValue(members);
  getPendingRepaymentsForCollection.mockResolvedValue([]);

  render(
    <ThemeProvider theme={theme}>
      <DailyCollectionsView
        data={[group]}
        datasetDate="2026-10-20"
        isDaily={isDaily}
        onViewDetails={vi.fn()}
      />
    </ThemeProvider>,
  );

  const heading = await screen.findByText("Condition Center");
  return heading.closest(".MuiCard-root");
};

const createWeeklyMember = (
  id: string,
  amountDue: number,
  amountApplied: number,
  loanCondition: LoanConditionStatus = "normal",
) => ({
  id,
  loans: [{ id: `${id}-loan`, status: "active" }],
  weeklyPaid: amountApplied >= amountDue,
  weeklyHasAllocation: amountApplied > 0,
  weeklyFinancial: {
    kind: "scheduled_week" as const,
    amountDue,
    amountApplied,
    postMaturityLoanCount: 0,
    incompleteScheduleLoanCount: 0,
  },
  loanCondition: { status: loanCondition },
});

const renderWeeklyCardText = async (
  members: unknown[],
  isDaily: boolean,
  expectedText: string,
) => {
  const group = {
    centerId: "weekly-center",
    centerName: "Bagontaas 01",
    collectionDay: "Tuesday",
    collectionDate: "2026-10-20",
    totalMembers: members.length,
    collections: [],
  } as unknown as DailyCollectionGroup;
  getCenterMembers.mockResolvedValue(members);
  getPendingRepaymentsForCollection.mockResolvedValue([]);

  const view = render(
    <ThemeProvider theme={theme}>
      <DailyCollectionsView
        data={[group]}
        datasetDate="2026-10-20"
        isDaily={isDaily}
        onViewDetails={vi.fn()}
      />
    </ThemeProvider>,
  );
  const card = (await screen.findByText("Bagontaas 01")).closest(
    ".MuiCard-root",
  );
  expect(card).not.toBeNull();
  await waitFor(() => expect(card).toHaveTextContent(expectedText));

  return { text: card?.textContent ?? "", unmount: view.unmount };
};

describe("formatCollectionDatasetDate", () => {
  it("formats a dataset calendar date without timezone shifting", () => {
    expect(formatCollectionDatasetDate("2026-09-07")).toBe("Sep 7, 2026");
    expect(formatCollectionDatasetDate("2026-09-03")).toBe("Sep 3, 2026");
  });

  it("preserves an invalid dataset date for diagnosis", () => {
    expect(formatCollectionDatasetDate("not-a-date")).toBe("not-a-date");
  });

  it.each([
    "2026-10-17",
    "2026-10-18",
    "2026-10-19",
    "2026-10-20",
    "2026-10-21",
    "2026-10-22",
    "2026-10-23",
  ])("resolves %s to the same Saturday-Friday week", (date) => {
    expect(getCollectionWeekRange(date)).toEqual({
      weekStart: "2026-10-17",
      weekEnd: "2026-10-23",
    });
  });

  it("starts a new collection week on Saturday", () => {
    expect(getCollectionWeekRange("2026-10-24")).toEqual({
      weekStart: "2026-10-24",
      weekEnd: "2026-10-30",
    });
  });
});

describe("DailyCollectionsView weekly operational Paid", () => {
  it("shows weekly page and center summaries across multiple centers", async () => {
    const northMember = {
      id: "member-north",
      loans: [{ id: "loan-north", status: "active" }],
      weeklyPaid: true,
      weeklyHasAllocation: true,
      weeklyAmountDue: 1500,
      weeklyAmountApplied: 1500,
      weeklyFinancial: {
        kind: "scheduled_week",
        amountDue: 1500,
        amountApplied: 1500,
        postMaturityLoanCount: 0,
        incompleteScheduleLoanCount: 0,
      },
    };
    const southMember = {
      id: "member-south",
      loans: [{ id: "loan-south", status: "active" }],
      weeklyPaid: false,
      weeklyHasAllocation: true,
      weeklyAmountDue: 1000,
      weeklyAmountApplied: 400,
      weeklyFinancial: {
        kind: "scheduled_week",
        amountDue: 1000,
        amountApplied: 400,
        postMaturityLoanCount: 0,
        incompleteScheduleLoanCount: 0,
      },
    };
    const groups = [
      {
        centerId: "center-north",
        centerName: "North Center",
        collectionDay: "Tuesday",
        collectionDate: "2026-10-20",
        totalMembers: 1,
        collections: [],
      },
      {
        centerId: "center-south",
        centerName: "South Center",
        collectionDay: "Tuesday",
        collectionDate: "2026-10-20",
        totalMembers: 1,
        collections: [],
      },
    ] as unknown as DailyCollectionGroup[];
    getCenterMembers.mockImplementation((centerId: string) =>
      Promise.resolve(
        centerId === "center-north" ? [northMember] : [southMember],
      ),
    );
    getPendingRepaymentsForCollection.mockResolvedValue([]);

    render(
      <ThemeProvider theme={theme}>
        <DailyCollectionsView
          data={groups}
          datasetDate="2026-10-20"
          onViewDetails={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(
      await screen.findByText("Collection Week: Oct 17, 2026 – Oct 23, 2026"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("Weekly Due")[0].parentElement,
    ).toHaveTextContent("2,500");
    expect(
      screen.getAllByText("Applied to Week")[0].parentElement,
    ).toHaveTextContent("1,900");
    expect(
      screen.getAllByText("Weekly Remaining")[0].parentElement,
    ).toHaveTextContent("600");

    const northCard = screen.getByText("North Center").closest(".MuiCard-root");
    const southCard = screen.getByText("South Center").closest(".MuiCard-root");
    expect(northCard).toHaveTextContent(/Weekly Due.*1,500/);
    expect(northCard).toHaveTextContent(/Applied to Week.*1,500/);
    expect(northCard).toHaveTextContent(/Weekly Remaining.*0/);
    expect(southCard).toHaveTextContent(/Weekly Due.*1,000/);
    expect(southCard).toHaveTextContent(/Applied to Week.*400/);
    expect(southCard).toHaveTextContent(/Weekly Remaining.*600/);
  });

  it("excludes post-maturity loans and sums remaining per scheduled member", async () => {
    const scheduledPaidAhead = {
      id: "member-1",
      loans: [{ id: "loan-1", status: "active" }],
      weeklyFinancial: {
        kind: "scheduled_week",
        amountDue: 1500,
        amountApplied: 2000,
        postMaturityLoanCount: 0,
        incompleteScheduleLoanCount: 0,
      },
    };
    const scheduledUnpaid = {
      id: "member-2",
      loans: [{ id: "loan-2", status: "active" }],
      weeklyFinancial: {
        kind: "scheduled_week",
        amountDue: 1500,
        amountApplied: 0,
        postMaturityLoanCount: 0,
        incompleteScheduleLoanCount: 0,
      },
    };
    const postMaturity = ["member-3", "member-4"].map((id) => ({
      id,
      loans: [{ id: `loan-${id}`, status: "active" }],
      loanCondition: { status: "past_maturity" },
      weeklyFinancial: {
        kind: "post_maturity_no_weekly_obligation",
        amountDue: null,
        amountApplied: null,
        postMaturityLoanCount: 1,
        incompleteScheduleLoanCount: 0,
      },
    }));
    const group = {
      centerId: "center-1",
      centerName: "North Center",
      collectionDay: "Tuesday",
      collectionDate: "2026-10-20",
      totalMembers: 4,
      collections: [],
    } as unknown as DailyCollectionGroup;
    getCenterMembers.mockResolvedValue([
      scheduledPaidAhead,
      scheduledUnpaid,
      ...postMaturity,
    ]);
    getPendingRepaymentsForCollection.mockResolvedValue([]);

    render(
      <ThemeProvider theme={theme}>
        <DailyCollectionsView
          data={[group]}
          datasetDate="2026-10-20"
          onViewDetails={vi.fn()}
        />
      </ThemeProvider>,
    );

    const centerCard = await screen.findByText("North Center");
    expect(centerCard.closest(".MuiCard-root")).toHaveTextContent(
      /Weekly Due.*3,000.*Applied to Week.*2,000.*Weekly Remaining.*1,500/,
    );
    expect(centerCard.closest(".MuiCard-root")).toHaveTextContent(
      "2 Past Maturity",
    );
    expect(
      screen.queryByText(/active loans are past their scheduled term/i),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Not available")).not.toBeInTheDocument();
  });

  it.each([
    {
      name: "Past Due only",
      members: [
        createConditionMember("past-due", "past_due"),
        createConditionMember("normal", "normal"),
      ],
      expected: "1 Past Due",
      absent: "Past Maturity",
    },
    {
      name: "Past Maturity only",
      members: [
        createConditionMember("maturity-1", "past_maturity"),
        createConditionMember("maturity-2", "past_maturity"),
      ],
      expected: "2 Past Maturity",
      absent: "Past Due",
    },
    {
      name: "mixed conditions",
      members: [
        createConditionMember("past-due", "past_due"),
        createConditionMember("maturity-1", "past_maturity"),
        createConditionMember("maturity-2", "past_maturity"),
        createConditionMember("maturity-multiple-loans", "past_maturity", [
          "active",
          "active",
        ]),
      ],
      expected: "1 Past Due · 3 Past Maturity",
      absent: null,
    },
  ])("renders the authoritative $name member summary", async (testCase) => {
    const card = await renderConditionCard(testCase.members);

    expect(card).toHaveTextContent(testCase.expected);
    if (testCase.absent) {
      expect(card).not.toHaveTextContent(testCase.absent);
    }
  });

  it.each([
    {
      name: "normal only",
      members: [createConditionMember("normal", "normal")],
    },
    {
      name: "indeterminate only",
      members: [createConditionMember("indeterminate", "indeterminate")],
    },
    {
      name: "normal and indeterminate",
      members: [
        createConditionMember("normal", "normal"),
        createConditionMember("indeterminate", "indeterminate"),
      ],
    },
  ])("hides the condition summary for $name", async (testCase) => {
    const card = await renderConditionCard(testCase.members);

    expect(card).not.toHaveTextContent("Past Due");
    expect(card).not.toHaveTextContent("Past Maturity");
  });

  it("excludes members without active loans and preserves weekly status counts", async () => {
    const members = [
      createConditionMember("active-past-due", "past_due"),
      createConditionMember("active-normal", "normal"),
      createConditionMember("closed-past-maturity", "past_maturity", [
        "closed",
      ]),
    ];

    const card = await renderConditionCard(members);

    expect(card).toHaveTextContent("1 Past Due");
    expect(card).not.toHaveTextContent("Past Maturity");
    expect(screen.getByText("Unpaid").parentElement).toHaveTextContent("2");
  });

  it("shows an explicit unavailable state for incomplete schedule data", async () => {
    const member = {
      id: "member-1",
      loans: [{ id: "loan-1", status: "active" }],
      weeklyFinancial: {
        kind: "missing_schedule_unexpectedly",
        amountDue: null,
        amountApplied: null,
        postMaturityLoanCount: 0,
        incompleteScheduleLoanCount: 1,
      },
    };
    const group = {
      centerId: "center-1",
      centerName: "North Center",
      collectionDay: "Tuesday",
      collectionDate: "2026-10-20",
      totalMembers: 1,
      collections: [],
    } as unknown as DailyCollectionGroup;
    getCenterMembers.mockResolvedValue([member]);
    getPendingRepaymentsForCollection.mockResolvedValue([]);

    render(
      <ThemeProvider theme={theme}>
        <DailyCollectionsView
          data={[group]}
          datasetDate="2026-10-20"
          onViewDetails={vi.fn()}
        />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(screen.getAllByText("Not available")).toHaveLength(4),
    );
    const centerCard = screen
      .getByText("North Center")
      .closest(".MuiCard-root");
    expect(centerCard).toHaveTextContent("Applied to Week: Not available");
    expect(centerCard).toHaveTextContent("Weekly Remaining: Not available");
    expect(screen.getAllByText("1 Weekly Schedule Issue")).toHaveLength(2);
  });

  it("shows a genuine weekly schedule issue on Daily cards", async () => {
    const member = {
      id: "daily-missing-schedule",
      loans: [{ id: "daily-missing-schedule-loan", status: "active" }],
      weeklyFinancial: {
        kind: "missing_schedule_unexpectedly",
        amountDue: null,
        amountApplied: null,
        postMaturityLoanCount: 0,
        incompleteScheduleLoanCount: 1,
      },
    };
    const card = await renderConditionCard([member]);

    expect(card).toHaveTextContent("1 Weekly Schedule Issue");
    expect(screen.getAllByText("1 Weekly Schedule Issue")).toHaveLength(2);
  });

  it.each([
    "pre_first_due_no_weekly_obligation",
    "post_maturity_no_weekly_obligation",
    "historical_funding_unavailable",
    "scheduled_week",
  ] as const)(
    "does not report %s as a Daily weekly schedule issue",
    async (kind) => {
      const member = {
        id: `member-${kind}`,
        loans: [{ id: `loan-${kind}`, status: "active" }],
        weeklyFinancial: {
          kind,
          amountDue: kind === "scheduled_week" ? 1500 : null,
          amountApplied: kind === "scheduled_week" ? 0 : null,
          postMaturityLoanCount:
            kind === "post_maturity_no_weekly_obligation" ? 1 : 0,
          incompleteScheduleLoanCount: 0,
        },
      };
      const card = await renderConditionCard([member]);

      expect(card).not.toHaveTextContent("Weekly Schedule Issue");
      expect(
        screen.queryByText(/Weekly Schedule Issues?/),
      ).not.toBeInTheDocument();
    },
  );

  it.each([
    {
      name: "same center and date",
      members: [createWeeklyMember("bagontaas-member", 20920, 0)],
      expected: "Weekly Remaining: ₱20,920",
    },
    {
      name: "partial selected week",
      members: [createWeeklyMember("partial-member", 1000, 400)],
      expected: "Weekly Remaining: ₱600",
    },
    {
      name: "advance-funded selected week",
      members: [createWeeklyMember("advance-member", 1500, 1500)],
      expected: "Weekly Remaining: ₱0",
    },
    {
      name: "reversed selected-week funding",
      members: [createWeeklyMember("reversed-member", 1000, 0)],
      expected: "Weekly Remaining: ₱1,000",
    },
    {
      name: "past maturity exclusion",
      members: [
        createWeeklyMember("scheduled-member", 1200, 200),
        {
          id: "past-maturity-member",
          loans: [{ id: "past-maturity-loan", status: "active" }],
          weeklyFinancial: {
            kind: "post_maturity_no_weekly_obligation",
            amountDue: null,
            amountApplied: null,
            postMaturityLoanCount: 1,
            incompleteScheduleLoanCount: 0,
          },
          loanCondition: { status: "past_maturity" },
        },
      ],
      expected: "Weekly Due₱1,200",
    },
    {
      name: "past due member still inside term",
      members: [createWeeklyMember("past-due-member", 1500, 300, "past_due")],
      expected: "Weekly Due₱1,500",
    },
    {
      name: "pre-first-due exclusion",
      members: [
        createWeeklyMember("current-member", 900, 0),
        {
          id: "pre-first-due-member",
          loans: [{ id: "pre-first-due-loan", status: "active" }],
          weeklyFinancial: {
            kind: "pre_first_due_no_weekly_obligation",
            amountDue: null,
            amountApplied: null,
            postMaturityLoanCount: 0,
            incompleteScheduleLoanCount: 0,
          },
          loanCondition: { status: "normal" },
        },
      ],
      expected: "Weekly Due₱900",
    },
    {
      name: "historical funding unavailable",
      members: [
        {
          id: "historical-member",
          loans: [{ id: "historical-loan", status: "active" }],
          weeklyFinancial: {
            kind: "historical_funding_unavailable",
            amountDue: null,
            amountApplied: null,
            postMaturityLoanCount: 0,
            incompleteScheduleLoanCount: 0,
          },
          loanCondition: { status: "indeterminate" },
        },
      ],
      expected: "Weekly DueNot available",
    },
  ])(
    "renders identical Daily and By Date metrics for $name",
    async (testCase) => {
      const daily = await renderWeeklyCardText(
        testCase.members,
        true,
        testCase.expected,
      );
      daily.unmount();

      const byDate = await renderWeeklyCardText(
        testCase.members,
        false,
        testCase.expected,
      );

      expect(daily.text).toBe(byDate.text);
      expect(byDate.text).toContain("Weekly Due");
      expect(byDate.text).toContain("Applied to Week");
      expect(byDate.text).toContain("Weekly Remaining");
    },
  );

  it.each([
    { name: "Daily", isDaily: true },
    { name: "By Date", isDaily: false },
  ])(
    "uses the operational status population for $name Total Members",
    async ({ isDaily }) => {
      const createOperationalMember = (
        id: string,
        weeklyPaid: boolean,
        weeklyHasAllocation: boolean,
        loans?: Array<{ id: string; status: string }>,
      ) => ({
        id,
        firstName: id,
        lastName: "Member",
        loans: loans ?? [{ id: `${id}-loan`, status: "active" }],
        weeklyPaid,
        weeklyHasAllocation,
        weeklyFinancial: {
          kind: "scheduled_week" as const,
          amountDue: 1500,
          amountApplied: weeklyPaid ? 1500 : weeklyHasAllocation ? 500 : 0,
          postMaturityLoanCount: 0,
          incompleteScheduleLoanCount: 0,
        },
      });
      const members = [
        ...Array.from({ length: 6 }, (_, index) =>
          createOperationalMember(
            `paid-${index}`,
            true,
            true,
            index === 0
              ? [
                  { id: "paid-0-loan-a", status: "active" },
                  { id: "paid-0-loan-b", status: "active" },
                ]
              : undefined,
          ),
        ),
        createOperationalMember("partial-1", false, true),
        createOperationalMember("pending-1", false, false),
        ...Array.from({ length: 3 }, (_, index) =>
          createOperationalMember(`unpaid-${index}`, false, false),
        ),
        { id: "no-loan", firstName: "No", lastName: "Loan", loans: [] },
        {
          id: "closed-only",
          firstName: "Closed",
          lastName: "Only",
          loans: [{ id: "closed-loan", status: "closed" }],
        },
        {
          id: "inactive-only",
          firstName: "Inactive",
          lastName: "Only",
          loans: [{ id: "inactive-loan", status: "inactive" }],
        },
      ];
      const group = {
        centerId: "population-center",
        centerName: "Population Center",
        collectionDay: "Tuesday",
        collectionDate: "2026-10-20",
        totalMembers: 48,
        collections: [],
      } as unknown as DailyCollectionGroup;
      getCenterMembers.mockResolvedValue(members);
      getPendingRepaymentsForCollection.mockResolvedValue([
        { operationType: "payment", member: { id: "pending-1" } },
      ]);

      render(
        <ThemeProvider theme={theme}>
          <DailyCollectionsView
            data={[group]}
            datasetDate="2026-10-20"
            isDaily={isDaily}
            onViewDetails={vi.fn()}
          />
        </ThemeProvider>,
      );

      const card = (await screen.findByText("Population Center")).closest(
        ".MuiCard-root",
      );
      expect(card).not.toBeNull();
      await waitFor(() =>
        expect(
          within(card as HTMLElement).getByText("Total Members").parentElement,
        ).toHaveTextContent("11"),
      );
      expect(
        within(card as HTMLElement).getByText("Paid").parentElement,
      ).toHaveTextContent("6");
      expect(
        within(card as HTMLElement).getByText("Partial").parentElement,
      ).toHaveTextContent("1");
      expect(
        within(card as HTMLElement).getByText("Pending").parentElement,
      ).toHaveTextContent("1");
      expect(
        within(card as HTMLElement).getByText("Unpaid").parentElement,
      ).toHaveTextContent("3");
    },
  );

  it("uses backend Daily collection value and weekly remaining while preserving center weekly values", async () => {
    const member = {
      id: "daily-financial-member",
      loans: [
        {
          id: "daily-financial-loan",
          status: "active",
          amount: 10000,
          loanCreatedDate: "2026-10-20",
          netCashReleased: 8000,
        },
      ],
      overallAmount: 10000,
      totalBalance: 7000,
      weeklyPaid: false,
      weeklyHasAllocation: true,
      weeklyFinancial: {
        kind: "scheduled_week",
        amountDue: 1500,
        amountApplied: 500,
        postMaturityLoanCount: 0,
        incompleteScheduleLoanCount: 0,
      },
    };
    const group = {
      centerId: "daily-financial-center",
      centerName: "Daily Financial Center",
      collectionDay: "Tuesday",
      collectionDate: "2026-10-20",
      totalReceived: 1250,
      totalMembers: 1,
      collections: [
        {
          id: "daily-collection",
          memberId: member.id,
          centerId: "daily-financial-center",
          collectionDate: "2026-10-20",
          amount: 1500,
          paymentReceived: 1000,
        },
      ],
    } as unknown as DailyCollectionGroup;
    getCenterMembers.mockResolvedValue([member]);
    getPendingRepaymentsForCollection.mockResolvedValue([]);
    exportAllCollectionsToExcel.mockResolvedValue(undefined);

    render(
      <ThemeProvider theme={theme}>
        <DailyCollectionsView
          data={[group]}
          datasetDate="2026-10-20"
          isDaily
          onViewDetails={vi.fn()}
        />
      </ThemeProvider>,
    );

    const card = (await screen.findByText("Daily Financial Center")).closest(
      ".MuiCard-root",
    );
    expect(card).not.toBeNull();
    expect(card).toHaveTextContent(/Weekly Due.*1,500/);
    expect(card).toHaveTextContent(/Applied to Week:.*500/);
    expect(card).toHaveTextContent(/Weekly Remaining:.*1,000/);
    expect(card).not.toHaveTextContent("10,000");
    expect(card).not.toHaveTextContent("Received:");
    expect(screen.getByText("Collected Today").parentElement).toHaveTextContent(
      "1,250",
    );
    expect(
      screen.getByText("Weekly Remaining").parentElement,
    ).toHaveTextContent("1,000");
    expect(screen.getByText("Released Today").parentElement).toHaveTextContent(
      "8,000",
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Export Current Results/i }),
    );
    await waitFor(() =>
      expect(exportAllCollectionsToExcel).toHaveBeenCalledWith(
        expect.any(Array),
        "Daily_Collections_Report",
        "daily",
      ),
    );
  });

  it("counts an included funded member as Paid and exports the same status without changing amounts", async () => {
    const member = {
      id: "member-1",
      firstName: "Maria",
      lastName: "Santos",
      loans: [{ id: "loan-1", status: "active", amount: 3000, amountPaid: 0 }],
      totalLoanAmount: 3000,
      totalBalance: 3000,
      weeklyPaymentAmount: 1500,
      weeklyPaid: true,
    };
    const collection = {
      id: "collection-1",
      memberId: member.id,
      centerId: "center-1",
      paymentReceived: 0,
      amount: 1500,
      collectionDate: "2026-10-20",
    };
    const group = {
      centerId: "center-1",
      centerName: "North Center",
      collectionDay: "Tuesday",
      collectionDate: "2026-10-20",
      totalAmount: 1500,
      totalReceived: 0,
      totalMembers: 1,
      pendingCollections: 0,
      collections: [collection],
    } as unknown as DailyCollectionGroup;
    getCenterMembers.mockResolvedValue([member]);
    getPendingRepaymentsForCollection.mockResolvedValue([]);
    exportAllCollectionsToExcel.mockResolvedValue(undefined);

    render(
      <ThemeProvider theme={theme}>
        <DailyCollectionsView
          data={[group]}
          datasetDate="2026-10-20"
          onViewDetails={vi.fn()}
        />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("Paid").parentElement).toHaveTextContent("1"),
    );
    expect(screen.getByText("Total Members").parentElement).toHaveTextContent(
      "1",
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Export Current Results/i }),
    );
    await waitFor(() =>
      expect(exportAllCollectionsToExcel).toHaveBeenCalledOnce(),
    );
    expect(exportAllCollectionsToExcel).toHaveBeenCalledWith(
      expect.any(Array),
      "Collections_By_Date_Report",
      "by-date",
    );
    const exportedMember =
      exportAllCollectionsToExcel.mock.calls[0][0][0].members[0];
    expect(exportedMember.id).toBe(member.id);
    expect(exportedMember.__computed.status.label).toBe("PAID");
    expect(exportedMember.totalBalance).toBe(3000);
    expect(exportedMember.collection.paymentReceived).toBe(0);
  });

  it("keeps the legacy status and export value when weekly funding is unavailable", async () => {
    const member = {
      id: "member-2",
      firstName: "Ana",
      lastName: "Reyes",
      loans: [
        {
          id: "loan-2",
          status: "active",
          amount: 3000,
          amountPaid: 500,
          weeklyPaymentAmount: 1500,
          loanCreatedDate: "2026-10-17",
        },
      ],
      totalLoanAmount: 3000,
      totalBalance: 2500,
      weeklyPaymentAmount: 1500,
      weeklyPaid: null,
    };
    const collection = {
      id: "collection-2",
      memberId: member.id,
      centerId: "center-1",
      paymentReceived: 0,
      amount: 1500,
      collectionDate: "2026-10-20",
    };
    const group = {
      centerId: "center-1",
      centerName: "North Center",
      collectionDay: "Tuesday",
      collectionDate: "2026-10-20",
      totalAmount: 1500,
      totalReceived: 0,
      totalMembers: 1,
      pendingCollections: 0,
      collections: [collection],
    } as unknown as DailyCollectionGroup;
    getCenterMembers.mockResolvedValue([member]);
    getPendingRepaymentsForCollection.mockResolvedValue([]);
    exportAllCollectionsToExcel.mockResolvedValue(undefined);

    render(
      <ThemeProvider theme={theme}>
        <DailyCollectionsView
          data={[group]}
          datasetDate="2026-10-20"
          onViewDetails={vi.fn()}
        />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("Partial").parentElement).toHaveTextContent("1"),
    );
    expect(screen.queryByText(/Unavailable/i)).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /Export Current Results/i }),
    );
    await waitFor(() =>
      expect(exportAllCollectionsToExcel).toHaveBeenCalledOnce(),
    );
    const exportedMembers = exportAllCollectionsToExcel.mock.calls.at(-1)?.[0];
    expect(exportedMembers[0].members).toHaveLength(1);
    expect(exportedMembers[0].members[0].id).toBe(member.id);
    expect(exportedMembers[0].members[0].__computed.status.label).toBe(
      "PARTIAL",
    );
  });

  it("uses an existing unfunded weekly schedule for both UI and export", async () => {
    const member = {
      id: "member-3",
      firstName: "Lina",
      lastName: "Cruz",
      loans: [
        {
          id: "loan-3",
          status: "active",
          amount: 4500,
          amountPaid: 3000,
          weeklyPaymentAmount: 1500,
          loanCreatedDate: "2026-10-17",
        },
      ],
      totalLoanAmount: 4500,
      totalBalance: 1500,
      weeklyPaymentAmount: 1500,
      weeklyPaid: false,
      weeklyHasAllocation: false,
    };
    const collection = {
      id: "collection-3",
      memberId: member.id,
      centerId: "center-1",
      paymentReceived: 0,
      amount: 1500,
      collectionDate: "2026-10-24",
    };
    const group = {
      centerId: "center-1",
      centerName: "North Center",
      collectionDay: "Saturday",
      collectionDate: "2026-10-24",
      totalAmount: 1500,
      totalReceived: 0,
      totalMembers: 1,
      pendingCollections: 0,
      collections: [collection],
    } as unknown as DailyCollectionGroup;
    getCenterMembers.mockResolvedValue([member]);
    getPendingRepaymentsForCollection.mockResolvedValue([]);
    exportAllCollectionsToExcel.mockResolvedValue(undefined);

    render(
      <ThemeProvider theme={theme}>
        <DailyCollectionsView
          data={[group]}
          datasetDate="2026-10-24"
          onViewDetails={vi.fn()}
        />
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("Unpaid").parentElement).toHaveTextContent("1"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Export Current Results/i }),
    );
    await waitFor(() =>
      expect(exportAllCollectionsToExcel).toHaveBeenCalledOnce(),
    );
    const exportedMembers = exportAllCollectionsToExcel.mock.calls.at(-1)?.[0];
    expect(exportedMembers[0].members).toHaveLength(1);
    expect(exportedMembers[0].members[0].id).toBe(member.id);
    expect(exportedMembers[0].members[0].__computed.status.label).toBe(
      "UNPAID",
    );
  });
});
