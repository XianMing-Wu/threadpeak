/// <reference types="vite/client" />

declare module 'react-markdown' {
  import type { ComponentType, ReactNode } from 'react'
  export type Components = Record<string, ComponentType<{ children?: ReactNode; node?: unknown }>>
  const ReactMarkdown: ComponentType<{ children?: string; remarkPlugins?: unknown[]; components?: Components }>
  export default ReactMarkdown
  export const Markdown: typeof ReactMarkdown
}

declare module '*.svg?url' { const url:string; export default url }
declare module '*.svg?raw' { const markup:string; export default markup }
declare module '*.js?url' { const url:string; export default url }
declare module '*?url' { const url:string; export default url }
declare module '*.css'
