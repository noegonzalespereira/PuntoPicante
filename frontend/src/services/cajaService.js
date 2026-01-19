import api from "./api";


export const cajaService = {
  async abrirCaja(monto_apertura) {
    const { data } = await api.post("/cajas/abrir", { monto_apertura });
    return data;
  },

  async getCajaAbierta() {
    const { data } = await api.get("/cajas/abierta");
    return data;
  },

  async cerrarCaja(id, monto_cierre) {
    const { data } = await api.patch(`/cajas/${id}/cerrar`, { monto_cierre });
    return data;
  },

  async getResumen(id) {
    const { data } = await api.get(`/cajas/${id}/resumen`);
    return data;
  },
  async getHistorial({ cajeroId, desde, hasta }) {
    const params = new URLSearchParams();
    if (cajeroId) params.append("cajero", cajeroId);
    if (desde) params.append("desde", desde);
    if (hasta) params.append("hasta", hasta);
    const { data } = await api.get(`/cajas/historial?${params.toString()}`);
    return data;
},
};
