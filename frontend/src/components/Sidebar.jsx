import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  BsSpeedometer2,
  BsCashStack,
  BsCartCheck,
  BsEggFried,
  BsBoxes,
  BsBasket,
  BsBarChart,
  BsCashCoin,
  BsJournalText,
  BsPeople,
  BsBoxArrowRight,
} from "react-icons/bs";

import logo from '../assets/logo.jpg'

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();

  const menu = [
    { label: "Dashboard", path: "/gerente/dashboard", icon: <BsSpeedometer2 /> },
    { label: "Caja", path: "/gerente/caja", icon: <BsCashStack /> },
    { label: "Pedidos", path: "/gerente/pedidos", icon: <BsCartCheck /> },
    { label: "Cocina", path: "/gerente/cocina", icon: <BsEggFried /> },
    { label: "Inventario", path: "/gerente/inventario", icon: <BsBoxes /> },
    { label: "Productos", path: "/gerente/productos", icon: <BsBasket /> },
    { label: "Reportes", path: "/gerente/reportes", icon: <BsBarChart /> },
    { label: "Gastos", path: "/gerente/gastos", icon: <BsCashCoin /> },
    { label: "Usuarios", path: "/gerente/usuarios", icon: <BsPeople /> },
  ];

  const activeColor = "#8b1a16";

  return (
    <>
      {/* Overlay en móvil */}
      {isOpen && (
        <div
          onClick={onClose}
          className="d-lg-none position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50"
          style={{ zIndex: 1030 }}
        />
      )}

      {/* Sidebar */}
      <aside
        className="bg-white border-end d-flex flex-column justify-content-between"
        style={{
          position: "fixed",
          top: 0,
          left: isOpen ? 0 : -250,
          width: 250,
          height: "100vh",
          transition: "left .25s ease",
          zIndex: 1031,
        }}
      >
        {/* Logo y nombre */}
        <div className="text-center px-3 pt-3">
          <img
            src={logo}
            alt="Logo"
            style={{ width: 60, height: 60, objectFit: "contain" }}
            className="mb-2"
          />
          <h5 className="m-0" style={{ color: activeColor }}>El Punto Picante</h5>
          <small className="text-muted">Sistema POS</small>
        </div>

        {/* Menú */}
        <nav className="mt-3 px-2 flex-grow-1 overflow-auto">
          {menu.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end
              onClick={onClose}
              className={({ isActive }) =>
                [
                  "d-flex align-items-center rounded px-3 py-2 mb-1 text-decoration-none",
                  isActive ? "fw-semibold" : "",
                ].join(" ")
              }
              style={({ isActive }) => ({
                color: isActive ? activeColor : "#333",
                background: isActive ? "#fbe9e7" : "transparent",
              })}
            >
              <span className="me-2 fs-5">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Usuario y logout */}
        <div className="border-top p-3 bg-white">
          <div className="bg-light rounded p-2 text-center mb-2">
            <strong>{user?.nombre || "Gerente"}</strong>
            <div className="small text-muted">{user?.rol}</div>
          </div>
          <button
            onClick={logout}
            className="btn w-100 text-white"
            style={{ backgroundColor: activeColor }}
          >
            <BsBoxArrowRight className="me-2" />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
