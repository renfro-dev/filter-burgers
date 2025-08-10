/**
 * OAuth Setup Script
 * Helps set up Google OAuth2 credentials and environment variables
 * Run with: node scripts/setup-oauth.js
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function loadEnv() {
  const envPath = join(__dirname, '..', '.env');
  if (!existsSync(envPath)) {
    return {};
  }
  
  try {
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
    console.log('Error reading .env file, starting fresh');
    return {};
  }
}

function saveEnv(env) {
  const envPath = join(__dirname, '..', '.env');
  const envContent = Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  
  writeFileSync(envPath, envContent);
  console.log(`✅ Environment variables saved to ${envPath}`);
}

async function setupOAuth() {
  console.log('🔐 Google OAuth2 Setup for Newsletter Processing');
  console.log('================================================');
  console.log('');
  
  const env = loadEnv();
  
  // Step 1: Google Cloud Console Setup
  console.log('📋 Step 1: Google Cloud Console Setup');
  console.log('1. Go to https://console.cloud.google.com/');
  console.log('2. Create a new project or select existing one');
  console.log('3. Enable Gmail API');
  console.log('4. Go to "APIs & Services" > "Credentials"');
  console.log('5. Click "Create Credentials" > "OAuth 2.0 Client IDs"');
  console.log('6. Choose "Desktop application"');
  console.log('7. Add authorized redirect URI: http://localhost:3000/auth/callback');
  console.log('');
  
  const clientId = await question('Enter your OAuth 2.0 Client ID: ');
  if (!clientId) {
    console.log('❌ Client ID is required');
    rl.close();
    return;
  }
  
  const clientSecret = await question('Enter your OAuth 2.0 Client Secret: ');
  if (!clientSecret) {
    console.log('❌ Client Secret is required');
    rl.close();
    return;
  }
  
  // Step 2: Get Authorization Code
  console.log('');
  console.log('📋 Step 2: Get Authorization Code');
  console.log('1. Open this URL in your browser:');
  console.log('');
  
  const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&redirect_uri=http://localhost:3000/auth/callback&scope=https://www.googleapis.com/auth/gmail.readonly&response_type=code&access_type=offline&prompt=consent`;
  console.log(authUrl);
  console.log('');
  console.log('2. Sign in with your Google account');
  console.log('3. Grant permissions to your app');
  console.log('4. Copy the authorization code from the URL (after "code=")');
  console.log('');
  
  const authCode = await question('Enter the authorization code: ');
  if (!authCode) {
    console.log('❌ Authorization code is required');
    rl.close();
    return;
  }
  
  // Step 3: Exchange for Refresh Token
  console.log('');
  console.log('📋 Step 3: Exchange Authorization Code for Refresh Token');
  console.log('Running token exchange...');
  
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: authCode,
        grant_type: 'authorization_code',
        redirect_uri: 'http://localhost:3000/auth/callback',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('❌ Token exchange failed:');
      console.log(`Status: ${response.status}`);
      console.log(`Response: ${errorText}`);
      rl.close();
      return;
    }

    const data = await response.json();
    
    console.log('✅ Token exchange successful!');
    console.log('');
    
    // Step 4: Save to Environment
    console.log('📋 Step 4: Save Environment Variables');
    
    env.GOOGLE_CLIENT_ID = clientId;
    env.GOOGLE_CLIENT_SECRET = clientSecret;
    env.GOOGLE_REFRESH_TOKEN = data.refresh_token;
    env.GOOGLE_ACCESS_TOKEN = data.access_token;
    
    saveEnv(env);
    
    console.log('');
    console.log('🎉 OAuth setup complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Test your setup: node scripts/test-gmail-integration.js');
    console.log('2. Deploy your Supabase functions');
    console.log('3. Process newsletters: node scripts/process-newsletters.js');
    
  } catch (error) {
    console.log('❌ Error during token exchange:', error.message);
  }
  
  rl.close();
}

// Handle script execution
if (import.meta.url === `file://${process.argv[1]}`) {
  setupOAuth().catch(console.error);
}

export { setupOAuth };
