
import api from "./api";

export const recetaService = {
  
  async listarInsumos() {
    const { data } = await api.get("/recetas/insumos");
    return data;
  },
  
  async crearInsumo(nombre, unidad_base) {
    const { data } = await api.post("/recetas/insumos", { nombre, unidad_base });
    return data;
  },

  // Editar insumo
  async editarInsumo(id, nombre, unidad_base) {
    const { data } = await api.patch(`/recetas/insumos/${id}`, { nombre, unidad_base });
    return data;
  },

  // Eliminar insumo
  async eliminarInsumo(id) {
    const { data } = await api.delete(`/recetas/insumos/${id}`);
    return data;
  },
  
  // Registrar un costo nuevo para un insumo
  async setCostoInsumo(id_insumo, costo_unitario, vigencia_desde, nota) {
    const { data } = await api.post("/recetas/costos", { id_insumo, costo_unitario, vigencia_desde, nota });
    return data;
  },

  // Obtener historial de costos de un insumo (ENDPOINT REAL)
  async getHistorialCostos(id_insumo) {
    const { data } = await api.get(`/recetas/costos/${id_insumo}`); 
    return data;
  },

  // Obtener receta por plato
  async getReceta(id_plato, fecha = "") {
    const { data } = await api.get(`/recetas/${id_plato}?fecha=${fecha}`);
    return data;
  },

  // Reemplazar receta de un plato (upsert)
  async upsertReceta(dto) {
    const { data } = await api.post("/recetas/upsert", dto);
    return data;
  },
  async listarResumenRecetas() {
    const { data } = await api.get("/recetas/resumen");
    return data;
  },
};