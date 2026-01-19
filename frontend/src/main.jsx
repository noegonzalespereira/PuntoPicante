import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// import { BrowserRouter } from 'react-router-dom'
import { HashRouter} from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'  
// import './index.css'
import App from './App.jsx'
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
    </HashRouter>
  </StrictMode>,
)
