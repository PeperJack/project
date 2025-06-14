// backend/prisma/seed.js
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from 'dotenv';

// Charger les variables d'environnement
config();

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Début du seeding...');

  // 🧹 Nettoyer la base de données (sauf les users pour ne pas perdre l'admin)
  await prisma.orderItem.deleteMany();
  await prisma.message.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();

  // 👤 Créer l'utilisateur admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeThisPassword123!';

  try {
    // Vérifier si l'admin existe déjà
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          password: hashedPassword,
          name: 'Administrateur',
          role: 'ADMIN',
          isActive: true,
          emailVerified: true
        }
      });

      console.log('✅ Admin créé:', admin.email);
    } else {
      console.log('ℹ️ Admin existe déjà:', adminEmail);
    }
  } catch (error) {
    console.error('❌ Erreur création admin:', error);
  }

  // 📦 Créer des produits test
  const products = await prisma.product.createMany({
    data: [
      {
        name: 'Smartphone',
        nameAr: 'هاتف ذكي',
        nameFr: 'Smartphone',
        descriptionAr: 'هاتف ذكي بمواصفات عالية',
        descriptionFr: 'Smartphone haute performance',
        price: 2500,
        stock: 10,
        category: 'ELECTRONIQUE',
        imageUrl: 'https://via.placeholder.com/300x300?text=Smartphone',
        isActive: true
      },
      {
        name: 'Écouteurs sans fil',
        nameAr: 'سماعات لاسلكية',
        nameFr: 'Écouteurs sans fil',
        descriptionAr: 'سماعات بلوتوث عالية الجودة',
        descriptionFr: 'Écouteurs Bluetooth haute qualité',
        price: 350,
        stock: 25,
        category: 'ELECTRONIQUE',
        imageUrl: 'https://via.placeholder.com/300x300?text=Ecouteurs',
        isActive: true
      },
      {
        name: 'Montre connectée',
        nameAr: 'ساعة ذكية',
        nameFr: 'Montre connectée',
        descriptionAr: 'ساعة ذكية متعددة الوظائف',
        descriptionFr: 'Montre intelligente multifonctions',
        price: 1200,
        stock: 15,
        category: 'ELECTRONIQUE',
        imageUrl: 'https://via.placeholder.com/300x300?text=Montre',
        isActive: true
      },
      {
        name: 'Batterie externe',
        nameAr: 'شاحن محمول',
        nameFr: 'Batterie externe',
        descriptionAr: 'شاحن محمول 20000mAh',
        descriptionFr: 'Power bank 20000mAh',
        price: 180,
        stock: 50,
        category: 'ACCESSOIRES',
        imageUrl: 'https://via.placeholder.com/300x300?text=PowerBank',
        isActive: true
      },
      {
        name: 'Coque téléphone',
        nameAr: 'غطاء هاتف',
        nameFr: 'Coque téléphone',
        descriptionAr: 'غطاء حماية للهاتف',
        descriptionFr: 'Coque de protection',
        price: 45,
        stock: 100,
        category: 'ACCESSOIRES',
        imageUrl: 'https://via.placeholder.com/300x300?text=Coque',
        isActive: true
      }
    ]
  });

  console.log(`✅ ${products.count} produits créés`);

  // 👤 Créer un client test
  const customer = await prisma.customer.create({
    data: {
      whatsappId: '212600000000', // Numéro marocain fictif
      phoneNumber: '+212600000000',
      name: 'Client Test',
      city: 'Casablanca',
      preferredLanguage: 'fr'
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
      total: productsData[0].price + productsData[1].price,
      shippingAddress: '123 Rue Test, Casablanca',
      shippingCity: 'Casablanca',
      shippingMethod: 'STANDARD',
      paymentStatus: 'PENDING',
      items: {
        create: [
          {
            productId: productsData[0].id,
            quantity: 1,
            price: productsData[0].price
          },
          {
            productId: productsData[1].id,
            quantity: 1,
            price: productsData[1].price
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
  console.log(`- 1 admin: ${adminEmail}`);
  
  console.log('\n🔐 Connexion admin:');
  console.log(`   Email: ${adminEmail}`);
  console.log(`   Mot de passe: ${adminPassword}`);
}

main()
  .catch((e) => {
    console.error('❌ Erreur pendant le seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });