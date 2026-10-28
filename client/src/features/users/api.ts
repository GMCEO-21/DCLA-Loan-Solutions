import api from "@utils/api";
import type {
  AdminUser,
  CreateUserPayload,
  CreateUserResponse,
  UpdateUserPayload,
} from "./types";

export const UsersAPI = {
  list: async (): Promise<AdminUser[]> => {
    const res = await api.get("/users");
    return res.data;
  },
  create: async (payload: CreateUserPayload): Promise<CreateUserResponse> => {
    const res = await api.post("/users", payload);
    return res.data;
  },
  update: async (id: string, payload: UpdateUserPayload): Promise<AdminUser> => {
    const res = await api.patch(`/users/${id}`, payload);
    return res.data;
  },
  updateStatus: async (id: string, isActive: boolean): Promise<AdminUser> => {
    const res = await api.patch(`/users/${id}/status`, { isActive });
    return res.data;
  },
  resetPassword: async (id: string): Promise<{ tempPassword: string }> => {
    const res = await api.post(`/users/${id}/reset-password`);
    return res.data;
  },
};
