import express from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { generateAccessToken, generateRefreshToken, authenticate } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

console.log('Prisma instance:', prisma);
console.log('Prisma.user:', prisma.user);

// Validation des erreurs
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
};

/**
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
    
    console.log('Tentative de connexion pour:', email);

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      console.log('Utilisateur non trouvé');
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      console.log('Mot de passe incorrect');
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    // Vérifier si le compte est actif
    if (!user.isActive) {
      return res.status(403).json({ error: 'Compte désactivé' });
    }

    // Générer les tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    // Mettre à jour lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    console.log('Connexion réussie pour:', user.email);

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
 * POST /api/auth/register
 */
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  body('name').trim().isLength({ min: 2, max: 100 })
], async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return validationError;

    const { email, password, name } = req.body;

    // Vérifier si l'email existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Email déjà utilisé' });
    }

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: 'USER',
        isActive: true
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

    res.status(201).json({
      message: 'Compte créé avec succès',
      user,
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Erreur registration:', error);
    res.status(500).json({ error: 'Erreur lors de la création du compte' });
  }
});

/**
 * POST /api/auth/refresh
 */
router.post('/refresh', [
  body('refreshToken').notEmpty()
], async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Vérifier le token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    // Pour l'instant, on génère juste un nouveau access token
    const accessToken = generateAccessToken({ 
      id: decoded.userId || 1, 
      email: decoded.email || 'admin@example.com',
      role: decoded.role || 'ADMIN'
    });

    res.json({ accessToken });

  } catch (error) {
    console.error('Erreur refresh:', error);
    res.status(500).json({ error: 'Erreur lors du refresh' });
  }
});

/**
 * GET /api/auth/profile - Route protégée
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

/**
 * POST /api/auth/logout
 */
router.post('/logout', authenticate, (req, res) => {
  // Dans une vraie app, invalider le refresh token en base
  res.json({ message: 'Déconnexion réussie' });
});

export default router;