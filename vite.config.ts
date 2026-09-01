import { defineConfig } from '../../zhihu_thread_chatbot/node_modules/vite/dist/node/index.js'
import react from '../../zhihu_thread_chatbot/node_modules/@vitejs/plugin-react/dist/index.js'
import { fileURLToPath, URL } from 'node:url'

const oldProject = fileURLToPath(new URL('../../zhihu_thread_chatbot/', import.meta.url))
const oldModules = fileURLToPath(new URL('../../zhihu_thread_chatbot/node_modules/', import.meta.url))
const chartsRoot = fileURLToPath(new URL('../../交互图/', import.meta.url))
const localRuntime = fileURLToPath(new URL('./src/vendor/learning-path-3d/index.js', import.meta.url))
const mainEntry = fileURLToPath(new URL('./index.html', import.meta.url))
const pathLabEntry = fileURLToPath(new URL('./path-lab.html', import.meta.url))

export default defineConfig({
  plugins: [react()],
  publicDir: `${oldProject}/public`,
  resolve: {
    alias: {
      react: `${oldModules}/react`,
      'react-dom': `${oldModules}/react-dom`,
      'react-dom/client': `${oldModules}/react-dom/client.js`,
      'react/jsx-runtime': `${oldModules}/react/jsx-runtime.js`,
      'liu-kanshan-learning-path-3d': localRuntime,
      'react-markdown': `${oldModules}/react-markdown`,
      'remark-gfm': `${oldModules}/remark-gfm`,
      'remark-math': `${oldModules}/remark-math`,
      katex: `${oldModules}/katex`,
      'katex/dist/katex.min.css': `${oldModules}/katex/dist/katex.min.css`,
      'organic-mindmap': `${chartsRoot}organic-mindmap`,
      'sunburst-chart': `${chartsRoot}sunburst-chart/src`,
      'wine-timeline': `${chartsRoot}wine-timeline-replica`,
    },
  },
  server: {
    fs: { allow: ['..', oldProject, chartsRoot] },
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
