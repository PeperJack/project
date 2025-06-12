import { useEffect, useState } from 'react';
import { 
  TrendingUp,
  TrendingDown,
  MoreVertical,
  ArrowUpRight,
  Euro,
  Users,
  Package,
  ShoppingBag
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function Dashboard() {
  const [period, setPeriod] = useState('7d');

  // Data for charts
  const revenueData = [
    { day: 'Lun', revenue: 1200 },
    { day: 'Mar', revenue: 1900 },
    { day: 'Mer', revenue: 1600 },
    { day: 'Jeu', revenue: 2800 },
    { day: 'Ven', revenue: 2400 },
    { day: 'Sam', revenue: 3200 },
    { day: 'Dim', revenue: 2800 },
  ];

  const stats = [
    {
      label: 'Revenu total',
      value: '€14,280',
      change: '+12.5%',
      trend: 'up',
      icon: Euro,
    },
    {
      label: 'Commandes',
      value: '1,429',
      change: '+8.2%',
      trend: 'up',
      icon: ShoppingBag,
    },
    {
      label: 'Clients actifs',
      value: '892',
      change: '-2.4%',
      trend: 'down',
      icon: Users,
    },
    {
      label: 'Produits vendus',
      value: '243',
      change: '+18.7%',
      trend: 'up',
      icon: Package,
    },
  ];

  const recentActivity = [
    { id: 1, type: 'order', description: 'Nouvelle commande #1234', time: 'Il y a 5 min', amount: '€89.00' },
    { id: 2, type: 'user', description: 'Nouveau client inscrit', time: 'Il y a 23 min', user: 'Marie L.' },
    { id: 3, type: 'order', description: 'Commande expédiée #1233', time: 'Il y a 1h' },
    { id: 4, type: 'product', description: 'Stock faible: T-shirt noir', time: 'Il y a 2h', stock: '3 restants' },
  ];

  const topProducts = [
    { name: 'T-shirt Premium Noir', sales: 145, revenue: '€4,350', growth: '+12%' },
    { name: 'Jean Slim Bleu', sales: 98, revenue: '€7,840', growth: '+8%' },
    { name: 'Hoodie Oversize', sales: 76, revenue: '€5,320', growth: '+15%' },
    { name: 'Sneakers Classic', sales: 64, revenue: '€5,760', growth: '-3%' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Vue d'ensemble de votre activité commerciale</p>
        </div>
        
        {/* Period selector */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
          {['24h', '7d', '30d', '12m'].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                period === p
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div
              key={index}
              className="bg-white p-6 rounded-xl border border-gray-200/50 hover:shadow-lg hover:border-gray-300/50 transition-all duration-300 cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-gray-100 transition-colors">
                  <Icon className="w-5 h-5 text-gray-600" />
                </div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="w-4 h-4 text-gray-400" />
                </button>
              </div>
              
              <div className="mt-4">
                <p className="text-3xl font-semibold text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
              </div>
              
              <div className="flex items-center gap-2 mt-4">
                {stat.trend === 'up' ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className={`text-sm font-medium ${
                  stat.trend === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {stat.change}
                </span>
                <span className="text-sm text-gray-400">vs période précédente</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200/50">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Évolution du revenu</h3>
              <p className="text-sm text-gray-500 mt-1">Derniers 7 jours</p>
            </div>
            <button className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1">
              Voir détails <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
          
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#111827" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#111827" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="day" stroke="#9ca3af" fontSize={12} />
              <YAxis stroke="#9ca3af" fontSize={12} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Area 
                type="monotone" 
                dataKey="revenue" 
                stroke="#111827" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorRevenue)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activity */}
        <div className="bg-white p-6 rounded-xl border border-gray-200/50">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Activité récente</h3>
          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 group cursor-pointer">
                <div className={`w-2 h-2 rounded-full mt-1.5 ${
                  activity.type === 'order' ? 'bg-blue-500' :
                  activity.type === 'user' ? 'bg-green-500' :
                  activity.type === 'product' ? 'bg-yellow-500' :
                  'bg-gray-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 group-hover:text-black transition-colors">
                    {activity.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {activity.time}
                    {activity.amount && <span className="font-medium text-gray-700"> • {activity.amount}</span>}
                    {activity.user && <span className="font-medium text-gray-700"> • {activity.user}</span>}
                    {activity.stock && <span className="font-medium text-orange-600"> • {activity.stock}</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Products Table */}
      <div className="bg-white rounded-xl border border-gray-200/50">
        <div className="p-6 border-b border-gray-200/50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Produits les plus vendus</h3>
            <button className="text-sm text-gray-600 hover:text-gray-900">
              Voir tous →
            </button>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200/50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Produit
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ventes
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenu
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Croissance
                </th>
              </tr>
            </thead>
            <tbody>
              {topProducts.map((product, index) => (
                <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg" />
                      <span className="font-medium text-gray-900">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {product.sales} unités
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {product.revenue}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-sm font-medium ${
                      product.growth.startsWith('+') ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {product.growth}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;