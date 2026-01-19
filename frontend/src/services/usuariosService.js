import api from "./api";

export const usuarioService = {
  async getAll() {
    const { data } = await api.get("/users");
    return data;
  },

  async getById(id) {
    const { data } = await api.get(`/users/${id}`);
    return data;
  },

  async create(payload) {
    const { data } = await api.post("/users", payload);
    return data;
  },

  async update(id, payload) {
    const { data } = await api.patch(`/users/${id}`, payload);
    return data;
  },

  async remove(id) {
    const { data } = await api.delete(`/users/${id}`);
    return data;
  },
};
