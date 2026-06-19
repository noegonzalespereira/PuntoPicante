import api from './api';

export const meseroService = {
  async getTodosActivos({ id_caja }) {
    const { data } = await api.get('/pedidos/cocina', {
      params: { id_caja },
    });
    return data;
  },

  async getResumen({ id_caja }) {
    const { data } = await api.get('/pedidos/cocina/resumen', {
      params: { id_caja },
    });
    return data;
  },
};
