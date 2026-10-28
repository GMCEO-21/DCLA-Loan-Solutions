import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MemberModal from "./MemberModal";
import type { Member } from "../types";

vi.mock("@mui/icons-material", () => ({
  PersonAdd: () => null,
  Edit: () => null,
  Close: () => null,
}));

vi.mock("@features/centers/api", () => ({
  CentersAPI: { getAll: vi.fn().mockResolvedValue([]) },
}));
const member: Member = {
  id: "fixture",
  firstName: "Maria",
  lastName: "Santos",
  middleName: "Reyes",
  contactNumber: "09171234567",
  address: "Davao City",
  birthDate: new Date(1990, 0, 1),
  center: { id: "center-fixture", name: "Center One", collectionDay: "Friday" },
};

describe("Member dialog presentation", () => {
  it("submits the unchanged form through the separate footer", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <MemberModal
        open
        member={member}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    const button = screen.getByRole("button", { name: "Update" });
    expect(button).toHaveAttribute("form", "member-form");
    fireEvent.click(button);
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit).toHaveBeenCalledWith({
      firstName: member.firstName,
      lastName: member.lastName,
      middleName: member.middleName,
      contactNumber: member.contactNumber,
      address: member.address,
      birthDate: member.birthDate,
      centerId: member.center!.id,
    });
  });
  it("preserves the loading close and submit guards", () => {
    const onClose = vi.fn();
    render(
      <MemberModal
        open
        loading
        member={member}
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Close member form" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
