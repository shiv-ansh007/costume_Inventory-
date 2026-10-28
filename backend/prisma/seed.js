const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const sampleCostumes = [
  {
    name: 'Medieval Knight Armor Costume',
    description: 'Full body metallic finish knight armor suit with chainmail tunic, helmet, and faux leather belt. Perfect for renaissance faires and theatrical events.',
    type: 'RENT',
    rentalPrice: 35.00,
    salePrice: 180.00,
    totalStock: 5,
    imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=800&q=80',
    category: 'Cosplay',
    isActive: true,
  },
  {
    name: 'Victorian Steampunk Gentleman',
    description: 'Double-breasted velvet waistcoat, tailcoat, cravat, and top hat with brass welding goggles and gear adornments.',
    type: 'RENT',
    rentalPrice: 28.00,
    salePrice: 140.00,
    totalStock: 4,
    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=800&q=80',
    category: 'Adult',
    isActive: true,
  },
  {
    name: 'Galaxy Astronaut Flight Suit',
    description: 'Detailed NASA-style white space flight suit with embroidered mission patches, zippered pockets, and padded collar.',
    type: 'BOTH',
    rentalPrice: 25.00,
    salePrice: 120.00,
    totalStock: 6,
    imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
    category: 'Adult',
    isActive: true,
  },
  {
    name: 'Little Superhero Cape & Mask Set',
    description: 'Vibrant reversible satin superhero cape with matching felt mask and wrist cuffs. Sized for kids ages 4-10.',
    type: 'RENT',
    rentalPrice: 12.00,
    salePrice: 45.00,
    totalStock: 10,
    imageUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=800&q=80',
    category: 'Kids',
    isActive: true,
  },
  {
    name: 'Enchanted Forest Fairy Dress',
    description: 'Handcrafted emerald green layered tulle dress with sparkling sequin bodice, detachable iridescent wings, and floral hair wreath.',
    type: 'RENT',
    rentalPrice: 22.00,
    salePrice: 95.00,
    totalStock: 4,
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=800&q=80',
    category: 'Kids',
    isActive: true,
  },
  {
    name: 'Pirate Captain Deluxe Tricorne & Cutlass',
    description: 'Weathered brown leather-look tricorn pirate hat with gold filigree trim, matching eye patch, and ornate prop cutlass sword.',
    type: 'BOTH',
    rentalPrice: 15.00,
    salePrice: 55.00,
    totalStock: 8,
    imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80',
    category: 'Accessories',
    isActive: true,
  },
];

const bcrypt = require('bcryptjs');

async function main() {
  console.log('Provisioning default Admin account...');
  const adminEmail = 'admin@costumerent.com';
  const hashedPassword = await bcrypt.hash('admin123', 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      password: hashedPassword,
      role: 'ADMIN',
      name: 'Store Admin',
    },
    create: {
      name: 'Store Admin',
      email: adminEmail,
      password: hashedPassword,
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin provisioned: ${admin.email} (Role: ${admin.role})`);

  // Provision second admin: admin@dgscreation.com
  const dgsEmail = 'admin@dgscreation.com';
  const dgsHashedPassword = await bcrypt.hash('Admin@12345', 12);
  const dgsAdmin = await prisma.user.upsert({
    where: { email: dgsEmail },
    update: {
      password: dgsHashedPassword,
      role: 'ADMIN',
      name: 'DGS Creation Admin',
    },
    create: {
      name: 'DGS Creation Admin',
      email: dgsEmail,
      password: dgsHashedPassword,
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin provisioned: ${dgsAdmin.email} (Role: ${dgsAdmin.role})`);

  console.log('Seeding demo costume products...');
  for (const costume of sampleCostumes) {
    const existing = await prisma.product.findFirst({
      where: { name: costume.name },
    });
    if (!existing) {
      await prisma.product.create({ data: costume });
    }
  }
  const count = await prisma.product.count();
  console.log(`✅ Seed completed. Total products in database: ${count}`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
