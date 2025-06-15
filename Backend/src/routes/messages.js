import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { authorize } from '../middleware/auth.js';
import { sendMessage } from '../services/whatsapp.js';

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
 * GET /api/messages - Liste des conversations
 * Groupe les messages par client
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['RECEIVED', 'READ', 'REPLIED']),
  query('search').optional().isString()
], async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return validationError;

    const page = req.query.page || 1;
    const limit = req.query.limit || 20;
    const skip = (page - 1) * limit;

    // Récupérer les conversations groupées par client
    const conversations = await prisma.customer.findMany({
      where: {
        messages: {
          some: {} // Au moins un message
        },
        ...(req.query.search && {
          OR: [
            { name: { contains: req.query.search, mode: 'insensitive' } },
            { phoneNumber: { contains: req.query.search } }
          ]
        })
      },
      skip,
      take: limit,
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 20 // Derniers 20 messages par conversation
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    // Compter les conversations non lues
    const unreadCount = await prisma.message.count({
      where: {
        status: 'RECEIVED',
        isFromCustomer: true
      }
    });

    // Formater les conversations
    const formattedConversations = conversations.map(customer => {
      const messages = customer.messages;
      const unreadMessages = messages.filter(m => m.status === 'RECEIVED' && m.isFromCustomer);
      const lastMessage = messages[0];

      return {
        id: customer.id,
        customerName: customer.name,
        phoneNumber: customer.phoneNumber,
        lastMessage: lastMessage?.content || '',
        timestamp: lastMessage?.createdAt || customer.createdAt,
        unread: unreadMessages.length,
        messages: messages.map(msg => ({
          id: msg.id,
          text: msg.content,
          from: msg.isFromCustomer ? 'customer' : 'agent',
          timestamp: msg.createdAt,
          status: msg.status,
          type: msg.type
        }))
      };
    });

    // Compter le total pour la pagination
    const total = await prisma.customer.count({
      where: {
        messages: {
          some: {}
        }
      }
    });

    res.json({
      conversations: formattedConversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      unreadCount
    });

  } catch (error) {
    console.error('Erreur liste messages:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
  }
});

/**
 * GET /api/messages/:customerId - Messages d'un client spécifique
 */
router.get('/:customerId', [
  param('customerId').isUUID()
], async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return validationError;

    const customer = await prisma.customer.findUnique({
      where: { id: req.params.customerId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    // Marquer les messages comme lus
    await prisma.message.updateMany({
      where: {
        customerId: req.params.customerId,
        status: 'RECEIVED',
        isFromCustomer: true
      },
      data: {
        status: 'READ'
      }
    });

    res.json({
      customer: {
        id: customer.id,
        name: customer.name,
        phoneNumber: customer.phoneNumber
      },
      messages: customer.messages.map(msg => ({
        id: msg.id,
        text: msg.content,
        from: msg.isFromCustomer ? 'customer' : 'agent',
        timestamp: msg.createdAt,
        status: msg.status,
        type: msg.type
      }))
    });

  } catch (error) {
    console.error('Erreur détail messages:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des messages' });
  }
});

/**
 * POST /api/messages/send - Envoyer un message WhatsApp
 */
router.post('/send', [
  body('customerId').isUUID().withMessage('ID client invalide'),
  body('message').notEmpty().withMessage('Message requis'),
  body('message').isLength({ max: 1000 }).withMessage('Message trop long')
], async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return validationError;

    const { customerId, message } = req.body;

    // Récupérer le client
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Client non trouvé' });
    }

    // Envoyer le message via WhatsApp
    const whatsappResponse = await sendMessage(customer.phoneNumber, message);

    // Sauvegarder le message en base
    const savedMessage = await prisma.message.create({
      data: {
        whatsappId: whatsappResponse.messages[0].id,
        customerId: customerId,
        type: 'TEXT',
        content: message,
        direction: 'OUTBOUND',
        isFromCustomer: false,
        status: 'SENT',
        metadata: JSON.stringify({
          sentBy: req.user.name || req.user.email,
          sentAt: new Date().toISOString()
        })
      }
    });

    res.json({
      success: true,
      message: {
        id: savedMessage.id,
        text: savedMessage.content,
        from: 'agent',
        timestamp: savedMessage.createdAt,
        status: savedMessage.status
      }
    });

  } catch (error) {
    console.error('Erreur envoi message:', error);
    res.status(500).json({ 
      error: 'Erreur lors de l\'envoi du message',
      details: error.message 
    });
  }
});

/**
 * PATCH /api/messages/:id/read - Marquer un message comme lu
 */
router.patch('/:id/read', [
  param('id').isUUID()
], async (req, res) => {
  try {
    const validationError = handleValidationErrors(req, res);
    if (validationError) return validationError;

    const message = await prisma.message.update({
      where: { id: req.params.id },
      data: { status: 'READ' }
    });

    res.json({ success: true, message });

  } catch (error) {
    console.error('Erreur marquage message:', error);
    res.status(500).json({ error: 'Erreur lors du marquage du message' });
  }
});

/**
 * GET /api/messages/stats - Statistiques des messages
 */
router.get('/stats/summary', authorize(['ADMIN']), async (req, res) => {
  try {
    const [totalMessages, unreadCount, todayMessages, activeConversations] = await Promise.all([
      // Total des messages
      prisma.message.count(),
      
      // Messages non lus
      prisma.message.count({
        where: {
          status: 'RECEIVED',
          isFromCustomer: true
        }
      }),
      
      // Messages aujourd'hui
      prisma.message.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),
      
      // Conversations actives (dernières 24h)
      prisma.customer.count({
        where: {
          messages: {
            some: {
              createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
              }
            }
          }
        }
      })
    ]);

    res.json({
      totalMessages,
      unreadCount,
      todayMessages,
      activeConversations
    });

  } catch (error) {
    console.error('Erreur stats messages:', error);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques' });
  }
});

export default router;