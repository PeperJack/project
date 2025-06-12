import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Search, Bell, ChevronDown } from 'lucide-react';
import { useState } from 'react';

function Layout() {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50/50">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header minimaliste */}
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-40">
          <div className="flex items-center justify-between h-16 px-8">
            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50/50 border border-gray-200/50 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-transparent transition-all"
                />
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2 ml-8">
              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
                </button>
                
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 py-2 animate-slide-up">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="font-medium text-sm">Notifications</p>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors">
                          <p className="text-sm font-medium text-gray-900">Nouvelle commande #{156 + i}</p>
                          <p className="text-xs text-gray-500 mt-1">Il y a {i * 5} minutes</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Profile */}
              <button className="flex items-center gap-3 px-3 py-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-900 rounded-lg flex items-center justify-center text-white text-sm font-medium">
                    A
                  </div>
                  <div className="text-left hidden md:block">
                    <p className="text-sm font-medium text-gray-900">Admin</p>
                    <p className="text-xs text-gray-500">admin@shop.com</p>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8 max-w-7xl mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;