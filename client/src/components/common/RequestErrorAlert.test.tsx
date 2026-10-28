import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RequestErrorAlert from "./RequestErrorAlert";

describe("RequestErrorAlert", () => {
  it("renders the user-facing request failure and retries it", () => {
    const onRetry = vi.fn();

    render(
      <RequestErrorAlert
        message="The requested resource was not found."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The requested resource was not found.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
