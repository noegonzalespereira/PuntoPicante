import api from "./api";

export const gastoService = {
  async getAll(filters = {}) {
    const params = {};
    if (filters.caja) params.caja = filters.caja;
    if (filters.desde) params.desde = filters.desde;
    if (filters.hasta) params.hasta = filters.hasta;
    if (filters.page) params.page = filters.page;
    if (filters.pageSize) params.pageSize = filters.pageSize;
    const { data } = await api.get("/gastos", { params });
    return data;
  },

  async create(gastoData) {
    const { data } = await api.post("/gastos", gastoData);
    return data;
  },

  async getOne(id) {
    const { data } = await api.get(`/gastos/${id}`);
    return data;
  },

  async update(id, gastoData) {
    const { data } = await api.patch(`/gastos/${id}`, gastoData);
    return data;
  },

  async delete(id) {
    const { data } = await api.delete(`/gastos/${id}`);
    return data;
  },

  async getResumen(filters = {}) {
    const params = {};
    if (filters.caja) params.caja = filters.caja;
    if (filters.desde) params.desde = filters.desde;
    if (filters.hasta) params.hasta = filters.hasta;
    const { data } = await api.get("/gastos/utils/resumen", { params });
    return data;
  },
};
