import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PathLabApp } from './App'
import { createPathLabSession } from './path-lab-session'
import '../vendor/learning-path-3d/styles.css'
import './styles.css'

const session = createPathLabSession({
  fetch: (input, init) => fetch(input, init),
  now: () => performance.now(),
})

createRoot(document.getElementById('path-lab-root')!).render(
  <StrictMode><PathLabApp session={session} /></StrictMode>,
)
