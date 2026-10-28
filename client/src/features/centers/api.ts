import api from "@utils/api";
import type { Center, CentersQuery, PaginatedCenters } from "./types";

export const CentersAPI = {
  getAll: async (
    query?: CentersQuery,
    signal?: AbortSignal,
  ): Promise<PaginatedCenters> => {
    const res = await api.get("/centers", { params: query, signal });
    return res.data;
  },

  getOptions: async (signal?: AbortSignal): Promise<Center[]> => {
    const res = await api.get("/centers/options", { signal });
    return res.data;
  },

  create: async (data: {
    name: string;
    collectionDay: string;
    address?: string;
    leader?: string;
  }) => {
    const res = await api.post("/centers", data);
    return res.data;
  },

  update: async (
    id: string,
    data: {
      name?: string;
      collectionDay?: string;
      address?: string;
      leader?: string;
    },
  ) => {
    const res = await api.patch(`/centers/${id}`, data);
    return res.data;
  },

  remove: async (id: string) => {
    const res = await api.delete(`/centers/${id}`);
    return res.data;
  },
};
