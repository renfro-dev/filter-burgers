# Scripts Directory

This directory contains utility scripts for setting up and testing your newsletter processing system.

## Setup Scripts

### `setup-oauth.js`
**Interactive OAuth2 setup for Gmail API**
```bash
node scripts/setup-oauth.js
```
- Walks you through the entire OAuth2 setup process
- Automatically saves credentials to your `.env` file
- Handles authorization code exchange for refresh tokens

### `oauth-helper.js`
**Manual OAuth2 token exchange**
```bash
node scripts/oauth-helper.js <auth-code> [client-secret]
```
- Exchanges authorization codes for refresh tokens
- Useful if you prefer manual setup
- Reads credentials from `.env` file if available

## Testing Scripts

### `test-gmail-integration.js`
**Test Gmail API authentication and basic functionality**
```bash
node scripts/test-gmail-integration.js
```
- Verifies OAuth2 credentials work
- Tests Gmail API access
- Searches for newsletter emails with current patterns

### `check-newsletters.js`
**Discover actual newsletter senders in your Gmail**
```bash
node scripts/check-newsletters.js
```
- Searches Gmail for newsletter patterns
- Identifies actual sender email addresses
- Suggests configuration updates
- **Run this first to configure your newsletter queries!**

## Pipeline Scripts

### `process-newsletters.js`
**End-to-end newsletter processing test**
```bash
node scripts/process-newsletters.js
```
- Fetches newsletter emails
- Extracts and processes URLs
- Tests the complete pipeline locally

## Usage Order

1. **First time setup:**
   ```bash
   node scripts/setup-oauth.js
   ```

2. **Discover your newsletters:**
   ```bash
   node scripts/check-newsletters.js
   ```

3. **Test the integration:**
   ```bash
   node scripts/test-gmail-integration.js
   ```

4. **Test the full pipeline:**
   ```bash
   node scripts/process-newsletters.js
   ```

## Troubleshooting

- **Missing credentials:** Run `setup-oauth.js` first
- **No newsletters found:** Run `check-newsletters.js` to discover senders
- **API errors:** Check your Google Cloud Console quotas and OAuth settings
- **Rate limiting:** Scripts include automatic rate limiting, but you may need to wait between runs

## Environment Variables

These scripts expect these variables in your `.env` file:
```bash
GOOGLE_CLIENT_ID=your-oauth-client-id
GOOGLE_CLIENT_SECRET=your-oauth-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Notes

- All scripts use ES modules (`.js` files with `import` statements)
- Scripts include automatic rate limiting for Gmail API
- Error handling and logging for debugging
- Designed to work with your existing Supabase setup
