# Manual & Tutorial Management System
**Department of Automobile and Mechanical Engineering — IOE, Thapathali Campus**

A complete full-stack web application for managing laboratory manuals and tutorials. Faculty and authorized staff can upload, organize, and curate content; students can search, filter, and download materials freely. The visual design mirrors the official campus website at [tcioe.edu.np](http://tcioe.edu.np).

---

## ✨ Features

### Public-facing
- 🏠 **Modern homepage** with department branding, statistics, and recently-added manuals
- 📚 **Searchable manual library** with filters (category, semester, full-text search)
- ⬇️ **Direct downloads** of all public manuals — no login required
- 🔍 **Real-time search** with debounced input
- 📱 **Responsive design** — works on mobile, tablet, and desktop
- 🏛️ **About page** with department info, programs, and lab facilities

### Admin Panel
- 🔐 **Secure JWT-based authentication** with bcrypt-hashed passwords
- 📊 **Dashboard** with stats: total manuals, public/private counts, downloads, recent activity, top downloads
- 📤 **Upload manuals** with metadata (title, description, subject, semester, category, visibility)
- ✏️ **Edit manual metadata** without re-uploading the file
- 🔁 **One-click public/private toggle** for each manual
- 🗑️ **Delete manuals** (also removes the underlying file)
- 🗂️ **Category management** — create, edit, delete categories
- 👥 **Multi-admin support** — super-admins can add/remove other admins
- 📋 **Activity log** — every upload, edit, delete, login is recorded
- 🔑 **Password change** for self-service security

### Backend
- 🛡️ JWT auth with HTTP-only cookies
- 📁 File upload via multer (50 MB limit, type-restricted)
- 💾 SQLite database (zero-config, file-based)
- 🔄 Foreign key constraints + WAL journal mode
- 📝 Full CRUD REST API
- 🚦 Role-based access control (admin / super_admin)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Node.js + Express |
| **Database** | SQLite (via better-sqlite3) |
| **Authentication** | JWT + bcrypt |
| **File Uploads** | Multer |
| **Frontend** | Vanilla HTML/CSS/JS (no build step) |
| **Fonts** | Merriweather (display) + Open Sans (body) |

No build tools, no bundlers — just `npm install && npm start`.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js 18+** ([download](https://nodejs.org/))
- npm (comes with Node.js)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Initialize the database (creates database.db + default admin + default categories)
npm run init-db

# 3. (Optional) Copy env example and edit JWT_SECRET
cp .env.example .env

# 4. Start the server
npm start
```

The server will start at **http://localhost:3000**.

### Default Admin Credentials

```
Username: admin
Password: admin123
```

> ⚠️ **Change the default password immediately** by logging in and going to **My Account** in the admin panel.

---

## 📂 Project Structure

```
manuals-system/
├── server.js                  # Express server entry point
├── init-db.js                 # Database initialization script
├── package.json
├── .env.example               # Environment variable template
├── .gitignore
│
├── routes/                    # API route modules
│   ├── auth.js                # Login, logout, password change
│   ├── manuals.js             # Upload, edit, delete, download
│   └── admin.js               # Categories, stats, admin users
│
├── middleware/
│   └── auth.js                # JWT authentication middleware
│
├── public/                    # Frontend (served as static)
│   ├── index.html             # Homepage
│   ├── manuals.html           # Public manual library
│   ├── about.html             # About department
│   ├── login.html             # Admin login
│   ├── admin.html             # Admin dashboard
│   ├── 404.html
│   ├── css/style.css
│   └── js/
│       ├── main.js            # Shared header/footer/helpers
│       └── admin.js           # Admin panel logic
│
├── uploads/                   # Uploaded files (auto-created)
└── database.db                # SQLite database (created by init-db)
```

---

## 🔌 API Reference

### Authentication
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login` | — | Login with username + password |
| POST | `/api/auth/logout` | Admin | Clear session |
| GET  | `/api/auth/me` | Admin | Current admin info |
| POST | `/api/auth/change-password` | Admin | Change own password |

### Manuals
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/api/manuals` | Public | List manuals (admin sees private too) |
| GET    | `/api/manuals/:id` | Public/Admin | Get one manual |
| GET    | `/api/manuals/:id/download` | Public | Download file |
| POST   | `/api/manuals` | Admin | Upload (multipart/form-data) |
| PUT    | `/api/manuals/:id` | Admin | Update metadata |
| PATCH  | `/api/manuals/:id/visibility` | Admin | Toggle public/private |
| DELETE | `/api/manuals/:id` | Admin | Delete manual + file |

### Categories & Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET    | `/api/admin/categories` | Public | List categories |
| POST   | `/api/admin/categories` | Admin | Create category |
| PUT    | `/api/admin/categories/:id` | Admin | Update category |
| DELETE | `/api/admin/categories/:id` | Admin | Delete category |
| GET    | `/api/admin/stats` | Admin | Dashboard statistics |
| GET    | `/api/admin/activity` | Admin | Activity log |
| GET    | `/api/admin/admins` | Super-admin | List admin users |
| POST   | `/api/admin/admins` | Super-admin | Create admin user |
| DELETE | `/api/admin/admins/:id` | Super-admin | Delete admin user |

---

## 🗄️ Database Schema

```
admins
├── id, username, email, password_hash
├── full_name, role ('admin' | 'super_admin')
└── created_at

categories
├── id, name, description
└── created_at

manuals
├── id, title, description, subject, semester
├── category_id → categories.id
├── file_name, original_name, file_size, file_type
├── is_public (0/1), download_count
├── uploaded_by → admins.id
└── created_at, updated_at

activity_log
├── id, admin_id → admins.id
├── action, details
└── created_at
```

Foreign keys are enforced; deleting a category sets `category_id = NULL` on its manuals (manuals are not lost).

---

## 🎨 Design Notes

The visual style intentionally mirrors **tcioe.edu.np**:
- **Navy blue** (`#0a2c5c`) primary with **TU red** (`#c8102e`) accents and **gold** (`#d4af37`) for the accreditation/UGC element
- A top utility bar with quick links to LMS / Routine / EMIS / Library
- A two-line brand block (university → institute → campus → department)
- Sticky main navigation in deep navy
- Footer with grid of quick-access columns and the same red top border

Typography uses **Merriweather** (serif, headings) and **Open Sans** (body) — both common on institutional sites.

---

## 🔒 Security Notes

- Passwords are hashed with **bcrypt** (10 rounds)
- JWT tokens are stored as **HTTP-only cookies** (also returned for API clients)
- File uploads are restricted by **extension whitelist** and **size limit** (50 MB)
- Stored filenames are randomized to prevent path-traversal attacks
- SQL queries use **parameterized statements** (no string concatenation)
- Admin-only endpoints require valid JWT; super-admin endpoints additionally check role

### Production checklist
- [ ] Change `JWT_SECRET` in `.env` to a strong random string
- [ ] Change the default admin password
- [ ] Set `NODE_ENV=production`
- [ ] Put the app behind HTTPS (e.g., via nginx + Let's Encrypt)
- [ ] Add `secure: true` to the cookie options when serving over HTTPS
- [ ] Set up regular backups of `database.db` and `uploads/`

---

## 📋 Default Categories Seeded

1. Thermodynamics Lab
2. Fluid Mechanics Lab
3. Manufacturing Processes
4. Automobile Engineering
5. Machine Design
6. Heat Transfer
7. Internal Combustion Engines
8. Strength of Materials
9. Mechatronics
10. General Tutorials

You can add, edit, or remove these from the admin panel.

---

## 🧪 Quick Test Walk-through

1. Run `npm install && npm run init-db && npm start`
2. Open http://localhost:3000 — homepage shows zero manuals
3. Click **Admin Login** → enter `admin` / `admin123`
4. From the admin panel: **Manuals → Upload New Manual**
5. Fill in title, choose a category, attach a PDF, leave "Make public" checked → Upload
6. Open http://localhost:3000/manuals — your manual appears, downloadable
7. Back in the admin panel, toggle the visibility off → it disappears from the public listing
8. Check the **Activity Log** — every action is recorded

---

## 📝 License

MIT — feel free to adapt for the department's needs.

---

## 👏 Credits

- **Design inspiration**: [tcioe.edu.np](http://tcioe.edu.np) (official campus website)
- **Built for**: Department of Automobile and Mechanical Engineering, IOE Thapathali Campus
