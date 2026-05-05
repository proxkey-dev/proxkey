# Next.js API Integration for ProxKey

This document describes the Next.js API integration added to the ProxKey project, enabling server-side rendering and API routes with Supabase authentication.

## What's Added

### 1. Supabase Utilities
- **Server Client** (`src/utils/supabase/server.ts`) - For server components and API routes
- **Browser Client** (`src/utils/supabase/client.ts`) - For client-side components
- **Middleware Client** (`src/utils/supabase/middleware.ts`) - For Next.js middleware

### 2. API Routes
- **Example API** (`src/app/api/example/route.ts`) - Demonstrates GET/POST operations with authentication

### 3. Next.js Configuration
- **Next.js Config** (`next.config.js`) - Configured for Supabase integration
- **Middleware** (`src/middleware.ts`) - Authentication and route protection
- **App Router** - Modern Next.js 13+ app directory structure

## Environment Setup

1. **Copy environment variables:**
   ```bash
   cp env.nextjs.example .env.local
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run Next.js development server:**
   ```bash
   npm run dev
   ```

## Available Scripts

- `npm run dev` - Start Next.js development server
- `npm run build` - Build Next.js application
- `npm run start` - Start production server
- `npm run dev:vite` - Start Vite development server (original)
- `npm run build:vite` - Build Vite application (original)

## API Endpoints

### GET /api/example
Returns authenticated user data and profile information.

**Response:**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "profile": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "avatar_url": "https://...",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

### POST /api/example
Updates user profile information.

**Request Body:**
```json
{
  "full_name": "John Doe",
  "avatar_url": "https://example.com/avatar.jpg"
}
```

**Response:**
```json
{
  "profile": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "avatar_url": "https://example.com/avatar.jpg",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

## Authentication Flow

1. **Middleware** checks authentication on protected routes
2. **API routes** validate user sessions using server-side Supabase client
3. **Client components** can use browser client for real-time auth state

## Database Schema

The API expects a `profiles` table with the following structure:

```sql
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Security Features

- **Row Level Security (RLS)** enabled on profiles table
- **Middleware protection** for API routes
- **Server-side authentication** validation
- **Automatic session refresh** via Supabase SSR

## Migration from Vite

The project now supports both Vite and Next.js:

- **Vite** - Original React SPA (use `npm run dev:vite`)
- **Next.js** - Full-stack with API routes (use `npm run dev`)

Both use the same Supabase project and environment variables.
