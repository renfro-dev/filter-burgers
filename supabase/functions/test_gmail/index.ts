Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      }
    });
  }

  try {
    const googleClientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const googleClientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    const googleRefreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');

    if (!googleClientId || !googleClientSecret || !googleRefreshToken) {
      return new Response(JSON.stringify({
        error: 'Missing Google credentials',
        env: { googleClientId: !!googleClientId, googleClientSecret: !!googleClientSecret, googleRefreshToken: !!googleRefreshToken }
      }), {
        headers: { 'content-type': 'application/json' },
        status: 500
      });
    }

    // Test Gmail authentication
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: googleRefreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      return new Response(JSON.stringify({
        error: 'Gmail auth failed',
        status: response.status,
        details: errorData
      }), {
        headers: { 'content-type': 'application/json' },
        status: 500
      });
    }

    const data = await response.json();
    
    // Test basic Gmail API call
    const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { Authorization: `Bearer ${data.access_token}` }
    });

    if (!gmailResponse.ok) {
      return new Response(JSON.stringify({
        error: 'Gmail API call failed',
        status: gmailResponse.status,
        details: await gmailResponse.text()
      }), {
        headers: { 'content-type': 'application/json' },
        status: 500
      });
    }

    const profile = await gmailResponse.json();

    return new Response(JSON.stringify({
      message: 'Gmail API working',
      profile: profile,
      tokenInfo: {
        hasAccessToken: !!data.access_token,
        expiresIn: data.expires_in
      }
    }), {
      headers: { 'content-type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Test failed',
      details: error.message
    }), {
      headers: { 'content-type': 'application/json' },
      status: 500
    });
  }
});
