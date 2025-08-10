/**
 * Enhanced HTML Content Parser
 * Replicates n8n workflow HTML extraction logic with TypeScript improvements
 * Handles title, author, publish date, summary, and full content extraction
 */

export interface ParsedContent {
  success: boolean;
  extractedAt: string;
  sourceUrl: string;
  data: {
    title: string;
    author: string | null;
    publishDate: string | null;
    summary: string;
    content: string;
    wordCount: number;
    readingTime: number;
    language: string;
    contentType: 'article' | 'short-form' | 'minimal';
  };
  error?: string;
}

/**
 * Clean text by removing HTML tags and normalizing whitespace
 * Matches n8n workflow cleaning logic exactly
 */
function cleanText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/gi, ' ') // Convert non-breaking spaces
    .replace(/&[#a-z0-9]+;/gi, ' ') // Convert HTML entities
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

/**
 * Extract metadata from HTML meta tags
 * Supports both name and property attributes
 */
function extractMetaTag(name: string, html: string): string {
  // Match meta tags with name or property attributes
  const regexA = new RegExp(`<meta[^>]*(?:name|property)=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i');
  const regexB = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["'][^>]*>`, 'i');
  
  const match = html.match(regexA) || html.match(regexB);
  return match ? cleanText(match[1]) : '';
}

/**
 * Extract and parse JSON-LD structured data
 * Returns array of parsed JSON-LD objects
 */
function extractJsonLD(html: string): Record<string, any>[] {
  const jsonLDArray: Record<string, any>[] = [];
  const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      jsonLDArray.push(parsed);
    } catch {
      // Ignore malformed JSON-LD
    }
  }
  
  return jsonLDArray;
}

/**
 * Extract main content from HTML using readability-style algorithm
 * Matches n8n workflow content extraction logic
 */
function extractMainContent(html: string): string {
  // Remove unwanted elements (scripts, styles, navigation, etc.)
  const unwantedRegex = /<script[^>]*>[\s\S]*?<\/script>|<style[^>]*>[\s\S]*?<\/style>|<nav[^>]*>[\s\S]*?<\/nav>|<header[^>]*>[\s\S]*?<\/header>|<footer[^>]*>[\s\S]*?<\/footer>|<aside[^>]*>[\s\S]*?<\/aside>/gi;
  const cleanedHtml = html.replace(unwantedRegex, '');
  
  // Try to find main content containers in order of preference
  const contentWrappers = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<[^>]*class="[^"]*(wp-block-post-content|entry-content|post-content|article-content)[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i,
    /<div[^>]*class="[^"]*(content|post|article)[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  ];
  
  let bodyHtml = '';
  for (const regex of contentWrappers) {
    const match = cleanedHtml.match(regex);
    if (match && match[1] && match[1].length > bodyHtml.length) {
      bodyHtml = match[1];
    }
  }
  
  // Fallback to the entire cleaned HTML if no container found
  if (!bodyHtml) {
    bodyHtml = cleanedHtml;
  }
  
  // Extract meaningful paragraphs and headings
  const paragraphRegex = /<(p|li|h[1-6]|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
  const contentParts: string[] = [];
  
  let match;
  while ((match = paragraphRegex.exec(bodyHtml)) !== null) {
    const cleanedText = cleanText(match[2]);
    
    // Only include substantial text (more than 40 characters)
    if (cleanedText.length > 40) {
      contentParts.push(cleanedText);
    }
  }
  
  return contentParts.join('\n\n');
}

/**
 * Extract source URL from HTML (canonical link, og:url, or provided URL)
 */
function extractSourceUrl(html: string, providedUrl?: string): string {
  if (providedUrl) return providedUrl;
  
  // Try og:url meta tag
  const ogUrl = extractMetaTag('og:url', html);
  if (ogUrl) return ogUrl;
  
  // Try canonical link
  const canonicalMatch = html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
  if (canonicalMatch && canonicalMatch[1]) return canonicalMatch[1];
  
  return '';
}

/**
 * Extract title from HTML using multiple strategies
 * Priority: og:title > twitter:title > h1 > title tag
 */
function extractTitle(html: string): string {
  // Try OpenGraph title
  let title = extractMetaTag('og:title', html);
  if (title) return title;
  
  // Try Twitter title
  title = extractMetaTag('twitter:title', html);
  if (title) return title;
  
  // Try first H1 tag
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match && h1Match[1]) {
    title = cleanText(h1Match[1]);
    if (title) return title;
  }
  
  // Try title tag (remove site name after | or -)
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = cleanText(titleMatch[1])
      .replace(/\s*[|\-—]\s*[^|]+$/, '') // Remove site name
      .trim();
    if (title) return title;
  }
  
  return '';
}

/**
 * Extract author information from HTML
 * Uses meta tags, structured data, and semantic HTML
 */
function extractAuthor(html: string): string | null {
  // Try meta tags
  let author = extractMetaTag('author', html) ||
               extractMetaTag('article:author', html) ||
               extractMetaTag('twitter:creator', html);
  
  if (author) return author;
  
  // Try rel=author link
  const authorLinkMatch = html.match(/<[^>]*rel=["']author["'][^>]*>([\s\S]*?)<\/[^>]*>/i);
  if (authorLinkMatch && authorLinkMatch[1]) {
    author = cleanText(authorLinkMatch[1]);
    if (author) return author;
  }
  
  // Try JSON-LD structured data
  const jsonLDArray = extractJsonLD(html);
  for (const jsonLD of jsonLDArray) {
    if (jsonLD.author) {
      if (typeof jsonLD.author === 'string') {
        return jsonLD.author;
      } else if (jsonLD.author.name) {
        return jsonLD.author.name;
      }
    }
  }
  
  // Try common author class patterns
  const authorClassMatch = html.match(/<[^>]*class="[^"]*(author|byline|writer)[^"]*"[^>]*>([\s\S]*?)<\/[^>]*>/i);
  if (authorClassMatch && authorClassMatch[2]) {
    author = cleanText(authorClassMatch[2]);
    if (author && author.length < 100) return author; // Sanity check
  }
  
  return null;
}

/**
 * Extract publish date from HTML
 * Uses structured data, meta tags, and time elements
 */
function extractPublishDate(html: string): string | null {
  // Try meta tags
  let publishDate = extractMetaTag('article:published_time', html) ||
                   extractMetaTag('pubdate', html) ||
                   extractMetaTag('date', html);
  
  if (publishDate) return publishDate;
  
  // Try time element with datetime attribute
  const timeMatch = html.match(/<time[^>]*datetime=["']([^"']+)["'][^>]*>/i);
  if (timeMatch && timeMatch[1]) return timeMatch[1];
  
  // Try JSON-LD structured data
  const jsonLDArray = extractJsonLD(html);
  for (const jsonLD of jsonLDArray) {
    publishDate = jsonLD.datePublished || jsonLD.dateCreated || jsonLD.publishedAt;
    if (publishDate) return publishDate;
  }
  
  return null;
}

/**
 * Extract summary/description from HTML
 * Uses meta description, og:description, and semantic elements
 */
function extractSummary(html: string): string {
  // Try meta description tags
  let summary = extractMetaTag('description', html) ||
               extractMetaTag('og:description', html) ||
               extractMetaTag('twitter:description', html);
  
  if (summary) return summary;
  
  // Try semantic summary elements
  const summaryElementMatch = html.match(/<[^>]*(id|class)=["'](?:speakable-summary|lead|summary|excerpt|abstract)[^"']*["'][^>]*>([\s\S]*?)<\/[^>]*>/i);
  if (summaryElementMatch && summaryElementMatch[2]) {
    summary = cleanText(summaryElementMatch[2]);
    if (summary) return summary;
  }
  
  // Try first paragraph as fallback
  const firstParagraphMatch = html.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
  if (firstParagraphMatch && firstParagraphMatch[1]) {
    const firstPara = cleanText(firstParagraphMatch[1]);
    if (firstPara.length > 50 && firstPara.length < 300) {
      return firstPara;
    }
  }
  
  return '';
}

/**
 * Extract language from HTML
 */
function extractLanguage(html: string): string {
  const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
  return langMatch && langMatch[1] ? langMatch[1] : 'unknown';
}

/**
 * Determine content type based on word count
 */
function determineContentType(wordCount: number): 'article' | 'short-form' | 'minimal' {
  if (wordCount > 500) return 'article';
  if (wordCount > 100) return 'short-form';
  return 'minimal';
}

/**
 * Main HTML parsing function
 * Processes HTML content and extracts structured data
 * Matches n8n workflow output format exactly
 */
export function parseHtml(html: string, url?: string): ParsedContent {
  try {
    if (!html || html.indexOf('<html') === -1) {
      return {
        success: false,
        extractedAt: new Date().toISOString(),
        sourceUrl: url || '',
        data: {
          title: '',
          author: null,
          publishDate: null,
          summary: '',
          content: '',
          wordCount: 0,
          readingTime: 0,
          language: 'unknown',
          contentType: 'minimal'
        },
        error: 'No valid HTML content found'
      };
    }

    // Extract all data fields
    const sourceUrl = extractSourceUrl(html, url);
    const title = extractTitle(html);
    const author = extractAuthor(html);
    const publishDate = extractPublishDate(html);
    const summary = extractSummary(html);
    const content = extractMainContent(html);
    const language = extractLanguage(html);
    
    // Calculate metrics
    const words = content.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const readingTime = Math.ceil(wordCount / 200); // 200 words per minute
    const contentType = determineContentType(wordCount);

    return {
      success: true,
      extractedAt: new Date().toISOString(),
      sourceUrl,
      data: {
        title,
        author,
        publishDate,
        summary,
        content,
        wordCount,
        readingTime,
        language,
        contentType
      }
    };

  } catch (error) {
    return {
      success: false,
      extractedAt: new Date().toISOString(),
      sourceUrl: url || '',
      data: {
        title: '',
        author: null,
        publishDate: null,
        summary: '',
        content: '',
        wordCount: 0,
        readingTime: 0,
        language: 'unknown',
        contentType: 'minimal'
      },
      error: error instanceof Error ? error.message : 'Unknown parsing error'
    };
  }
}

/**
 * Batch process multiple HTML documents
 * Useful for processing newsletter URLs in bulk
 */
export function batchParseHtml(htmlDocuments: Array<{ html: string; url?: string }>): ParsedContent[] {
  return htmlDocuments.map(({ html, url }) => parseHtml(html, url));
}

/**
 * Validate parsed content quality
 * Returns quality score and suggestions for improvement
 */
export function validateParsedContent(parsed: ParsedContent): {
  score: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 0;

  // Title validation (30 points)
  if (parsed.data.title) {
    if (parsed.data.title.length > 10) {
      score += 30;
    } else {
      issues.push('Title too short');
      suggestions.push('Check if title extraction is working correctly');
    }
  } else {
    issues.push('No title found');
    suggestions.push('Verify HTML structure and meta tags');
  }

  // Content validation (40 points)
  if (parsed.data.content) {
    if (parsed.data.wordCount > 100) {
      score += 40;
    } else if (parsed.data.wordCount > 20) {
      score += 20;
      issues.push('Low content volume');
      suggestions.push('Check if main content extraction is working');
    } else {
      issues.push('Very little content extracted');
      suggestions.push('Verify content selectors and parsing logic');
    }
  } else {
    issues.push('No content found');
    suggestions.push('Check HTML structure and content selectors');
  }

  // Metadata validation (20 points)
  if (parsed.data.author) score += 10;
  if (parsed.data.publishDate) score += 5;
  if (parsed.data.summary) score += 5;

  // Structure validation (10 points)
  if (parsed.sourceUrl) score += 5;
  if (parsed.data.language !== 'unknown') score += 5;

  return { score, issues, suggestions };
}