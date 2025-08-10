/**
 * Newsletter Checker Script
 * Searches Gmail for actual newsletter senders to help configure the system
 * Run with: node scripts/check-newsletters.js
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

const env = loadEnv();
const CLIENT_ID = env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = env.GOOGLE_REFRESH_TOKEN;

async function checkNewsletters() {
  console.log('🔍 Newsletter Sender Discovery Tool');
  console.log('==================================');
  console.log('');

  if (!CLIENT_SECRET || !REFRESH_TOKEN) {
    console.log('❌ Missing required environment variables');
    console.log('Run the setup script first: node scripts/setup-oauth.js');
    return;
  }

  try {
    // Get access token
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
      console.log(`❌ Token refresh failed: ${tokenResponse.status}`);
      return;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    console.log('✅ Authenticated with Gmail API');
    console.log('');

    // Search for various newsletter patterns
    const searchPatterns = [
      'newsletter',
      'daily',
      'weekly',
      'ai',
      'tech',
      'theneuron',
      'tldr',
      'rundown',
      'futuretools',
      'aibreakfast',
      'beehiiv',
      'substack'
    ];

    const discoveredSenders = new Map();

    for (const pattern of searchPatterns) {
      console.log(`🔍 Searching for: "${pattern}"`);
      
      try {
        const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(pattern + ' newer_than:30d')}&maxResults=20`;
        const response = await fetch(searchUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          console.log(`   ❌ Search failed: ${response.status}`);
          continue;
        }

        const data = await response.json();
        const messages = data.messages || [];

        if (messages.length === 0) {
          console.log(`   📭 No emails found`);
          continue;
        }

        console.log(`   📧 Found ${messages.length} emails`);

        // Get details for first few emails to identify senders
        const sampleCount = Math.min(5, messages.length);
        for (let i = 0; i < sampleCount; i++) {
          try {
            const emailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messages[i].id}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (emailResponse.ok) {
              const email = await emailResponse.json();
              const headers = email.payload.headers;
              const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
              const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
              const date = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';

              if (from && !discoveredSenders.has(from)) {
                discoveredSenders.set(from, {
                  count: 1,
                  subjects: [subject],
                  dates: [date],
                  pattern: pattern
                });
              } else if (from) {
                const existing = discoveredSenders.get(from);
                existing.count++;
                if (!existing.subjects.includes(subject)) {
                  existing.subjects.push(subject);
                }
                if (!existing.dates.includes(date)) {
                  existing.dates.push(date);
                }
              }
            }

            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
          } catch (error) {
            console.log(`      ❌ Error fetching email: ${error.message}`);
          }
        }

      } catch (error) {
        console.log(`   ❌ Error searching for "${pattern}": ${error.message}`);
      }

      // Rate limiting between searches
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Display results
    console.log('');
    console.log('📊 Discovered Newsletter Senders');
    console.log('================================');

    if (discoveredSenders.size === 0) {
      console.log('❌ No newsletter senders found');
      return;
    }

    // Sort by email count
    const sortedSenders = Array.from(discoveredSenders.entries())
      .sort((a, b) => b[1].count - a[1].count);

    for (const [sender, info] of sortedSenders) {
      console.log('');
      console.log(`📧 ${sender}`);
      console.log(`   Count: ${info.count} emails`);
      console.log(`   Pattern: "${info.pattern}"`);
      console.log(`   Recent subjects:`);
      
      info.subjects.slice(0, 3).forEach(subject => {
        console.log(`     - ${subject}`);
      });
      
      if (info.subjects.length > 3) {
        console.log(`     ... and ${info.subjects.length - 3} more`);
      }
    }

    // Generate suggested configuration
    console.log('');
    console.log('💡 Suggested Configuration');
    console.log('==========================');
    console.log('Add these to your newsletter queries:');
    
    const suggestedQueries = [];
    for (const [sender, info] of sortedSenders) {
      if (info.count >= 2) { // Only suggest if we found multiple emails
        const email = sender.match(/<(.+?)>/) ? sender.match(/<(.+?)>/)[1] : sender;
        suggestedQueries.push(`from:${email}`);
      }
    }

    if (suggestedQueries.length > 0) {
      console.log('');
      console.log('Newsletter queries:');
      suggestedQueries.forEach(query => {
        console.log(`  '${query}',`);
      });
    }

    console.log('');
    console.log('Next steps:');
    console.log('1. Update your newsletter queries in src/gmail-api.ts');
    console.log('2. Test the integration: node scripts/test-gmail-integration.js');
    console.log('3. Process newsletters: node scripts/process-newsletters.js');

  } catch (error) {
    console.log('❌ Newsletter check failed:', error.message);
  }
}

// Run if executed directly
console.log('🚀 Starting newsletter check...');
checkNewsletters().catch(error => {
  console.error('❌ Newsletter check failed:', error.message);
  process.exit(1);
});

export { checkNewsletters };
