# Family Ledger

## Overview
Family Ledger is a mobile-first, invite-only web application designed for families to track finances, focusing on expense logging, personal savings goals, and role-based access for parents and children. It promotes personal autonomy, consent-based data sharing, and financial awareness within households. The project aims to provide a clear overview of family spending without focusing on strict budgeting.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
### Frontend
- **Framework & Language**: React with TypeScript, Vite
- **UI & Styling**: shadcn/ui (Radix UI primitives), Tailwind CSS
- **State Management**: TanStack React Query
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod for validation
- **Data Visualization**: Recharts for spending summaries
- **Mobile-First Design**: Optimized for mobile with large touch targets and bottom navigation.

### Backend
- **Runtime & Language**: Node.js with Express, TypeScript (ESM)
- **API**: RESTful endpoints, Zod for request/response validation
- **Authentication**: Passport.js with local strategy, session-based auth (express-session)
- **Security**: Scrypt hashing for passwords
- **File Uploads**: Multer for receipt uploads (5MB limit)

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod
- **Session Store**: connect-pg-simple for persistent sessions
- **Schema**: Defined in `shared/schema.ts` with Zod schemas.

### Core Features
- **Expense Tracking**: Log expenses with receipt uploads, `paymentSource` (personal/family), and customizable categories.
- **Goals**: Personal savings goals.
- **Family Management**: Invite-only groups, parent/child roles, dual admin management.
- **Reporting**: Personal spending dashboards, family dashboard for aggregated shared expenses (privacy-focused), and customizable recurring expense tracking.
- **Budgeting**: Per-category budgets with progress tracking and notifications.
- **Communication**: Internal messaging system and shared notes.
- **Notifications**: Customizable user notification reminders (daily, weekly, monthly) using Browser Notification API.
- **Multilingual Support**: English and French.
- **PWA**: Progressive Web App capabilities for offline use and installability.

### Shared Code
The `shared/` directory contains common code for both frontend and backend, including database schema definitions (`schema.ts`) and API contract definitions (`routes.ts`).

## External Dependencies
- **Database**: PostgreSQL (via `DATABASE_URL`)
- **ORM Migrations**: Drizzle Kit
- **Session Management**: connect-pg-simple (requires `SESSION_SECRET`)
- **UI Libraries**: Radix UI, Lucide React (icons), Embla Carousel, Vaul (drawers), date-fns.
- **AI Integration**: Google Gemini AI (via Replit AI Integrations) for receipt OCR scanning.