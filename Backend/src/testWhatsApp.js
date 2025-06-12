// backend/src/testWhatsApp.js
require('dotenv').config();
const whatsappService = require('./services/whatsappService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testWhatsApp() {
  try {
    console.log('🧪 Test WhatsApp Commerce MENA\n');
    
    // Le numéro pour recevoir les messages test
    // IMPORTANT: Change ce numéro par TON numéro WhatsApp personnel!
    const testPhoneNumber = '33677019589'; // Format: 212 pour Maroc + numéro sans 0
    
    console.log(`📱 Envoi vers: ${testPhoneNumber}`);
    console.log('⚠️  Assure-toi que ce numéro est autorisé dans Meta!\n');

    // 1️⃣ Test message simple
    console.log('1️⃣ Test message texte simple...');
    await whatsappService.sendTextMessage(
      testPhoneNumber,
      '🌟 مرحبا! هذا اختبار من WhatsApp Commerce MENA\n\nBonjour! Ceci est un test.'
    );
    
    // Attendre 2 secondes entre les messages
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 2️⃣ Test message avec boutons
    console.log('\n2️⃣ Test message avec boutons...');
    await whatsappService.sendInteractiveMessage(
      testPhoneNumber,
      'كيف يمكنني مساعدتك؟\nComment puis-je vous aider?',
      [
        { id: 'view_products', title: 'عرض المنتجات' },
        { id: 'track_order', title: 'تتبع طلبي' },
        { id: 'contact', title: 'اتصل بنا' }
      ]
    );

    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3️⃣ Test liste de produits
    console.log('\n3️⃣ Test liste de produits...');
    const products = await prisma.product.findMany({
      where: { isActive: true },
      take: 5
    });

    if (products.length > 0) {
      await whatsappService.sendProductList(
        testPhoneNumber,
        '🛍️ منتجاتنا المتوفرة',
        'اختر المنتج الذي يعجبك:',
        products
      );
    }

    console.log('\n✅ Tous les tests terminés avec succès!');
    console.log('📱 Vérifie ton WhatsApp pour voir les messages!');

  } catch (error) {
    console.error('\n❌ Erreur pendant les tests:', error.message);
    
    if (error.response?.data) {
      console.error('Détails:', JSON.stringify(error.response.data, null, 2));
    }

    console.log('\n💡 Conseils de dépannage:');
    console.log('1. Vérifie que le numéro est ajouté dans Meta Business');
    console.log('2. Le token est-il toujours valide? (expire après 24h)');
    console.log('3. Le numéro est au bon format? (212XXXXXXXXX pour Maroc)');
  } finally {
    await prisma.$disconnect();
  }
}

// Lancer le test
testWhatsApp();