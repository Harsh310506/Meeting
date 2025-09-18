const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

console.log('Environment variables loaded:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');

// Initialize Supabase client with service role for server operations
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Also create a client for anon operations (for auth)
const supabaseAnon = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Test database connection
const testConnection = async () => {
  try {
    console.log('🔍 Testing Supabase connection...');
    console.log('URL:', process.env.SUPABASE_URL);
    console.log('Service Role Key (first 20 chars):', process.env.SUPABASE_SERVICE_ROLE_KEY?.substring(0, 20) + '...');
    
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error && !error.message.includes('relation "users" does not exist')) {
      console.error('❌ Supabase connection error:', error);
    } else {
      console.log('✅ Connected to Supabase database');
    }
  } catch (err) {
    console.error('❌ Database connection error:', err);
  }
};

// Test connection on startup
testConnection();

module.exports = { supabase, supabaseAnon };