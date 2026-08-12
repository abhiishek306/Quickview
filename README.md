# Quickview

Quickview is a full-stack movie ticket booking platform with a React frontend and an Express/MongoDB backend.

## What is included

- Browse movies by section:
  - Movies (all available movies)
  - Theaters (currently in theaters)
  - Releases (recently released)
- Movie details page with trailer playback
- Home trailer gallery with click-to-play behavior
- Seat selection and booking flow
- Stripe checkout integration
- Stripe webhook payment status updates
- Clerk authentication
- Admin area for adding/listing shows and bookings
- Real-time seat updates using Socket.IO
- Production-oriented middleware (rate limiting, helmet, compression, logging)

## Project structure

- `client/`: React + Vite app
- `server/`: Express API + MongoDB

## Prerequisites

- Node.js 18+
- npm
- MongoDB Atlas (or local MongoDB)
- Clerk account
- Stripe account
- TMDB API token

## Environment variables

Create environment files before running.

### Client (`client/.env`)

Example:

```env
VITE_CURRENCY='$'
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_BASE_URL=http://localhost:3000
VITE_TMDB_IMAGE_BASE_URL=https://image.tmdb.org/t/p/original
```

### Server (`server/.env`)

Use your existing server configuration and ensure these are present:

- `MONGODB_URI`
- `CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `TMDB_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `CLIENT_URL` (for Stripe success/cancel redirects)

## Installation

Install dependencies separately:

```bash
npm --prefix client install
npm --prefix server install
```

## Run locally

Start backend:

```bash
npm --prefix server run dev
```

Start frontend:

```bash
npm --prefix client run dev
```

Client default URL: `http://localhost:5173`

Server default URL: `http://localhost:3000`

## Build

Build frontend:

```bash
npm --prefix client run build
```

Server sanity check:

```bash
npm --prefix server run check
```

## Important notes

- There is no root `package.json` script for `npm run dev`.
- Run scripts from `client/` and `server/` (or use `npm --prefix ...`).
- Trailer playback is implemented via YouTube iframe embeds for stability.

## API highlights

- `GET /api/show/now-playing`
- `GET /api/show/all`
- `GET /api/show/:movieId`
- `POST /api/booking/create-booking`
- `POST /api/stripe`

## Deployment

- Frontend and backend can be deployed independently.
- Ensure production environment variables are configured on both services.
- Set proper CORS origins and webhook URLs in production.

## License

This project is provided as-is for educational and development use.
