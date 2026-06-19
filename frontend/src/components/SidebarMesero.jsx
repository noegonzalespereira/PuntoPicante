import React from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BsClipboardCheck } from "react-icons/bs";
import logo from '../assets/logo.jpg';

export default function SidebarMesero({ isOpen, onClose }) {
  const { user, logout } = useAuth();

  const menu = [
    { label: "Pedidos", path: "/mesero", icon: <BsClipboardCheck size={18} /> },
  ];

  return (
    <>
      <div
        onClick={onClose}
        className="position-fixed top-0 start-0 w-100 h-100 bg-dark bg-opacity-50 d-lg-none"
        style={{ zIndex: 1040, display: isOpen ? "block" : "none" }}
      />

      <aside
        className="bg-light border-end vh-100 position-fixed top-0 start-0 d-flex flex-column shadow-sm"
        style={{
          width: 250,
          zIndex: 1045,
          transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform .3s ease",
        }}
      >
        <div className="text-center p-3 border-bottom">
          <img
            src={logo}
            alt="Logo"
            className="img-fluid mb-2"
            style={{ width: 60, height: 60, objectFit: "contain" }}
          />
          <h5 className="mb-0" style={{ color: "#8b1a16" }}>El Punto Picante</h5>
          <small className="text-muted">Módulo Mesero</small>
        </div>

        <nav className="flex-grow-1 p-2">
          <ul className="nav nav-pills flex-column gap-1">
            {menu.map((item) => (
              <li className="nav-item" key={item.path}>
                <NavLink
                  to={item.path}
                  end
                  onClick={onClose}
                  className={({ isActive }) =>
                    `nav-link d-flex align-items-center gap-2 px-3 py-2 ${
                      isActive
                        ? "text-danger-emphasis bg-danger-subtle fw-semibold"
                        : "text-dark"
                    }`
                  }
                >
                  <span className="me-1">{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-top p-3 bg-white">
          <div className="mb-2 p-2 bg-light rounded text-center">
            <strong>{user?.nombre || "Mesero"}</strong>
            <div className="small text-muted">{user?.rol}</div>
          </div>
          <button
            onClick={logout}
            className="btn btn-danger w-100 fw-semibold"
            style={{ backgroundColor: "#8b1a16", borderColor: "#8b1a16" }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}
