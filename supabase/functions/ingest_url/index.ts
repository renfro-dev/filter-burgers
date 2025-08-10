// Deno Edge Function
// Minimal handler we will extend in Phase 2/3

type Out = {
    url: string;
    type: 'pdf'|'x'|'reddit'|'job'|'advertiser'|'article';
    title?: string;
    author?: string | null;
    publishDate?: string | null;
    summary?: string;
    content?: string;
    newsletter?: string | null;
  };
  
  function classify(u: string): Out['type'] {
    const s = u.toLowerCase();
    if (s.endsWith('.pdf') || s.includes('/pdf')) return 'pdf';
    if (s.includes('x.com') || s.includes('twitter.com')) return 'x';
    if (s.includes('reddit.com')) return 'reddit';
    if (/(careers|jobs|greenhouse\.io|lever\.co)/.test(s)) return 'job';
    if (/(ads?|advertis)/.test(s)) return 'advertiser';
    return 'article';
  }
  
  async function fetchHtml(url: string) {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
    const contentType = res.headers.get('content-type') ?? '';
    const isPdf = contentType.includes('application/pdf') || url.toLowerCase().endsWith('.pdf');
    return { text: isPdf ? '' : await res.text(), isPdf };
  }
  
  function naiveParse(html: string, url: string) {
    const title = (html.match(/<title>(.*?)<\/title>/i)?.[1] ?? '').trim();
    return {
      title,
      author: null,
      publishDate: null,
      summary: title ? `Summary: ${title}` : '',
      content: html ? html.slice(0, 5000) : '',
    };
  }
  
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, content-type',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      });
    }
  
    try {
      if (req.method !== 'POST') return new Response('Use POST', { status: 405 });
      const { url, newsletter } = await req.json();
      if (!url) return new Response('Missing url', { status: 400 });
  
      const { text, isPdf } = await fetchHtml(url);
      const type = classify(url);
  
      const parsed = isPdf
        ? { title: 'PDF', author: null, publishDate: null, summary: '', content: '' }
        : naiveParse(text, url);
  
      const out: Out = { url, type, newsletter: newsletter ?? null, ...parsed };
  
      return new Response(JSON.stringify(out), {
        headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        status: 200,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(JSON.stringify({ error: msg }), {
        headers: { 'content-type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        status: 500,
      });
    }
  });