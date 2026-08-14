import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    watch: {
      ignored: ["**/public/audios/**"], // Ignore les fichiers MP3 lourds pour éviter le verrouillage OneDrive
    },
  },
  build: {
    // Separe les librairies tierces en chunks stables et mis en cache
    // longtemps par le navigateur (ne changent pas a chaque deploiement).
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react-router")) return "router";
            if (id.includes("@supabase")) return "supabase";
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("react")) return "react";
            return "vendor";
          }
        },
      },
    },
  },
});