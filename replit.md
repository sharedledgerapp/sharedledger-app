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
- `messages` - Family group chat messages
- `notes` - Shared family notes (shopping lists, reminders)
- `recurring_expenses` - Fixed/recurring costs (subscriptions, utilities, taxes, insurance)
- `message_read_status` - Per-user unread message tracking

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

## Recent Changes (February 2026)

### Recurring Expenses Tracking
- New `recurring_expenses` database table for fixed/recurring costs
- Categories: Subscriptions, Utilities, Taxes, Insurance, Other
- Frequencies: Monthly, Quarterly, Yearly
- Home page toggle between "Everyday Expenses" and "Recurring Expenses" views
- **Recurring view features**:
  - Expenses grouped by category with subtotals (normalized to monthly amounts)
  - Grand total of all active recurring expenses (monthly equivalent)
  - Add/edit/delete recurring expense dialog with form validation
  - Pause/resume functionality (isActive toggle)
  - Paused items shown in separate section with reduced opacity
- API endpoints: GET/POST `/api/recurring-expenses`, PATCH/DELETE `/api/recurring-expenses/:id`
- Ownership-scoped: users can only manage their own recurring expenses
- Cascade deletion: user account deletion removes recurring expenses
- Full EN/FR translation support

### Notification Reminders
- User notification preferences (daily, weekly, monthly reminders) stored in database
- Daily reminder with configurable time (default 7pm)
- Browser Notification API integration with service worker
- Notification scheduler checks every minute, uses localStorage to prevent duplicates
- Settings UI with Switch toggles and time picker

### Dual Admin Management
- Maximum 2 parents (admins) per family
- Promote/demote UI on Family page with confirmation dialog
- PATCH `/api/family/members/:id/role` endpoint with security checks

### Internal Messaging & Notes System
- Family group chat accessible via message icon in header (next to profile avatar)
- `/messages` route with two-tab interface: Messages and Saved Notes
- **Messages Tab**: Real-time family chat with:
  - Auto-refreshing every 5 seconds
  - Sender name grouping and smart time formatting
  - Bubble-style UI (own messages right-aligned in primary color, others left-aligned)
  - Send via button or Enter key
- **Saved Notes Tab**: Shared family notes (shopping lists, reminders) with:
  - Create notes with title and optional content
  - Complete/incomplete toggle (checkbox)
  - Delete notes
  - Completed notes shown separately at bottom
  - Creator name and date displayed
- Unread message badge on message icon (polls every 15 seconds)
- API endpoints: GET/POST `/api/messages`, GET `/api/messages/unread`, GET/POST `/api/notes`, PATCH/DELETE `/api/notes/:id`
- Family-scoped security: all message/note operations verified against user's family
- Cascade deletion: user account deletion also removes their messages, notes, and read status

## Previous Changes (January 2026)

### Receipt OCR Scanning
- Integrated Google Gemini AI via Replit AI Integrations for receipt scanning
- POST `/api/receipts/scan` endpoint processes receipt images and extracts:
  - Amount
  - Category (mapped to app categories)
  - Store name/note
  - Line items
- Confirmation UI allows users to review and accept/reject extracted data before saving

### Currency Preference
- Added `currency` field to users table (default: "EUR")
- Supported currencies: USD, EUR, GBP, CAD, AUD, JPY, CHF, CNY, INR, MXN
- Currency selection available in Settings page
- First-time expense prompt for currency selection if not set
- Currency utility (`client/src/lib/currency.ts`) provides `getCurrencySymbol()` and `formatAmount()` helpers
- Currency symbols applied consistently across: HomePage, ExpensesPage, GoalsPage, FamilyDashboard

### Account & Data Deletion
- Users can delete expenses via trash icon on expense cards
- Users can delete goals via trash icon on goal cards
- DELETE `/api/user/account` endpoint for account deletion with cascade:
  - Deletes user's expense splits
  - Deletes user's expenses and their associated splits
  - Deletes user's goal approvals
  - Deletes user's goals and their associated approvals
  - Deletes user's allowances
  - Deletes the user account
- Danger Zone UI in Settings page with confirmation dialog requiring "DELETE" text input
- Full translation support (English/French) for deletion UI

### Payment Source Tracking
- Replaced complex expense splitting with simple payment source indicator
- `paymentSource` field added to expenses table (enum: "personal" | "family")
- "Paid With" toggle in expense dialog: "My Money" vs "Family Money"
- Payment source badge shown on expense cards
- Default: "personal" (My Money)

### Reports Page
- New `/reports` route for historical expense analysis
- Month/week period toggle with navigation
- Total spent summary card with expense count
- Pie chart breakdown by category
- Clickable categories to view individual expenses
- Category detail view shows all expenses in that category for the selected period
- Links from Home page spending breakdown to Reports

### Custom Expense Categories
- Users can customize their expense categories in Settings
- Default categories: Food, Transport, Entertainment, Shopping, Utilities, Education, Health, Other
- `categories` text array field added to users table
- Settings page includes Categories management section with:
  - Add new category (max 20 categories, 30 chars each)
  - Inline edit category names (click to edit)
  - Remove categories
  - Reset to defaults
- Expense dialog uses user's custom categories with fallback to defaults
- Hint link in expense dialog: "Customize categories in Settings"

### Family Dashboard (Privacy-Focused Insights)
- New `/family-dashboard` route for aggregated family financial insights
- GET `/api/family/dashboard` endpoint with period filtering (month/week) and date navigation
- **Privacy Protection**: Only shows expenses with visibility="public" (shared expenses)
  - No individual member spending totals exposed
  - No user IDs or names attached to expense data
  - Aggregation performed server-side for security
- **Features**:
  - Total shared spending summary with expense count
  - Category breakdown pie chart (clickable to drill down)
  - Money source split visualization (Family Money vs Personal Money percentages)
  - Shared family goals with smart status indicators (On Track, Slightly Behind, Behind, Completed)
  - Recent shared expenses list (up to 10 items) with payment source badges
- Accessible via "Shared" tab in bottom nav (mobile) and sidebar (desktop)

### Multilingual Support
- Translation system via `LanguageContext` with English and French
- All new features include translation keys for both languages

### UI/UX Improvements
- Fixed Select dropdown backgrounds by adding missing CSS variables (`--popover`, `--popover-foreground`, `--popover-border`) to index.css
- Dropdown menus now have solid white backgrounds instead of transparent
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