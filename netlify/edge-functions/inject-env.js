export default async (request, context) => {
  const response = await context.next();
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return response;

  const html = await response.text();
  const env = {
    GROQ_API_KEY: Deno.env.get('GROQ_API_KEY') || '',
    YOUTUBE_API_KEY: Deno.env.get('YOUTUBE_API_KEY') || '',
    YOUTUBE_CHANNEL_ID: Deno.env.get('YOUTUBE_CHANNEL_ID') || '',
    TRADING212_API_KEY: Deno.env.get('TRADING212_API_KEY') || '',
  };
  const script = `<script>window.__ENV__=${JSON.stringify(env)};</script>`;
  const modified = html.replace('</head>', script + '\n</head>');
  return new Response(modified, { status: response.status, headers: response.headers });
};
