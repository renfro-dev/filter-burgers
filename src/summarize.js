import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Main summarization function
export async function summarize(input) {
  const providers = [];
  
  // Initialize available providers based on environment variables
  if (process.env.OPENAI_API_KEY) {
    providers.push(new OpenAIProvider(process.env.OPENAI_API_KEY));
  }
  
  if (process.env.ANTHROPIC_API_KEY) {
    providers.push(new AnthropicProvider(process.env.ANTHROPIC_API_KEY));
  }

  if (providers.length === 0) {
    // No AI providers available, return fallback
    return {
      summary: input.summary || input.title || 'No content to summarize',
      provider: 'fallback',
      model: 'none',
      error: 'No AI API keys configured'
    };
  }

  // Use hybrid provider if multiple available, otherwise use single provider
  const provider = providers.length > 1 ? 
    new HybridProvider(providers) : 
    providers[0];

  return await provider.summarize(input);
}

// Utility function for batch summarization
export async function summarizeBatch(inputs) {
  const results = [];
  
  for (const input of inputs) {
    try {
      const result = await summarize(input);
      results.push(result);
    } catch (error) {
      results.push({
        summary: '',
        provider: 'error',
        model: 'none',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  return results;
}

// OpenAI Provider
class OpenAIProvider {
  constructor(apiKey) {
    this.name = 'openai';
    this.client = new OpenAI({ apiKey });
  }

  async summarize(input) {
    try {
      const content = this.prepareContent(input);
      const maxLength = input.maxLength || 150;

      const response = await this.client.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional content summarizer. Create a concise, engaging summary of the provided content in ${maxLength} words or less. Focus on key insights, main points, and actionable takeaways. Use clear, professional language.`
          },
          {
            role: 'user',
            content: `Please summarize this content:\n\nTitle: ${input.title || 'No title'}\n\nContent: ${content}`
          }
        ],
        max_tokens: Math.min(maxLength * 2, 1000),
        temperature: 0.3,
      });

      const summary = response.choices[0]?.message?.content || 'No summary generated';
      
      return {
        summary: summary.trim(),
        provider: this.name,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        tokensUsed: response.usage?.total_tokens
      };
    } catch (error) {
      return {
        summary: '',
        provider: this.name,
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  prepareContent(input) {
    if (input.content) return input.content;
    if (input.summary) return input.summary;
    if (input.title) return input.title;
    return 'No content provided';
  }
}

// Anthropic Provider
class AnthropicProvider {
  constructor(apiKey) {
    this.name = 'anthropic';
    this.client = new Anthropic({ apiKey });
  }

  async summarize(input) {
    try {
      const content = this.prepareContent(input);
      const maxLength = input.maxLength || 150;

      const response = await this.client.messages.create({
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        max_tokens: Math.min(maxLength * 2, 1000),
        messages: [
          {
            role: 'user',
            content: `You are a professional content summarizer. Create a concise, engaging summary of the provided content in ${maxLength} words or less. Focus on key insights, main points, and actionable takeaways. Use clear, professional language.

Content to summarize:
Title: ${input.title || 'No title'}
Content: ${content}

Please provide your summary:`
          }
        ]
      });

      const summary = response.content[0]?.type === 'text' ? response.content[0].text : 'No summary generated';
      
      return {
        summary: summary.trim(),
        provider: this.name,
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        tokensUsed: response.usage?.input_tokens ? 
          response.usage.input_tokens + (response.usage.output_tokens || 0) : undefined
      };
    } catch (error) {
      return {
        summary: '',
        provider: this.name,
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  prepareContent(input) {
    if (input.content) return input.content;
    if (input.summary) return input.summary;
    if (input.title) return input.title;
    return 'No content provided';
  }
}

// Hybrid Provider (tries multiple providers with fallback)
class HybridProvider {
  constructor(providers) {
    this.name = 'hybrid';
    this.providers = providers;
  }

  async summarize(input) {
    for (const provider of this.providers) {
      try {
        const result = await provider.summarize(input);
        if (result.summary && !result.error) {
          return {
            ...result,
            provider: this.name,
            summary: `[${provider.name.toUpperCase()}] ${result.summary}`
          };
        }
      } catch (error) {
        console.warn(`Provider ${provider.name} failed:`, error);
        continue;
      }
    }

    // Fallback to basic summarization
    return this.fallbackSummarization(input);
  }

  fallbackSummarization(input) {
    const content = input.content || input.summary || input.title || '';
    const words = content.split(/\s+/).slice(0, 50).join(' ');
    
    return {
      summary: words + (content.length > words.length ? '...' : ''),
      provider: this.name,
      model: 'fallback',
      error: 'All AI providers failed, using basic text truncation'
    };
  }
}
