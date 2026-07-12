import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative asset paths → works from any host, subpath, or a single file.
  base: "./",
  server: { port: 5173, host: "127.0.0.1" },
  preview: { port: 8090, host: "127.0.0.1" },
});
