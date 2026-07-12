import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Absolute base: required for BrowserRouter so assets load on nested routes
  // (e.g. /mes-reservations). Served at the domain root on Vercel/Netlify.
  base: "/",
  server: { port: 5173, host: "127.0.0.1" },
  preview: { port: 8090, host: "127.0.0.1" },
});
