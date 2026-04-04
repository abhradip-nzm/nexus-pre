import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('nexus_token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data.user);
      setPermissions(res.data.permissions || {});
    } catch (err) {
      localStorage.removeItem('nexus_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('nexus_token', res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('nexus_token');
    setUser(null);
    setPermissions({});
  };

  const isSystemAdmin = () => user?.role_name === 'system_admin';
  const isSuperAdmin = () => user?.role_name === 'super_admin';
  const isManager = () => ['system_admin', 'super_admin', 'pre_sales_manager'].includes(user?.role_name);
  const isExecutive = () => user?.role_name === 'pre_sales_executive';

  const canDo = (module, action) => {
    if (!user) return false;
    if (user.role_name === 'system_admin') return true;
    if (user.role_name === 'pre_sales_manager') return true;
    if (user.role_name === 'super_admin') {
      const perm = permissions[module];
      if (!perm) return true; // default full access
      return perm[`can_${action}`];
    }
    if (user.role_name === 'pre_sales_executive') {
      if (module === 'user_stories' && action === 'create') return false;
      return action === 'read' || action === 'update';
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{
      user, permissions, loading,
      login, logout, loadUser,
      isSystemAdmin, isSuperAdmin, isManager, isExecutive, canDo
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
