import axios from 'axios';
import { config } from 'dotenv';

config();

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;

/**
 * Envoie un message WhatsApp
 * @param {string} to - Numéro de téléphone du destinataire
 * @param {string} message - Message à envoyer
 * @returns {Promise<object>} - Réponse de l'API WhatsApp
 */
export async function sendMessage(to, message) {
  try {
    // Nettoyer le numéro de téléphone
    const cleanNumber = to.replace(/\D/g, '');
    
    console.log(`📤 Envoi message à ${cleanNumber}`);

    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanNumber,
        type: 'text',
        text: {
          preview_url: false,
          body: message
        }
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Message envoyé:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Erreur envoi message:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Envoie un message avec des boutons
 * @param {string} to - Numéro de téléphone
 * @param {string} bodyText - Texte du message
 * @param {Array} buttons - Tableau de boutons [{id, title}]
 */
export async function sendButtonMessage(to, bodyText, buttons) {
  try {
    const cleanNumber = to.replace(/\D/g, '');
    
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanNumber,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: {
            text: bodyText
          },
          action: {
            buttons: buttons.map(btn => ({
              type: 'reply',
              reply: {
                id: btn.id,
                title: btn.title
              }
            }))
          }
        }
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('❌ Erreur envoi boutons:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Envoie une image
 * @param {string} to - Numéro de téléphone
 * @param {string} imageUrl - URL de l'image
 * @param {string} caption - Légende de l'image
 */
export async function sendImage(to, imageUrl, caption) {
  try {
    const cleanNumber = to.replace(/\D/g, '');
    
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanNumber,
        type: 'image',
        image: {
          link: imageUrl,
          caption: caption
        }
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('❌ Erreur envoi image:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Marque un message comme lu
 * @param {string} messageId - ID du message WhatsApp
 */
export async function markAsRead(messageId) {
  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Message marqué comme lu');
    return response.data;
  } catch (error) {
    console.error('❌ Erreur marquage lu:', error.response?.data || error.message);
    // Ne pas throw l'erreur pour ne pas bloquer le traitement
  }
}

/**
 * Envoie un template de message
 * @param {string} to - Numéro de téléphone
 * @param {string} templateName - Nom du template
 * @param {string} languageCode - Code langue (ex: 'en_US', 'fr_FR')
 * @param {Array} components - Paramètres du template
 */
export async function sendTemplate(to, templateName, languageCode = 'en_US', components = []) {
  try {
    const cleanNumber = to.replace(/\D/g, '');
    
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanNumber,
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: languageCode
          },
          components: components
        }
      },
      {
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('❌ Erreur envoi template:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Envoie un catalogue de produits
 * @param {string} to - Numéro de téléphone
 * @param {string} bodyText - Texte d'introduction
 * @param {Array} products - Liste des produits
 */
export async function sendProductCatalog(to, bodyText, products) {
  try {
    const cleanNumber = to.replace(/\D/g, '');
    
    // Formater le message avec les produits
    let message = bodyText + '\n\n';
    
    products.forEach((product, index) => {
      message += `${index + 1}. *${product.name}*\n`;
      message += `   💰 Prix: ${product.price}€\n`;
      message += `   📦 Stock: ${product.stock} unités\n`;
      if (product.description) {
        message += `   📝 ${product.description}\n`;
      }
      message += '\n';
    });
    
    message += '_Répondez avec le numéro du produit pour commander_';
    
    return await sendMessage(to, message);
  } catch (error) {
    console.error('❌ Erreur envoi catalogue:', error);
    throw error;
  }
}

/**
 * Vérifie si un numéro WhatsApp est valide
 * @param {string} phoneNumber - Numéro à vérifier
 */
export async function checkWhatsAppNumber(phoneNumber) {
  try {
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    const response = await axios.get(
      `${WHATSAPP_API_URL}/${PHONE_NUMBER_ID}/phone_numbers`,
      {
        params: {
          fields: 'is_valid,formatted_number',
          phone_number: cleanNumber
        },
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('❌ Erreur vérification numéro:', error.response?.data || error.message);
    return { is_valid: false };
  }
}