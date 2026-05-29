# Fence Cost Calculator

Fence Cost Calculator is a production-ready web application for estimating brick fence construction costs. It includes a public calculator interface and a Payload CMS admin area for managing pricing data and supplier price sources.

The current application is built with Next.js, React, TypeScript, Payload CMS, Tailwind CSS, and PostgreSQL.

## Application Areas

- Public calculator: used by external users to enter dimensions, choose bond patterns, configure piers and infill, and calculate estimated costs.
- Pricing API: serves calculator pricing data from Payload CMS with a default pricing fallback.
- Admin area: used by internal company staff to manage pricing items, supplier price sources, and administrative users.

In production, the public calculator can be exposed to the internet, while `/admin` and backend CMS/API routes should be restricted to the company network, VPN, or approved office IP addresses.

## Requirements

- Node.js 22.x
- npm
- PostgreSQL 16 or later

If using `nvm`:

```bash
nvm install 22
nvm use 22
node -v
npm -v
```

## Environment Variables

Create a `.env.local` file in the project root.

```env
DATABASE_URL=postgres://USER:PASSWORD@127.0.0.1:5432/fence_calculator
PAYLOAD_SECRET=replace-with-a-long-random-secret
```

For local development, the PostgreSQL database must already exist and the database user must have access to it.

## Local Development

Install dependencies:

```bash
npm install
```

Initialize the Payload database schema when running against a new local database:

```bash
PAYLOAD_DB_PUSH=true npm run payload:bootstrap
```

Start the development server:

```bash
npm run dev
```

Open the local URL shown in the terminal. The default Next.js port is usually:

```text
http://localhost:3000
```

If port `3000` is already in use, Next.js will choose another available port.

Admin area:

```text
http://localhost:3000/admin
```

On a fresh database, open the first-user page and create the first admin account:

```text
http://localhost:3000/admin/create-first-user
```

## Production Deployment

For server deployment, use the dedicated deployment guide:

[DEPLOYMENT.md](./DEPLOYMENT.md)

The deployment guide covers:

- Company server preparation
- PostgreSQL setup
- Production environment variables
- Payload schema initialization
- Production build
- systemd service setup
- Nginx public website routing
- Internal-only admin access
- HTTPS, firewall, backup, restore, and verification steps

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Initialize Payload schema if enabled, then build the production Next.js application |
| `npm run preview` | Start the production Next.js server with `next start` |
| `npm run lint` | Run ESLint |
| `npm run payload:bootstrap` | Run the Payload schema bootstrap command |

For first deployment or schema changes, run:

```bash
PAYLOAD_DB_PUSH=true npm run payload:bootstrap
```

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Payload CMS 3
- PostgreSQL
- Tailwind CSS 4
- react-konva
- react-i18next

## Project Structure

| Path | Purpose |
| --- | --- |
| `src/app` | Next.js app routes, public site routes, Payload routes, and API routes |
| `src/screens` | Calculator workflow screens |
| `src/components` | Shared React UI components |
| `src/context` | Calculator form state |
| `src/bonds` | Brick bond pattern generation logic |
| `src/payload` | Payload CMS collections, admin components, and security helpers |
| `src/pricing.ts` | Pricing defaults and cost calculation logic |
| `payload.config.ts` | Payload CMS configuration |
| `DEPLOYMENT.md` | Production server deployment guide |

## Verification

Run lint:

```bash
npm run lint
```

Run a production build:

```bash
npm run build
```

Start a production server after building:

```bash
npm run preview
```

Check the pricing endpoint:

```bash
curl http://localhost:3000/pricing-data
```

## Troubleshooting

If the app does not start:

- Confirm Node.js 22.x is being used.
- Confirm dependencies were installed with `npm install` or `npm ci`.
- Confirm `.env.local` exists.
- Confirm `DATABASE_URL` and `PAYLOAD_SECRET` are set.
- Confirm PostgreSQL is running and the database exists.

If `/pricing-data` returns default pricing instead of CMS pricing:

- Confirm the database connection is working.
- Confirm Payload schema bootstrap has been run.
- Check the application logs for database or Payload initialization errors.

If the admin area does not load:

- Confirm the app can connect to PostgreSQL.
- Confirm `PAYLOAD_SECRET` is set.
- Confirm the first admin user has been created on a fresh database.

If the public site is deployed but admin routes are reachable from the internet:

- Review the Nginx access-control rules in `DEPLOYMENT.md`.
- Ensure `/admin`, `/api`, `/graphql`, and `/graphql-playground` are blocked on the public domain.
