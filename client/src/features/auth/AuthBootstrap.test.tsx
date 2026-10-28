import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../../types/auth";
import AuthBootstrap from "./AuthBootstrap";
import { authService } from "./api";
import { useAuthStore } from "./authStore";

vi.mock("./api", () => ({
  authService: {
    getProfile: vi.fn(),
    changePassword: vi.fn(),
  },
}));

const profile: User = {
  id: "user-a",
  email: "user@example.com",
  role: "manager",
  mustChangePassword: false,
};

describe("AuthBootstrap", () => {
  beforeEach(() => {
    vi.mocked(authService.getProfile).mockReset();
    vi.mocked(authService.changePassword).mockReset();
    useAuthStore.setState({
      user: profile,
      token: "access-token",
      refreshToken: "refresh-token",
      isAuthenticated: false,
      isInitialized: false,
    });
  });

  it("does not render protected content before profile verification", async () => {
    let resolveProfile!: (value: User) => void;
    vi.mocked(authService.getProfile).mockReturnValue(
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
    );

    render(
      <AuthBootstrap>
        <div>Protected content</div>
      </AuthBootstrap>,
    );

    expect(screen.queryByText("Protected content")).not.toBeInTheDocument();
    await act(async () => resolveProfile(profile));
    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it("clears a session when startup verification fails", async () => {
    vi.mocked(authService.getProfile).mockRejectedValue(new Error("invalid"));

    render(
      <AuthBootstrap>
        <div>Router</div>
      </AuthBootstrap>,
    );

    await waitFor(() => expect(useAuthStore.getState().token).toBeNull());
    expect(useAuthStore.getState().isInitialized).toBe(true);
  });

  it("keeps the requirement visible and restores normal access after password change", async () => {
    const temporaryProfile = { ...profile, mustChangePassword: true };
    useAuthStore.setState({ user: temporaryProfile });
    vi.mocked(authService.getProfile).mockResolvedValue(temporaryProfile);
    vi.mocked(authService.changePassword).mockResolvedValue({
      message: "Password changed successfully",
      user: profile,
    });

    render(
      <AuthBootstrap>
        <div>Router</div>
      </AuthBootstrap>,
    );

    expect(
      await screen.findByRole("heading", { name: "Change Temporary Password" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Current Password"), {
      target: { value: "temporary-password" },
    });
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "new-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), {
      target: { value: "new-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Change Temporary Password" }),
      ).not.toBeInTheDocument(),
    );
    expect(authService.changePassword).toHaveBeenCalledWith({
      currentPassword: "temporary-password",
      newPassword: "new-password",
    });
  });
});
