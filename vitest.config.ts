import {mergeConfig,defineConfig} from 'vitest/config'
import vite from './vite.config.ts'
export default mergeConfig(vite,defineConfig({test:{include:['tests/ui/**/*.test.tsx'],environment:'jsdom',setupFiles:['tests/ui/setup.ts'],maxWorkers:1,testTimeout:30000,coverage:{provider:'v8',include:['src/**/*.{ts,tsx}'],exclude:['src/vendor/**','src/**/*.test.*','packages/**','server/**','tests/**'],excludeAfterRemap:true,reporter:['text','json-summary','html'],reportsDirectory:'coverage/frontend'}}}))
