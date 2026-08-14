import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { PermissionsProvider } from './contexts/PermissionsContext';
import { DemoProvider } from './contexts/DemoContext';
import ErrorBoundary from './components/Common/ErrorBoundary';
import App from './App';
import './styles/global.css';

// VitePWA handles SW registration via registerSW.js

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <DemoProvider>
            <ThemeProvider>
              <PermissionsProvider>
                <App />
              </PermissionsProvider>
            </ThemeProvider>
          </DemoProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
