import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: true, // Listen on all local IPs
  },
  plugins: [
    react(),
    process.env.npm_lifecycle_event !== 'build:web' && electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3'],
              output: {
                manualChunks: {
                  'react-vendor': ['react', 'react-dom', 'react-router-dom'],
                  'ui-vendor': ['framer-motion', 'lucide-react', 'clsx', 'tailwind-merge'],
                  'data-vendor': ['@tanstack/react-query', 'axios', 'dexie', 'dexie-react-hooks', 'date-fns'],
                },
                banner: `
import { createRequire as topLevelCreateRequire } from 'node:module';
import { fileURLToPath as topLevelFileURLToPath } from 'node:url';
import { dirname as topLevelDirname } from 'node:path';
const require = topLevelCreateRequire(import.meta.url);
const __filename = topLevelFileURLToPath(import.meta.url);
const __dirname = topLevelDirname(__filename);
`,
              },
            },
          },
        },
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      // Ployfill the Electron and Node.js API for Renderer process.
      // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer: process.env.NODE_ENV === 'test'
        // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
        ? undefined
        : {},
    }),
  ].filter(Boolean),
})
