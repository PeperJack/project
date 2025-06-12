import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken, generateRefreshToken, authenticate } from '../middleware/auth.js';
import crypto from 'crypto';

const router = express.Router();
const prisma = new PrismaClient();

// Constantes de sécurité
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 30 * 60 * 1000; // 30 minutes
const SALT_ROUNDS = 12;

/**
 * Validation des erreurs
 */
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
};

/**
 * Route de registration sécurisée
 * POST /api/auth/register
 */
router.post('/register', [
  // Validation stricte
  body('email')
    .isEmail()
    .normalizeEmail()
    .custom(async (email) => {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) throw new Error('Email déjà utilisé');
      return true;
    }),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Le mot de passe doit contenir au moins 8 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Le mot de passe doit contenir: majuscule, minuscule, chiffre et caractère spécial'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .matches(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .withMessage('Nom invalide')
], async (req, res) => {
  try {
    // Vérifier les erreurs de validation
    const validationError = handleValidationErrors(req, res);
    if (validationError) return validationError;

    const { email, password, name } = req.body;

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Créer l'utilisateur dans une transaction
    const result = await prisma.$transaction(async (tx) => {
      // Créer l'utilisateur
      const user = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: 'USER'
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true
        }
      });

      // Générer les tokens
      const accessToken = generateAccessToken(user);
      const refreshToken = generateRefreshToken();

      // Sauvegarder le refresh token
      await tx.refreshToken.create({
        data: {
          token: refreshToken,
          userId: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 jours
          ipAddress: req.ip,
          deviceInfo: req.headers['user-agent']
        }
      });

      // Logger la création
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'USER_REGISTERED',
          entityType: 'USER',
          entityId: user.id.toString(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        }
      });

      return { user, accessToken, refreshToken };
    });

    res.status(201).json({
      message: 'Compte créé avec succès',
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken
    });

  } catch (error) {
    console.error('Erreur registration:', error);
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

/**
 * Route de login sécurisée avec protection brute force
 * POST /api/auth/login
 */
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return validationError;

    const { email, password } = req.body;

    // Récupérer l'utilisateur avec gestion du verrouillage
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      // Ne pas révéler que l'email n'existe pas
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérifier si le compte est verrouillé
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingTime = Math.ceil((user.lockedUntil - new Date()) / 60000);
      return res.status(423).json({ 
        error: `Compte verrouillé. Réessayez dans ${remainingTime} minutes` 
      });
    }

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      // Incrémenter les tentatives
      const attempts = user.loginAttempts + 1;
      const isLocked = attempts >= MAX_LOGIN_ATTEMPTS;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: attempts,
          lockedUntil: isLocked ? new Date(Date.now() + LOCK_TIME) : null
        }
      });

      // Logger la tentative échouée
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: 'LOGIN_FAILED',
          entityType: 'USER',
          entityId: user.id.toString(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: { attempts }
        }
      });

      if (isLocked) {
        return res.status(423).json({ 
          error: 'Trop de tentatives. Compte verrouillé pour 30 minutes' 
        });
      }

      return res.status(401).json({ 
        error: 'Email ou mot de passe incorrect',
        remainingAttempts: MAX_LOGIN_ATTEMPTS - attempts
      });
    }

    // Vérifier si le compte est actif
    if (!user.isActive) {
      return res.status(403).json({ error: 'Compte désactivé' });
    }

    // Login réussi - Réinitialiser les tentatives
    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: req.ip
      }
    });

    // Générer les tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    // Sauvegarder le refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: req.ip,
        deviceInfo: req.headers['user-agent']
      }
    });

    // Logger le succès
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN_SUCCESS',
        entityType: 'USER',
        entityId: user.id.toString(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    res.json({
      message: 'Connexion réussie',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Erreur login:', error);
    res.status(500).json({ error: 'Erreur lors de la connexion' });
  }
});

/**
 * Refresh token sécurisé
 * POST /api/auth/refresh
 */
router.post('/refresh', [
  body('refreshToken').notEmpty()
], async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Vérifier le refresh token
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true }
    });

    if (!tokenRecord) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    // Vérifier l'expiration
    if (tokenRecord.expiresAt < new Date()) {
      await prisma.refreshToken.delete({
        where: { id: tokenRecord.id }
      });
      return res.status(401).json({ error: 'Token expiré' });
    }

    // Vérifier si révoqué
    if (tokenRecord.revokedAt) {
      return res.status(401).json({ error: 'Token révoqué' });
    }

    // Vérifier si l'utilisateur est actif
    if (!tokenRecord.user.isActive) {
      return res.status(403).json({ error: 'Compte désactivé' });
    }

    // Générer un nouveau access token
    const accessToken = generateAccessToken(tokenRecord.user);

    res.json({
      accessToken,
      user: {
        id: tokenRecord.user.id,
        email: tokenRecord.user.email,
        name: tokenRecord.user.name,
        role: tokenRecord.user.role
      }
    });

  } catch (error) {
    console.error('Erreur refresh:', error);
    res.status(500).json({ error: 'Erreur lors du refresh' });
  }
});

/**
 * Logout sécurisé
 * POST /api/auth/logout
 */
router.post('/logout', authenticate, async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Révoquer le refresh token
      await prisma.refreshToken.updateMany({
        where: {
          token: refreshToken,
          userId: req.user.id
        },
        data: {
          revokedAt: new Date()
        }
      });
    }

    // Logger la déconnexion
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'LOGOUT',
        entityType: 'USER',
        entityId: req.user.id.toString(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    res.json({ message: 'Déconnexion réussie' });

  } catch (error) {
    console.error('Erreur logout:', error);
    res.status(500).json({ error: 'Erreur lors de la déconnexion' });
  }
});

/**
 * Route protégée pour obtenir le profil
 * GET /api/auth/profile
 */
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    res.json(user);

  } catch (error) {
    console.error('Erreur profile:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du profil' });
  }
});

export default router;