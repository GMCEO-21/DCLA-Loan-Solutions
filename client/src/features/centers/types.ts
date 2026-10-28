export interface Center {
  id: string;
  name: string;
  collectionDay: string;
  address?: string;
  leader?: string;
}

export interface CenterFormData {
  name: string;
  collectionDay: string;
  address: string;
  leader?: string;
}

export interface CenterFormProps {
  center?: Center;
  onSubmit: (data: CenterFormData) => Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
}

export interface CenterTableProps {
  centers: Center[];
  onEdit: (center: Center) => void;
  onDelete: (id: string) => Promise<void>;
  loading?: boolean;
}

export type CentersQuery = {
  page?: number;
  limit?: number;
  search?: string;
};

export type PaginatedCenters = {
  items: Center[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};