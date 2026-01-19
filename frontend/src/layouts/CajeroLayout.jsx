import React, { useEffect, useState } from "react";
import SidebarCajero from "../components/SidebarCajero";
import Topbar from "../components/Topbar";
import { Outlet } from "react-router-dom";

export default function CajeroLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== "undefined" ? window.matchMedia("(min-width: 992px)").matches : true
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 992px)");
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Bloquea scroll del body cuando el sidebar está abierto en móvil
  useEffect(() => {
    if (!isDesktop) {
      document.body.style.overflow = sidebarOpen ? "hidden" : "auto";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [sidebarOpen, isDesktop]);

  return (
    <div className="d-flex min-vh-100 bg-light">
      {/* Sidebar (offcanvas-like) */}
      <SidebarCajero
        isOpen={sidebarOpen || isDesktop}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Área principal */}
      <div
        className="d-flex flex-column flex-grow-1 min-vh-100"
        style={{ marginLeft: isDesktop ? 250 : 0, transition: "margin-left .3s ease" }}
      >
        {/* Topbar (el mismo que gerente) */}
        <Topbar onMenuClick={() => setSidebarOpen(true)} title="Cajero" />

        {/* Contenido */}
        <main className="flex-grow-1 p-3 bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
