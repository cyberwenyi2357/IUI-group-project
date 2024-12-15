import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './components/App.tsx'

import './style/index.css'
import './style/ArrowRectangleNode.css';


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
