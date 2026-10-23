# Database & Environment Setup Guide

Follow these steps to initialize your database and configure the environment variables required to run the backend server.

## 1. Prerequisites
*   Install **Node.js** (v18+ recommended).
*   Install **MySQL Server** on your local machine (or use a cloud provider like PlanetScale or AWS RDS). Ensure it is running.
*   Create an account on **Cloudinary** (for image hosting).

## 2. Environment Variables (.env)
Create a file named `.env` in the root directory of your **backend** project. Copy and paste the following structure into it. Replace the bracketed text with your actual credentials.

```env
# Server Configuration
PORT=5000

# Security
# Generate a random string for this (e.g., using Node crypto or an online generator)
JWT_SECRET=your_super_secret_jwt_key_here

# Database Configuration (Prisma)
# Format: mysql://USER:PASSWORD@HOST:PORT/DATABASE_NAME
DATABASE_URL="mysql://root:password123@localhost:3306/costume_rental_db"

# Cloudinary Configuration (Get these from your Cloudinary dashboard)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## 3. Database Initialization (Prisma)

Once your MySQL server is running and your `.env` file is saved with the correct `DATABASE_URL`, run the following commands in your backend terminal:

**Step 3.1: Install Prisma**
```bash
npm install prisma --save-dev
npm install @prisma/client
```

**Step 3.2: Initialize Prisma**
```bash
npx prisma init
```
*(This creates a `prisma` folder. Ensure you copy the schema we discussed earlier into `prisma/schema.prisma`)*

**Step 3.3: Run the Migration**
This command reads your schema, creates the actual tables in your MySQL database, and generates the local client.
```bash
npx prisma migrate dev --name init_costume_db
```

**Step 3.4: Generate Prisma Client (Optional but recommended after changes)**
```bash
npx prisma generate
```

## 4. Connecting the Backend
Your Express application will automatically connect to the database via Prisma using the `.env` file. You do not need to write raw MySQL connection pooling code.

Whenever you need database access in your routes, simply require it:
```javascript
const { PrismaClient } = require('@prisma-client/prisma');
const prisma = new PrismaClient();
// Example: await prisma.product.findMany();
```