import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ScopeProvider } from './contexts/ScopeContext';
import { AuthProvider } from './contexts/AuthContext';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ScopeProvider>
          <App />
        </ScopeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
