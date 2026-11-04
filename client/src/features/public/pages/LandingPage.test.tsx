import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { ThemeProvider } from "@mui/material/styles";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { theme } from "../../../theme/theme";
import LandingPage from "./LandingPage";

class MockPreloadImage {
  decoding = "auto";
  onerror: (() => void) | null = null;
  onload: (() => void) | null = null;

  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }

  decode() {
    return Promise.resolve();
  }

  setAttribute() {}
}

function renderLandingPage() {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    </ThemeProvider>,
  );
}

describe("LandingPage", () => {
  beforeEach(() => {
    vi.stubGlobal("Image", MockPreloadImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the public landing page with its required sections", () => {
    const { container } = renderLandingPage();

    expect(
      screen.getByRole("heading", {
        name: "Financial support for women and growing businesses.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("About DCLA")).toBeInTheDocument();
    expect(screen.getByText("DCLA Activities")).toBeInTheDocument();
    expect(container).toHaveTextContent("DCLA Business Solutions");
    expect(
      screen.getByRole("heading", { name: "Frequently asked questions." }),
    ).toBeInTheDocument();
  }, 15_000);

  it("renders the pooled activities gallery between About and Loan Services", async () => {
    renderLandingPage();

    const gallery = screen.getByRole("region", {
      name: "DCLA activities photo gallery",
    });
    const activitiesSection = screen
      .getByRole("heading", {
        name: "Supporting businesses and communities beyond lending.",
      })
      .closest("section");
    const aboutSection = screen.getByText("About DCLA").closest("section");
    const loanServicesSection = screen
      .getByRole("heading", { name: "Support for the needs that matter." })
      .closest("section");

    if (!aboutSection || !activitiesSection || !loanServicesSection) {
      throw new Error("Expected landing-page sections were not rendered");
    }

    await waitFor(() => {
      expect(gallery.querySelectorAll("img")).toHaveLength(10);
    });

    const galleryImages = within(gallery).getAllByRole("img");
    const visibleSources = galleryImages.map((image) =>
      image.getAttribute("src"),
    );

    expect(gallery).toHaveAttribute("data-visible-slot-count", "10");
    expect(gallery).toHaveAttribute("data-ready-buffer-target", "4");
    expect(gallery).toHaveAttribute("data-ready-count", "4");
    expect(gallery.querySelectorAll("[data-activity-slot]")).toHaveLength(10);
    expect(new Set(visibleSources)).toHaveProperty("size", 10);
    galleryImages.forEach((image) => {
      expect(image).not.toHaveAttribute("loading");
      expect(image).toHaveAttribute("decoding", "async");
      expect(image).toHaveAttribute("width", "780");
      expect(image).toHaveAttribute("height", "585");
      expect(image).toHaveAttribute("alt", expect.not.stringMatching(/^$/));
      expect(image.parentElement).toHaveAttribute("data-loaded", "false");
    });
    expect(
      aboutSection.compareDocumentPosition(activitiesSection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      activitiesSection.compareDocumentPosition(loanServicesSection) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("uses the approved login and contact destinations", () => {
    renderLandingPage();

    expect(screen.getByRole("banner")).toHaveClass("MuiAppBar-positionSticky");
    expect(screen.getAllByRole("link", { name: "Login" })[0]).toHaveAttribute(
      "href",
      "/login",
    );
    screen.getAllByRole("link", { name: "Contact DCLA" }).forEach((link) => {
      expect(link).toHaveAttribute("href", "#contact");
    });
  });

  it("uses the approved hero image and Valencia City content", () => {
    const { container } = renderLandingPage();

    expect(
      screen.getByRole("img", {
        name: "Women reviewing business documents at a neighborhood shop",
      }),
    ).toHaveAttribute("src", expect.stringContaining("hero-image.png"));
    expect(screen.getByText("Serving Valencia City, Bukidnon")).toBeVisible();
    expect(container).not.toHaveTextContent(/Cebu/i);
    expect(container).not.toHaveTextContent(/Malaybalay/i);
  });

  it("uses same-page hashes for primary navigation", () => {
    renderLandingPage();

    const navigation = screen.getByRole("navigation", { name: "Landing page" });
    expect(
      within(navigation).getByRole("link", { name: "Home" }),
    ).toHaveAttribute("href", "#home");
    expect(
      within(navigation).getByRole("link", { name: "About" }),
    ).toHaveAttribute("href", "#about");
    expect(
      within(navigation).getByRole("link", { name: "Loans" }),
    ).toHaveAttribute("href", "#loans");
    expect(
      within(navigation).getByRole("link", { name: "How It Works" }),
    ).toHaveAttribute("href", "#how-it-works");
    expect(
      within(navigation).getByRole("link", { name: "FAQ" }),
    ).toHaveAttribute("href", "#faq");
    expect(
      within(navigation).getByRole("link", { name: "Contact" }),
    ).toHaveAttribute("href", "#contact");
    expect(navigation).toBeInTheDocument();
  });

  it("keeps the mobile drawer navigation and actions accessible", () => {
    renderLandingPage();

    fireEvent.click(
      screen.getByRole("button", { name: "Open landing page navigation" }),
    );

    const mobileNavigation = screen.getByRole("navigation", {
      name: "Landing page mobile",
    });
    expect(
      within(mobileNavigation).getByRole("link", { name: "About" }),
    ).toHaveAttribute("href", "#about");
    expect(
      screen.getByRole("button", { name: "Close landing page navigation" }),
    ).toBeVisible();
    expect(
      screen
        .getAllByRole("link", { name: "Contact DCLA" })
        .some((link) => link.getAttribute("href") === "#contact"),
    ).toBe(true);
  });

  it("supports manual hero benefit navigation", () => {
    renderLandingPage();

    expect(screen.getByText("Clear conversations")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next benefit" }));
    expect(
      within(
        screen.getByRole("complementary", {
          name: "DCLA lending benefits",
        }),
      ).getByText("Simple process"),
    ).toBeInTheDocument();
  });

  it("renders the editorial About content and informational steps", () => {
    renderLandingPage();

    expect(
      screen.queryByRole("list", { name: "DCLA company highlights" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Company Background" }),
    ).toBeVisible();
    expect(
      screen.getByText(/began its lending operations in 2024/i),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Our Mission" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Our Vision" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Core Values" })).toBeVisible();
    ["Trust", "Transparency", "Accountability", "Empowerment"].forEach(
      (value) => expect(screen.getByText(value)).toBeVisible(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Show step 3: Approval" }),
    );
    expect(screen.getByRole("heading", { name: "Approval" })).toBeVisible();
  });

  it("shows confirmed contact details without placeholders or a form", () => {
    const { container } = renderLandingPage();

    screen.getAllByRole("link", { name: "0968 261 8158" }).forEach((link) => {
      expect(link).toHaveAttribute("href", "tel:09682618158");
    });
    screen
      .getAllByRole("link", { name: "dclasolutions@gmail.com" })
      .forEach((link) => {
        expect(link).toHaveAttribute("href", "mailto:dclasolutions@gmail.com");
      });
    expect(
      screen.getAllByText("Valencia City, Bukidnon, Philippines"),
    ).not.toHaveLength(0);
    expect(
      screen.getAllByText("Bagontaas, Valencia City, Bukidnon", {
        exact: false,
      }),
    ).not.toHaveLength(0);
    expect(container).not.toHaveTextContent(/placeholder|office hours/i);
    expect(
      screen.queryByRole("form", { name: "Inquiry form" }),
    ).not.toBeInTheDocument();
  });

  it("uses the confirmed loan-service categories and no inquiry form", () => {
    renderLandingPage();

    [
      "Business Capital",
      "Livelihood Support",
      "Working Capital",
      "Personal Financial Needs",
      "Other Eligible Needs",
    ].forEach((service) => {
      expect(screen.getByRole("heading", { name: service })).toBeVisible();
    });
    expect(
      screen.queryByRole("form", { name: "Inquiry form" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Full Name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Loan Purpose")).not.toBeInTheDocument();
  });

  it("expands and collapses FAQ answers", () => {
    renderLandingPage();
    const question = screen.getByRole("button", {
      name: "Who can apply for a loan?",
    });

    expect(question).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(question);
    expect(question).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(/^Women, small entrepreneurs, market vendors/i),
    ).toBeVisible();
  });
});
