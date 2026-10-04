# Tamil Vizuthukal — MyClass Content Browser

Client application for browsing school content (Class → Subject → Unit → Sub-Unit → Lesson) with rich content viewers for students and teachers. Built as a mobile-first Progressive Web App (PWA).

## Features

- **Login / Signup** with profile management and password change
- **Student view & Teacher view** with cascade filters (class, subject, unit, sub-unit, lesson)
- **Content viewers:** Notes, Q&A, Books, Slides, Videos, Audio, Flashcards, Worksheets, Question Papers, and Quizzes
- **PDF export & printing** for notes and Q&A (jsPDF / html2canvas)
- **Text-to-Speech** and word highlighting in Q&A view
- **PWA** — installable, offline-ready (service worker)
- **View tracking** for lessons and content items

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Frontend | React 19, TypeScript, Vite 6, Tailwind CSS 3 |
| PWA      | vite-plugin-pwa |
| Backend  | Node.js, Express 4, Mongoose 7 |
| Database | MongoDB (local or Atlas) |
| Other    | Axios, Cloudinary, PDF.js, jsPDF, SweetAlert2, bcryptjs, JSON Web Tokens, Nodemailer |

## Prerequisites

- **Node.js 20.x**
- **MongoDB** — a running local instance (recommended) or a cloud Atlas cluster

## Setup

```bash
# 1. Install frontend dependencies
npm install

# 2. Install backend dependencies
cd api && npm install && cd ..

# 3. Configure environment variables
cp api/.env.example api/.env
#   then edit api/.env with your MONGODB_URI, JWT_SECRET, etc.
```

### MongoDB connection

The backend reads `MONGODB_URI` from `api/.env`. For a local MongoDB use:

```
MONGODB_URI=mongodb://localhost:27017/learning-platform
```

or use your Atlas connection string. Note that the sample `.env.example` values must be replaced with real credentials.

## Run Locally

```bash
npm run dev:all
```

This starts both servers together:

| Server   | URL                    |
|----------|------------------------|
| Frontend | http://localhost:3001 |
| Backend  | http://localhost:5001 |

The frontend proxies `/api` requests to the backend (see `vite.config.ts`).

### Individual scripts

| Command              | Description                                   |
|----------------------|-----------------------------------------------|
| `npm run dev`        | Vite frontend only (port 3001)                |
| `npm run dev:api`    | Backend API only via nodemon (port 5001)      |
| `npm run dev:all`    | Frontend + backend together (concurrently)    |
| `npm run build`      | Production build to `dist/`                   |
| `npm run preview`    | Preview the production build                  |

## Windows Helper Scripts

- **`start.bat`** — verifies the MongoDB service is running (starts it if needed), then launches frontend + backend.
- **`stop.bat`** — stops the frontend (port 3001) and backend (port 5001).
- **`push_to_github.bat`** — commits all changes and pushes to the configured remote.

## Project Structure

```
├── api/                      # Express backend
│   ├── index.js              # Server + database connection
│   ├── models.cjs            # Mongoose models (User, Class, Subject, Unit, ...)
│   ├── routes/index.cjs      # API endpoints
│   └── .env.example          # Environment variable template
├── components/               # UI components
│   ├── content_views/        # Notes, QA, Book, Slide, Video, Audio, Flashcard, Worksheet, Quiz, ...
│   └── Login, Signup, Header, StudentView, TeacherView, MobileHome, ...
├── context/                  # React context (auth, theme, etc.)
├── hooks/                    # Custom hooks
├── services/                 # API clients
├── utils/                    # Shared utilities
├── public/                   # Static assets (logos, fonts, PDF.js worker)
└── vite.config.ts            # Vite + PWA configuration
```

## API Endpoints (prefix `/api`)

| Method | Endpoint                          | Description                      |
|--------|-----------------------------------|----------------------------------|
| POST   | `/auth/login`                     | User login                       |
| POST   | `/auth/signup`                    | User signup                      |
| GET    | `/classes`, `/subjects`, `/units`, `/subUnits`, `/lessons` | Content hierarchy |
| GET    | `/hierarchy/:lessonId`            | Lesson resource tree             |
| GET    | `/content`, `/content/:id/file`   | Content items & files            |
| GET    | `/users/:id/profile`              | User profile                     |
| PUT    | `/users/:id/update-profile`       | Update profile                   |
| PUT    | `/users/:id/change-password`      | Change password                  |
| POST   | `/lessons/:id/view`               | Increment lesson view count      |
| POST   | `/content/:id/view`               | Increment content view count     |

A health check is available at `GET /health` on the backend.

## Environment Variables (`api/.env`)

| Variable                  | Description                          |
|---------------------------|--------------------------------------|
| `MONGODB_URI`             | MongoDB connection string            |
| `JWT_SECRET`              | Secret for token signing             |
| `NODE_ENV`                | `production` / `development`         |
| `PORT`                    | Backend port (default `5001`)        |
| `CLOUDINARY_CLOUD_NAME`   | Cloudinary cloud name                |
| `CLOUDINARY_API_KEY`      | Cloudinary API key                   |
| `CLOUDINARY_API_SECRET`   | Cloudinary API secret                |
| `SENDER_EMAIL`            | Sender email for outgoing mail       |
| `EMAIL_USER`, `EMAIL_PASS`| SMTP credentials (e.g., Brevo)       |
| `SMTP_HOST`, `SMTP_PORT`  | SMTP server settings                 |

> **Security:** `.env` files are git-ignored. Never commit real secrets.

## Deployment

The project is configured for **Vercel** (`vercel.json`). The backend `api/index.js` exports both a Node server (`startServer`) and a serverless handler for Vercel.

```bash
npm run build
```

## Troubleshooting

- **`bad auth: authentication failed`** — the `MONGODB_URI` username/password in `api/.env` are rejected by MongoDB Atlas. Reset the database user password in the Atlas console (Security → Database Access) and update the URI, or point `MONGODB_URI` at a local MongoDB instance.
- **`EADDRINUSE`** — the port is already in use. Run `stop.bat` to free ports `3001`/`5001`, then start again.
