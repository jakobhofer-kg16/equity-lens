import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Relative base so a production build also works under a GitHub Pages
// project subpath like https://<user>.github.io/<repo>/.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 3200 }
});
