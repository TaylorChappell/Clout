import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset URLs make the same build work on both:
  //   https://username.github.io/repository/
  // and a custom GitHub Pages domain.
  base: "./",
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    sourcemap: true,
  },
});
