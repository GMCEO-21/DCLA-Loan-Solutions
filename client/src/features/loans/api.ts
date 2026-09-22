import api from "@utils/api";
import type {
  ApplyLoanWaiverPayload,
  ApplyLoanWaiverResponse,
  CreateLoanData,
  Loan,
  MemberLoansQuery,
  MemberLoansResponse,
  LoanWaiver,
  LoanWaiverCandidate,
  ReloanEligibility,
  LoanRepaymentScheduleRow,
  LoanChargeBreakdown,
  LoanChargeSweepResponse,
  UpdateLoanTermData,
} from "./types";

export const LoansAPI = {
  getAll: async (): Promise<Loan[]> => {
    const res = await api.get("/loans");
    return res.data;
  },

  getByMember: async (
    memberId: string,
    params: MemberLoansQuery = {},
  ): Promise<MemberLoansResponse> => {
    const res = await api.get(`/loans/member/${memberId}`, { params });
    return res.data;
  },

  getOne: async (id: string): Promise<Loan> => {
    const res = await api.get(`/loans/${id}`);
    return res.data;
  },

  create: async (data: CreateLoanData): Promise<Loan> => {
    const res = await api.post("/loans", data);
    return res.data;
  },

  update: async (id: string, data: Partial<CreateLoanData>): Promise<Loan> => {
    const res = await api.patch(`/loans/${id}`, data);
    return res.data;
  },

  updateTerm: async (id: string, data: UpdateLoanTermData): Promise<Loan> => {
    const res = await api.patch(`/loans/${id}/term`, data);
    return res.data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/loans/${id}`);
  },

  checkEligibility: async (memberId: string): Promise<ReloanEligibility> => {
    const res = await api.get(`/loans/member/${memberId}/eligibility`);
    return res.data;
  },

  getRepaymentSchedule: async (
    loanId: string,
  ): Promise<LoanRepaymentScheduleRow[]> => {
    const res = await api.get(`/repayments/loan/${loanId}/schedule`);
    return res.data;
  },

  getWaiverCandidates: async (): Promise<LoanWaiverCandidate[]> => {
    const res = await api.get("/loans/waivers/candidates");
    return res.data;
  },

  getLoanWaivers: async (loanId: string): Promise<LoanWaiver[]> => {
    const res = await api.get(`/loans/${loanId}/waivers`);
    return res.data;
  },

  applyWaiver: async (
    loanId: string,
    payload: ApplyLoanWaiverPayload,
  ): Promise<ApplyLoanWaiverResponse> => {
    const res = await api.post(`/loans/${loanId}/waivers`, payload);
    return res.data;
  },

  getCharges: async (loanId: string): Promise<LoanChargeBreakdown> => {
    const res = await api.get(`/loans/${loanId}/charges`);
    return res.data;
  },

  runChargeSweep: async (): Promise<LoanChargeSweepResponse> => {
    const res = await api.post("/loans/charges/sweep");
    return res.data;
  },
};
