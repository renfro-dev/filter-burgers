/**
 * OAuth Helper Script
 * Exchanges authorization code for refresh token
 * Run with: node scripts/oauth-helper.js <auth-code> [client-secret]
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

function loadEnv() {
  try {
    const envPath = join(__dirname, '..', '.env');
    const envContent = readFileSync(envPath, 'utf8');
    const env = {};
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    });
    
    return env;
  } catch (error) {
    console.log('No .env file found, using defaults');
    return {};
  }
}

const env = loadEnv();
const CLIENT_ID = env.GOOGLE_CLIENT_ID;
const REDIRECT_URI = 'http://localhost:3000/auth/callback';

const authCode = process.argv[2];
const clientSecret = process.argv[3] || env.GOOGLE_CLIENT_SECRET;

if (!authCode) {
  console.error('Usage: node scripts/oauth-helper.js <auth-code> [client-secret]');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/oauth-helper.js 4/0AfJohXn... your-client-secret');
  console.error('');
  console.error('Or set GOOGLE_CLIENT_SECRET in .env file and run:');
  console.error('  node scripts/oauth-helper.js 4/0AfJohXn...');
  process.exit(1);
}

if (!clientSecret) {
  console.error('Error: Client secret required');
  console.error('Either pass it as second argument or set GOOGLE_CLIENT_SECRET in .env file');
  process.exit(1);
}

async function exchangeCodeForToken() {
  try {
    console.log('Exchanging authorization code for tokens...');
    console.log(`Client ID: ${CLIENT_ID}`);
    console.log(`Redirect URI: ${REDIRECT_URI}`);
    console.log('');

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: clientSecret,
        code: authCode,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token exchange failed:');
      console.error(`Status: ${response.status}`);
      console.error(`Response: ${errorText}`);
      process.exit(1);
    }

    const data = await response.json();
    
    console.log('✅ Token exchange successful!');
    console.log('');
    console.log('Add these to your .env file:');
    console.log('');
    console.log(`GOOGLE_REFRESH_TOKEN=${data.refresh_token}`);
    console.log(`GOOGLE_ACCESS_TOKEN=${data.access_token}`);
    console.log('');
    console.log('Token expires in:', data.expires_in, 'seconds');
    console.log('');
    console.log('Note: The access token will expire, but the refresh token is long-lived.');
    console.log('Use the refresh token to get new access tokens automatically.');

  } catch (error) {
    console.error('Error exchanging code for token:', error.message);
    process.exit(1);
  }
}

exchangeCodeForToken();
