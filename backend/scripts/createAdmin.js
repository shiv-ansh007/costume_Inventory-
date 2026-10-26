const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');

async function createAdmin(email, password, name = 'Admin') {
  if (!email || !password) {
    console.error('Usage: node createAdmin.js <email> <password> [name]');
    process.exit(1);
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        password: hashedPassword,
        role: 'ADMIN',
      },
      create: {
        name,
        email,
        password: hashedPassword,
        role: 'ADMIN',
      },
    });

    console.log(`✅ Admin account created/updated successfully!`);
    console.log(`   ID:    ${user.id}`);
    console.log(`   Name:  ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role:  ${user.role}`);
  } catch (error) {
    console.error('❌ Failed to create admin user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const args = process.argv.slice(2);
const email = args[0] || process.env.ADMIN_EMAIL || 'admin@dgscreation.com';
const password = args[1] || process.env.ADMIN_PASSWORD || 'Admin@12345';
const name = args[2] || 'DGS Admin';

createAdmin(email, password, name);
