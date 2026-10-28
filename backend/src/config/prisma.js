const { PrismaClient } = require('@prisma/client');

let dbUrl = process.env.STORAGE_DATABASE_URL || process.env.STORAGE_PRISMA_DATABASE_URL || process.env.DATABASE_URL;
if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
  dbUrl = process.env.DATABASE_URL;
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: dbUrl,
    },
  },
});

module.exports = prisma;
