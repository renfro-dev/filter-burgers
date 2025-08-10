/**
 * Simple Gmail API Test
 * Tests basic authentication and profile access
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
    console.log('❌ No .env file found');
    return {};
  }
}

async function testGmail() {
  console.log('🧪 Simple Gmail API Test');
  console.log('========================');
  
  const env = loadEnv();
  const CLIENT_ID = env.GOOGLE_CLIENT_ID;
  const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
  const REFRESH_TOKEN = env.GOOGLE_REFRESH_TOKEN;
  
  console.log('Environment variables:');
  console.log(`  Client ID: ${CLIENT_ID ? '✅ Set' : '❌ Missing'}`);
  console.log(`  Client Secret: ${CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`  Refresh Token: ${REFRESH_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log('');
  
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) {
    console.log('❌ Missing required credentials');
    return;
  }
  
  try {
    console.log('🔄 Getting access token...');
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
      console.log(`Response: ${errorText}`);
      return;
    }
    
    const data = await response.json();
    console.log(`✅ Access token obtained (expires in ${data.expires_in}s)`);
    console.log('');
    
    console.log('🔄 Testing Gmail API access...');
    const profileResponse = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    
    if (!profileResponse.ok) {
      console.log(`❌ Profile access failed: ${profileResponse.status}`);
      return;
    }
    
    const profile = await profileResponse.json();
    console.log(`✅ Gmail API working!`);
    console.log(`  Email: ${profile.emailAddress}`);
    console.log(`  Messages: ${profile.messagesTotal}`);
    console.log(`  Threads: ${profile.threadsTotal}`);
    console.log('');
    console.log('🎉 Your OAuth2 setup is working perfectly!');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Always run the test
testGmail();
