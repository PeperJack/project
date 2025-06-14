import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Login
  const login = async (email, password) => {
    try {
      console.log('Tentative de connexion...');
      
      const response = await api.post('/auth/login', {
        email: email.toLowerCase().trim(),
        password
      });

      console.log('Réponse login:', response.data);

      const { accessToken, refreshToken, user: userData } = response.data;

      // Stocker les tokens
      sessionStorage.setItem('wac_access_token', accessToken);
      sessionStorage.setItem('wac_refresh_token', refreshToken);
      sessionStorage.setItem('wac_token_expiry', new Date().getTime() + 15 * 60 * 1000);

      // Configurer le header par défaut
      api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

      // Mettre à jour l'état
      setUser(userData);

      console.log('Connexion réussie, redirection...');

      return { success: true };
    } catch (error) {
      console.error('Erreur login:', error);
      throw new Error(error.response?.data?.error || 'Erreur de connexion');
    }
  };

  // Logout
  const logout = async () => {
    try {
      const refreshToken = sessionStorage.getItem('wac_refresh_token');
      if (refreshToken) {
        await api.post('/auth/logout', { refreshToken }).catch(console.error);
      }
    } finally {
      // Nettoyer
      sessionStorage.removeItem('wac_access_token');
      sessionStorage.removeItem('wac_refresh_token');
      sessionStorage.removeItem('wac_token_expiry');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
      window.location.href = '/login';
    }
  };

  // Vérifier l'auth au chargement
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = sessionStorage.getItem('wac_access_token');
        
        if (!token) {
          throw new Error('No token');
        }

        // Configurer le header
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        // Récupérer le profil
        const response = await api.get('/auth/profile');
        setUser(response.data);

      } catch (error) {
        console.error('Auth check failed:', error);
        sessionStorage.removeItem('wac_access_token');
        sessionStorage.removeItem('wac_refresh_token');
        sessionStorage.removeItem('wac_token_expiry');
        delete api.defaults.headers.common['Authorization'];
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Intercepteur pour gérer les erreurs 401
  useEffect(() => {
    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401 && !error.config._retry) {
          error.config._retry = true;
          
          const refreshToken = sessionStorage.getItem('wac_refresh_token');
          
          if (refreshToken) {
            try {
              const response = await api.post('/auth/refresh', { refreshToken });
              const { accessToken } = response.data;
              
              sessionStorage.setItem('wac_access_token', accessToken);
              api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
              
              error.config.headers.Authorization = `Bearer ${accessToken}`;
              return api(error.config);
            } catch (refreshError) {
              await logout();
            }
          } else {
            await logout();
          }
        }
        
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};