import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authorize } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Middleware de validation des erreurs
 */
const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  return null;
};

/**
 * GET /api/products - Liste des produits avec pagination
 * Accessible à tous les utilisateurs authentifiés
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('search').optional().trim().escape(),
  query('category').optional().trim().escape(),
  query('minPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('maxPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('inStock').optional().isBoolean().toBoolean()
], async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return validationError;

    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const skip = (page - 1) * limit;

    // Construire les filtres de manière sécurisée
    const where = {
      isActive: true
    };

    if (req.query.search) {
      where.OR = [
        { name: { contains: req.query.search } },
        { nameFr: { contains: req.query.search } },
        { description: { contains: req.query.search } }
      ];
    }

    if (req.query.category) {
      where.category = req.query.category;
    }

    if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
      where.price = {};
      if (req.query.minPrice !== undefined) where.price.gte = req.query.minPrice;
      if (req.query.maxPrice !== undefined) where.price.lte = req.query.maxPrice;
    }

    if (req.query.inStock) {
      where.stock = { gt: 0 };
    }

    // Requête avec pagination
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          nameFr: true,
          nameAr: true,
          description: true,
          descriptionFr: true,
          descriptionAr: true,
          price: true,
          stock: true,
          category: true,
          imageUrl: true,
          createdAt: true
        }
      }),
      prisma.product.count({ where })
    ]);

    res.json({
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Erreur liste produits:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des produits' });
  }
});

/**
 * GET /api/products/:id - Détail d'un produit
 */
router.get('/:id', [
  param('id').isInt().toInt()
], async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return validationError;

    const product = await prisma.product.findFirst({
      where: {
        id: req.params.id,
        isActive: true
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    // Logger l'accès au produit
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'VIEW_PRODUCT',
        entityType: 'PRODUCT',
        entityId: product.id.toString(),
        ipAddress: req.ip
      }
    }).catch(console.error);

    res.json(product);

  } catch (error) {
    console.error('Erreur détail produit:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération du produit' });
  }
});

/**
 * POST /api/products - Créer un produit (ADMIN only)
 */
router.post('/', authorize(['ADMIN']), [
  body('name')
    .trim()
    .isLength({ min: 2, max: 200 })
    .escape(),
  body('nameFr')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .escape(),
  body('nameAr')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .escape(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .escape(),
  body('descriptionFr')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .escape(),
  body('descriptionAr')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .escape(),
  body('price')
    .isFloat({ min: 0 })
    .toFloat(),
  body('stock')
    .isInt({ min: 0 })
    .toInt(),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .escape(),
  body('imageUrl')
    .optional()
    .isURL()
    .matches(/^https:\/\//)
    .withMessage('URL doit être HTTPS')
], async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return validationError;

    const { 
      name, 
      nameFr, 
      nameAr,
      description, 
      descriptionFr,
      descriptionAr,
      price, 
      stock, 
      category, 
      imageUrl 
    } = req.body;

    // Vérifier l'unicité du nom
    const existingProduct = await prisma.product.findFirst({
      where: { 
        AND: [
          { isActive: true }, // Vérifier seulement les produits actifs
          {
            OR: [
              { name: { equals: name } },
              { nameFr: { equals: nameFr || name } }
            ]
          }
        ]
      }
    });

    if (existingProduct) {
      return res.status(409).json({ error: 'Un produit avec ce nom existe déjà' });
    }

    const product = await prisma.product.create({
      data: {
        name,
        nameFr: nameFr || name,
        nameAr: nameAr || '',
        description: description || '',
        descriptionFr: descriptionFr || description || '',
        descriptionAr: descriptionAr || '',
        price,
        stock,
        category: category || null,
        imageUrl: imageUrl || null,
        isActive: true
      }
    });

    // Logger la création
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'CREATE_PRODUCT',
        entityType: 'PRODUCT',
        entityId: product.id.toString(),
        ipAddress: req.ip,
        metadata: JSON.stringify({ productName: name }) // Modifié ici
      }
    });

    res.status(201).json({
      message: 'Produit créé avec succès',
      product
    });

  } catch (error) {
    console.error('Erreur création produit:', error);
    res.status(500).json({ error: 'Erreur lors de la création du produit' });
  }
});

/**
 * PUT /api/products/:id - Modifier un produit (ADMIN only)
 */
router.put('/:id', authorize(['ADMIN']), [
  param('id').isInt().toInt(),
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 200 })
    .escape(),
  body('nameFr')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .escape(),
  body('nameAr')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .escape(),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .escape(),
  body('descriptionFr')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .escape(),
  body('descriptionAr')
    .optional()
    .trim()
    .isLength({ max: 2000 })
    .escape(),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .toFloat(),
  body('stock')
    .optional()
    .isInt({ min: 0 })
    .toInt(),
  body('category')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .escape(),
  body('imageUrl')
    .optional()
    .isURL()
    .matches(/^https:\/\//)
], async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return validationError;

    const productId = req.params.id;

    // Vérifier que le produit existe
    const existingProduct = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!existingProduct) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    // Préparer les données de mise à jour
    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.nameFr !== undefined) updateData.nameFr = req.body.nameFr;
    if (req.body.nameAr !== undefined) updateData.nameAr = req.body.nameAr;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.descriptionFr !== undefined) updateData.descriptionFr = req.body.descriptionFr;
    if (req.body.descriptionAr !== undefined) updateData.descriptionAr = req.body.descriptionAr;
    if (req.body.price !== undefined) updateData.price = req.body.price;
    if (req.body.stock !== undefined) updateData.stock = req.body.stock;
    if (req.body.category !== undefined) updateData.category = req.body.category;
    if (req.body.imageUrl !== undefined) updateData.imageUrl = req.body.imageUrl;

    const product = await prisma.product.update({
      where: { id: productId },
      data: updateData
    });

    // Logger la modification
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_PRODUCT',
        entityType: 'PRODUCT',
        entityId: product.id.toString(),
        ipAddress: req.ip,
        metadata: JSON.stringify({
          changes: Object.keys(updateData)
        })
      }
    });

    res.json({
      message: 'Produit modifié avec succès',
      product
    });

  } catch (error) {
    console.error('Erreur modification produit:', error);
    res.status(500).json({ error: 'Erreur lors de la modification du produit' });
  }
});

/**
 * DELETE /api/products/:id - Supprimer un produit (ADMIN only)
 * Soft delete pour garder l'historique
 */
router.delete('/:id', authorize(['ADMIN']), [
  param('id').isInt().toInt()
], async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return validationError;

    const productId = req.params.id;

    // Vérifier que le produit existe
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return res.status(404).json({ error: 'Produit non trouvé' });
    }

    // Vérifier s'il y a des commandes en cours avec ce produit
    const activeOrders = await prisma.orderItem.count({
      where: {
        productId,
        order: {
          status: {
            in: ['PENDING', 'CONFIRMED', 'PROCESSING']
          }
        }
      }
    });

    if (activeOrders > 0) {
      return res.status(409).json({ 
        error: 'Impossible de supprimer ce produit, des commandes sont en cours' 
      });
    }

    // Soft delete
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false }
    });

    // Logger la suppression
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'DELETE_PRODUCT',
        entityType: 'PRODUCT',
        entityId: productId.toString(),
        ipAddress: req.ip,
        metadata: JSON.stringify({ productName: product.name }) // Modifié ici
      }
    });

    res.json({
      message: 'Produit supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur suppression produit:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du produit' });
  }
});

export default router;