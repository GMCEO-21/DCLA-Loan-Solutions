import api from "@utils/api";
import type { MemberFormData, MembersQuery, PaginatedMembers } from "./types";

export const MembersAPI = {
  getAll: async (
    query?: MembersQuery,
    signal?: AbortSignal,
  ): Promise<PaginatedMembers> => {
    const res = await api.get("/members", { params: query, signal });
    return res.data;
  },

  create: async (data: MemberFormData) => {
    const response = await api.post("/members/", data);
    return response.data;
  },

  update: async (id: string, data: MemberFormData) => {
    console.log("ID: ", id);
    console.log("Data: ", data);

    const response = await api.put(`/members/${id}`, data);
    return response.data;
  },

  remove: async (id: string) => {
    console.log("Deleting member with ID:", id);

    const response = await api.delete(`/members/${id}`);
    return response.data;
  },
};
