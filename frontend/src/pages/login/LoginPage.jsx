import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BsLock, BsEnvelope } from 'react-icons/bs'; 
import { Button, Form } from 'react-bootstrap'; 

import logo from '../../assets/logo.jpg'; 
import '../../styles/LoginPage.css'

export default function LoginPage() {
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setErr('');
    try {
      await login(email, password);
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Error de login');
    }
  }

  return (
    <div className="login-container">
      <div className="text-center">
        <img src={logo} alt="Logo" className="logo" />
        <h1>Iniciar Sesión</h1>
      </div>

      {/* Mostrar error si existe */}
      {err && (
        <div style={{ 
          color: 'var(--rojo)', 
          background: 'rgba(183, 28, 28, 0.1)', 
          border: '1px solid var(--rojo)', 
          padding: '8px', 
          borderRadius: '8px', 
          marginBottom: '10px' 
        }}>
          {err}
        </div>
      )}

      {/* Formulario */}
      <Form onSubmit={onSubmit}>
        <Form.Group controlId="email">
          <Form.Label>Correo</Form.Label>
          <div className="input-group">
            <span className="input-group-text"><BsEnvelope /></span>
            <Form.Control
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="correo@ejemplo.com"
            />
          </div>
        </Form.Group>

        <Form.Group controlId="password">
          <Form.Label>Contraseña</Form.Label>
          <div className="input-group">
            <span className="input-group-text"><BsLock /></span>
            <Form.Control
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
            />
          </div>
        </Form.Group>

        <Button
          disabled={loading}
          type="submit"
          className="mt-3"
          style={{
            backgroundColor: 'var(--rojo)', 
            borderColor: 'var(--rojo)', 
            fontWeight: 700
          }}
        >
          {loading ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </Form>

      <div className="text-center mt-3">
        <small>
          ¿No tienes cuenta? 
          <a href="/register" style={{ color: 'var(--rojo)' }}>Regístrate aquí</a>
        </small>
      </div>
    </div>
  );
}
