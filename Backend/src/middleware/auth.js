import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Vérifie et decode un JWT token
 * @param {string} token - Le token JWT
 * @returns {object|null} - Le payload décodé ou null si invalide
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
 * Vérifie le JWT token et attache l'utilisateur à req
 */
export const authenticate = async (req, res, next) => {
  try {
    // Extraire le token du header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'Token d\'authentification manquant'
      });
    }

    // Format attendu: "Bearer TOKEN"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: 'Format de token invalide'
      });
    }

    const token = parts[1];
    
    // Vérifier le token
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({
        error: 'Token invalide ou expiré'
      });
    }

    // Vérifier que l'utilisateur existe et est actif
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

    // Attacher l'utilisateur à la requête
    req.user = user;
    
    // Logger l'accès pour l'audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'API_ACCESS',
        entityType: req.route?.path || req.path,
        entityId: req.method,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: {
          path: req.path,
          method: req.method
        }
      }
    }).catch(err => {
      console.error('Erreur audit log:', err);
    });

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
 * @param {string[]} allowedRoles - Les rôles autorisés
 */
export const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Non authentifié'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      // Logger la tentative d'accès non autorisé
      prisma.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
          entityType: req.route?.path || req.path,
          entityId: req.method,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: {
            requiredRoles: allowedRoles,
            userRole: req.user.role
          }
        }
      }).catch(err => {
        console.error('Erreur audit log:', err);
      });

      return res.status(403).json({
        error: 'Accès non autorisé'
      });
    }

    next();
  };
};

/**
 * Middleware optionnel d'authentification
 * Attache l'utilisateur si token valide, mais ne bloque pas si absent
 */
export const optionalAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return next();
    }

    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const token = parts[1];
      const decoded = verifyToken(token);
      
      if (decoded) {
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

        if (user && user.isActive) {
          req.user = user;
        }
      }
    }

    next();
  } catch (error) {
    // En cas d'erreur, continuer sans authentification
    next();
  }
};

/**
 * Génère un access token JWT
 * @param {object} user - L'utilisateur
 * @returns {string} - Le token JWT
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
      expiresIn: '15m', // Token court pour la sécurité
      issuer: 'whatsapp-commerce',
      audience: 'api'
    }
  );
}

/**
 * Génère un refresh token
 * @returns {string} - Le refresh token
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