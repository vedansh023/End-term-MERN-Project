import axios from "axios";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

export const registerUser = (data) => api.post("/auth/register", data);
export const loginUser = (data) => api.post("/auth/login", data);
export const getMe = () => api.get("/auth/me");
export const logoutUser = () => api.post("/auth/logout");

export const listGroups = () => api.get("/groups");
export const createGroup = (data) => api.post("/groups", data);
export const joinGroup = (data) => api.post("/groups/join", data);
export const getGroup = (id) => api.get(`/groups/${id}`);
export const toggleArchiveGroup = (id) => api.post(`/groups/${id}/archive`);
export const updateBudget = (id, data) => api.put(`/groups/${id}/budget`, data);

export const addExpense = (id, data) => api.post(`/groups/${id}/expenses`, data);
export const updateExpense = (groupId, expenseId, data) =>
  api.put(`/groups/${groupId}/expenses/${expenseId}`, data);
export const deleteExpense = (groupId, expenseId) =>
  api.delete(`/groups/${groupId}/expenses/${expenseId}`);

export const addSettlement = (id, data) => api.post(`/groups/${id}/settlements`, data);

export default api;
