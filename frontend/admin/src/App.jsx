import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';

// Juste après les imports
function TestTailwind() {
  return (
    <div className="p-4">
      <div className="bg-blue-500 text-white p-4 rounded">
        Si ce bloc est bleu, Tailwind fonctionne !
      </div>
    </div>
  );
}

// Pages temporaires pour Messages et Orders
function Messages() {
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-8">Messages</h2>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">La page des messages arrive bientôt...</p>
      </div>
    </div>
  );
}

function Orders() {
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-8">Commandes</h2>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600">La page des commandes arrive bientôt...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="messages" element={<Messages />} />
          <Route path="orders" element={<Orders />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;