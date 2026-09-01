import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const localRuntime = fileURLToPath(new URL('./src/vendor/learning-path-3d/index.js', import.meta.url))
const chartsRoot = fileURLToPath(new URL('./vendor/charts/', import.meta.url))
const mainEntry = fileURLToPath(new URL('./index.html', import.meta.url))
const pathLabEntry = fileURLToPath(new URL('./path-lab.html', import.meta.url))

export default defineConfig({
  plugins: [react()],
  publicDir: 'public',
  resolve: {
    alias: {
      'liu-kanshan-learning-path-3d': localRuntime,
      'organic-mindmap': `${chartsRoot}organic-mindmap`,
      'sunburst-chart': `${chartsRoot}sunburst-chart`,
      'wine-timeline': `${chartsRoot}wine-timeline`,
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4312',
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: mainEntry,
        pathLab: pathLabEntry,
      },
    },
  },
})
