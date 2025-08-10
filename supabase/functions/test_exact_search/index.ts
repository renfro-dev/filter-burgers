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

    // Get access token
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

    const data = await response.json();
    
    // Test the EXACT query from your newsletter function
    const exactQuery = 'from:dan@tldrnewsletter.com OR from:tldr.tech newer_than:7d';
    const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(exactQuery)}&maxResults=10`;
    
    console.log('Testing exact query:', exactQuery);
    console.log('Encoded URL:', searchUrl);
    
    const searchResponse = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${data.access_token}` }
    });
    
    if (!searchResponse.ok) {
      return new Response(JSON.stringify({
        error: 'Search failed',
        status: searchResponse.status,
        details: await searchResponse.text(),
        query: exactQuery,
        encodedUrl: searchUrl
      }), {
        headers: { 'content-type': 'application/json' },
        status: 500
      });
    }

    const searchData = await searchResponse.json();
    
    return new Response(JSON.stringify({
      message: 'Exact search test results',
      query: exactQuery,
      encodedUrl: searchUrl,
      results: {
        totalResults: searchData.resultSizeEstimate || 0,
        messages: searchData.messages?.length || 0,
        sampleMessages: searchData.messages?.slice(0, 3) || []
      }
    }), {
      headers: { 
        'content-type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Search test failed',
      details: error.message
    }), {
      headers: { 
        'content-type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      status: 500
    });
  }
});
