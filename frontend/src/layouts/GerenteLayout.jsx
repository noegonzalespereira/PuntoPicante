import React, { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import { Outlet } from "react-router-dom";

export default function GerenteLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      document.body.style.overflow = sidebarOpen ? "hidden" : "auto";
    }
  }, [sidebarOpen, isDesktop]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#fafafa" }}>
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen || isDesktop} onClose={() => setSidebarOpen(false)} />

      {/* Área principal */}
      <div
        style={{
          flex: 1,
          marginLeft: isDesktop && !sidebarOpen ? "250px" : "0", 
          transition: "margin-left 0.3s ease",
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
      >
        {/* Topbar */}
        <Topbar onMenuClick={() => setSidebarOpen(true)} />

        {/* Contenido */}
        <main
          style={{
            flex: 1,
            padding: "1rem",
            background: "#f8f8f8",
            overflowY: "auto",
          }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
