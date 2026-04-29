const express = require('express');
const https   = require('https');
const Parser  = require('rss-parser');
const axios   = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const selfsigned = require('selfsigned');
const fs   = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const parser = new Parser({
  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content', 'mediaContent'],
      ['media:group', 'mediaGroup'],
      ['content:encoded', 'contentEncoded'],
      ['yt:videoId', 'ytVideoId'],
    ],
  },
});

// In-memory cache with TTL
class Cache {
  constructor() { this.store = new Map(); }
  get(key, ttl) {
    const e = this.store.get(key);
    if (e && Date.now() - e.ts < ttl) return e.data;
    return null;
  }
  set(key, data) { this.store.set(key, { data, ts: Date.now() }); }
  delete(key) { this.store.delete(key); }
}

const cache = new Cache();
const FEED_TTL  = 15 * 60 * 1000;  // 15 min
const ART_TTL   = 60 * 60 * 1000;  // 1 hour

const DATA_DIR    = process.env.DATA_DIR || __dirname;
const CONFIG_PATH = path.join(DATA_DIR, 'feeds.json');
const DEFAULT_FEEDS = [
  // General
  { id: 'bbc-news',      name: 'BBC News',         category: 'General',  url: 'https://feeds.bbci.co.uk/news/rss.xml',                  enabled: true  },
  { id: 'reuters',       name: 'Reuters',           category: 'General',  url: 'https://feeds.reuters.com/reuters/topNews',               enabled: false },
  { id: 'guardian',      name: 'The Guardian',      category: 'General',  url: 'https://www.theguardian.com/world/rss',                   enabled: false },
  { id: 'npr',           name: 'NPR News',          category: 'General',  url: 'https://feeds.npr.org/1001/rss.xml',                      enabled: false },
  { id: 'ap',            name: 'AP News',           category: 'General',  url: 'https://feeds.apnews.com/rss/apf-topnews',               enabled: false },
  { id: 'aljazeera',     name: 'Al Jazeera',        category: 'General',  url: 'https://www.aljazeera.com/xml/rss/all.xml',               enabled: false },
  // Technology
  { id: 'bbc-tech',      name: 'BBC Technology',    category: 'Technology', url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',      enabled: true  },
  { id: 'theverge',      name: 'The Verge',         category: 'Technology', url: 'https://www.theverge.com/rss/index.xml',                enabled: false },
  { id: 'arstechnica',   name: 'Ars Technica',      category: 'Technology', url: 'https://feeds.arstechnica.com/arstechnica/index',       enabled: false },
  { id: 'wired',         name: 'Wired',             category: 'Technology', url: 'https://www.wired.com/feed/rss',                        enabled: false },
  { id: 'techcrunch',    name: 'TechCrunch',        category: 'Technology', url: 'https://techcrunch.com/feed/',                          enabled: false },
  { id: 'hackernews',    name: 'Hacker News',       category: 'Technology', url: 'https://hnrss.org/frontpage',                           enabled: false },
  // Science
  { id: 'newscientist',  name: 'New Scientist',     category: 'Science',  url: 'https://www.newscientist.com/feed/home/',                 enabled: false },
  { id: 'nasa',          name: 'NASA',              category: 'Science',  url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss',          enabled: false },
  { id: 'sciencedaily',  name: 'Science Daily',     category: 'Science',  url: 'https://www.sciencedaily.com/rss/all.xml',                enabled: false },
  // Business
  { id: 'bbc-business',  name: 'BBC Business',        category: 'Business',            url: 'https://feeds.bbci.co.uk/news/business/rss.xml',                              enabled: false },
  // Norwegian
  { id: 'nrk',           name: 'NRK Nyheter',         category: 'Norwegian',           url: 'https://www.nrk.no/toppsaker.rss',                                            enabled: false },
  { id: 'vg',            name: 'VG',                  category: 'Norwegian',           url: 'https://www.vg.no/rss/feed/',                                                 enabled: false },
  { id: 'dagbladet',     name: 'Dagbladet',           category: 'Norwegian',           url: 'https://www.dagbladet.no/rss',                                                enabled: false },
  { id: 'aftenposten',   name: 'Aftenposten',         category: 'Norwegian',           url: 'https://www.aftenposten.no/rss/',                                             enabled: false },
  { id: 'tv2',           name: 'TV 2 Nyheter',        category: 'Norwegian',           url: 'https://www.tv2.no/rss/',                                                     enabled: false },
  { id: 'nettavisen',    name: 'Nettavisen',          category: 'Norwegian',           url: 'https://www.nettavisen.no/rss.xml',                                           enabled: false },
  { id: 'e24',           name: 'E24',                 category: 'Norwegian',           url: 'https://e24.no/rss',                                                          enabled: false },
  { id: 'dn',            name: 'Dagens Næringsliv',   category: 'Norwegian',           url: 'https://www.dn.no/rss',                                                       enabled: false },
  { id: 'bt',            name: 'Bergens Tidende',     category: 'Norwegian',           url: 'https://www.bt.no/rss/',                                                      enabled: false },
  { id: 'nrk-sport',     name: 'NRK Sport',           category: 'Norwegian',           url: 'https://www.nrk.no/sport/toppsaker.rss',                                      enabled: false },
  // Artificial Intelligence — news & industry
  { id: 'ai-venturebeat',  name: 'VentureBeat AI',    category: 'Artificial Intelligence', url: 'https://venturebeat.com/category/ai/feed/',                               enabled: false },
  { id: 'ai-mit-tr',       name: 'MIT Tech Review',   category: 'Artificial Intelligence', url: 'https://www.technologyreview.com/feed/',                                  enabled: false },
  { id: 'ai-verge',        name: 'The Verge AI',      category: 'Artificial Intelligence', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',       enabled: false },
  { id: 'ai-openai',       name: 'OpenAI News',       category: 'Artificial Intelligence', url: 'https://openai.com/news/rss.xml',                                         enabled: false },
  { id: 'ai-deepmind',     name: 'DeepMind Blog',     category: 'Artificial Intelligence', url: 'https://deepmind.google/blog/rss.xml',                                    enabled: false },
  { id: 'ai-googleai',     name: 'Google AI Blog',    category: 'Artificial Intelligence', url: 'https://blog.research.google/feeds/posts/default',                        enabled: false },
  { id: 'ai-huggingface',  name: 'Hugging Face',      category: 'Artificial Intelligence', url: 'https://huggingface.co/blog/feed.xml',                                    enabled: false },
  { id: 'ai-msresearch',   name: 'Microsoft Research',category: 'Artificial Intelligence', url: 'https://www.microsoft.com/en-us/research/feed/',                          enabled: false },
  { id: 'ai-ainews',       name: 'AI News',           category: 'Artificial Intelligence', url: 'https://artificialintelligence-news.com/feed/',                           enabled: false },
  { id: 'ai-synced',       name: 'Synced AI',         category: 'Artificial Intelligence', url: 'https://syncedreview.com/feed/',                                          enabled: false },
  { id: 'ai-ieee',         name: 'IEEE Spectrum AI',  category: 'Artificial Intelligence', url: 'https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss',       enabled: false },
  { id: 'ai-lastweek',     name: 'Last Week in AI',   category: 'Artificial Intelligence', url: 'https://lastweekin.ai/feed',                                              enabled: false },
  // Artificial Intelligence — research & learning
  { id: 'ai-bair',         name: 'BAIR Blog',         category: 'Artificial Intelligence', url: 'https://bair.berkeley.edu/blog/feed.xml',                                 enabled: false },
  { id: 'ai-kdnuggets',    name: 'KDnuggets',         category: 'Artificial Intelligence', url: 'https://www.kdnuggets.com/feed',                                          enabled: false },
  { id: 'ai-tds',          name: 'Towards Data Science', category: 'Artificial Intelligence', url: 'https://towardsdatascience.com/feed',                                  enabled: false },
  { id: 'ai-towardsai',    name: 'Towards AI',        category: 'Artificial Intelligence', url: 'https://towardsai.net/feed',                                              enabled: false },
  { id: 'ai-gradient',     name: 'The Gradient',      category: 'Artificial Intelligence', url: 'https://thegradient.pub/rss/',                                            enabled: false },
  { id: 'ai-importai',     name: 'Import AI',         category: 'Artificial Intelligence', url: 'https://importai.substack.com/feed',                                      enabled: false },
  { id: 'ai-alignment',    name: 'AI Alignment Forum',category: 'Artificial Intelligence', url: 'https://www.alignmentforum.org/feed.xml',                                 enabled: false },
  { id: 'ai-mlsafety',     name: 'ML Safety Newsletter', category: 'Artificial Intelligence', url: 'https://newsletter.mlsafety.org/feed',                                enabled: false },
  { id: 'ai-lexfridman',   name: 'Lex Fridman Blog',  category: 'Artificial Intelligence', url: 'https://lexfridman.com/feed/',                                            enabled: false },
];

function loadConfig() {
  let saved;
  try {
    if (fs.existsSync(CONFIG_PATH)) saved = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {}

  // Normalise: old format was a plain array, new format is { feeds, customCategories }
  const savedFeeds = Array.isArray(saved) ? saved : (saved?.feeds ?? null);
  const customCategories = Array.isArray(saved) ? [] : (saved?.customCategories ?? []);

  if (!savedFeeds) return { feeds: [...DEFAULT_FEEDS], customCategories: [] };

  const existingIds = new Set(savedFeeds.map(f => f.id));
  const mergedFeeds = [
    ...savedFeeds.map(f => {
      if (!f.category) {
        const def = DEFAULT_FEEDS.find(d => d.id === f.id);
        return def ? { ...f, category: def.category } : { ...f, category: 'General' };
      }
      return f;
    }),
    ...DEFAULT_FEEDS.filter(d => !existingIds.has(d.id)),
  ];

  const result = { feeds: mergedFeeds, customCategories };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(result, null, 2));
  return result;
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

function getItemImage(item) {
  if (item.mediaThumbnail) {
    if (item.mediaThumbnail.$ && item.mediaThumbnail.$.url) return item.mediaThumbnail.$.url;
    if (typeof item.mediaThumbnail === 'string') return item.mediaThumbnail;
  }
  if (item.mediaGroup) {
    const g = Array.isArray(item.mediaGroup) ? item.mediaGroup[0] : item.mediaGroup;
    const thumb = g?.['media:thumbnail']?.[0] ?? g?.['media:thumbnail'];
    if (thumb?.$?.url) return thumb.$.url;
  }
  if (item.mediaContent) {
    if (Array.isArray(item.mediaContent)) {
      const mc = item.mediaContent.find(m => m.$ && m.$.url);
      if (mc) return mc.$.url;
    }
    if (item.mediaContent.$ && item.mediaContent.$.url) return item.mediaContent.$.url;
  }
  if (item.enclosure && item.enclosure.url && /image/i.test(item.enclosure.type || '')) {
    return item.enclosure.url;
  }
  const html = item.contentEncoded || item.content || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function getYoutubeDescription(item) {
  if (item.mediaGroup) {
    const g = Array.isArray(item.mediaGroup) ? item.mediaGroup[0] : item.mediaGroup;
    const desc = g?.['media:description']?.[0];
    if (desc) return typeof desc === 'string' ? desc : desc._ || '';
  }
  return null;
}

// ── API routes ────────────────────────────────────────────────────────────────

app.get('/api/config', (req, res) => res.json(loadConfig()));

app.put('/api/config', (req, res) => {
  saveConfig(req.body);
  res.json({ ok: true });
});

app.get('/api/feed', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  const key = `feed:${url}`;
  const hit = cache.get(key, FEED_TTL);
  if (hit) return res.json({ ...hit, fromCache: true });

  try {
    const feed = await parser.parseURL(url);
    const data = {
      title: feed.title || 'Feed',
      items: feed.items.map(item => ({
        id:          item.guid || item.link || item.title || '',
        title:       item.title || '',
        link:        item.link  || '',
        description: item.contentSnippet || item.summary || getYoutubeDescription(item) || '',
        image:       getItemImage(item),
        pubDate:     item.pubDate || item.isoDate || null,
        author:      item.creator || item.author  || '',
        ytVideoId:   item.ytVideoId || null,
      })),
      fetchedAt: Date.now(),
    };
    cache.set(key, data);
    res.json(data);
  } catch (err) {
    console.error('[feed]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/feed-cache', (req, res) => {
  const { url } = req.query;
  if (url) cache.delete(`feed:${url}`);
  res.json({ ok: true });
});

app.get('/api/article', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });

  const key = `article:${url}`;
  const hit = cache.get(key, ART_TTL);
  if (hit) return res.json({ ...hit, fromCache: true });

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-GB,en;q=0.9',
      },
      timeout: 15000,
      maxRedirects: 5,
    });

    const dom = new JSDOM(response.data, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) return res.status(422).json({ error: 'Could not extract article content' });

    const data = {
      title:         article.title,
      content:       article.content,
      excerpt:       article.excerpt,
      byline:        article.byline,
      siteName:      article.siteName,
      publishedTime: article.publishedTime,
      fetchedAt:     Date.now(),
    };
    cache.set(key, data);
    res.json(data);
  } catch (err) {
    console.error('[article]', err.message);
    res.status(500).json({ error: err.message });
  }
});

const HTTP_PORT  = process.env.PORT  || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

app.listen(HTTP_PORT, () => {
  console.log(`\n  News Reader  →  http://localhost:${HTTP_PORT}`);
});

// Self-signed HTTPS so phones on the same Wi-Fi can install the PWA
try {
  const certPath = path.join(DATA_DIR, 'cert.json');
  let pems;
  if (fs.existsSync(certPath)) {
    pems = JSON.parse(fs.readFileSync(certPath, 'utf8'));
  } else {
    pems = selfsigned.generate([{ name: 'commonName', value: 'news-reader.local' }], { days: 730 });
    fs.writeFileSync(certPath, JSON.stringify(pems));
  }
  https.createServer({ key: pems.private, cert: pems.cert }, app).listen(HTTPS_PORT, () => {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();
    const lan = Object.values(nets).flat().find(n => n.family === 'IPv4' && !n.internal);
    console.log(`  PWA (HTTPS) →  https://localhost:${HTTPS_PORT}`);
    if (lan) console.log(`  On your phone →  https://${lan.address}:${HTTPS_PORT}  (accept the cert warning)\n`);
  });
} catch (err) {
  console.warn('  HTTPS unavailable:', err.message, '\n');
}
