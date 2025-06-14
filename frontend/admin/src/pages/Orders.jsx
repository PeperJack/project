import { useState, useEffect } from 'react';
import { Eye, CheckCircle, XCircle, Clock, Truck, Package } from 'lucide-react';

function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    // Simuler des données pour l'instant
    setOrders([
      {
        id: 1,
        orderNumber: 'ORD-2024-001',
        customer: 'Mohammed Ali',
        phone: '+212 6 12 34 56 78',
        total: 259.97,
        status: 'pending',
        items: 3,
        createdAt: new Date().toISOString()
      },
      {
        id: 2,
        orderNumber: 'ORD-2024-002',
        customer: 'Fatima Zahra',
        phone: '+212 6 98 76 54 32',
        total: 149.99,
        status: 'processing',
        items: 2,
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 3,
        orderNumber: 'ORD-2024-003',
        customer: 'Ahmed Hassan',
        phone: '+212 7 11 22 33 44',
        total: 89.99,
        status: 'delivered',
        items: 1,
        createdAt: new Date(Date.now() - 172800000).toISOString()
      }
    ]);
    setLoading(false);
  }, []);

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, text: 'En attente' },
      processing: { color: 'bg-blue-100 text-blue-800', icon: Package, text: 'En traitement' },
      shipped: { color: 'bg-purple-100 text-purple-800', icon: Truck, text: 'Expédiée' },
      delivered: { color: 'bg-green-100 text-green-800', icon: CheckCircle, text: 'Livrée' },
      cancelled: { color: 'bg-red-100 text-red-800', icon: XCircle, text: 'Annulée' }
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="w-3 h-3" />
        {config.text}
      </span>
    );
  };

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter(order => order.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Commandes</h1>
        
        {/* Filtres */}
        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">Toutes</option>
            <option value="pending">En attente</option>
            <option value="processing">En traitement</option>
            <option value="shipped">Expédiées</option>
            <option value="delivered">Livrées</option>
            <option value="cancelled">Annulées</option>
          </select>
        </div>
      </div>

      {/* Table des commandes */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Commande
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Client
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredOrders.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{order.orderNumber}</div>
                  <div className="text-sm text-gray-500">{order.items} articles</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{order.customer}</div>
                  <div className="text-sm text-gray-500">{order.phone}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{order.total.toFixed(2)} MAD</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(order.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(order.createdAt).toLocaleDateString('fr-FR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button className="text-indigo-600 hover:text-indigo-900">
                    <Eye className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Aucune commande trouvée
          </div>
        )}
      </div>
    </div>
  );
}

export default Orders;