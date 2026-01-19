import React from "react";
import { useAuth } from "../context/AuthContext";

/**
 * Barra superior del panel del Gerente.
 * Muestra:
 * - Botón menú (visible en pantallas pequeñas)
 * - Fecha actual
 * - Usuario logueado
 */
export default function Topbar({ onMenuClick }) {
  const { user } = useAuth();

  // Obtener fecha actual formateada
  const fecha = new Date().toLocaleDateString("es-BO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header
      style={{
        height: "60px",
        background: "#fff",
        borderBottom: "1px solid #eee",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 1rem",
        position: "sticky",
        top: 0,
        zIndex: 15,
      }}
    >
      {/* 🔹 Botón hamburguesa (solo visible en pantallas pequeñas) */}
      <button
        onClick={onMenuClick}
        className="menu-btn"
        style={{
          background: "none",
          border: "none",
          fontSize: 24,
          cursor: "pointer",
          color: "#8b1a16",
        }}
      >
        ☰
      </button>

      {/* 🔹 Fecha actual */}
      <div style={{ fontSize: 15, color: "#444", textTransform: "capitalize" }}>
        {fecha}
      </div>

      {/* 🔹 Usuario logueado */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          background: "#f9f9f9",
          padding: "6px 12px",
          borderRadius: "10px",
          fontSize: 14,
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "#8b1a16",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
          }}
        >
          {user?.nombre ? user.nombre.charAt(0).toUpperCase() : "G"}
        </span>
        <div style={{ textAlign: "left" }}>
          <div style={{ fontWeight: 600, color: "#080808ff" }}>
            {user?.nombre || "Gerente"}
          </div>
          <div style={{ fontSize: 12, color: "#272727ff" }}>{user?.rol}</div>
        </div>
      </div>

      {/* 🔹 Estilos responsivos */}
      <style>
        {`
          @media (min-width: 1024px) {
            .menu-btn {
              display: none;
            }
          }
        `}
      </style>
    </header>
  );
}
