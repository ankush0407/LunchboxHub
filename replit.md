# LunchBox - Food Delivery Application

## Overview

LunchBox is a food delivery platform specifically designed for Amazon office locations. The application enables customers to order lunchboxes from local restaurants with delivery to specific Amazon buildings (SLU, Bellevue, Redmond). It features three user roles: customers who place orders, restaurant owners who manage their menus and orders, and admins who oversee the entire platform.

The system is built as a full-stack TypeScript application with a React frontend, Express backend, and PostgreSQL database. It includes features like user authentication, role-based access control, shopping cart functionality, order management, payment integration with Stripe, and weekly menu management.

## Key Features

### Weekly Menu System
- **Restaurant Owner**: Can add structured weekly menus (Monday-Sunday) to each lunchbox via the restaurant dashboard
- **Customer**: Can view weekly menus through an interactive modal popup when viewing lunchboxes
- **Storage**: Weekly menus stored as JSONB in the database with optional fields for each day
- **UI Components**: 
  - Edit form with individual input fields for each day of the week
  - Modal component displaying day-by-day menu items with visual day badges
  - "View Weekly Menu" button appears on lunchbox cards when menu data exists

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, built using Vite for fast development and optimized production builds
- **Routing**: Wouter library for client-side routing with protected routes based on authentication status
- **State Management**: TanStack Query (React Query) for server state management and caching, React Context for client-side state (auth, cart)
- **UI Framework**: Shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling
- **Forms**: React Hook Form with Zod schema validation for type-safe form handling
- **Styling**: Tailwind CSS with custom CSS variables for theming, responsive design with mobile-first approach

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Authentication**: Passport.js with local strategy using scrypt for password hashing
- **Session Management**: Express sessions stored in PostgreSQL using connect-pg-simple
- **API Design**: RESTful endpoints with role-based authorization middleware
- **Error Handling**: Centralized error handling with proper HTTP status codes

### Database Architecture
- **Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM for type-safe database operations and migrations
- **Schema Design**: Normalized relational structure with proper foreign key relationships
- **Tables**: users, restaurants, lunchboxes (with weeklyMenu JSONB), orders, orderItems, emailVerifications, passwordResets with appropriate indexes and constraints
- **Data Types**: PostgreSQL enums for user roles and order statuses, UUIDs for primary keys, JSONB for structured weekly menu data

### Authentication & Authorization
- **Strategy**: Session-based authentication with HTTP-only cookies
- **Password Security**: Scrypt hashing with salt for secure password storage
- **Role-Based Access**: Three-tier system (customer, restaurant_owner, admin) with route protection
- **Session Storage**: PostgreSQL-backed sessions for scalability and persistence
- **Email Verification**: 6-digit verification codes sent after registration, stored with expiry in database
- **Password Reset**: Multi-step flow with 6-digit codes for secure password recovery

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React 18, React DOM, React Hook Form, TanStack Query for frontend state management
- **Build Tools**: Vite for development server and production builds, TypeScript compiler for type checking
- **Backend Framework**: Express.js with TypeScript support via tsx for development

### Database & ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **ORM**: Drizzle ORM with drizzle-kit for migrations and schema management
- **Database Client**: @neondatabase/serverless for connection pooling and WebSocket support

### UI & Styling
- **Component Library**: Radix UI primitives for accessible, unstyled components
- **Styling**: Tailwind CSS for utility-first styling with PostCSS for processing
- **Icons**: Lucide React for consistent iconography

### Authentication & Security
- **Authentication**: Passport.js with passport-local strategy
- **Session Management**: express-session with connect-pg-simple for PostgreSQL storage
- **Password Hashing**: Node.js built-in crypto module with scrypt

### Payment Processing
- **Payment Provider**: Stripe (@stripe/stripe-js, @stripe/react-stripe-js)
- **Integration**: Client-side Stripe Elements for secure payment form handling

### Validation & Type Safety
- **Schema Validation**: Zod for runtime type checking and form validation
- **Form Integration**: @hookform/resolvers for connecting Zod schemas with React Hook Form
- **ORM Integration**: drizzle-zod for generating Zod schemas from database schema

### Development & Tooling
- **Development Server**: Vite with React plugin and runtime error overlay
- **Replit Integration**: @replit/vite-plugin-cartographer and runtime error modal for development
- **Build Process**: esbuild for production server bundling with ESM output