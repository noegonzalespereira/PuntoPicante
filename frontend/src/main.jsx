import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter} from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'
import App from './App.jsx'
import { Toaster } from 'sonner';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles/theme.css';
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
    <AuthProvider>
      <App />
      <Toaster position="top-right" richColors closeButton duration={3000} />
    </AuthProvider>
    </HashRouter>
  </StrictMode>,
)
