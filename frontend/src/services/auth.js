import api from './api';
import { jwtDecode } from 'jwt-decode';


 
export async function loginRequest(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}

export async function fetchProfile() {
  const { data } = await api.get('/auth/me');
  return data;
}

export function decodeToken(token) {
  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
}
