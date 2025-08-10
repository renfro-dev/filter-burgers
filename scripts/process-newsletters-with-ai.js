#!/usr/bin/env node

console.log('📧 Processing Real Newsletters with AI...');

import { join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { summarize, summarizeBatch } from '../src/summarize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

async function getAccessToken() {
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
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function fetchNewsletterEmails(accessToken) {
  const queries = [
    'from:theneuron@newsletter.theneurondaily.com newer_than:7d',
    'from:dan@tldrnewsletter.com newer_than:7d', 
    'from:news@daily.therundown.ai newer_than:7d',
    'from:futuretools@mail.beehiiv.com newer_than:7d',
    'from:aibreakfast@mail.beehiiv.com newer_than:7d'
  ];

  const newsletters = [];

  for (const query of queries) {
    try {
      const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=3`;
      const response = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        console.log(`   ❌ Search failed for "${query}": ${response.status}`);
        continue;
      }

      const data = await response.json();
      if (data.messages) {
        for (const message of data.messages.slice(0, 2)) { // Get 2 emails per newsletter
          try {
            console.log(`   🔍 Fetching email: ${message.id}`);
            const emailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message.id}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (emailResponse.ok) {
              const email = await emailResponse.json();
              const headers = email.payload.headers;
              const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || 'No subject';
              const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || 'No sender';
              
              // Extract newsletter name
              const newsletter = query.includes('theneuron') ? 'The Neuron' :
                               query.includes('tldr') ? 'TLDR' :
                               query.includes('rundown') ? 'The Rundown' :
                               query.includes('futuretools') ? 'FutureTools' :
                               query.includes('aibreakfast') ? 'AI Breakfast' : 'Unknown';

              // Extract content (simplified - you might want to enhance this)
              let content = '';
              if (email.payload.body && email.payload.body.data) {
                content = Buffer.from(email.payload.body.data, 'base64').toString('utf-8');
              } else if (email.payload.parts) {
                for (const part of email.payload.parts) {
                  if (part.mimeType === 'text/plain' && part.body && part.body.data) {
                    content = Buffer.from(part.body.data, 'base64').toString('utf-8');
                    break;
                  }
                }
              }

              console.log(`   ✅ Email processed: "${subject}" (${content.length} chars)`);

              newsletters.push({
                id: message.id,
                newsletter,
                subject,
                from,
                content: content.substring(0, 1000), // Limit content length
                timestamp: message.internalDate ? new Date(parseInt(message.internalDate)).toISOString() : new Date().toISOString()
              });
            } else {
              console.log(`   ❌ Email fetch failed: ${emailResponse.status}`);
            }
          } catch (error) {
            console.log(`   ❌ Error fetching email ${message.id}: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.log(`   ❌ Error searching "${query}": ${error.message}`);
    }
  }

  return newsletters;
}

async function processNewslettersWithAI() {
  console.log('🚀 Starting Newsletter Processing Pipeline...\n');

  try {
    // Step 1: Get access token
    console.log('🔄 Step 1: Getting Gmail access token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access token obtained\n');

    // Step 2: Fetch newsletter emails
    console.log('🔄 Step 2: Fetching newsletter emails...');
    const newsletters = await fetchNewsletterEmails(accessToken);
    console.log(`✅ Found ${newsletters.length} newsletters to process\n`);

    if (newsletters.length === 0) {
      console.log('⚠️  No newsletters found to process');
      return;
    }

    // Step 3: Prepare content for AI processing
    console.log('🔄 Step 3: Preparing content for AI processing...');
    const aiInputs = newsletters.map(nl => ({
      title: nl.subject,
      content: nl.content,
      url: `gmail://${nl.id}`,
      maxLength: 100
    }));

    console.log('✅ Content prepared for AI processing\n');

    // Step 4: Process with AI
    console.log('🔄 Step 4: Processing with AI...');
    const results = await summarizeBatch(aiInputs);
    console.log('✅ AI processing completed\n');

    // Step 5: Display results
    console.log('📊 Newsletter Processing Results:');
    console.log('================================\n');

    results.forEach((result, index) => {
      const newsletter = newsletters[index];
      console.log(`📧 ${newsletter.newsletter}`);
      console.log(`   Subject: ${newsletter.subject}`);
      console.log(`   From: ${newsletter.from}`);
      console.log(`   AI Provider: ${result.provider}`);
      console.log(`   Model: ${result.model}`);
      if (result.tokensUsed) {
        console.log(`   Tokens Used: ${result.tokensUsed}`);
      }
      console.log(`   Summary: ${result.summary}`);
      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      }
      console.log('');
    });

    // Step 6: Summary statistics
    const successful = results.filter(r => !r.error).length;
    const failed = results.filter(r => r.error).length;
    const totalTokens = results.reduce((sum, r) => sum + (r.tokensUsed || 0), 0);

    console.log('📈 Processing Statistics:');
    console.log(`   Total Newsletters: ${newsletters.length}`);
    console.log(`   Successfully Processed: ${successful}`);
    console.log(`   Failed: ${failed}`);
    console.log(`   Total Tokens Used: ${totalTokens}`);
    console.log(`   Average Tokens per Newsletter: ${Math.round(totalTokens / newsletters.length)}`);

  } catch (error) {
    console.error('❌ Newsletter processing failed:', error.message);
  }
}

// Run the processing
processNewslettersWithAI().catch(console.error);
