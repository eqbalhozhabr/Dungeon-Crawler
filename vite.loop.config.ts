import { defineConfig } from 'vite';

// The "Alley Echo" prototype: its own page (loop.html) and its own output folder.
export default defineConfig({
  base: './',
  define: { __TARGET__: JSON.stringify(process.env.VITE_TARGET ?? 'web') },
  build: {
    outDir: process.env.LOOP_OUT ?? 'dist-loop',
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: { input: 'loop.html' },
  },
  server: { open: '/loop.html' },
});
