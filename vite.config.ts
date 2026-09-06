import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const rawBasePath = process.env.VITE_BASE_PATH || "/";
const basePath = rawBasePath === "/" ? "/" : `/${rawBasePath.replace(/^\/+|\/+$/g, "")}/`;

export default defineConfig({
  base: basePath,
  plugins: [react()],
});
