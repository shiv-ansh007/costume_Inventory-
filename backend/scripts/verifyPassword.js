const bcrypt = require('bcryptjs');
const prisma = require('../src/config/prisma');

async function verify(email, testPassword) {
  try {
    const user = await prisma.user.findFirst({
      where: {
        email: {
          equals: email.trim(),
        },
      },
    });

    if (!user) {
      console.log(`❌ No user found with email "${email}"`);
      return;
    }

    console.log(`User found: ID ${user.id}, Name: ${user.name}, Role: ${user.role}`);
    const isMatch = await bcrypt.compare(testPassword, user.password);
    console.log(`Password "${testPassword}" match: ${isMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2] || 'admin@dgscreation.com';
const pass = process.argv[3] || 'Admin@12345';
verify(email, pass);
