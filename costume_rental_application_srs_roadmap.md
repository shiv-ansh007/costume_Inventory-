# Software Requirements Specification (SRS) & Initial Setup Roadmap
**Project:** Costume Rental Web Application

## 1. System Architecture
The application strictly follows a decoupled architecture, separating the client-side user interface from the server-side business logic and database management.

### 1.1 Frontend (Client-Side)
*   **Framework:** React with Next.js (Pages or App Router).
*   **Styling:** TailwindCSS.
*   **Design Philosophy:** Basic, functional, and minimalist. The UI will focus purely on usability and layout structure (like a wireframe) without heavy colorful styling. Speed and reliable rendering are prioritized over aesthetics for this initial prototype.
*   **Hosting Context:** Can be deployed independently (e.g., Vercel, Netlify).

### 1.2 Backend (Server-Side)
*   **Framework:** Node.js with Express.js.
*   **Database:** MySQL (Relational database required for date-overlap queries).
*   **ORM:** Prisma (for schema management and query building).
*   **File Storage:** Cloudinary (via Multer) for handling catalog images.
*   **Hosting Context:** Runs as a standalone API server (e.g., Heroku, Render, AWS).

---

## 2. Functional Requirements

### 2.1 User Roles
1.  **Client (End-User):** Can browse the catalog, view availability, and submit rental requests.
2.  **Admin (Shop Owner):** Can upload/edit catalog items, view inventory, and approve/manage rental requests.

### 2.2 Core Modules
*   **Authentication & Authorization:** JWT-based login system separating Admin routes from Client routes.
*   **Inventory Management (Admin):** CRUD operations for costumes. Must specify `type` (Rent, Sale, Both), prices, and `total_stock`.
*   **Booking & Availability Engine (Backend):** Must query overlapping date ranges to prevent double-booking items beyond their `total_stock`.
*   **Image Management:** Seamless upload of costume images directly to cloud storage, saving only the URL to the database.

---

## 3. Development Roadmap (Initial Setup Phase)

### Phase 1: Environment & Scaffolding
*   Initialize separate GitHub repositories (or a monorepo) for `/frontend` and `/backend`.
*   Set up local MySQL database server.
*   Initialize Node.js/Express backend and install dependencies (`express`, `prisma`, `cors`, `dotenv`).
*   Initialize Next.js frontend and install TailwindCSS.

### Phase 2: Backend Core (Weeks 1-2)
*   Define Prisma schema (Users, Products, RentalOrders).
*   Run initial database migrations.
*   Build JWT Authentication middleware.
*   Build the Availability Engine API endpoint (`/api/rentals/request`).
*   Integrate Multer + Cloudinary for image uploads (`/api/admin/catalog`).

### Phase 3: Frontend Functional UI (Weeks 2-3)
*   Build basic layout wrapper (Navbar, simple routing).
*   Create Catalog Browse page (Grid layout, basic cards).
*   Create Item Detail page with Start/End Date pickers and dynamic price calculation.
*   Build Admin Dashboard tables (Approval queue) and Upload Form.

### Phase 4: Integration & Testing (Week 4)
*   Connect Next.js frontend to Express.js backend via API calls.
*   Test date-overlap edge cases.
*   Verify JWT token storage (localStorage/cookies) and route protection.