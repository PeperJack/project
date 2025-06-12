import express from 'express';
import crypto from 'crypto';
import { sendMessage, markAsRead } from '../services/whatsapp.js';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

/**
 * Vérifie la signature du webhook WhatsApp
 * @param {string} payload - Le body brut de la requête
 * @param {string} signature - La signature dans le header x-hub-signature-256
 * @returns {boolean} - True si la signature est valide
 */
function verifyWebhookSignature(payload, signature) {
  if (!process.env.WHATSAPP_APP_SECRET) {
    console.error('⚠️ WHATSAPP_APP_SECRET non configuré - webhook non sécurisé!');
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.WHATSAPP_APP_SECRET)
    .update(payload)
    .digest('hex');

  return signature === `sha256=${expectedSignature}`;
}

// Middleware pour capturer le body brut
router.use(express.raw({ type: 'application/json' }));

// Vérification du webhook (GET)
router.get('/', (req, res) => {
  console.log('🔍 Vérification du webhook WhatsApp');
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Vérification du token secret
  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook vérifié avec succès');
    res.status(200).send(challenge);
  } else {
    console.error('❌ Token de vérification invalide');
    res.sendStatus(403);
  }
});

// Réception des messages (POST)
router.post('/', async (req, res) => {
  try {
    // Vérification de la signature
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = req.body.toString('utf8');
    
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('❌ Signature webhook invalide!');
      return res.sendStatus(401);
    }

    // Parser le body après vérification
    const body = JSON.parse(rawBody);
    console.log('📥 Webhook reçu:', JSON.stringify(body, null, 2));

    // Vérifier la structure du webhook
    if (!body.object || !body.entry || !Array.isArray(body.entry)) {
      console.error('❌ Structure webhook invalide');
      return res.sendStatus(400);
    }

    // Répondre immédiatement à WhatsApp
    res.sendStatus(200);

    // Traiter les messages de manière asynchrone
    for (const entry of body.entry) {
      const changes = entry.changes || [];
      
      for (const change of changes) {
        // Vérifier que c'est un message
        if (change.field !== 'messages' || !change.value.messages) {
          continue;
        }

        const message = change.value.messages[0];
        const contact = change.value.contacts?.[0];
        
        if (!message || !contact) {
          console.warn('⚠️ Message ou contact manquant');
          continue;
        }

        // Validation des données
        const phoneNumber = contact.wa_id?.replace(/[^0-9]/g, '');
        if (!phoneNumber || phoneNumber.length < 10) {
          console.error('❌ Numéro de téléphone invalide:', contact.wa_id);
          continue;
        }

        console.log(`📱 Message de: ${phoneNumber}`);
        console.log(`💬 Contenu: ${message.text?.body || 'Non-texte'}`);

        // Sauvegarder le message avec gestion d'erreur
        try {
          await prisma.message.create({
            data: {
              phoneNumber: phoneNumber,
              message: message.text?.body || '',
              messageType: message.type || 'unknown',
              status: 'received',
              metadata: {
                messageId: message.id,
                timestamp: message.timestamp,
                contactName: contact.profile?.name
              }
            }
          });

          // Marquer comme lu
          await markAsRead(message.id);

          // Traiter la commande
          await processCommand(phoneNumber, message.text?.body || '');
          
        } catch (dbError) {
          console.error('❌ Erreur base de données:', dbError);
          // Continuer avec les autres messages
        }
      }
    }

  } catch (error) {
    console.error('❌ Erreur webhook:', error);
    // Ne pas renvoyer d'erreur 500 pour éviter que WhatsApp retry
    res.sendStatus(200);
  }
});

/**
 * Traite les commandes avec validation
 */
async function processCommand(phoneNumber, text) {
  if (!text || typeof text !== 'string') {
    return;
  }

  const command = text.toLowerCase().trim();
  
  // Limite de longueur pour éviter les abus
  if (command.length > 1000) {
    await sendMessage(phoneNumber, "Message trop long. Tapez 'menu' pour voir les options.");
    return;
  }

  try {
    switch(command) {
      case 'menu':
      case 'produits':
        await showProducts(phoneNumber);
        break;
      
      case 'bonjour':
      case 'salut':
      case 'hello':
        await sendWelcomeMessage(phoneNumber);
        break;
      
      case 'commande':
      case 'commandes':
        await showOrders(phoneNumber);
        break;
      
      default:
        // Vérifier si c'est une commande de produit
        if (command.startsWith('acheter ')) {
          const productId = command.replace('acheter ', '').trim();
          // Validation de l'ID produit
          if (/^\d+$/.test(productId)) {
            await handlePurchase(phoneNumber, parseInt(productId));
          } else {
            await sendMessage(phoneNumber, "ID de produit invalide.");
          }
        } else {
          await sendMessage(phoneNumber, 
            "Désolé, je n'ai pas compris. Tapez 'menu' pour voir les options disponibles."
          );
        }
    }
  } catch (error) {
    console.error('❌ Erreur traitement commande:', error);
    await sendMessage(phoneNumber, 
      "Une erreur s'est produite. Veuillez réessayer plus tard."
    );
  }
}

// Fonctions helper avec gestion d'erreur
async function sendWelcomeMessage(phoneNumber) {
  const message = `🎉 Bienvenue sur WhatsApp Commerce!

Je suis votre assistant shopping. Voici ce que je peux faire:

📱 Tapez "menu" - Voir nos produits
🛍️ Tapez "commande" - Voir vos commandes
💬 Tapez "aide" - Obtenir de l'aide

Comment puis-je vous aider aujourd'hui?`;
  
  await sendMessage(phoneNumber, message);
}

async function showProducts(phoneNumber) {
  try {
    const products = await prisma.product.findMany({
      where: { 
        isActive: true,
        stock: { gt: 0 }
      },
      take: 10 // Limiter le nombre de produits
    });

    if (products.length === 0) {
      await sendMessage(phoneNumber, "Aucun produit disponible pour le moment.");
      return;
    }

    let message = "🛍️ *Nos produits disponibles:*\n\n";
    
    products.forEach((product, index) => {
      message += `${index + 1}. *${product.name}*\n`;
      message += `   Prix: ${product.price}€\n`;
      message += `   Stock: ${product.stock} unités\n`;
      message += `   _Tapez "acheter ${product.id}" pour commander_\n\n`;
    });

    await sendMessage(phoneNumber, message);
  } catch (error) {
    console.error('❌ Erreur récupération produits:', error);
    await sendMessage(phoneNumber, "Impossible de charger les produits.");
  }
}

async function showOrders(phoneNumber) {
  try {
    const orders = await prisma.order.findMany({
      where: { phoneNumber },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 5 // Limiter le nombre de commandes
    });

    if (orders.length === 0) {
      await sendMessage(phoneNumber, "Vous n'avez pas encore de commandes.");
      return;
    }

    let message = "📦 *Vos dernières commandes:*\n\n";
    
    orders.forEach(order => {
      message += `Commande #${order.id}\n`;
      message += `Date: ${order.createdAt.toLocaleDateString()}\n`;
      message += `Statut: ${order.status}\n`;
      message += `Total: ${order.total}€\n`;
      message += `---\n`;
    });

    await sendMessage(phoneNumber, message);
  } catch (error) {
    console.error('❌ Erreur récupération commandes:', error);
    await sendMessage(phoneNumber, "Impossible de charger vos commandes.");
  }
}

async function handlePurchase(phoneNumber, productId) {
  // Validation de l'ID
  if (!productId || productId < 1) {
    await sendMessage(phoneNumber, "ID de produit invalide.");
    return;
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      await sendMessage(phoneNumber, "Ce produit n'existe pas.");
      return;
    }

    if (product.stock < 1) {
      await sendMessage(phoneNumber, "Désolé, ce produit est en rupture de stock.");
      return;
    }

    // Créer la commande dans une transaction
    const order = await prisma.$transaction(async (tx) => {
      // Vérifier à nouveau le stock
      const currentProduct = await tx.product.findUnique({
        where: { id: productId }
      });

      if (currentProduct.stock < 1) {
        throw new Error('Rupture de stock');
      }

      // Créer la commande
      const newOrder = await tx.order.create({
        data: {
          phoneNumber,
          total: product.price,
          status: 'pending',
          items: {
            create: {
              productId: product.id,
              quantity: 1,
              price: product.price
            }
          }
        }
      });

      // Décrémenter le stock
      await tx.product.update({
        where: { id: productId },
        data: { stock: currentProduct.stock - 1 }
      });

      return newOrder;
    });

    await sendMessage(phoneNumber, 
      `✅ Commande confirmée!\n\n` +
      `Produit: ${product.name}\n` +
      `Prix: ${product.price}€\n` +
      `Numéro de commande: #${order.id}\n\n` +
      `Un conseiller vous contactera pour finaliser le paiement et la livraison.`
    );

  } catch (error) {
    console.error('❌ Erreur achat:', error);
    await sendMessage(phoneNumber, 
      "Impossible de traiter votre commande. Veuillez réessayer."
    );
  }
}

export default router;