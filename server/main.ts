import { startProductServer } from './durable/bootstrap.ts'

try { await startProductServer() } catch (error) {
  const known=new Set(['PRODUCTION_CONFIG_REQUIRED','MODEL_CONTEXT_CONFIG_INVALID','LOGIN_URL_MUST_BE_HTTPS','DATABASE_START_FAILED'])
  process.stderr.write(JSON.stringify({event:'server.start_failed',code:error instanceof Error&&known.has(error.message)?error.message:'SERVER_START_FAILED'})+'\n')
  process.exitCode=1
}
