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
 * GET /api/orders - Liste des commandes avec pagination
 * ADMIN: toutes les commandes
 * USER: seulement ses commandes
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
  query('phoneNumber').optional().isMobilePhone(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return validationError;

    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const skip = (page - 1) * limit;

    // Construire les filtres
    const where = {};

    // Si USER, ne voir que ses commandes
    if (req.user.role === 'USER') {
      where.userId = req.user.id;
    }

    // Filtres additionnels
    if (req.query.status) {
      where.status = req.query.status;
    }

    if (req.query.phoneNumber && req.user.role === 'ADMIN') {
      where.phoneNumber = req.query.phoneNumber;
    }

    if (req.query.startDate || req.query.endDate) {
      where.createdAt = {};
      if (req.query.startDate) where.createdAt.gte = new Date(req.query.startDate);
      if (req.query.endDate) where.createdAt.lte = new Date(req.query.endDate);
    }

    // Requête avec pagination
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true
                }
              }
            }
          },
          user: {
            select: {
              id: true,
              email: true,
              name: true
            }
          }
        }
      }),
      prisma.order.count({ where })
    ]);

    res.json({
      orders: orders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        phoneNumber: order.phoneNumber,
        total: order.total,
        status: order.status,
        itemCount: order.items.length,
        items: order.items,
        user: order.user,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Erreur liste commandes:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des commandes' });
  }
});

/**
 * GET /api/orders/:orderNumber - Détail d'une commande
 */
router.get('/:orderNumber', [
  param('orderNumber').isUUID()
], async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return validationError;

    const where = {
      orderNumber: req.params.orderNumber
    };

    // Si USER, vérifier que c'est sa commande
    if (req.user.role === 'USER') {
      where.userId = req.user.id;
    }

    const order = await prisma.order.findFirst({
      where,
      include: {
        items: {
          include: {
            product: true
          }
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    // Logger l'accès
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'VIEW_ORDER',
        entityType: 'ORDER',
        entityId: order.id.toString(),
        ipAddress: req.ip
      }
    }).catch(console.error);

    res.json(order);

  } catch (error) {
    console.error('Erreur détail commande:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération de la commande' });
  }
});

/**
 * POST /api/orders - Créer une commande
 */
router.post('/', [
  body('phoneNumber').isMobilePhone().withMessage('Numéro de téléphone invalide'),
  body('items').isArray({ min: 1 }).withMessage('Au moins un article requis'),
  body('items.*.productId').isInt({ min: 1 }),
  body('items.*.quantity').isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return validationError;

    const { phoneNumber, items } = req.body;

    // Transaction pour garantir l'intégrité
    const order = await prisma.$transaction(async (tx) => {
      // Vérifier la disponibilité des produits
      const productIds = items.map(item => item.productId);
      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          isActive: true
        }
      });

      if (products.length !== productIds.length) {
        throw new Error('Un ou plusieurs produits invalides');
      }

      // Vérifier le stock
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (product.stock < item.quantity) {
          throw new Error(`Stock insuffisant pour ${product.name}`);
        }
      }

      // Calculer le total
      let total = 0;
      const orderItems = items.map(item => {
        const product = products.find(p => p.id === item.productId);
        const price = Number(product.price);
        total += price * item.quantity;
        
        return {
          productId: item.productId,
          quantity: item.quantity,
          price: price
        };
      });

      // Créer la commande
      const newOrder = await tx.order.create({
        data: {
          phoneNumber,
          userId: req.user.id,
          total,
          status: 'PENDING',
          items: {
            create: orderItems
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        },
        include: {
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // Décrémenter le stock
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity
            }
          }
        });
      }

      // Logger la création
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          action: 'CREATE_ORDER',
          entityType: 'ORDER',
          entityId: newOrder.id.toString(),
          ipAddress: req.ip,
          metadata: {
            orderNumber: newOrder.orderNumber,
            total: newOrder.total,
            itemCount: items.length
          }
        }
      });

      return newOrder;
    });

    res.status(201).json({
      message: 'Commande créée avec succès',
      order
    });

  } catch (error) {
    console.error('Erreur création commande:', error);
    
    if (error.message.includes('Stock insuffisant') || error.message.includes('produits invalides')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Erreur lors de la création de la commande' });
  }
});

/**
 * PATCH /api/orders/:orderNumber/status - Changer le statut (ADMIN)
 */
router.patch('/:orderNumber/status', authorize(['ADMIN']), [
  param('orderNumber').isUUID(),
  body('status').isIn(['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']),
  body('note').optional().trim().isLength({ max: 500 })
], async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return validationError;

    const { status, note } = req.body;

    // Vérifier que la commande existe
    const order = await prisma.order.findUnique({
      where: { orderNumber: req.params.orderNumber }
    });

    if (!order) {
      return res.status(404).json({ error: 'Commande non trouvée' });
    }

    // Vérifier les transitions de statut valides
    const validTransitions = {
      'PENDING': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': ['PROCESSING', 'CANCELLED'],
      'PROCESSING': ['SHIPPED', 'CANCELLED'],
      'SHIPPED': ['DELIVERED', 'REFUNDED'],
      'DELIVERED': ['REFUNDED'],
      'CANCELLED': [],
      'REFUNDED': []
    };

    if (!validTransitions[order.status].includes(status)) {
      return res.status(400).json({ 
        error: `Transition invalide de ${order.status} vers ${status}` 
      });
    }

    // Mettre à jour le statut
    const updatedOrder = await prisma.order.update({
      where: { orderNumber: req.params.orderNumber },
      data: {
        status,
        statusHistory: {
          push: {
            from: order.status,
            to: status,
            date: new Date(),
            userId: req.user.id,
            note
          }
        }
      }
    });

    // Si annulation, restaurer le stock
    if (status === 'CANCELLED' || status === 'REFUNDED') {
      const items = await prisma.orderItem.findMany({
        where: { orderId: order.id }
      });

      for (const item of items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              increment: item.quantity
            }
          }
        });
      }
    }

    // Logger le changement
    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: 'UPDATE_ORDER_STATUS',
        entityType: 'ORDER',
        entityId: order.id.toString(),
        ipAddress: req.ip,
        metadata: {
          orderNumber: order.orderNumber,
          fromStatus: order.status,
          toStatus: status,
          note
        }
      }
    });

    res.json({
      message: 'Statut mis à jour avec succès',
      order: updatedOrder
    });

  } catch (error) {
    console.error('Erreur changement statut:', error);
    res.status(500).json({ error: 'Erreur lors de la mise à jour du statut' });
  }
});

/**
 * GET /api/orders/stats/summary - Statistiques des commandes (ADMIN)
 */
router.get('/stats/summary', authorize(['ADMIN']), async (req, res) => {
  try {
    const [totalOrders, statusCounts, revenueByStatus, todayOrders] = await Promise.all([
      // Total des commandes
      prisma.order.count(),
      
      // Commandes par statut
      prisma.order.groupBy({
        by: ['status'],
        _count: true
      }),
      
      // Revenu par statut
      prisma.order.groupBy({
        by: ['status'],
        _sum: {
          total: true
        }
      }),
      
      // Commandes du jour
      prisma.order.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ]);

    const stats = {
      totalOrders,
      todayOrders,
      ordersByStatus: statusCounts.reduce((acc, curr) => {
        acc[curr.status] = curr._count;
        return acc;
      }, {}),
      revenueByStatus: revenueByStatus.reduce((acc, curr) => {
        acc[curr.status] = curr._sum.total || 0;
        return acc;
      }, {}),
      totalRevenue: revenueByStatus.reduce((sum, curr) => {
        if (['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'].includes(curr.status)) {
          return sum + (Number(curr._sum.total) || 0);
        }
        return sum;
      }, 0)
    };

    res.json(stats);

  } catch (error) {
    console.error('Erreur stats commandes:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

export default router;