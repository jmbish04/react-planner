import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

// The chat sidebar is a standalone React 18 bundle that mounts into #sidebar
// of the react-planner (React 16) page. It is emitted into the shared assets
// dir (../dist/chat) with stable filenames so the webpack-built index.html can
// reference /chat/chat.js + /chat/chat.css.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: resolve(__dirname, '../dist/chat'),
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/main.tsx'),
      formats: ['es'],
      fileName: () => 'chat.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: (asset) =>
          asset.name && asset.name.endsWith('.css') ? 'chat.css' : '[name][extname]',
      },
    },
  },
});
