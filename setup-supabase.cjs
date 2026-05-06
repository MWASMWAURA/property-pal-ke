const { Pool } = require('pg');
require('dotenv').config();

async function createSupabaseProject() {
    console.log('🔍 Checking Supabase connection...');
    console.log('Current DATABASE_URL:', process.env.DATABASE_URL);
    console.log('');

    console.log('📋 To create a new Supabase project:');
    console.log('1. Go to https://supabase.com');
    console.log('2. Sign up/Login to your account');
    console.log('3. Click "New Project"');
    console.log('4. Choose your organization');
    console.log('5. Enter project details:');
    console.log('   - Name: PropertyHub Kenya');
    console.log('   - Database Password: Choose a strong password');
    console.log('   - Region: Select the closest region (e.g., eu-west-1)');
    console.log('6. Click "Create new project"');
    console.log('');
    console.log('⏳ Wait for the project to be fully provisioned (5-10 minutes)');
    console.log('');
    console.log('🔧 After project creation:');
    console.log('1. Go to Settings > Database in your project dashboard');
    console.log('2. Copy the "Connection string" (PostgreSQL format)');
    console.log('3. Update the DATABASE_URL in your .env file');
    console.log('4. Run this command again to test: node test-db.cjs');
    console.log('');
    console.log('💡 Alternatively, you can use SQLite for local development:');
    console.log('   Comment out the DATABASE_URL line in .env to use local SQLite');
    console.log('');
    console.log('❓ If you already have a Supabase project, check:');
    console.log('- Is the project active (not paused)?');
    console.log('- Is the connection string correct?');
    console.log('- Have you waited for initial setup to complete?');
}

createSupabaseProject();