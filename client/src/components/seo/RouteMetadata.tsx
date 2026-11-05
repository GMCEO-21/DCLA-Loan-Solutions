import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_NAME = "DCLA Business Solutions";
const SITE_URL = "https://dclasolutions.com/";
const LOGO_URL = `${SITE_URL}dcla-logo.png`;
const HOME_TITLE =
  "DCLA Business Solutions | Financial Support in Valencia City";
const HOME_DESCRIPTION =
  "DCLA Business Solutions provides accessible financial assistance to women, small entrepreneurs, market vendors, and working individuals in Valencia City, Bukidnon.";
const LOGIN_DESCRIPTION =
  "Sign in to access your DCLA Business Solutions account.";

const protectedPaths = new Set([
  "/dashboard",
  "/member-management",
  "/centers",
  "/collections",
  "/portfolio",
  "/transactions",
  "/admin/users",
  "/approvals",
  "/waivers",
]);

const homeStructuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "FinancialService",
      "@id": `${SITE_URL}#financial-service`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: LOGO_URL,
      description: HOME_DESCRIPTION,
      telephone: "0968 261 8158",
      email: "dclasolutions@gmail.com",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Valencia City",
        addressRegion: "Bukidnon",
        addressCountry: "PH",
      },
      areaServed: "Valencia City, Bukidnon, Philippines",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#website`,
      name: SITE_NAME,
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}#financial-service` },
    },
  ],
};

type RouteMetadataConfig = {
  title: string;
  description?: string;
  robots: "index,follow" | "noindex,nofollow";
  canonical?: string;
  homepage?: boolean;
};

function getRouteMetadata(pathname: string): RouteMetadataConfig {
  if (pathname === "/") {
    return {
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      robots: "index,follow",
      canonical: SITE_URL,
      homepage: true,
    };
  }

  if (pathname === "/login") {
    return {
      title: `Sign In | ${SITE_NAME}`,
      description: LOGIN_DESCRIPTION,
      robots: "noindex,nofollow",
    };
  }

  if (protectedPaths.has(pathname)) {
    return {
      title: `Internal Access | ${SITE_NAME}`,
      robots: "noindex,nofollow",
    };
  }

  return {
    title: `Page Not Found | ${SITE_NAME}`,
    robots: "noindex,nofollow",
  };
}

function setMeta(
  attribute: "name" | "property",
  key: string,
  content?: string,
) {
  const selector = `meta[${attribute}="${key}"]`;
  const existing = document.head.querySelector<HTMLMetaElement>(selector);

  if (!content) {
    existing?.remove();
    return;
  }

  const element = existing ?? document.createElement("meta");
  element.setAttribute(attribute, key);
  element.content = content;
  if (!existing) document.head.appendChild(element);
}

function setCanonical(href?: string) {
  const existing = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]',
  );

  if (!href) {
    existing?.remove();
    return;
  }

  const element = existing ?? document.createElement("link");
  element.rel = "canonical";
  element.href = href;
  if (!existing) document.head.appendChild(element);
}

function setStructuredData(enabled: boolean) {
  const id = "dcla-home-structured-data";
  const existing = document.getElementById(id) as HTMLScriptElement | null;

  if (!enabled) {
    existing?.remove();
    return;
  }

  const element = existing ?? document.createElement("script");
  element.id = id;
  element.type = "application/ld+json";
  element.textContent = JSON.stringify(homeStructuredData);
  if (!existing) document.head.appendChild(element);
}

export default function RouteMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const metadata = getRouteMetadata(pathname);

    document.title = metadata.title;
    setMeta("name", "description", metadata.description);
    setMeta("name", "robots", metadata.robots);
    setCanonical(metadata.canonical);

    setMeta("property", "og:type", metadata.homepage ? "website" : undefined);
    setMeta(
      "property",
      "og:site_name",
      metadata.homepage ? SITE_NAME : undefined,
    );
    setMeta("property", "og:title", metadata.homepage ? HOME_TITLE : undefined);
    setMeta(
      "property",
      "og:description",
      metadata.homepage ? HOME_DESCRIPTION : undefined,
    );
    setMeta("property", "og:url", metadata.homepage ? SITE_URL : undefined);

    setMeta("name", "twitter:card", metadata.homepage ? "summary" : undefined);
    setMeta("name", "twitter:title", metadata.homepage ? HOME_TITLE : undefined);
    setMeta(
      "name",
      "twitter:description",
      metadata.homepage ? HOME_DESCRIPTION : undefined,
    );
    setStructuredData(Boolean(metadata.homepage));
  }, [pathname]);

  return null;
}
