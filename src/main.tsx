import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n'
import App from './App.tsx'
import { ErrorBoundary } from '@/components/error-boundary'
import { ShortcutHintsProvider } from '@/components/shortcut-hints'

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <ShortcutHintsProvider>
      <App />
    </ShortcutHintsProvider>
  </ErrorBoundary>,
)
