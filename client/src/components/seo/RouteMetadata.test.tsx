import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import RouteMetadata from "./RouteMetadata";

function renderMetadata(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RouteMetadata />
    </MemoryRouter>,
  );
}

describe("RouteMetadata", () => {
  it("uses public, indexable metadata only for the homepage", async () => {
    renderMetadata("/");

    await waitFor(() =>
      expect(document.title).toBe(
        "DCLA Business Solutions | Financial Support in Valencia City",
      ),
    );
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      "content",
      expect.stringContaining("Valencia City, Bukidnon"),
    );
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      "content",
      "index,follow",
    );
    expect(document.querySelector('meta[property="og:type"]')).toHaveAttribute(
      "content",
      "website",
    );
    expect(
      document.querySelector('meta[property="og:site_name"]'),
    ).toHaveAttribute("content", "DCLA Business Solutions");
    expect(document.querySelector('meta[name="twitter:card"]')).toHaveAttribute(
      "content",
      "summary",
    );

    const structuredData = JSON.parse(
      document.getElementById("dcla-home-structured-data")?.textContent ?? "{}",
    ) as { "@graph"?: Array<{ "@type": string }> };
    expect(structuredData["@graph"]?.map((entry) => entry["@type"])).toEqual([
      "FinancialService",
      "WebSite",
    ]);
  });

  it.each(["/dashboard", "/collections", "/admin/users"])(
    "marks internal route %s as noindex without public metadata",
    async (path) => {
      renderMetadata(path);

      await waitFor(() =>
        expect(document.title).toBe("Internal Access | DCLA Business Solutions"),
      );
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex,nofollow",
      );
      expect(document.querySelector('link[rel="canonical"]')).toBeNull();
      expect(document.querySelector('meta[property="og:title"]')).toBeNull();
      expect(document.getElementById("dcla-home-structured-data")).toBeNull();
    },
  );

  it("uses dedicated noindex metadata for Login", async () => {
    renderMetadata("/login");

    await waitFor(() =>
      expect(document.title).toBe("Sign In | DCLA Business Solutions"),
    );
    expect(document.querySelector('meta[name="description"]')).toHaveAttribute(
      "content",
      "Sign in to access your DCLA Business Solutions account.",
    );
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex,nofollow",
    );
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it("uses noindex metadata for unknown paths", async () => {
    renderMetadata("/missing-page");

    await waitFor(() =>
      expect(document.title).toBe("Page Not Found | DCLA Business Solutions"),
    );
    expect(document.querySelector('meta[name="description"]')).toBeNull();
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex,nofollow",
    );
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
  });
});
