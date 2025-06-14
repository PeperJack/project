import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimer, setBlockTimer] = useState(0);

  // Rediriger si déjà connecté
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Timer pour le blocage temporaire
  useEffect(() => {
    if (blockTimer > 0) {
      const timer = setTimeout(() => {
        setBlockTimer(blockTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (blockTimer === 0 && isBlocked) {
      setIsBlocked(false);
      setAttemptCount(0);
    }
  }, [blockTimer, isBlocked]);

  // Validation en temps réel
  const validateField = (name, value) => {
    const newErrors = { ...errors };

    switch (name) {
      case 'email':
        if (!value) {
          newErrors.email = 'Email requis';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          newErrors.email = 'Format d\'email invalide';
        } else {
          delete newErrors.email;
        }
        break;

      case 'password':
        if (!value) {
          newErrors.password = 'Mot de passe requis';
        } else if (value.length < 8) {
          newErrors.password = 'Minimum 8 caractères';
        } else {
          delete newErrors.password;
        }
        break;
    }

    setErrors(newErrors);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Limiter la longueur des inputs
    if (name === 'email' && value.length > 100) return;
    if (name === 'password' && value.length > 128) return;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Validation en temps réel
    validateField(name, value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Vérifier si bloqué
    if (isBlocked) {
      return;
    }

    // Validation finale
    const validationErrors = {};
    if (!formData.email) validationErrors.email = 'Email requis';
    if (!formData.password) validationErrors.password = 'Mot de passe requis';
    
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      await login(formData.email, formData.password);
      
      // Réinitialiser le compteur de tentatives
      setAttemptCount(0);
      
      // Redirection sera gérée par useEffect
    } catch (error) {
      console.error('Login error:', error);
      
      // Incrémenter le compteur de tentatives
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);
      
      // Bloquer après 5 tentatives
      if (newAttemptCount >= 5) {
        setIsBlocked(true);
        setBlockTimer(300); // 5 minutes
        setErrors({ 
          general: 'Trop de tentatives. Compte bloqué temporairement.' 
        });
      } else {
        setErrors({ 
          general: error.message || 'Erreur de connexion' 
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo et titre */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-full mb-4">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">WhatsApp Commerce</h1>
          <p className="text-gray-600 mt-2">Connectez-vous à votre espace admin</p>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Message d'erreur général */}
            {errors.general && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm">{errors.general}</p>
              </div>
            )}

            {/* Timer de blocage */}
            {isBlocked && blockTimer > 0 && (
              <div className="bg-orange-50 border border-orange-200 text-orange-700 px-4 py-3 rounded-lg">
                <p className="text-sm text-center">
                  Compte bloqué. Réessayez dans {Math.floor(blockTimer / 60)}:{(blockTimer % 60).toString().padStart(2, '0')}
                </p>
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={isBlocked}
                  className={`pl-10 pr-4 py-3 w-full border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  } ${isBlocked ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="admin@example.com"
                  value={formData.email}
                  onChange={handleChange}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            {/* Mot de passe */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={isBlocked}
                  className={`pl-10 pr-12 py-3 w-full border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  } ${isBlocked ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-600">{errors.password}</p>
              )}
            </div>

            {/* Options */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-600">Se souvenir de moi</span>
              </label>
              <a href="#" className="text-sm text-indigo-600 hover:text-indigo-500">
                Mot de passe oublié ?
              </a>
            </div>

            {/* Bouton de connexion */}
            <button
              type="submit"
              disabled={isLoading || isBlocked || Object.keys(errors).length > 0}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-all ${
                isLoading || isBlocked || Object.keys(errors).length > 0
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              }`}
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Connexion...
                </span>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>

          {/* Indicateurs de sécurité */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
              <ShieldCheck className="w-4 h-4" />
              <span>Connexion sécurisée avec SSL</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-600 mt-8">
          © 2024 WhatsApp Commerce MENA. Tous droits réservés.
        </p>
      </div>
    </div>
  );
}

export default Login;