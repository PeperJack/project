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

  // 👤 Créer l'utilisateur admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'test1234';

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
        description: 'Smartphone haute performance',
        price: 2500,
        stock: 10,
        category: 'ELECTRONIQUE',
        imageUrl: 'https://via.placeholder.com/300x300?text=Smartphone',
        isActive: true
      },
      {
        name: 'Écouteurs sans fil',
        description: 'Écouteurs Bluetooth haute qualité',
        price: 350,
        stock: 25,
        category: 'ELECTRONIQUE',
        imageUrl: 'https://via.placeholder.com/300x300?text=Ecouteurs',
        isActive: true
      },
      {
        name: 'Montre connectée',
        description: 'Montre intelligente multifonctions',
        price: 1200,
        stock: 15,
        category: 'ELECTRONIQUE',
        imageUrl: 'https://via.placeholder.com/300x300?text=Montre',
        isActive: true
      },
      {
        name: 'Batterie externe',
        description: 'Power bank 20000mAh',
        price: 180,
        stock: 50,
        category: 'ACCESSOIRES',
        imageUrl: 'https://via.placeholder.com/300x300?text=PowerBank',
        isActive: true
      },
      {
        name: 'Coque téléphone',
        description: 'Coque de protection',
        price: 45,
        stock: 100,
        category: 'ACCESSOIRES',
        imageUrl: 'https://via.placeholder.com/300x300?text=Coque',
        isActive: true
      },
      {
        name: 'Produit Test (sans commandes)',
        description: 'Ce produit peut être supprimé pour tester la fonction de suppression',
        price: 99,
        stock: 50,
        category: 'TEST',
        imageUrl: 'https://via.placeholder.com/300x300?text=Test',
        isActive: true
      }
    ]
  });

  console.log(`✅ ${products.count} produits créés`);

  console.log('\n🎉 Seeding terminé avec succès!');
  console.log('📊 Résumé:');
  console.log(`- ${products.count} produits`);
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