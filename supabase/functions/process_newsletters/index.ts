/**
 * Supabase Edge Function: Newsletter Processing
 * Fetches newsletter emails via Gmail API and processes URLs
 * Replicates n8n workflow behavior in Supabase Edge Functions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * Simplified Gmail API client for Edge Function
 * Core functionality extracted from main gmail-api.ts
 */
class GmailApiClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private lastRequestTime: number = 0;
  private readonly minRequestInterval = 100;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly refreshToken: string
  ) {}

  private async authenticate(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Gmail auth failed: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000;
    return this.accessToken;
  }

  private async rateLimitedRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest));
    }

    this.lastRequestTime = Date.now();
    const token = await this.authenticate();
    
    const response = await fetch(url, {
      ...options,
      headers: { ...options.headers, Authorization: `Bearer ${token}` },
    });

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return this.rateLimitedRequest(url, options);
    }

    return response;
  }

  async fetchNewsletterEmails(maxResults: number = 50) {
    const newsletterQueries = [
      'from:theneuron@newsletter.theneurondaily.com OR from:theneuron.ai',
      'from:dan@tldrnewsletter.com OR from:tldr.tech',
      'from:news@daily.therundown.ai OR from:therundown.ai',
      'from:futuretools@mail.beehiiv.com',
      'from:aibreakfast@mail.beehiiv.com'
    ];

    const allEmails = [];

    for (const query of newsletterQueries) {
      const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query + ' newer_than:1d')}&maxResults=${maxResults}`;
      const searchResponse = await this.rateLimitedRequest(searchUrl);
      
      if (!searchResponse.ok) continue;

      const searchData = await searchResponse.json();
      const messages = searchData.messages || [];

      for (const message of messages) {
        try {
          const email = await this.fetchEmailDetails(message.id);
          if (email) allEmails.push(email);
        } catch (error) {
          console.error(`Failed to fetch email ${message.id}:`, error);
        }
      }
    }

    return allEmails.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  private async fetchEmailDetails(messageId: string) {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`;
    const response = await this.rateLimitedRequest(url);

    if (!response.ok) return null;

    const message = await response.json();
    const headers = message.payload.headers;
    const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
    const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
    const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value;

    let body = '';
    if (message.payload.body?.data) {
      body = this.decodeBase64Url(message.payload.body.data);
    } else if (message.payload.parts) {
      const htmlPart = message.payload.parts.find(part => part.mimeType === 'text/html');
      const textPart = message.payload.parts.find(part => part.mimeType === 'text/plain');
      const part = htmlPart || textPart;
      
      if (part?.body?.data) {
        body = this.decodeBase64Url(part.body.data);
      }
    }

    return {
      id: message.id,
      from,
      subject,
      date: dateHeader ? new Date(dateHeader) : new Date(parseInt(message.internalDate)),
      body,
      newsletter: this.identifyNewsletter(from, subject)
    };
  }

  private identifyNewsletter(from: string, subject: string) {
    const fromLower = from.toLowerCase();
    const subjectLower = subject.toLowerCase();

    if (fromLower.includes('theneuron') || fromLower.includes('neurondaily')) return 'The Neuron';
    if (fromLower.includes('tldr') || fromLower.includes('tldrnewsletter')) return 'TLDR';
    if (fromLower.includes('rundown') || fromLower.includes('daily.therundown')) return 'The Rundown';
    if (fromLower.includes('futuretools')) return 'FutureTools';
    if (fromLower.includes('aibreakfast')) return 'AI Breakfast';
    return 'unknown';
  }

  private decodeBase64Url(data: string): string {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    try {
      return atob(padded);
    } catch {
      return '';
    }
  }

  extractUrlsFromEmail(email: any) {
    const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&=]*)/gi;
    const urls = [];
    const matches = email.body.match(urlRegex) || [];
    
    for (const url of matches) {
      if (this.shouldIncludeUrl(url)) {
        urls.push(this.cleanUrl(url));
      }
    }

    return {
      urls: [...new Set(urls)],
      newsletter: email.newsletter,
      emailId: email.id,
      processedAt: new Date()
    };
  }

  private shouldIncludeUrl(url: string): boolean {
    const urlLower = url.toLowerCase();
    const excludePatterns = [
      /unsubscribe/i,
      /\.(jpg|jpeg|png|gif|webp|svg|ico)(\?|$)/i,
      /pixel|tracking|analytics/i,
      /facebook\.com\/tr/i,
      /google-analytics\.com/i,
      /doubleclick\.net/i,
      /amazonaws\.com.*\.(jpg|png|gif)/i,
      /cdn.*\.(jpg|png|gif)/i
    ];
    return !excludePatterns.some(pattern => pattern.test(url));
  }

  private cleanUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const paramsToRemove = ['gclid', 'fbclid', 'msclkid', '_ga', '_gl', 'mc_cid', 'mc_eid'];
      paramsToRemove.forEach(param => urlObj.searchParams.delete(param));
      urlObj.hash = '';
      return urlObj.toString();
    } catch {
      return url;
    }
  }
}

/**
 * URL Classification Logic (matching n8n workflow)
 */
function classifyUrl(url: string): string {
  const s = url.toLowerCase();
  if (s.includes('youtube.com') || s.includes('youtu.be')) return 'youtube';
  if (s.endsWith('.pdf') || s.includes('/pdf')) return 'pdf';
  if (s.includes('x.com') || s.includes('twitter.com')) return 'x';
  if (s.includes('reddit.com')) return 'reddit';
  if (/(careers|jobs|greenhouse\.io|lever\.co)/.test(s)) return 'job';
  if (/(utm|ads?|advertis)/.test(s)) return 'advertiser';
  return 'article';
}

/**
 * Process URLs by calling the existing ingest_url function
 */
async function processUrl(url: string, newsletter: string, supabaseUrl: string, serviceKey: string) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ingest_url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ url, newsletter }),
    });

    if (!response.ok) {
      console.error(`Failed to process URL ${url}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error processing URL ${url}:`, error);
    return null;
  }
}

/**
 * Main Edge Function Handler
 */
Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response('Use POST', { status: 405 });
    }

    // Get environment variables
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const googleRefreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!googleClientId || !googleClientSecret || !googleRefreshToken || !supabaseUrl || !serviceKey) {
      return new Response('Missing required environment variables', { status: 500 });
    }

    // Parse request body for configuration
    const { maxEmails = 50, processUrls = true } = await req.json().catch(() => ({}));

    // Initialize Gmail API client
    const gmailClient = new GmailApiClient(googleClientId, googleClientSecret, googleRefreshToken);

    // Fetch newsletter emails
    console.log('Fetching newsletter emails...');
    const emails = await gmailClient.fetchNewsletterEmails(maxEmails);
    console.log(`Found ${emails.length} newsletter emails`);

    const results = {
      emailsProcessed: emails.length,
      urlsExtracted: 0,
      urlsProcessed: 0,
      errors: [],
      summary: {}
    };

    // Process each email to extract URLs
    for (const email of emails) {
      try {
        console.log(`Processing email from ${email.newsletter}: ${email.subject}`);
        
        const extractedUrls = gmailClient.extractUrlsFromEmail(email);
        results.urlsExtracted += extractedUrls.urls.length;
        
        // Update summary by newsletter
        if (!results.summary[email.newsletter]) {
          results.summary[email.newsletter] = { emails: 0, urls: 0 };
        }
        results.summary[email.newsletter].emails += 1;
        results.summary[email.newsletter].urls += extractedUrls.urls.length;

        // Process URLs if requested
        if (processUrls && extractedUrls.urls.length > 0) {
          console.log(`Processing ${extractedUrls.urls.length} URLs from ${email.newsletter}`);
          
          for (const url of extractedUrls.urls) {
            const result = await processUrl(url, email.newsletter, supabaseUrl, serviceKey);
            if (result) {
              results.urlsProcessed += 1;
            }
          }
        }
      } catch (error) {
        const errorMsg = `Failed to process email ${email.id}: ${error.message}`;
        console.error(errorMsg);
        results.errors.push(errorMsg);
      }
    }

    console.log('Newsletter processing completed:', results);

    return new Response(JSON.stringify(results), {
      headers: { 
        'content-type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      status: 200,
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Newsletter processing failed:', errorMsg);
    
    return new Response(JSON.stringify({ 
      error: 'Newsletter processing failed',
      details: errorMsg 
    }), {
      headers: { 
        'content-type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      status: 500,
    });
  }
});
