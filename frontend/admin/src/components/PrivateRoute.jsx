import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function PrivateRoute({ allowedRoles = [] }) {
  const { isAuthenticated, user, loading } = useAuth();

  // Afficher un loader pendant la vérification
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Rediriger vers login si non authentifié
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Vérifier les rôles si spécifiés
  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Accès refusé</h1>
          <p className="text-gray-600 mb-8">Vous n'avez pas les permissions nécessaires pour accéder à cette page.</p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  // Autoriser l'accès
  return <Outlet />;
}

export default PrivateRoute;