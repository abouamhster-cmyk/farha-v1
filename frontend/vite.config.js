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
});