#!/bin/bash

# ProxKey Website Environment Setup Script
echo "🔧 Setting up ProxKey frontend environment..."

# Check if .env file exists
if [ -f ".env" ]; then
    echo "⚠️  .env file already exists. Backing up to .env.backup"
    cp .env .env.backup
fi

# Create .env file with Supabase configuration
cat > .env << EOF
# Supabase Configuration
VITE_SUPABASE_URL=https://jiguxwsfuolxsyqkejop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppZ3V4d3NmdW9seHN5cWtlam9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2NTA2MTksImV4cCI6MjA3MzIyNjYxOX0.T6xrf4iztRa19RP7mZBQPnR6-GRoFaChZJOZCVKtSy4

# Debug mode for development
VITE_SUPABASE_DEBUG=true
EOF

echo "✅ Environment file created successfully!"
echo ""
echo "📋 Next steps:"
echo "1. Install dependencies: npm install"
echo "2. Start development server: npm run dev"
echo "3. Open http://localhost:5173 in your browser"
echo ""
echo "🔐 To use your own Supabase project:"
echo "1. Create a project at https://supabase.com"
echo "2. Get your project URL and anon key from Settings > API"
echo "3. Update the VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env"
echo "4. Run the database setup SQL from SUPABASE_SETUP.md"
echo ""
echo "🚀 Happy coding!"