import tseslint from 'typescript-eslint'
import hooks from 'eslint-plugin-react-hooks'
export default [
  {ignores:['dist/**','node_modules/**','src/vendor/**','vendor/**','public/**','server/.data/**','.openai/**']},
  {files:['src/**/*.{ts,tsx}','server/**/*.ts','packages/*/src/**/*.ts'],languageOptions:{parser:tseslint.parser},plugins:{'react-hooks':hooks},rules:{
    'no-debugger':'error','no-unreachable':'error','no-dupe-else-if':'error','no-dupe-args':'error','no-constant-binary-expression':'error','no-unsafe-finally':'error','no-async-promise-executor':'error','no-promise-executor-return':'error','no-eval':'error','no-implied-eval':'error','react-hooks/rules-of-hooks':'error',
  }},
  {files:['tests/**/*.{ts,tsx,mjs}','scripts/**/*.mjs','src/**/*.test.mjs','server/**/*.mjs','packages/**/*.mjs'],languageOptions:{parser:tseslint.parser},rules:{
    'no-debugger':'error','no-unreachable':'error','no-dupe-else-if':'error','no-dupe-args':'error','no-unsafe-finally':'error','no-async-promise-executor':'error',
  }},
]
