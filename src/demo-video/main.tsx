import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import {DemoVideo} from './DemoVideo'
import './video.css'

createRoot(document.getElementById('root')!).render(<StrictMode><DemoVideo/></StrictMode>)
