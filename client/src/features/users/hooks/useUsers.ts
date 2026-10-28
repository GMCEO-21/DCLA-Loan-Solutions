import { useCallback, useEffect, useState } from "react";
import { UsersAPI } from "../api";
import type {
  AdminUser,
  CreateUserPayload,
  UpdateUserPayload,
  CreateUserResponse,
} from "../types";

export function useUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await UsersAPI.list();
      setUsers(data);
    } catch (err) {
      console.error("Failed to fetch users:", err);
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = useCallback(
    async (payload: CreateUserPayload): Promise<CreateUserResponse> => {
      try {
        setLoading(true);
        setError(null);
        const response = await UsersAPI.create(payload);
        await fetchUsers();
        return response;
      } catch (err) {
        setError("Failed to create user.");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [fetchUsers]
  );

  const updateUser = useCallback(
    async (id: string, payload: UpdateUserPayload) => {
      try {
        setLoading(true);
        setError(null);
        const updated = await UsersAPI.update(id, payload);
        setUsers((prev) =>
          prev.map((user) => (user.id === updated.id ? updated : user))
        );
        return updated;
      } catch (err) {
        setError("Failed to update user.");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const updateStatus = useCallback(
    async (id: string, isActive: boolean) => {
      try {
        setLoading(true);
        setError(null);
        const updated = await UsersAPI.updateStatus(id, isActive);
        setUsers((prev) =>
          prev.map((user) => (user.id === updated.id ? updated : user))
        );
        return updated;
      } catch (err) {
        setError("Failed to update user status.");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const resetPassword = useCallback(async (id: string) => {
    try {
      setLoading(true);
      setError(null);
      return await UsersAPI.resetPassword(id);
    } catch (err) {
      setError("Failed to reset password.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    createUser,
    updateUser,
    updateStatus,
    resetPassword,
    refetch: fetchUsers,
  };
}
