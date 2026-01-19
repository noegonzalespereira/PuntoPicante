import api from "./api";

export const stockService = {
  async getDisponible(fecha) {
    const params = {};
    if (fecha) params.fecha = fecha;

    const { data } = await api.get("/inventario/disponible", { params });
    return data;
  },

  // Apertura de platos para el día
  async registrarApertura(payload) {
    const { data } = await api.post("/inventario/apertura-platos", payload);
    return data;
  },

  // Registrar ingreso de stock de bebidas
  async ingresoBebida(payload) {
    const { data } = await api.post("/inventario/ingreso-bebida", payload);
    return data;
  },
  async getDesgloseStock(fecha) {
  const params = {};
  if (fecha) params.fecha = fecha;

  // Llama al endpoint que devuelve [Inicial, Vendido, Merma, Final]
  const { data } = await api.get("/inventario/disponible-detalles", { params });
  return data;
},
  // Registrar merma (platos o bebidas)
  async registrarMerma(payload) {
    const { data } = await api.post("/inventario/merma", payload);
    return data;
  },
  async getMermas() {
  const { data } = await api.get("/inventario/merma");
  return data;
},

};
