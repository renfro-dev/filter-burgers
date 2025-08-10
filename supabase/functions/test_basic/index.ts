Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      }
    });
  }

  try {
    // Test 1: Basic response
    if (req.method === 'GET') {
      return new Response(JSON.stringify({
        message: "Function is working",
        timestamp: new Date().toISOString(),
        env: {
          hasGoogleClientId: !!Deno.env.get('GOOGLE_CLIENT_ID'),
          hasGoogleClientSecret: !!Deno.env.get('GOOGLE_CLIENT_SECRET'),
          hasGoogleRefreshToken: !!Deno.env.get('GOOGLE_REFRESH_TOKEN'),
          hasProjectUrl: !!Deno.env.get('PROJECT_URL'),
          hasServiceKey: !!Deno.env.get('SERVICE_ROLE_KEY')
        }
      }), {
        headers: { 
          'content-type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // Test 2: Parse request body
    if (req.method === 'POST') {
      const body = await req.json();
      return new Response(JSON.stringify({
        message: "POST request received",
        body: body,
        timestamp: new Date().toISOString()
      }), {
        headers: { 
          'content-type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

  } catch (error) {
    return new Response(JSON.stringify({
      error: 'Test failed',
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
