export type LinkType = 'pdf'|'x'|'reddit'|'job'|'advertiser'|'article';
export function classify(url: string): LinkType {
  const s = url.toLowerCase();
  if (s.endsWith('.pdf') || s.includes('/pdf')) return 'pdf';
  if (s.includes('x.com') || s.includes('twitter.com')) return 'x';
  if (s.includes('reddit.com')) return 'reddit';
  if (/(careers|jobs|greenhouse\.io|lever\.co)/.test(s)) return 'job';
  if (/(ads?|advertis)/.test(s)) return 'advertiser';
  return 'article';
}