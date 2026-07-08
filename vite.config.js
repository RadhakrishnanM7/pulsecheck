import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes all asset paths relative, so the built site works on
// Netlify, Vercel, Cloudflare Pages, Surge, AND GitHub Pages project subpaths
// (e.g. https://user.github.io/pulsecheck/) with no extra config.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
