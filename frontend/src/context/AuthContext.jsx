import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loginRequest, fetchProfile, decodeToken } from '../services/auth';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (token && !user) {
        try {
          const profile = await fetchProfile();
          setUser(profile);
          localStorage.setItem('user', JSON.stringify(profile));
        } catch {
          // token inválido
          logout();
        }
      }
    })();
  }, [token]);

  async function login(email, password) {
    setLoading(true);
    try {
      const data = await loginRequest(email, password);

      const access = data.access_token || data.token || null;
      if (!access) throw new Error('Token no recibido');

      localStorage.setItem('token', access);
      setToken(access);

      let u = data.user || null;
      if (!u) {
        try {
          u = await fetchProfile();
        } catch {
          const decoded = decodeToken(access);
          if (decoded) {
            u = {
              id: decoded.sub || decoded.id,
              email: decoded.email,
              nombre: decoded.nombre,
              rol: decoded.rol,
            };
          }
        }
      }
      if (!u) throw new Error('No se pudo obtener el usuario');

      setUser(u);
      localStorage.setItem('user', JSON.stringify(u));

      // Redirige según rol
      if (u.rol === 'GERENTE') navigate('/gerente/dashboard', { replace: true });
      else if (u.rol === 'CAJERO') navigate('/cajero/dashboard', { replace: true });
      else if (u.rol === 'COCINA') navigate('/cocina', { replace: true });
      else if (u.rol === 'MESERO') navigate('/mesero', { replace: true });
      else throw new Error('Rol no reconocido');
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    navigate('/login', { replace: true });
  }

  const value = useMemo(() => ({
    token,
    user,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    logout,
  }), [token, user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
