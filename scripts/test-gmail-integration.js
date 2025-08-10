/**
 * Test Gmail Integration Script
 * Verifies that Gmail API authentication and email fetching works
 * Run with: node scripts/test-gmail-integration.js
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Load environment variables from .env file
dotenv.config({ path: join(__dirname, '..', '.env') });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

async function testGmailIntegration() {
  console.log('🧪 Testing Gmail API Integration');
  console.log('================================');
  console.log('');

  // Check environment variables
  if (!CLIENT_SECRET || !REFRESH_TOKEN) {
    console.log('❌ Missing required environment variables:');
    if (!CLIENT_SECRET) console.log('   - GOOGLE_CLIENT_SECRET');
    if (!REFRESH_TOKEN) console.log('   - GOOGLE_REFRESH_TOKEN');
    console.log('');
    console.log('Run the setup script first:');
    console.log('  node scripts/setup-oauth.js');
    return;
  }

  console.log('✅ Environment variables loaded');
  console.log(`   Client ID: ${CLIENT_ID.substring(0, 20)}...`);
  console.log(`   Client Secret: ${CLIENT_SECRET ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Refresh Token: ${REFRESH_TOKEN ? '✅ Set' : '❌ Missing'}`);
  console.log('');

  try {
    // Test 1: Get access token
    console.log('🔄 Test 1: Getting access token...');
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        refresh_token: REFRESH_TOKEN,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.log(`❌ Token refresh failed: ${tokenResponse.status}`);
      console.log(`   Response: ${errorText}`);
      return;
    }

    const tokenData = await tokenResponse.json();
    console.log(`✅ Access token obtained (expires in ${tokenData.expires_in}s)`);
    console.log('');

    // Test 2: Get user profile
    console.log('🔄 Test 2: Getting user profile...');
    const profileResponse = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileResponse.ok) {
      console.log(`❌ Profile fetch failed: ${profileResponse.status}`);
      return;
    }

    const profile = await profileResponse.json();
    console.log(`✅ Profile loaded: ${profile.emailAddress}`);
    console.log(`   Messages total: ${profile.messagesTotal}`);
    console.log(`   Threads total: ${profile.threadsTotal}`);
    console.log('');

    // Test 3: Search for newsletter emails
    console.log('🔄 Test 3: Searching for newsletter emails...');
    await searchNewsletterEmails(tokenData.access_token);

  } catch (error) {
    console.log('❌ Integration test failed:', error.message);
  }
}

async function searchNewsletterEmails(accessToken) {
  const queries = [
    'from:theneuron@newsletter.theneurondaily.com newer_than:7d',
    'from:dan@tldrnewsletter.com newer_than:7d', 
    'from:news@daily.therundown.ai newer_than:7d',
    'from:futuretools@mail.beehiiv.com newer_than:7d',
    'from:aibreakfast@mail.beehiiv.com newer_than:7d'
  ];

  let totalFound = 0;

  for (const query of queries) {
    try {
      const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=5`;
      const response = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        console.log(`   ❌ Search failed for "${query}": ${response.status}`);
        continue;
      }

      const data = await response.json();
      const count = data.messages ? data.messages.length : 0;
      totalFound += count;

      // Extract newsletter name from query
      const newsletter = query.includes('theneuron') ? 'The Neuron' :
                       query.includes('tldr') ? 'TLDR' :
                       query.includes('rundown') ? 'The Rundown' :
                       query.includes('futuretools') ? 'FutureTools' :
                       query.includes('aibreakfast') ? 'AI Breakfast' : 'Unknown';

      console.log(`   📧 ${newsletter}: ${count} emails found`);
      
      // Show sample email details
      if (count > 0 && data.messages[0]) {
        const emailId = data.messages[0].id;
        const emailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (emailResponse.ok) {
          const email = await emailResponse.json();
          const headers = email.payload.headers;
          const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'No subject';
          const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'No sender';
          console.log(`      Sample: "${subject}" from ${from}`);
        }
      }

    } catch (error) {
      console.log(`   ❌ Error searching "${query}": ${error.message}`);
    }
  }

  console.log('');
  console.log(`📊 Total newsletter emails found: ${totalFound}`);
  
  if (totalFound === 0) {
    console.log('⚠️  No newsletter emails found. This could mean:');
    console.log('   - No recent newsletters in the last 7 days');
    console.log('   - Sender patterns have changed');
    console.log('   - Gmail search queries need updating');
  }
}

// Run the test
testGmailIntegration().catch(console.error);

export { testGmailIntegration };
