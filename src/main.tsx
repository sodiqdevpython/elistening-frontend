import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { LangProvider } from './i18n'
import { ThemeProvider } from './theme/ThemeProvider'
import './styles/global.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LangProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </LangProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
