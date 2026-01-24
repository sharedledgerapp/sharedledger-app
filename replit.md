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

## Recent Changes (January 2026)

### Receipt OCR Scanning
- Integrated Google Gemini AI via Replit AI Integrations for receipt scanning
- POST `/api/receipts/scan` endpoint processes receipt images and extracts:
  - Amount
  - Category (mapped to app categories)
  - Store name/note
  - Line items
- Confirmation UI allows users to review and accept/reject extracted data before saving

### Currency Preference
- Added `currency` field to users table (default: "USD")
- Supported currencies: USD, EUR, GBP, CAD, AUD, JPY, CHF, CNY, INR, MXN
- Currency selection available in Settings page
- First-time expense prompt for currency selection if not set
- Expense list displays amounts with user's preferred currency symbol

### Multilingual Support
- Translation system via `LanguageContext` with English and French
- All new features include translation keys for both languages

### UI/UX Improvements
- Fixed Select dropdown backgrounds (added `bg-popover` class) to prevent text obscuration
- Added proper `data-testid` attributes for all new interactive elements

### Progressive Web App (PWA)
- **Manifest**: `/manifest.json` with app name, icons, standalone display mode
- **Service Worker**: `/sw.js` with caching strategies:
  - Cache-first for static assets (JS, CSS, images, fonts)
  - Network-first for API calls with offline fallback
  - Navigation fallback to `/` for SPA routing
- **Icons**: 192x192 and 512x512 PNG icons with both "any" and "maskable" purposes
- **Update Flow**: Prompts users when updates are available, reloads on controllerchange
- **iOS/Android Meta Tags**: Full mobile web app capability support

#### Installing the PWA
1. Open the app URL in Chrome (Android) or Safari (iOS)
2. Android: Tap menu (⋮) → "Add to Home Screen" or "Install app"
3. iOS: Tap Share button → "Add to Home Screen"
4. The app will launch in standalone mode without browser UI

#### PWA Best Practices for Testing
- The service worker caches pages and assets as users visit them
- API data is cached for offline viewing (network-first strategy)
- Updates are automatic - users get prompted when new versions are deployed
- The Replit URL remains stable for consistent testing

#### Offline Limitations (Private Testing)
- Assets are cached on-demand (not precached at install time)
- For reliable offline use: Open the app and visit key pages while online first
- After initial use, cached pages and data will work offline
- First-time offline access without prior online use may not work
- This is acceptable for private family testing; production deployment would require additional precaching setup