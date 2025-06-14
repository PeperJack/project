import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Génère un access token JWT
 */
export function generateAccessToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '15m',
      issuer: 'whatsapp-commerce',
      audience: 'api'
    }
  );
}

/**
 * Génère un refresh token
 */
export function generateRefreshToken() {
  return jwt.sign(
    {
      type: 'refresh',
      random: Math.random().toString(36)
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRE || '7d'
    }
  );
}

/**
 * Vérifie et decode un JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Middleware d'authentification
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Token d\'authentification manquant'
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Format de token invalide'
      });
    }

    const token = parts[1];
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        error: 'Token invalide ou expiré'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true
      }
    });

    if (!user) {
      return res.status(401).json({
        error: 'Utilisateur non trouvé'
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'Compte désactivé'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Erreur authentification:', error);
    return res.status(500).json({
      error: 'Erreur serveur'
    });
  }
};

/**
 * Middleware pour vérifier les rôles
 */
export const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Non authentifié'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Accès non autorisé'
      });
    }

    next();
  };
};