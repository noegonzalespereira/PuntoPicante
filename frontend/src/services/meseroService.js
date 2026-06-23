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

  async entregar(id_pedido) {
    const { data } = await api.patch(`/pedidos/${id_pedido}/entregar`);
    return data;
  },
};
