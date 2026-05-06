import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),

    // VitePWA({
    //   registerType: "autoUpdate",
    //   workbox: {
    //     globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
    //   },
    //   includeAssets: ["favicon.ico", "placeholder.svg"],
    //   manifest: {
    //     name: "PropertyHub Kenya",
    //     short_name: "PropertyHub",
    //     description: "Property management for Kenyan landlords",
    //     theme_color: "#0f4d36",
    //     icons: [
    //       {
    //         src: "/placeholder.svg",
    //         sizes: "192x192",
    //         type: "image/svg+xml",
    //         purpose: "any maskable",
    //       },
    //     ],
    //   },
    // }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
}));
