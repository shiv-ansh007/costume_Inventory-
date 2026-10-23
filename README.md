# Costume Rental Web Application

A full-stack costume rental management app built with **Next.js** (frontend) and **Express.js + Prisma** (backend).

---

## Project Structure

```
costumes/
├── backend/                  # Express.js API
│   ├── prisma/
│   │   └── schema.prisma     # Database schema
│   ├── src/
│   │   ├── config/
│   │   │   ├── prisma.js     # Prisma client
│   │   │   └── cloudinary.js # Cloudinary + Multer
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── productController.js
│   │   │   └── rentalController.js
│   │   ├── middleware/
│   │   │   ├── auth.js       # JWT protect + adminOnly
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── authRoutes.js
│   │   │   ├── productRoutes.js
│   │   │   └── rentalRoutes.js
│   │   └── app.js
│   ├── server.js
│   ├── .env.example
│   └── package.json
│
└── frontend/                 # Next.js App Router
    ├── app/
    │   ├── page.tsx          # Home
    │   ├── catalog/
    │   │   ├── page.tsx      # Product list + filters
    │   │   └── [id]/page.tsx # Product detail + rental request
    │   ├── login/page.tsx
    │   ├── register/page.tsx
    │   ├── my-orders/page.tsx
    │   └── admin/page.tsx    # Admin dashboard
    ├── components/
    │   ├── Navbar.tsx
    │   └── ProductCard.tsx
    ├── context/
    │   └── AuthContext.tsx   # JWT auth state
    ├── lib/
    │   └── api.ts            # API client
    └── .env.local
```

---

## Getting Started

### 1. Backend Setup

```bash
cd backend

# Copy and configure env
cp .env.example .env
# Edit .env with your MySQL credentials and Cloudinary keys

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Start dev server
npm run dev   # runs on http://localhost:5000
```

### 2. Frontend Setup

```bash
cd frontend

# .env.local is already configured to point at localhost:5000
npm install
npm run dev   # runs on http://localhost:3000
```

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register client |
| POST | `/api/auth/login` | — | Login |
| GET | `/api/auth/me` | JWT | Current user |
| GET | `/api/products` | — | List products (filterable) |
| GET | `/api/products/:id` | — | Product detail |
| GET | `/api/products/:id/availability` | — | Check date availability |
| POST | `/api/products/admin` | ADMIN | Create product |
| PUT | `/api/products/admin/:id` | ADMIN | Update product |
| DELETE | `/api/products/admin/:id` | ADMIN | Deactivate product |
| POST | `/api/rentals/request` | JWT | Submit rental request |
| GET | `/api/rentals/my-orders` | JWT | My orders |
| DELETE | `/api/rentals/:id` | JWT | Cancel order |
| GET | `/api/rentals/admin/orders` | ADMIN | All orders |
| PATCH | `/api/rentals/admin/orders/:id/status` | ADMIN | Update order status |
| GET | `/api/rentals/admin/dashboard` | ADMIN | Stats |

---

## Admin Credentials

A default admin account has been provisioned:

| Email | Password | Role |
|---|---|---|
| `admin@costumerent.com` | `admin123` | `ADMIN` |

You can log in at `http://localhost:3000/login` with these credentials to access the [Admin Dashboard](http://localhost:3000/admin).

### Promoting another User to Admin

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'user@example.com';
```

Or use Prisma Studio:

```bash
cd backend && npm run db:studio
```

