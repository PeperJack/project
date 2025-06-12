// backend/prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seeding...');

  // 🧹 Nettoyer la base de données
  await prisma.orderItem.deleteMany();
  await prisma.whatsAppMessage.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();

  // 📦 Créer des produits test
  const products = await prisma.product.createMany({
    data: [
      {
        nameAr: 'هاتف ذكي',
        nameFr: 'Smartphone',
        descriptionAr: 'هاتف ذكي بمواصفات عالية',
        descriptionFr: 'Smartphone haute performance',
        price: 2500,
        stock: 10,
        imageUrl: 'https://via.placeholder.com/300x300?text=Smartphone'
      },
      {
        nameAr: 'سماعات لاسلكية',
        nameFr: 'Écouteurs sans fil',
        descriptionAr: 'سماعات بلوتوث عالية الجودة',
        descriptionFr: 'Écouteurs Bluetooth haute qualité',
        price: 350,
        stock: 25,
        imageUrl: 'https://via.placeholder.com/300x300?text=Ecouteurs'
      },
      {
        nameAr: 'ساعة ذكية',
        nameFr: 'Montre connectée',
        descriptionAr: 'ساعة ذكية متعددة الوظائف',
        descriptionFr: 'Montre intelligente multifonctions',
        price: 1200,
        stock: 15,
        imageUrl: 'https://via.placeholder.com/300x300?text=Montre'
      },
      {
        nameAr: 'شاحن محمول',
        nameFr: 'Batterie externe',
        descriptionAr: 'شاحن محمول 20000mAh',
        descriptionFr: 'Power bank 20000mAh',
        price: 180,
        stock: 50,
        imageUrl: 'https://via.placeholder.com/300x300?text=PowerBank'
      },
      {
        nameAr: 'غطاء هاتف',
        nameFr: 'Coque téléphone',
        descriptionAr: 'غطاء حماية للهاتف',
        descriptionFr: 'Coque de protection',
        price: 45,
        stock: 100,
        imageUrl: 'https://via.placeholder.com/300x300?text=Coque'
      }
    ]
  });

  console.log(`✅ ${products.count} produits créés`);

  // 👤 Créer un client test
  const customer = await prisma.customer.create({
    data: {
      whatsappId: '212600000000', // Numéro marocain fictif
      phone: '212600000000',
      name: 'Client Test',
      city: 'Casablanca',
      language: 'ar'
    }
  });

  console.log('✅ Client test créé');

  // 📋 Créer une commande test
  const productsData = await prisma.product.findMany({ take: 2 });
  
  const order = await prisma.order.create({
    data: {
      orderNumber: `CMD-${Date.now()}`,
      customerId: customer.id,
      status: 'PENDING',
      totalAmount: productsData[0].price + productsData[1].price,
      paymentMethod: 'CASHPLUS',
      deliveryAddress: '123 Rue Test, Casablanca',
      items: {
        create: [
          {
            productId: productsData[0].id,
            quantity: 1,
            unitPrice: productsData[0].price,
            totalPrice: productsData[0].price
          },
          {
            productId: productsData[1].id,
            quantity: 1,
            unitPrice: productsData[1].price,
            totalPrice: productsData[1].price
          }
        ]
      }
    },
    include: {
      items: true
    }
  });

  console.log('✅ Commande test créée');

  console.log('\n🎉 Seeding terminé avec succès!');
  console.log('📊 Résumé:');
  console.log(`- ${products.count} produits`);
  console.log('- 1 client');
  console.log('- 1 commande avec 2 articles');
}

main()
  .catch((e) => {
    console.error('❌ Erreur pendant le seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });