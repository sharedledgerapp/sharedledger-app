# Family Ledger

## Overview

Family Ledger is a mobile-first, invite-only household financial tracking web application designed for families with teens and young adults. The app prioritizes personal autonomy, consent-based data sharing, and financial awareness. It focuses on expense tracking rather than budgeting, with features including expense logging with receipt uploads, personal savings goals, family group management with invite codes, and role-based access (parent/child).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, bundled via Vite
- **Routing**: Wouter (lightweight client-side routing)
- **State Management**: TanStack React Query for server state caching and synchronization
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens (CSS variables for theming)
- **Charts**: Recharts for data visualization on spending summaries
- **Forms**: React Hook Form with Zod resolver for validation
- **Mobile-First Design**: Large touch targets, bottom navigation, safe area handling for mobile browsers

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Design**: RESTful endpoints defined in `shared/routes.ts` with Zod schemas for request/response validation
- **Authentication**: Passport.js with local strategy, session-based auth using express-session
- **Password Security**: Scrypt hashing with random salts
- **File Uploads**: Multer with memory storage (5MB limit for receipts)

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema-to-validation integration
- **Session Store**: connect-pg-simple for persistent sessions in PostgreSQL
- **Schema Location**: `shared/schema.ts` contains all table definitions and Zod schemas

### Key Database Tables
- `families` - Family groups with unique invite codes
- `users` - User accounts with role (parent/child) and family association
- `expenses` - Individual expense entries with visibility controls (private/public)
- `goals` - Personal and family savings goals
- `allowances` - Parent-set recurring allowances for children

### Shared Code Pattern
The `shared/` directory contains code used by both frontend and backend:
- `schema.ts` - Database schema definitions and Zod validation schemas
- `routes.ts` - API contract definitions with paths, methods, and type schemas

### Build System
- **Development**: tsx for running TypeScript directly
- **Production Build**: Custom build script using esbuild for server bundling and Vite for client
- **Output**: `dist/` directory with `index.cjs` (server) and `public/` (client assets)

## External Dependencies

### Database
- PostgreSQL (required, connection via `DATABASE_URL` environment variable)
- Drizzle Kit for schema migrations (`npm run db:push`)

### Session Management
- Sessions stored in PostgreSQL via connect-pg-simple
- `SESSION_SECRET` environment variable for session encryption

### Third-Party UI Libraries
- Radix UI primitives for accessible component foundations
- Lucide React for icons
- Embla Carousel for carousels
- Vaul for drawer components
- date-fns for date formatting

### Replit-Specific Integrations
- `@replit/vite-plugin-runtime-error-modal` for development error display
- `@replit/vite-plugin-cartographer` and `@replit/vite-plugin-dev-banner` for Replit development experience