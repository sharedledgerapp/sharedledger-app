# SharedLedger

## Overview
SharedLedger is a mobile-first, invite-only web application for shared finance management. It supports multiple group types — families, roommates, and couples — with expense splitting, debt tracking, balance boards, and settlement features. The platform promotes personal autonomy, consent-based data sharing, and financial awareness within any shared-living arrangement.

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
- **Authentication**: Passport.js with local strategy + Google OAuth 2.0 (passport-google-oauth20), session-based auth (express-session). Apple Sign In route stubs in place (requires Apple Developer credentials to activate).
- **Security**: Scrypt hashing for passwords (password is nullable for OAuth-only users)
- **File Uploads**: Multer for receipt uploads (5MB limit)

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod
- **Session Store**: connect-pg-simple for persistent sessions
- **Schema**: Defined in `shared/schema.ts` with Zod schemas.

### Core Features
- **Group System**: Supports family, roommates, and couple group types with invite codes (FAM-/GRP-/CPL- prefixes). One group per user.
- **Expense Tracking**: Log expenses with receipt OCR scanning, `paymentSource` (personal/group), customizable categories, and split methods (equal/custom/percentage).
- **Expense Splitting**: When creating shared expenses, users can split costs equally, by custom amounts, or by percentage among selected group members.
- **Balance Board**: Tracks net balances for each group member based on shared expenses and settlements. Shows who owes whom.
- **Settlements**: Record debt settlements between group members to clear balances.
- **Goals**: Personal and shared savings goals with approval workflows.
- **Group Management**: Invite-only groups with QR code invite sharing, role management (parent/child for families, member for roommates/couples), dual admin support, leave group option.
- **Group Dashboard**: Aggregated shared spending view, category breakdown, balance board, recent shared expenses — all privacy-focused (no personal data leakage). Roommates get a dedicated minimal dashboard (`RoommatesDashboard.tsx`) with balance board, settle up, and recent shared expenses — no period selector, pie charts, or goals. Couples get a dedicated dashboard (`CouplesDashboard.tsx`) with household spending summary, category pie chart, contribution comparison (informational, no IOU/debt language), shared milestones, and recent shared expenses.
- **Reporting**: Personal spending dashboards, spending activity charts (weekly/monthly), customizable recurring expense tracking.
- **Budgeting**: Per-category budgets with progress tracking, threshold alerts, and notifications.
- **Communication**: Internal messaging system and shared notes.
- **Push Notifications**: Server-side Web Push notifications (VAPID) for daily/weekly/monthly reminders and budget alerts, delivered even when the app is closed. Budget alerts fire once per threshold crossing per budget period, with escalation bands at 110%/125%/150%/200% for continued overspending. Users can mute budget alerts independently via Settings.
- **Multilingual Support**: English and French.
- **PWA**: Progressive Web App capabilities for offline use and installability.

### Registration & Onboarding
- Registration supports two modes: "Create Group" (pick type + name) and "Join Group" (enter invite code or scan QR code).
- Social sign-in: "Continue with Google" and "Continue with Apple" buttons on both login and register forms. Google OAuth is fully functional when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. Apple Sign In routes are stubbed, awaiting Apple Developer credentials.
- OAuth users who sign in without a group are redirected to a group setup form (create or join) before accessing the dashboard.
- Group types: Family, Roommates, Couple — each generates different invite code prefixes.
- QR code scanning on registration uses the device camera to auto-fill the invite code.
- Onboarding screens introduce the app's privacy model and group concept.

### Privacy Model
- Personal expenses, budgets, savings goals, and reports are private to each user.
- Only shared/public expenses appear in the Group Dashboard.
- Balance calculations only use shared expenses and settlements.
- Sharing is consent-based — users choose which expenses to share.

### Shared Code
The `shared/` directory contains common code for both frontend and backend, including database schema definitions (`schema.ts`) and API contract definitions (`routes.ts`).

### Key Files
- `shared/schema.ts` — Database tables (families, users, expenses, expenseSplits, settlements, goals, etc.) with Zod schemas
- `shared/routes.ts` — API contract definitions with typed endpoints
- `server/storage.ts` — Storage interface and implementation (CRUD, balance calculations)
- `server/routes.ts` — Express route handlers
- `client/src/contexts/LanguageContext.tsx` — Translation system (EN/FR)
- `client/src/components/BalanceBoard.tsx` — Balance board and settlement UI
- `client/src/pages/FamilyDashboard.tsx` — Group Dashboard page (family view, conditionally renders RoommatesDashboardView for roommates)
- `client/src/pages/RoommatesDashboard.tsx` — Roommates-specific dashboard view (minimal: balance board, recent expenses, add expense)
- `client/src/pages/CouplesDashboard.tsx` — Couples-specific dashboard view (spending summary, pie chart, contributions, milestones, recent expenses)
- `client/src/pages/FamilyPage.tsx` — Group management page
- `client/src/pages/ExpensesPage.tsx` — Expense tracking with split UI
- `client/src/lib/notifications.ts` — Client-side notification scheduling + Web Push subscription
- `server/push-scheduler.ts` — Server-side push notification scheduler (daily/weekly/monthly reminders, budget alerts)
- `client/public/sw.js` — Service worker with push event handling, caching, offline support

## External Dependencies
- **Database**: PostgreSQL (via `DATABASE_URL`)
- **ORM Migrations**: Drizzle Kit
- **Session Management**: connect-pg-simple (requires `SESSION_SECRET`)
- **UI Libraries**: Radix UI, Lucide React (icons), Embla Carousel, Vaul (drawers), date-fns.
- **AI Integration**: Google Gemini AI (via Replit AI Integrations) for receipt OCR scanning.
