import { defineConfig } from 'vite';

// The "Gullet Salvage" prototype: its own page (salvage.html) and its own output folder.
export default defineConfig({
  base: './',
  define: { __TARGET__: JSON.stringify(process.env.VITE_TARGET ?? 'web') },
  build: {
    outDir: 'dist-salvage',
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
    rollupOptions: { input: 'salvage.html' },
  },
  server: { open: '/salvage.html' },
});
