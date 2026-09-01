import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PathLabApp } from './App'
import '../vendor/learning-path-3d/styles.css'
import './styles.css'

createRoot(document.getElementById('path-lab-root')!).render(
  <StrictMode><PathLabApp /></StrictMode>,
)
