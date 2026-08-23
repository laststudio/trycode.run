import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { App } from './App';
import { AuthProvider } from './hooks/useAuth';
import { ThemeProvider } from './hooks/useTheme';
import { I18nProvider } from './i18n';
import { Toaster } from './components/ui/Toaster';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <I18nProvider>
          <ThemeProvider>
            <AuthProvider>
              <App />
              <Toaster />
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </BrowserRouter>
    </HelmetProvider>
  </React.StrictMode>
);
