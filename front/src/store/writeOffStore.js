import { create } from 'zustand';
import * as woApi from '../api/writeOffs.api';
import * as storesApi from '../api/stores.api';

export const useWriteOffStore = create((set, get) => ({
  // списки
  list: [],
  pagination: null,
  listLoading: false,
  listError: null,

  // счётчики
  stats: { pending: 0, approved: 0, rejected: 0, total: 0 },

  // деталь
  current: null,
  currentLoading: false,
  currentError: null,

  // справочники
  stores: [],
  employees: [],

  // действие в процессе (approve/reject/submit) — для блокировки кнопок
  acting: false,

  async fetchList(params = {}) {
    set({ listLoading: true, listError: null });
    try {
      const data = await woApi.listWriteOffs(params);
      set({ list: data.write_offs || [], pagination: data.pagination || null, listLoading: false });
    } catch (e) {
      set({ listError: e.message, listLoading: false });
    }
  },

  async fetchStats(scope) {
    try {
      const stats = await woApi.getStats(scope);
      set({ stats });
    } catch {
      // тихо — счётчики не критичны для рендера
    }
  },

  async fetchOne(id) {
    set({ currentLoading: true, currentError: null, current: null });
    try {
      const data = await woApi.getWriteOff(id);
      set({ current: data.write_off, currentLoading: false });
    } catch (e) {
      set({ currentError: e.message, currentLoading: false });
    }
  },

  async create(payload) {
    set({ acting: true });
    try {
      const data = await woApi.createWriteOff(payload);
      return data.write_off;
    } finally {
      set({ acting: false });
    }
  },

  async approve(id) {
    set({ acting: true });
    try {
      const data = await woApi.approveWriteOff(id);
      set({ current: data.write_off });
      return data.write_off;
    } finally {
      set({ acting: false });
    }
  },

  async reject(id, reason) {
    set({ acting: true });
    try {
      const data = await woApi.rejectWriteOff(id, reason);
      set({ current: data.write_off });
      return data.write_off;
    } finally {
      set({ acting: false });
    }
  },

  async retryIiko(id) {
    set({ acting: true });
    try {
      const data = await woApi.retryIiko(id);
      set({ current: data.write_off });
      return data.write_off;
    } finally {
      set({ acting: false });
    }
  },

  async loadStores() {
    if (get().stores.length) return get().stores;
    const data = await storesApi.getStores();
    const stores = data.stores || [];
    set({ stores });
    return stores;
  },

  async loadEmployees(storeId) {
    const data = storeId ? await storesApi.getStoreEmployees(storeId) : await storesApi.getEmployees();
    const employees = data.employees || [];
    set({ employees });
    return employees;
  },
}));
