// backend/src/controllers/whatsappController.js
const whatsappService = require('../services/whatsappService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class WhatsAppController {
  // 🔐 Vérification du webhook (GET) - Meta envoie ça pour vérifier
  async verifyWebhook(req, res) {
    try {
      console.log('🔐 Vérification webhook reçue');
      
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      console.log('Mode:', mode);
      console.log('Token reçu:', token);
      console.log('Token attendu:', process.env.WHATSAPP_WEBHOOK_TOKEN);

      // Vérifier que c'est bien Meta qui appelle
      if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_TOKEN) {
        console.log('✅ Webhook vérifié avec succès');
        res.status(200).send(challenge);
      } else {
        console.log('❌ Token invalide');
        res.sendStatus(403);
      }
    } catch (error) {
      console.error('❌ Erreur vérification webhook:', error);
      res.sendStatus(500);
    }
  }

  // 📥 Réception des messages (POST)
  async handleWebhook(req, res) {
    try {
      console.log('\n📥 Webhook reçu:', JSON.stringify(req.body, null, 2));

      // Toujours répondre 200 rapidement à WhatsApp
      res.sendStatus(200);

      // Parser le message
      const message = whatsappService.parseIncomingMessage(req.body);
      
      if (!message) {
        console.log('⚠️ Pas de message à traiter');
        return;
      }

      console.log('📱 Message de:', message.from);
      console.log('📝 Type:', message.type);
      console.log('💬 Contenu:', message.text || message.interactive);

      // Marquer comme lu
      await whatsappService.markAsRead(message.messageId);

      // Traiter selon le type
      switch (message.type) {
        case 'text':
          await this.handleTextMessage(message);
          break;
        case 'interactive':
          await this.handleInteractiveMessage(message);
          break;
        default:
          console.log('❓ Type de message non géré:', message.type);
      }

    } catch (error) {
      console.error('❌ Erreur traitement webhook:', error);
    }
  }

  // 💬 Gérer les messages texte
  async handleTextMessage(message) {
    const text = message.text.toLowerCase();
    const customerPhone = message.from;

    console.log('💬 Traitement message texte:', text);

    // Trouver ou créer le client
    let customer = await prisma.customer.upsert({
      where: { phone: customerPhone },
      update: {},
      create: {
        phone: customerPhone,
        whatsappId: customerPhone,
        name: message.contact?.name || 'Client',
        language: 'fr' // On détectera la langue plus tard
      }
    });

// Sauvegarder le message (éviter les doublons)
try {
  await prisma.whatsAppMessage.create({
    data: {
      messageId: message.messageId,
      type: 'text',
      content: JSON.stringify(message),
      direction: 'INBOUND',
      status: 'received'
    }
  });
} catch (error) {
  if (error.code === 'P2002') {
    console.log('⚠️ Message déjà traité:', message.messageId);
  } else {
    throw error;
  }
}

    // Logique de réponse simple
    if (text.includes('bonjour') || text.includes('salut') || text.includes('hello')) {
      await this.sendWelcomeMessage(customerPhone, customer.name);
    } 
    else if (text.includes('produit') || text.includes('menu') || text.includes('catalogue')) {
      await this.sendProductList(customerPhone);
    }
    else if (text.includes('commande') || text.includes('panier')) {
      await this.sendOrderStatus(customerPhone, customer.id);
    }
    else {
      // Message par défaut
      await whatsappService.sendTextMessage(
        customerPhone,
        "Désolé, je n'ai pas compris. Tapez 'menu' pour voir nos produits ou 'commande' pour suivre votre commande."
      );
    }
  }

  // 🔘 Gérer les messages interactifs (boutons, listes)
  async handleInteractiveMessage(message) {
    const customerPhone = message.from;
    console.log('🔘 Message interactif reçu:', message.interactive);

    const buttonId = message.interactive.button_reply?.id;
    const listId = message.interactive.list_reply?.id;

    if (buttonId) {
      // Réponse à un bouton
      switch (buttonId) {
        case 'view_products':
          await this.sendProductList(customerPhone);
          break;
        case 'track_order':
          const customer = await prisma.customer.findUnique({
            where: { phone: customerPhone }
          });
          await this.sendOrderStatus(customerPhone, customer?.id);
          break;
        case 'contact':
          await whatsappService.sendTextMessage(
            customerPhone,
            "📞 Vous pouvez nous contacter au +212 5XX XXX XXX ou par email à contact@example.com"
          );
          break;
      }
    } else if (listId) {
      // Un produit sélectionné dans la liste
      await this.handleProductSelection(customerPhone, listId);
    }
  }

  // 🏠 Message de bienvenue
  async sendWelcomeMessage(customerPhone, name) {
    console.log('🏠 Envoi message de bienvenue');
    
    // Pour le test, on envoie le template hello_world
    try {
      await whatsappService.sendTextMessage(
        customerPhone,
        `Bonjour ${name} ! 👋\n\nBienvenue sur WhatsApp Commerce MENA.\n\nComment puis-je vous aider aujourd'hui ?`
      );
    } catch (error) {
      // Si erreur, utiliser le template
      console.log('⚠️ Erreur message texte, utilisation du template');
      const axios = require('axios');
      await axios.post(
        `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          to: customerPhone,
          type: 'template',
          template: {
            name: 'hello_world',
            language: { code: 'en_US' }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
    }
  }

  // 📦 Envoyer la liste des produits
  async sendProductList(customerPhone) {
    console.log('📦 Envoi liste produits');
    
    const products = await prisma.product.findMany({
      where: { isActive: true },
      take: 5
    });

    if (products.length === 0) {
      await whatsappService.sendTextMessage(
        customerPhone,
        "Désolé, aucun produit disponible pour le moment."
      );
      return;
    }

    // Pour le test, on envoie juste un message texte avec les produits
    let productList = "🛍️ *Nos produits disponibles:*\n\n";
    products.forEach((product, index) => {
      productList += `${index + 1}. *${product.nameFr}*\n`;
      productList += `   Prix: ${product.price} MAD\n`;
      productList += `   Stock: ${product.stock} unités\n\n`;
    });

    try {
      await whatsappService.sendTextMessage(customerPhone, productList);
    } catch (error) {
      console.log('⚠️ Erreur envoi liste, utilisation du template');
      // Fallback au template
    }
  }

  // 📋 Statut des commandes
  async sendOrderStatus(customerPhone, customerId) {
    console.log('📋 Envoi statut commandes');
    
    if (!customerId) {
      await whatsappService.sendTextMessage(
        customerPhone,
        "Vous n'avez pas encore de commande."
      );
      return;
    }

    const orders = await prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 3
    });

    if (orders.length === 0) {
      await whatsappService.sendTextMessage(
        customerPhone,
        "Vous n'avez pas encore passé de commande."
      );
    } else {
      let orderText = "📦 *Vos dernières commandes:*\n\n";
      orders.forEach(order => {
        orderText += `Commande: ${order.orderNumber}\n`;
        orderText += `Statut: ${order.status}\n`;
        orderText += `Total: ${order.totalAmount} MAD\n\n`;
      });
      
      await whatsappService.sendTextMessage(customerPhone, orderText);
    }
  }

  // 🛒 Gérer la sélection d'un produit
  async handleProductSelection(customerPhone, productId) {
    console.log('🛒 Produit sélectionné:', productId);
    
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      await whatsappService.sendTextMessage(
        customerPhone,
        "Désolé, ce produit n'est plus disponible."
      );
      return;
    }

    await whatsappService.sendTextMessage(
      customerPhone,
      `Vous avez sélectionné:\n*${product.nameFr}*\nPrix: ${product.price} MAD\n\nPour commander, répondez avec la quantité souhaitée.`
    );
  }
}

module.exports = new WhatsAppController();