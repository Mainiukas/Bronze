import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts (Latin subset only), bundled by Vite: no external requests.
import '@fontsource/barlow-condensed/latin-500.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import '@fontsource/barlow-condensed/latin-800.css'
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-500.css'
import '@fontsource/barlow/latin-600.css'
import App from './App.tsx'
import { preloadBoardImages } from './components/board/assets'
import './index.css'

// Start loading the board's pictures now, so the map board is ready when it opens.
void preloadBoardImages()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
