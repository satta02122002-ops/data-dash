import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      currentWorkspaceId: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            currentWorkspaceId: data.user.defaultWorkspaceId,
            isLoading: false,
          });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
          return data;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/register', { email, password, name });
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            currentWorkspaceId: data.user.defaultWorkspaceId,
            isLoading: false,
          });
          api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
          return data;
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        const { refreshToken } = get();
        try {
          await api.post('/auth/logout', { refreshToken });
        } catch (_) {}
        delete api.defaults.headers.common['Authorization'];
        set({ user: null, accessToken: null, refreshToken: null, currentWorkspaceId: null });
      },

      setAccessToken: (token) => {
        set({ accessToken: token });
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      },

      setCurrentWorkspace: (workspaceId) => set({ currentWorkspaceId: workspaceId }),

      updateUser: (updates) => set((state) => ({ user: { ...state.user, ...updates } })),
    }),
    {
      name: 'datadash-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        currentWorkspaceId: state.currentWorkspaceId,
      }),
    }
  )
);

export default useAuthStore;
