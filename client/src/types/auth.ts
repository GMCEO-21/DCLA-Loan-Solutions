export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  mustChangePassword?: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setInitialized: (isInitialized: boolean) => void;
  setSession: (token: string, refreshToken: string, user: User) => void;
  setRefreshedSession: (
    token: string,
    refreshToken: string,
    user: User,
  ) => void;
  setUser: (user: User) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}
