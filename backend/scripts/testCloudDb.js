require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

console.log('Testing connection to Aiven/Railway Cloud MySQL...');

const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as connected, VERSION() as version`;
    console.log('Connection successful!');
    console.log('Database response:', result);
  } catch (err) {
    console.error('Connection failed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
