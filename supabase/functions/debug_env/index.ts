Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  }

  try {
    const envVars = {
      GOOGLE_CLIENT_ID: Deno.env.get('GOOGLE_CLIENT_ID') ? 'SET' : 'NOT SET',
      GOOGLE_CLIENT_SECRET: Deno.env.get('GOOGLE_CLIENT_SECRET') ? 'SET' : 'NOT SET',
      GOOGLE_REFRESH_TOKEN: Deno.env.get('GOOGLE_REFRESH_TOKEN') ? 'SET' : 'NOT SET',
      PROJECT_URL: Deno.env.get('PROJECT_URL') ? 'SET' : 'NOT SET',
      SERVICE_ROLE_KEY: Deno.env.get('SERVICE_ROLE_KEY') ? 'SET' : 'NOT SET',
    };

    return new Response(JSON.stringify(envVars, null, 2), {
      headers: { 
        'content-type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      status: 200,
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Debug failed',
      details: error.message 
    }), {
      headers: { 
        'content-type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      status: 500,
    });
  }
});
