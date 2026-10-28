import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SendSmsConfirmationDialog from "./SendSmsConfirmationDialog";
import { smsNotificationsApi } from "../api";
import type { SmsEligibilityItem, SmsRequestResult } from "../types";

vi.mock("../api", () => ({
  smsNotificationsApi: {
    requestLoanSms: vi.fn(),
    requestRepaymentBatch: vi.fn(),
    getStatus: vi.fn(),
  },
}));

const ready = (resourceId: string, memberName: string): SmsEligibilityItem => ({
  resourceId,
  memberName,
  amount: 1000,
  recipientMasked: "+639****4567",
  eligible: true,
  errorCode: null,
  errorMessage: null,
  notificationId: null,
  notificationStatus: null,
});

const requestResult = (
  item: SmsEligibilityItem,
  overrides: Partial<SmsRequestResult> = {},
): SmsRequestResult => ({
  ...item,
  notificationId: "notification-id",
  notificationStatus: "pending",
  eventType: "loan_created",
  created: true,
  status: "pending",
  ...overrides,
});

describe("SendSmsConfirmationDialog", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it("keeps financial-success wording and Don't Send makes no request", () => {
    const onClose = vi.fn();
    render(
      <SendSmsConfirmationDialog
        open
        eventType="loan_created"
        title="Loan Created Successfully"
        candidates={[ready("loan-id", "Maria Santos")]}
        onClose={onClose}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: /Loan Created Successfully/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close SMS notification" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("The financial transaction is complete."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Don't Send" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(smsNotificationsApi.requestLoanSms).not.toHaveBeenCalled();
  });

  it("submits only the loan resource ID and polls to sent", async () => {
    const item = ready("loan-id", "Maria Santos");
    vi.mocked(smsNotificationsApi.requestLoanSms).mockResolvedValue(
      requestResult(item),
    );
    vi.mocked(smsNotificationsApi.getStatus).mockResolvedValue({
      notificationId: "notification-id",
      eventType: "loan_created",
      status: "sent",
      recipientMasked: "+639****4567",
      sentAt: "2026-08-26T00:00:00.000Z",
      errorCode: null,
      errorMessage: null,
    });

    render(
      <SendSmsConfirmationDialog
        open
        eventType="loan_created"
        title="Loan Created Successfully"
        candidates={[item]}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Send SMS" }));

    await screen.findByText(
      "SMS sent successfully. UniSMS accepted the message.",
    );
    expect(smsNotificationsApi.requestLoanSms).toHaveBeenCalledWith("loan-id");
    expect(smsNotificationsApi.requestLoanSms).toHaveBeenCalledTimes(1);
  });

  it("sends all eligible approved payments in one batch request", async () => {
    const first = ready("repayment-1", "Member A");
    const second = ready("repayment-2", "Member B");
    const invalid: SmsEligibilityItem = {
      ...ready("repayment-3", "Member C"),
      recipientMasked: null,
      eligible: false,
      errorCode: "INVALID_CONTACT_NUMBER",
      errorMessage: "Invalid contact number.",
    };
    vi.mocked(smsNotificationsApi.requestRepaymentBatch).mockResolvedValue({
      items: [
        requestResult(first, { eventType: "repayment_posted" }),
        requestResult(second, {
          eventType: "repayment_posted",
          notificationId: "notification-id-2",
        }),
      ],
      summary: {
        selected: 2,
        queued: 2,
        alreadySent: 0,
        invalidContact: 0,
        missingContact: 0,
        ineligible: 0,
      },
    });

    render(
      <SendSmsConfirmationDialog
        open
        eventType="repayment_posted"
        title="3 Payments Successfully Approved"
        candidates={[first, second, invalid]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Invalid contact")).toBeInTheDocument();
    expect(screen.getByLabelText("SMS notification actions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Don't Send" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send All 2" }));

    await waitFor(() =>
      expect(smsNotificationsApi.requestRepaymentBatch).toHaveBeenCalledWith([
        "repayment-1",
        "repayment-2",
      ]),
    );
    expect(
      await screen.findByText(/2 SMS notifications queued/),
    ).toBeInTheDocument();
  });

  it("disables duplicate clicks while the request is in flight", async () => {
    const item = ready("loan-id", "Maria Santos");
    let resolveRequest!: (value: SmsRequestResult) => void;
    vi.mocked(smsNotificationsApi.requestLoanSms).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }),
    );
    vi.mocked(smsNotificationsApi.getStatus).mockResolvedValue({
      notificationId: "notification-id",
      eventType: "loan_created",
      status: "sent",
      recipientMasked: "+639****4567",
      sentAt: null,
      errorCode: null,
      errorMessage: null,
    });

    render(
      <SendSmsConfirmationDialog
        open
        eventType="loan_created"
        title="Loan Created Successfully"
        candidates={[item]}
        onClose={vi.fn()}
      />,
    );
    const sendButton = screen.getByRole("button", { name: "Send SMS" });
    fireEvent.click(sendButton);
    fireEvent.click(sendButton);
    expect(smsNotificationsApi.requestLoanSms).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Close SMS notification" }),
    ).toBeDisabled();
    resolveRequest(requestResult(item));
    await screen.findByText(
      "SMS sent successfully. UniSMS accepted the message.",
    );
  });

  it("shows a deterministic delayed state after bounded polling", async () => {
    vi.useFakeTimers();
    const item = ready("loan-id", "Maria Santos");
    vi.mocked(smsNotificationsApi.requestLoanSms).mockResolvedValue(
      requestResult(item),
    );
    vi.mocked(smsNotificationsApi.getStatus).mockResolvedValue({
      notificationId: "notification-id",
      eventType: "loan_created",
      status: "processing",
      recipientMasked: "+639****4567",
      sentAt: null,
      errorCode: null,
      errorMessage: null,
    });

    render(
      <SendSmsConfirmationDialog
        open
        eventType="loan_created"
        title="Loan Created Successfully"
        candidates={[item]}
        onClose={vi.fn()}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send SMS" }));
      await vi.advanceTimersByTimeAsync(7_000);
    });

    expect(smsNotificationsApi.getStatus).toHaveBeenCalledTimes(8);
    expect(
      screen.getByText(
        "SMS delivery is temporarily delayed. The system will retry automatically.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the provider failure and stops polling", async () => {
    vi.useFakeTimers();
    const item = ready("loan-id", "Maria Santos");
    vi.mocked(smsNotificationsApi.requestLoanSms).mockResolvedValue(
      requestResult(item),
    );
    vi.mocked(smsNotificationsApi.getStatus).mockResolvedValue({
      notificationId: "notification-id",
      eventType: "loan_created",
      status: "failed",
      recipientMasked: "+639****4567",
      sentAt: null,
      errorCode: "UNISMS_REQUEST_REJECTED",
      errorMessage: "Unsupported message content.",
    });

    render(
      <SendSmsConfirmationDialog
        open
        eventType="loan_created"
        title="Loan Created Successfully"
        candidates={[item]}
        onClose={vi.fn()}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send SMS" }));
      await Promise.resolve();
    });

    expect(
      screen.getByText("Unsupported message content."),
    ).toBeInTheDocument();
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(smsNotificationsApi.getStatus).toHaveBeenCalledTimes(1);
  });

  it("aborts polling and clears its delay when the dialog closes", async () => {
    vi.useFakeTimers();
    const item = ready("loan-id", "Maria Santos");
    let statusSignal: AbortSignal | undefined;
    vi.mocked(smsNotificationsApi.requestLoanSms).mockResolvedValue(
      requestResult(item),
    );
    vi.mocked(smsNotificationsApi.getStatus).mockImplementation(
      async (_notificationId, signal) => {
        statusSignal = signal;
        return {
          notificationId: "notification-id",
          eventType: "loan_created",
          status: "processing",
          recipientMasked: "+639****4567",
          sentAt: null,
          errorCode: null,
          errorMessage: null,
        };
      },
    );

    const { rerender } = render(
      <SendSmsConfirmationDialog
        open
        eventType="loan_created"
        title="Loan Created Successfully"
        candidates={[item]}
        onClose={vi.fn()}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send SMS" }));
      await Promise.resolve();
    });
    expect(smsNotificationsApi.getStatus).toHaveBeenCalledTimes(1);
    expect(statusSignal?.aborted).toBe(false);

    rerender(
      <SendSmsConfirmationDialog
        open={false}
        eventType="loan_created"
        title="Loan Created Successfully"
        candidates={[item]}
        onClose={vi.fn()}
      />,
    );
    expect(statusSignal?.aborted).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(smsNotificationsApi.getStatus).toHaveBeenCalledTimes(1);
  });

  it("aborts polling when the component unmounts", async () => {
    vi.useFakeTimers();
    const item = ready("loan-id", "Maria Santos");
    let statusSignal: AbortSignal | undefined;
    vi.mocked(smsNotificationsApi.requestLoanSms).mockResolvedValue(
      requestResult(item),
    );
    vi.mocked(smsNotificationsApi.getStatus).mockImplementation(
      async (_notificationId, signal) => {
        statusSignal = signal;
        return {
          notificationId: "notification-id",
          eventType: "loan_created",
          status: "processing",
          recipientMasked: "+639****4567",
          sentAt: null,
          errorCode: null,
          errorMessage: null,
        };
      },
    );

    const { unmount } = render(
      <SendSmsConfirmationDialog
        open
        eventType="loan_created"
        title="Loan Created Successfully"
        candidates={[item]}
        onClose={vi.fn()}
      />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send SMS" }));
      await Promise.resolve();
    });

    unmount();
    expect(statusSignal?.aborted).toBe(true);
    await act(async () => vi.advanceTimersByTimeAsync(10_000));
    expect(smsNotificationsApi.getStatus).toHaveBeenCalledTimes(1);
  });
});
