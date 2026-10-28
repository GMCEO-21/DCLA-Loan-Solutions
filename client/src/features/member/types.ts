// import type { Loan, Savings } from "@features/loans/types";
import type { Center } from "@features/centers/types";

export interface Member {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string;
  contactNumber: string;
  address: string;
  birthDate: Date;
  center?: Center;
}

export interface MemberFormData {
  firstName: string;
  lastName: string;
  middleName: string;
  contactNumber: string;
  address: string;
  birthDate: Date | null;
  centerId?: string;
}

export interface MemberFormProps {
  member?: Member;
  onSubmit: (data: MemberFormData) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

export interface MemberTableProps {
  members: Member[];
  onEdit: (member: Member) => void;
  onDelete: (id: string) => Promise<void>;
  loading?: boolean;
}

export interface MemberCardsProps {
  members: Member[];
  onEdit: (member: Member) => void;
  onDelete: (id: string) => Promise<void>;
  onViewLoan?: (member: Member) => void;
  onAddSavings?: (member: Member) => void;
  loading?: boolean;
}

export type MembersQuery = {
  page?: number;
  limit?: number;
  search?: string;
  centerId?: string;
};

export type PaginatedMembers = {
  items: Member[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};
