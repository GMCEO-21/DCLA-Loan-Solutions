import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Netlify deployment configuration", () => {
  const configuration = readFileSync(
    resolve(process.cwd(), "..", "netlify.toml"),
    "utf8",
  );

  it("builds and publishes the Vite client", () => {
    expect(configuration).toContain('base = "client"');
    expect(configuration).toContain('command = "npm run build"');
    expect(configuration).toContain('publish = "dist"');
  });

  it.each(["/transactions", "/member-management", "/collections"])(
    "serves the SPA shell for direct route %s",
    () => {
      expect(configuration).toContain('from = "/*"');
      expect(configuration).toContain('to = "/index.html"');
      expect(configuration).toContain("status = 200");
      expect(configuration).toContain("force = false");
    },
  );
});
