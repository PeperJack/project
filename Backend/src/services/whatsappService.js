// backend/src/services/whatsappService.js
const axios = require('axios');
const crypto = require('crypto');

class WhatsAppService {
  constructor() {
    this.apiUrl = 'https://graph.facebook.com/v18.0';
    this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    this.token = process.env.WHATSAPP_ACCESS_TOKEN;
    this.webhookToken = process.env.WHATSAPP_WEBHOOK_TOKEN;
  }

  // 🔐 Vérifier la signature du webhook
  verifyWebhook(payload, signature) {
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookToken)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(`sha256=${expectedSignature}`)
    );
  }

  // 📤 Envoyer un message texte simple
  async sendTextMessage(to, text) {
    try {
      console.log(`📤 Envoi message à ${to}: ${text.substring(0, 50)}...`);
      
      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'text',
          text: { body: text }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Message envoyé avec succès');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur envoi WhatsApp:', error.response?.data || error.message);
      throw error;
    }
  }

  // 🔘 Envoyer un message avec boutons
  async sendInteractiveMessage(to, body, buttons) {
    try {
      const buttonData = buttons.slice(0, 3).map((btn, index) => ({
        type: 'reply',
        reply: {
          id: btn.id,
          title: btn.title.substring(0, 20) // Max 20 caractères
        }
      }));

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'interactive',
          interactive: {
            type: 'button',
            body: { text: body },
            action: { buttons: buttonData }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Message interactif envoyé');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur envoi message interactif:', error.response?.data || error.message);
      throw error;
    }
  }

  // 📋 Envoyer une liste de produits
  async sendProductList(to, headerText, bodyText, products) {
    try {
      const sections = [{
        title: 'منتجاتنا',
        rows: products.slice(0, 10).map(product => ({
          id: product.id,
          title: product.nameAr.substring(0, 24), // Max 24 caractères
          description: `${product.price} MAD`
        }))
      }];

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: to,
          type: 'interactive',
          interactive: {
            type: 'list',
            header: {
              type: 'text',
              text: headerText
            },
            body: {
              text: bodyText
            },
            footer: {
              text: 'أسعار بالدرهم المغربي'
            },
            action: {
              button: 'عرض المنتجات',
              sections: sections
            }
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Liste produits envoyée');
      return response.data;
    } catch (error) {
      console.error('❌ Erreur envoi liste:', error.response?.data || error.message);
      throw error;
    }
  }

  // 📥 Parser les messages entrants
  parseIncomingMessage(webhookBody) {
    try {
      const entry = webhookBody.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const message = value?.messages?.[0];
      
      if (!message) return null;

      return {
        from: message.from,
        messageId: message.id,
        timestamp: message.timestamp,
        type: message.type,
        text: message.text?.body,
        interactive: message.interactive,
        // Info sur le contact
        contact: value.contacts?.[0]
      };
    } catch (error) {
      console.error('❌ Erreur parsing message:', error);
      return null;
    }
  }

  // 📊 Marquer un message comme lu
  async markAsRead(messageId) {
    try {
      await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      console.log('✅ Message marqué comme lu');
    } catch (error) {
      console.error('❌ Erreur mark as read:', error.response?.data || error.message);
    }
  }
}

module.exports = new WhatsAppService();