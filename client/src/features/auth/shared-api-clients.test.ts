import { beforeEach, describe, expect, it, vi } from "vitest";

const { api } = vi.hoisted(() => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@utils/api", () => ({ default: api }));

import { collectionsService } from "../collections/api";
import { savingsService } from "../savings/api";

describe("feature API authentication", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes Savings through the shared authenticated client", async () => {
    api.post.mockResolvedValue({ data: { ok: true } });
    api.get.mockResolvedValue({ data: { activeLoanSavings: 100 } });

    await savingsService.deposit({ memberId: "member-id", amount: 100 });
    await savingsService.getByMember("member-id");

    expect(api.post).toHaveBeenCalledWith("/savings/deposit", {
      memberId: "member-id",
      amount: 100,
    });
    expect(api.get).toHaveBeenCalledWith("/savings/member/member-id");
  });

  it("routes Collections, repayments, and reloan support through one client", async () => {
    api.get.mockResolvedValue({ data: [] });
    api.post.mockResolvedValue({ data: { id: "repayment-id" } });

    await collectionsService.getTodayCollections("2026-09-05");
    await collectionsService.createRepayment({
      loanId: "loan-id",
      memberId: "member-id",
      centerId: "center-id",
      amount: 100,
    });

    expect(api.get).toHaveBeenCalledWith("/collection/daily", {
      params: { date: "2026-09-05" },
    });
    expect(api.post).toHaveBeenCalledWith("/repayments", {
      loanId: "loan-id",
      memberId: "member-id",
      centerId: "center-id",
      amount: 100,
    });
  });
});
