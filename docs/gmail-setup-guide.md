# Gmail API Setup Guide

This guide walks you through setting up Gmail API access for your newsletter processing system.

## Prerequisites

- Google account with Gmail access
- Node.js installed locally
- Supabase project set up

## Step 1: Google Cloud Console Setup

### 1.1 Create/Select Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Make sure billing is enabled (required for API access)

### 1.2 Enable Gmail API
1. Go to "APIs & Services" > "Library"
2. Search for "Gmail API"
3. Click on "Gmail API" and click "Enable"

### 1.3 Create OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. Choose "Desktop application" as application type
4. Add authorized redirect URI: `http://localhost:3000/auth/callback`
5. Click "Create"
6. **Save your Client ID and Client Secret** - you'll need these!

## Step 2: Get Authorization Code

### 2.1 Generate Authorization URL
Use the interactive setup script:
```bash
node scripts/setup-oauth.js
```

Or manually construct the URL:
```
https://accounts.google.com/o/oauth2/auth?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:3000/auth/callback&scope=https://www.googleapis.com/auth/gmail.readonly&response_type=code&access_type=offline&prompt=consent
```

Replace `YOUR_CLIENT_ID` with your actual client ID.

### 2.2 Get Authorization Code
1. Open the authorization URL in your browser
2. Sign in with your Google account
3. Grant permissions to your app
4. **Important**: You'll get redirected to `localhost:3000` which will fail to connect - this is expected!
5. **Copy the authorization code from the URL** (the part after `code=`)

The redirect will look like:
```
http://localhost:3000/auth/callback?code=4/0AfJohXn...
```

Copy everything after `code=` (including the `4/0` part).

## Step 3: Exchange for Refresh Token

### 3.1 Use the OAuth Helper
```bash
node scripts/oauth-helper.js YOUR_AUTH_CODE YOUR_CLIENT_SECRET
```

### 3.2 Or Use the Interactive Setup
```bash
node scripts/setup-oauth.js
```

This will walk you through the entire process and automatically save everything to your `.env` file.

## Step 4: Environment Variables

Your `.env` file should now contain:
```bash
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REFRESH_TOKEN=your-refresh-token-here
GOOGLE_ACCESS_TOKEN=your-access-token-here
```

## Step 5: Test Your Setup

Test that everything is working:
```bash
node scripts/test-gmail-integration.js
```

## Troubleshooting

### "Access blocked" Error
If you get "Access blocked: [App] has not completed the Google verification process":

**Option 1: Add Test Users**
1. Go to Google Cloud Console > APIs & Services > OAuth consent screen
2. Add your email as a test user
3. Try the authorization flow again

**Option 2: Create New OAuth Client**
1. Delete the existing OAuth client
2. Create a new one with a different name
3. Follow the setup process again

### "localhost refused to connect" Error
This is **expected behavior**! The redirect to localhost will fail because no server is running there. The important part is that you get redirected and can copy the authorization code from the URL.

### Invalid Grant Error
- Make sure you're using the authorization code immediately (they expire quickly)
- Ensure the redirect URI matches exactly
- Check that your client ID and secret are correct

### Rate Limiting
The Gmail API has quotas. The system includes automatic rate limiting, but if you hit limits:
- Wait a few minutes before retrying
- Reduce the number of emails fetched
- Check your Google Cloud Console for quota usage

## Security Notes

- **Never commit your `.env` file** to version control
- **Keep your client secret secure** - it's like a password
- **Refresh tokens are long-lived** - store them securely
- **Access tokens expire** - the system handles refresh automatically

## Next Steps

Once Gmail API is working:
1. Test newsletter fetching: `node scripts/check-newsletters.js`
2. Test the full pipeline: `node scripts/test-full-pipeline.js`
3. Deploy to Supabase: `supabase functions deploy process_newsletters`

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Verify your environment variables are set correctly
3. Check Google Cloud Console for API quotas and errors
4. Review the console output for detailed error messages
