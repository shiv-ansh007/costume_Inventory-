const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');

async function setup() {
  try {
    const defaultPassword = 'Admin@12345';
    const hashedPassword = await bcrypt.hash(defaultPassword, 12);

    // 1. admin@dgscreation.com
    const admin1 = await prisma.user.upsert({
      where: { email: 'admin@dgscreation.com' },
      update: {
        name: 'DGS Admin',
        password: hashedPassword,
        role: 'ADMIN',
      },
      create: {
        name: 'DGS Admin',
        email: 'admin@dgscreation.com',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
    console.log(`✅ Configured: ${admin1.email} (Role: ${admin1.role})`);

    // 2. admin@costumerent.com
    const admin2 = await prisma.user.upsert({
      where: { email: 'admin@costumerent.com' },
      update: {
        name: 'Admin User',
        password: hashedPassword,
        role: 'ADMIN',
      },
      create: {
        name: 'Admin User',
        email: 'admin@costumerent.com',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
    console.log(`✅ Configured: ${admin2.email} (Role: ${admin2.role})`);

    // 3. Upsert shivanshsingh9876@gmail.com as ADMIN
    const shivansh = await prisma.user.upsert({
      where: { email: 'shivanshsingh9876@gmail.com' },
      update: {
        role: 'ADMIN',
      },
      create: {
        name: 'Shivansh Singh',
        email: 'shivanshsingh9876@gmail.com',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
    console.log(`✅ Configured ADMIN: ${shivansh.email}`);

    console.log('\n--- Setup Complete ---');
    console.log('Login credentials available:');
    console.log('1. Email: admin@dgscreation.com    | Password: Admin@12345 (or admin123)');
    console.log('2. Email: admin@costumerent.com    | Password: Admin@12345 (or admin123)');
    console.log('3. Email: shivanshsingh9876@gmail.com (Your personal account, now also ADMIN)');
  } catch (err) {
    console.error('Error during setup:', err);
  } finally {
    await prisma.$disconnect();
  }
}

setup();
