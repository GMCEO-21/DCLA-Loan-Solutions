import path from "path";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolveApiBaseUrl } from "./src/config/resolve-api-url";

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), "");
  resolveApiBaseUrl(environment.VITE_API_URL, mode === "production");

  return {
    plugins: [
      react(),
      tsconfigPaths({
        projects: ["./tsconfig.app.json"],
      }),
    ],
    resolve: {
      alias: {
        "@components": path.resolve(__dirname, "src/components"),
        "@features": path.resolve(__dirname, "src/features"),
        "@hooks": path.resolve(__dirname, "src/hooks"),
        "@routes": path.resolve(__dirname, "src/routes"),
        "@types": path.resolve(__dirname, "src/types"),
        "@utils": path.resolve(__dirname, "src/utils"),
      },
    },
  };
});
