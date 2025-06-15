import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import webhookRoutes from './routes/webhook.js';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import { authenticate, authorize } from './middleware/auth.js';
import messageRoutes from './routes/messages.js';


// Charger les variables d'environnement
config();

// Vérifier les variables critiques
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'WHATSAPP_ACCESS_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_WEBHOOK_TOKEN',
  'WHATSAPP_APP_SECRET'
];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`❌ Variable d'environnement manquante: ${varName}`);
    process.exit(1);
  }
});

// Vérifier la force du JWT_SECRET
if (process.env.JWT_SECRET.length < 32) {
  console.error('❌ JWT_SECRET trop faible (min 32 caractères)');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Helmet pour les headers de sécurité
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// CORS sécurisé
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'];
    
    // Permettre les requêtes sans origin (Postman, etc) en dev seulement
    if (!origin && process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 heures
};

app.use(cors(corsOptions));

// Rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes max
  message: 'Trop de requêtes, veuillez réessayer plus tard',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Rate limiting strict pour l'authentification
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 tentatives max
  skipSuccessfulRequests: true,
  message: 'Trop de tentatives de connexion, veuillez réessayer dans 15 minutes'
});

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logger simple
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/webhook', webhookRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/products', authenticate, productRoutes);
app.use('/api/orders', authenticate, orderRoutes);
app.use('/api/messages', authenticate, messageRoutes); // Ajouté ici

// IMPORTANT: Route dashboard stats
app.get('/api/dashboard/stats', authenticate, async (req, res) => {
  try {
    console.log('📊 Requête stats dashboard reçue');
    
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    // Récupérer les statistiques
    const [totalOrders, totalProducts, recentOrders] = await Promise.all([
      prisma.order.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: { product: true }
          }
        }
      })
    ]);

    // Calculer le revenu total
    const totalRevenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } }
    });

    // Pour l'instant, on simule le nombre de messages
    const totalMessages = 0;

    const response = {
      totalOrders,
      totalRevenue: totalRevenue._sum.total || 0,
      totalProducts,
      totalMessages,
      recentOrders: recentOrders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status,
        createdAt: order.createdAt,
        itemCount: order.items.length
      }))
    };

    console.log('✅ Stats calculées:', response);
    res.json(response);

    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Erreur stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

// Route de test
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 WhatsApp Commerce API',
    version: '1.0.0',
    status: 'running'
  });
});

// Route de santé
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Gestion des erreurs 404
app.use((req, res) => {
  console.log(`❌ 404 - Route non trouvée: ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Route non trouvée' });
});

// Gestion globale des erreurs
app.use((err, req, res, next) => {
  console.error('❌ Erreur:', err);
  
  // Erreur de validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Données invalides',
      details: err.details 
    });
  }
  
  // Erreur CORS
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origine non autorisée' });
  }
  
  res.status(err.status || 500).json({ 
    error: err.message || 'Erreur serveur' 
  });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`
🚀 Serveur WhatsApp Commerce démarré!
📍 URL: http://localhost:${PORT}
🌍 Environnement: ${process.env.NODE_ENV}
📱 WhatsApp Phone ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID}
🔐 JWT configuré: ✓
📊 Base de données: ${process.env.DATABASE_URL ? '✓' : '✗'}

📋 Routes disponibles:
  - POST   /api/auth/login
  - GET    /api/dashboard/stats (authentifié)
  - GET    /api/products (authentifié)
  - GET    /api/orders (authentifié)
  `);
});