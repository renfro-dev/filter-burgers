# N8N Workflow Analysis

## Current System Overview
- **Newsletter Sources**: The Neuron, TLDR, The Rundown
- **Processing Volume**: ~50-500 URLs per newsletter per day
- **Current Tables**: Youtube_Videos, PDF, X, reddit, jobs, Advertiser, Master, Filter_Burgers

## Workflow Breakdown
[Paste your actual n8n workflow JSON export here]

## URL Classification Logic (From n8n If nodes)
- YouTube: contains 'youtube.com' OR 'youtu.be' → Youtube_Videos table
- PDF: contains '.pdf' → PDF table  
- Twitter: contains 'x.com' → X table
- Reddit: contains 'reddit.com' → reddit table
- Jobs: contains 'job' → jobs table
- UTM: contains 'utm' → Advertiser table
- Default: → content processing pipeline

## AI Prompt Templates (Exact from n8n)