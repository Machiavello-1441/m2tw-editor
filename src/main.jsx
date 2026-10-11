import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { hydrateBigFiles } from '@/lib/bigFileStore'

// Restore files loaded on Home before any editor reads them.
hydrateBigFiles().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <App />
  )
})