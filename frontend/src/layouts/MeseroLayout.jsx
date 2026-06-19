import React, { useEffect, useState } from "react";
import SidebarMesero from "../components/SidebarMesero";
import Topbar from "../components/Topbar";
import { Outlet } from "react-router-dom";

export default function MeseroLayout() {
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

  useEffect(() => {
    if (!isDesktop) {
      document.body.style.overflow = sidebarOpen ? "hidden" : "auto";
    } else {
      document.body.style.overflow = "auto";
    }
  }, [sidebarOpen, isDesktop]);

  return (
    <div className="d-flex min-vh-100 bg-light">
      <SidebarMesero
        isOpen={sidebarOpen || isDesktop}
        onClose={() => setSidebarOpen(false)}
      />

      <div
        className="d-flex flex-column flex-grow-1 min-vh-100"
        style={{ marginLeft: isDesktop ? 250 : 0, transition: "margin-left .3s ease" }}
      >
        <Topbar onMenuClick={() => setSidebarOpen(true)} title="Mesero" />

        <main className="flex-grow-1 p-3 bg-white">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
