/**
 * Gmail API Integration for Newsletter Processing
 * Matches n8n workflow behavior for email fetching and URL extraction
 */

interface GmailMessage {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  payload: {
    headers: Array<{ name: string; value: string }>;
    body?: { data: string };
    parts?: Array<{
      mimeType: string;
      body: { data: string };
    }>;
  };
  internalDate: string;
}

interface NewsletterEmail {
  id: string;
  from: string;
  subject: string;
  date: Date;
  body: string;
  newsletter: 'The Neuron' | 'TLDR' | 'The Rundown' | 'unknown';
}

interface ExtractedUrls {
  urls: string[];
  newsletter: string;
  emailId: string;
  processedAt: Date;
}

/**
 * Gmail API client for newsletter processing
 * Handles OAuth2 authentication and email fetching with rate limiting
 */
export class GmailApiClient {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private lastRequestTime: number = 0;
  private readonly minRequestInterval = 100; // 100ms between requests for rate limiting

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly refreshToken: string
  ) {}

  /**
   * Authenticate with Gmail API using refresh token
   * Handles token refresh automatically
   */
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
      throw new Error(`Gmail authentication failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000; // 1 minute buffer

    return this.accessToken;
  }

  /**
   * Rate limiting for Gmail API requests
   * Ensures we don't exceed API quotas
   */
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
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.status === 429) {
      // Rate limited - exponential backoff
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      return this.rateLimitedRequest(url, options);
    }

    return response;
  }

  /**
   * Fetch recent newsletter emails based on sender patterns
   * Matches n8n workflow email filtering logic
   */
  async fetchNewsletterEmails(maxResults: number = 50): Promise<NewsletterEmail[]> {
    // Newsletter sender patterns based on real Gmail data
    const newsletterQueries = [
      'from:theneuron@newsletter.theneurondaily.com OR from:theneuron.ai',
      'from:dan@tldrnewsletter.com OR from:tldr.tech',
      'from:news@daily.therundown.ai OR from:therundown.ai',
      'from:futuretools@mail.beehiiv.com',
      'from:aibreakfast@mail.beehiiv.com'
    ];

    const allEmails: NewsletterEmail[] = [];

    for (const query of newsletterQueries) {
      try {
        const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query + ' newer_than:1d')}&maxResults=${maxResults}`;
        const searchResponse = await this.rateLimitedRequest(searchUrl);
        
        if (!searchResponse.ok) {
          console.error(`Gmail search failed: ${searchResponse.status} ${searchResponse.statusText}`);
          continue;
        }

        const searchData = await searchResponse.json();
        const messages = searchData.messages || [];

        for (const message of messages) {
          try {
            const email = await this.fetchEmailDetails(message.id);
            if (email) {
              allEmails.push(email);
            }
          } catch (error) {
            console.error(`Failed to fetch email ${message.id}:`, error);
          }
        }
      } catch (error) {
        console.error(`Newsletter query failed for: ${query}`, error);
      }
    }

    return allEmails.sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  /**
   * Fetch detailed email content and metadata
   * Extracts headers and body content for URL processing
   */
  private async fetchEmailDetails(messageId: string): Promise<NewsletterEmail | null> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`;
    const response = await this.rateLimitedRequest(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch email ${messageId}: ${response.status}`);
    }

    const message: GmailMessage = await response.json();
    
    // Extract headers
    const headers = message.payload.headers;
    const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
    const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
    const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value;
    
    // Extract body content
    let body = '';
    if (message.payload.body?.data) {
      body = this.decodeBase64Url(message.payload.body.data);
    } else if (message.payload.parts) {
      // Multi-part message - find HTML or text part
      const htmlPart = message.payload.parts.find(part => part.mimeType === 'text/html');
      const textPart = message.payload.parts.find(part => part.mimeType === 'text/plain');
      const part = htmlPart || textPart;
      
      if (part?.body?.data) {
        body = this.decodeBase64Url(part.body.data);
      }
    }

    // Determine newsletter source
    const newsletter = this.identifyNewsletter(from, subject);
    
    return {
      id: message.id,
      from,
      subject,
      date: dateHeader ? new Date(dateHeader) : new Date(parseInt(message.internalDate)),
      body,
      newsletter
    };
  }

  /**
   * Identify newsletter source from email metadata
   * Matches n8n workflow newsletter classification
   */
  private identifyNewsletter(from: string, subject: string): NewsletterEmail['newsletter'] {
    const fromLower = from.toLowerCase();
    const subjectLower = subject.toLowerCase();

    if (fromLower.includes('theneuron') || fromLower.includes('neurondaily')) {
      return 'The Neuron';
    }
    if (fromLower.includes('tldr') || fromLower.includes('tldrnewsletter')) {
      return 'TLDR';
    }
    if (fromLower.includes('rundown') || fromLower.includes('daily.therundown')) {
      return 'The Rundown';
    }
    if (fromLower.includes('futuretools')) {
      return 'FutureTools';
    }
    if (fromLower.includes('aibreakfast')) {
      return 'AI Breakfast';
    }

    return 'unknown';
  }

  /**
   * Decode Gmail's base64url encoded content
   */
  private decodeBase64Url(data: string): string {
    // Convert base64url to base64
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    // Pad if necessary
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    
    try {
      return atob(padded);
    } catch {
      return '';
    }
  }

  /**
   * Extract URLs from email content using regex patterns
   * Matches n8n workflow URL extraction logic
   */
  extractUrlsFromEmail(email: NewsletterEmail): ExtractedUrls {
    // Comprehensive URL regex matching n8n patterns
    const urlRegex = /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&=]*)/gi;
    
    const urls = [];
    const matches = email.body.match(urlRegex) || [];
    
    for (const url of matches) {
      // Filter out unwanted URLs (matching n8n logic)
      if (this.shouldIncludeUrl(url)) {
        urls.push(this.cleanUrl(url));
      }
    }

    // Remove duplicates
    const uniqueUrls = [...new Set(urls)];

    return {
      urls: uniqueUrls,
      newsletter: email.newsletter,
      emailId: email.id,
      processedAt: new Date()
    };
  }

  /**
   * Determine if URL should be included based on n8n filtering rules
   * Excludes unsubscribe links, images, ads, and tracking pixels
   */
  private shouldIncludeUrl(url: string): boolean {
    const urlLower = url.toLowerCase();
    
    // Exclude patterns (matching n8n logic)
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

  /**
   * Clean URL by removing tracking parameters and fragments
   * Preserves essential UTM parameters for advertiser classification
   */
  private cleanUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // Remove common tracking parameters but keep UTM for classification
      const paramsToRemove = ['gclid', 'fbclid', 'msclkid', '_ga', '_gl', 'mc_cid', 'mc_eid'];
      
      paramsToRemove.forEach(param => {
        urlObj.searchParams.delete(param);
      });

      // Remove fragment
      urlObj.hash = '';

      return urlObj.toString();
    } catch {
      return url; // Return original if URL parsing fails
    }
  }
}

/**
 * Factory function to create Gmail API client with environment variables
 */
export function createGmailClient(): GmailApiClient {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing required Gmail API credentials in environment variables');
  }

  return new GmailApiClient(clientId, clientSecret, refreshToken);
}
