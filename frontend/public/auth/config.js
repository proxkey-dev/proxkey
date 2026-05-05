// Authentication Configuration for Static Pages
// This file can be used to configure Supabase settings for static hosting

window.SUPABASE_CONFIG = {
    // Supabase Project Configuration
    SUPABASE_URL: 'https://jiguxwsfuolxsyqkejop.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppZ3V4d3NmdW9seHN5cWtlam9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2NTA2MTksImV4cCI6MjA3MzIyNjYxOX0.T6xrf4iztRa19RP7mZBQPnR6-GRoFaChZJOZCVKtSy4',
    
    // Redirect URLs
    DEFAULT_REDIRECT: '/app',
    SUCCESS_REDIRECT: '/dashboard',
    ERROR_REDIRECT: '/',
    
    // Email Templates
    EMAIL_TEMPLATES: {
        CONFIRM_SIGNUP: '/email-templates/confirm-signup.html',
        INVITE_USER: '/email-templates/invite-user.html',
        MAGIC_LINK: '/email-templates/magic-link.html',
        CHANGE_EMAIL: '/email-templates/change-email.html',
        RESET_PASSWORD: '/email-templates/reset-password.html',
        REAUTHENTICATION: '/email-templates/reauthentication.html'
    },
    
    // Verification Pages
    VERIFICATION_PAGES: {
        CONFIRM: '/auth/confirm.html',
        RESET_PASSWORD: '/auth/reset/index.html',
        MAGIC_LINK: '/auth/magic-link.html'
    }
};

// Make configuration available globally
window.SUPABASE_URL = window.SUPABASE_CONFIG.SUPABASE_URL;
window.SUPABASE_ANON_KEY = window.SUPABASE_CONFIG.SUPABASE_ANON_KEY;
