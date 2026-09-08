import {defineConfig,mergeConfig} from 'vitest/config'
import vite from '../../../vite.config.ts'
export default mergeConfig(vite,defineConfig({test:{
  include:['qa/evidence/project-audit-2026-09-08/*.test.tsx'],environment:'jsdom',
  setupFiles:['tests/ui/setup.ts'],maxWorkers:1,testTimeout:30000,
}}))
