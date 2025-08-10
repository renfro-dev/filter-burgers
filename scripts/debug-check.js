#!/usr/bin/env node

console.log('🔍 Debug Newsletter Check Starting...');

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

console.log('✅ Imports successful');

function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env');
    console.log(`   Loading .env from: ${envPath}`);
    const envContent = readFileSync(envPath, 'utf8');
    const env = {};
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    });
    
    console.log('✅ Environment loaded successfully');
    return env;
  } catch (error) {
    console.log('❌ Error loading .env:', error.message);
    return {};
  }
}

const env = loadEnv();
console.log('✅ Environment variables loaded');

const CLIENT_ID = env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = env.GOOGLE_REFRESH_TOKEN;

console.log(`   Client ID: ${CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
console.log(`   Client Secret: ${CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
console.log(`   Refresh Token: ${REFRESH_TOKEN ? '✅ Set' : '❌ Missing'}`);

if (!CLIENT_SECRET || !REFRESH_TOKEN) {
  console.log('❌ Missing required environment variables');
  process.exit(1);
}

console.log('');
console.log('🔄 Testing OAuth token refresh...');

async function testOAuth() {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Token refresh failed: ${response.status}`);
      console.log(`   Response: ${errorText}`);
      return;
    }

    const tokenData = await response.json();
    console.log(`✅ Access token obtained (expires in ${tokenData.expires_in}s)`);
    
    // Test a simple Gmail API call
    console.log('');
    console.log('🔄 Testing Gmail API access...');
    
    const profileResponse = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileResponse.ok) {
      console.log(`❌ Gmail API access failed: ${profileResponse.status}`);
      return;
    }

    const profile = await profileResponse.json();
    console.log(`✅ Gmail API access successful!`);
    console.log(`   Email: ${profile.emailAddress}`);
    
    console.log('');
    console.log('🎉 Basic OAuth and Gmail API are working!');
    
  } catch (error) {
    console.error('❌ Error during OAuth test:', error.message);
  }
}

console.log('🚀 Starting OAuth test...');
testOAuth().then(() => {
  console.log('✅ Debug script completed');
}).catch((error) => {
  console.error('❌ Debug script failed:', error.message);
});
