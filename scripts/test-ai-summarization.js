#!/usr/bin/env node

console.log('🤖 Testing AI Content Summarization...');

import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { summarize, summarizeBatch } from '../src/summarize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Load environment variables from .env file
dotenv.config({ path: join(__dirname, '..', '.env') });
console.log('✅ Environment loaded with dotenv');

// Check for AI API keys
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasAnthropic = !!process.env.ANTHROPIC_API_KEY;

console.log(`   OpenAI API Key: ${hasOpenAI ? '✅ Set' : '❌ Missing'}`);
console.log(`   Anthropic API Key: ${hasAnthropic ? '✅ Set' : '❌ Missing'}`);

if (!hasOpenAI && !hasAnthropic) {
  console.log('⚠️  No AI API keys found. Will test fallback mode only.');
}

// Sample content for testing
const sampleContent = {
  title: "The Future of AI in Legal Technology",
  content: `Artificial Intelligence is revolutionizing the legal industry, transforming how lawyers research cases, draft documents, and manage client relationships. Machine learning algorithms can now analyze thousands of legal documents in minutes, identifying relevant precedents and potential risks that might take human lawyers weeks to uncover.

The integration of AI in legal technology has led to significant improvements in efficiency and accuracy. Document automation tools can generate contracts and legal briefs with remarkable precision, while predictive analytics help attorneys assess the likelihood of success in litigation.

However, the adoption of AI in legal practice also raises important questions about ethics, privacy, and the role of human judgment in legal decision-making. As AI systems become more sophisticated, legal professionals must navigate the balance between technological efficiency and human oversight.

Key benefits include reduced research time, improved accuracy in document review, and enhanced client communication through AI-powered chatbots. Challenges include ensuring data privacy, maintaining ethical standards, and addressing concerns about job displacement in the legal sector.`
};

async function testSummarization() {
  console.log('\n🔄 Testing AI Summarization...');
  console.log('   Content length:', sampleContent.content.length, 'characters');
  
  try {
    const result = await summarize(sampleContent);
    
    console.log('\n✅ Summarization Result:');
    console.log(`   Provider: ${result.provider}`);
    console.log(`   Model: ${result.model}`);
    console.log(`   Tokens Used: ${result.tokensUsed || 'N/A'}`);
    console.log(`   Error: ${result.error || 'None'}`);
    console.log('\n📝 Summary:');
    console.log('   ' + result.summary);
    
    if (result.error) {
      console.log('\n⚠️  Summarization completed with errors');
    } else {
      console.log('\n🎉 Summarization successful!');
    }
    
  } catch (error) {
    console.error('❌ Summarization failed:', error.message);
  }
}

async function testBatchSummarization() {
  console.log('\n🔄 Testing Batch Summarization...');
  
  const batchInputs = [
    { title: "Quick Update", content: "This is a brief update about recent developments." },
    { title: "Detailed Report", content: "This is a comprehensive report with multiple sections covering various topics and providing in-depth analysis of the current situation." },
    { title: "News Article", content: "Breaking news: Major developments in technology sector. Companies are adopting new AI solutions rapidly." }
  ];
  
  try {
    const results = await summarizeBatch(batchInputs);
    
    console.log('\n✅ Batch Summarization Results:');
    results.forEach((result, index) => {
      console.log(`\n   Item ${index + 1}:`);
      console.log(`     Provider: ${result.provider}`);
      console.log(`     Summary: ${result.summary}`);
      if (result.error) {
        console.log(`     Error: ${result.error}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Batch summarization failed:', error.message);
  }
}

// Run tests
console.log('\n🚀 Starting AI Summarization Tests...\n');

testSummarization().then(() => {
  return testBatchSummarization();
}).then(() => {
  console.log('\n✅ All tests completed!');
}).catch((error) => {
  console.error('\n❌ Test suite failed:', error.message);
});
