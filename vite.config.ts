import { defineConfig } from 'vite';

// One code base, two builds: the normal web build and the CrazyGames portal build.
// VITE_TARGET=crazygames switches IS_PORTAL on (see src/target.ts) and uses its own output folder.
const target = process.env.VITE_TARGET ?? 'web';

export default defineConfig({
  base: './', // relative paths only (CrazyGames requirement)
  define: {
    __TARGET__: JSON.stringify(target),
  },
  build: {
    outDir: target === 'web' ? 'dist' : `dist-${target}`,
    emptyOutDir: true,
    chunkSizeWarningLimit: 2000,
    assetsInlineLimit: 0,
  },
});
