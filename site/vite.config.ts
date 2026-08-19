import { defineConfig } from 'vite';

// Deployed under /<repo-name>/ on GitHub Pages; override via VITE_BASE if needed.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/deer-isle-quest/',
  build: {
    outDir: 'dist',
  },
});
