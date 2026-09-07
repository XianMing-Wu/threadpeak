import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
import { App } from './App'
import './styles.css'
import './input-motion.css'
import './ui/flowith-home.css'
import './ui/flowith-market.css'
import './ui/composer-beam.css'
import './ui/flowith-product.css'

function syncAppFrame() {
  const inner = window.innerHeight
  const visual = window.visualViewport?.height ?? inner
  const client = document.documentElement.clientHeight || inner
  const outer = window.outerHeight
  let frame = Math.min(inner, visual, client)
  if (outer > 0 && outer < frame) frame = outer
  document.documentElement.style.setProperty('--app-h', `${Math.round(frame)}px`)
}
syncAppFrame()
addEventListener('resize', syncAppFrame)
window.visualViewport?.addEventListener('resize', syncAppFrame)
window.visualViewport?.addEventListener('scroll', syncAppFrame)

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>)
