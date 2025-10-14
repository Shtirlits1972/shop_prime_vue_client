import { rmSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const wwwrootDir = fileURLToPath(new URL('../ShopPrimeVueServerAPI/wwwroot', import.meta.url))

function cleanOutDirPreservingImages(outDir: string): Plugin {
  return {
    name: 'clean-outdir-preserve-images',
    apply: 'build',
    buildStart() {
      if (!existsSync(outDir)) {
        return
      }

      for (const entry of readdirSync(outDir, { withFileTypes: true })) {
        if (entry.name === 'images') {
          continue
        }

        rmSync(join(outDir, entry.name), { recursive: true, force: true })
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    cleanOutDirPreservingImages(wwwrootDir),
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    outDir: wwwrootDir,
    emptyOutDir: false,
  },
})
