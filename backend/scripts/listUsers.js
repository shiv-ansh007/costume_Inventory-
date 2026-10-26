const prisma = require('../src/config/prisma');

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });
    console.log('--- ALL REGISTERED USERS ---');
    console.table(users);
  } catch (err) {
    console.error('Error listing users:', err);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();
