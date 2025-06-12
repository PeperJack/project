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

// Charger les variables d'environnement
config();

// Vérifier les variables critiques
const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_NUMBER_ID',
  'WHATSAPP_WEBHOOK_VERIFY_TOKEN',
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
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes max
  message: 'Trop de requêtes, veuillez réessayer plus tard',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', globalLimiter);

// Rate limiting strict pour auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 tentatives max
  message: 'Trop de tentatives de connexion',
  skipSuccessfulRequests: true
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body parsing avec limite
app.use(express.json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Garder le body brut pour la vérification webhook
    if (req.url === '/webhook' && req.method === 'POST') {
      req.rawBody = buf.toString('utf8');
    }
  }
}));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de logging sécurisé
app.use((req, res, next) => {
  // Ne pas logger les données sensibles
  const sanitizedUrl = req.url.replace(/password=.*?(&|$)/, 'password=***$1');
  console.log(`${new Date().toISOString()} - ${req.method} ${sanitizedUrl} - ${req.ip}`);
  next();
});

// Health check public
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// Routes
app.use('/webhook', webhookRoutes); // Webhook WhatsApp (doit rester public)
app.use('/api/auth', authRoutes); // Routes d'authentification

// Routes protégées
app.use('/api/products', authenticate, productRoutes);
app.use('/api/orders', authenticate, orderRoutes);

// Routes admin seulement
app.use('/api/admin', authenticate, authorize(['ADMIN']), (req, res) => {
  res.json({ message: 'Admin access granted' });
});

// Dashboard stats - authentification requise
app.get('/api/dashboard/stats', authenticate, async (req, res) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    // Utiliser des requêtes optimisées
    const [totalOrders, totalProducts, totalMessages, recentOrders] = await Promise.all([
      prisma.order.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.message.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
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

    // Calculer le revenu total de manière sécurisée
    const totalRevenue = await prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { in: ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] } }
    });

    res.json({
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
    });

    await prisma.$disconnect();
  } catch (error) {
    console.error('Erreur stats:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Error handler global sécurisé
app.use((err, req, res, next) => {
  // Ne pas exposer les détails d'erreur en production
  const isDev = process.env.NODE_ENV === 'development';
  
  // Logger l'erreur côté serveur
  console.error('Erreur:', err);

  // Erreur CORS
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'Origine non autorisée' });
  }

  // Erreur de validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Données invalides',
      details: isDev ? err.message : undefined
    });
  }

  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Token invalide' });
  }

  // Erreur par défaut
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Erreur serveur',
    stack: isDev ? err.stack : undefined
  });
});

// Gestion propre de l'arrêt
const gracefulShutdown = async () => {
  console.log('\n🛑 Arrêt du serveur...');
  
  // Fermer les connexions
  server.close(async () => {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$disconnect();
    console.log('✅ Serveur arrêté proprement');
    process.exit(0);
  });

  // Forcer l'arrêt après 10 secondes
  setTimeout(() => {
    console.error('❌ Arrêt forcé');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Démarrer le serveur
const server = app.listen(PORT, () => {
  console.log(`
  🔐 Serveur sécurisé démarré!
  🔗 URL: http://localhost:${PORT}
  🌍 Environnement: ${process.env.NODE_ENV}
  📅 Démarré le: ${new Date().toLocaleString('fr-FR')}
  `);

  // Vérifications de sécurité au démarrage
  console.log('🔒 Vérifications de sécurité:');
  console.log(`  ✓ JWT Secret: ${process.env.JWT_SECRET.length} caractères`);
  console.log(`  ✓ CORS: ${corsOptions.origin.length || 'Configuré'}`);
  console.log(`  ✓ Rate Limiting: Activé`);
  console.log(`  ✓ Helmet: Activé`);
});