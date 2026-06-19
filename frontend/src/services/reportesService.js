import api from "./api";

export const reportesService = {
  // Resumen gerencial agregado en el backend (productos, destinos, métodos de pago).
  async getResumen({ desde, hasta, caja } = {}) {
    const params = {};
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    if (caja) params.caja = caja;
    const { data } = await api.get("/reportes/resumen", { params });
    return data;
  },

  // Ventas desglosadas por día (solo pedidos PAGADOS).
  async getPorDia({ desde, hasta } = {}) {
    const params = {};
    if (desde) params.desde = desde;
    if (hasta) params.hasta = hasta;
    const { data } = await api.get("/reportes/por-dia", { params });
    return data;
  },
};
