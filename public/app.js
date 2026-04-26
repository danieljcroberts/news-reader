'use strict';

// ── Constants ────────────────────────────────────────────────────────────────
const LS_PREFIX    = 'news_feed_';
const LS_IDX       = 'news_feed_index';
const BATCH_SIZE   = 15;
const DEFAULT_CATS = ['General', 'Technology', 'Artificial Intelligence', 'Science', 'Business'];

// Running as a Capacitor native app (no server needed)
const IS_NATIVE = typeof window.Capacitor !== 'undefined' && Capacitor.isNativePlatform();

// Default feeds mirrored from server.js — used in native mode
const DEFAULT_FEEDS = [
  { id: 'bbc-news',      name: 'BBC News',             category: 'General',              url: 'https://feeds.bbci.co.uk/news/rss.xml',                                    enabled: true  },
  { id: 'reuters',       name: 'Reuters',               category: 'General',              url: 'https://feeds.reuters.com/reuters/topNews',                                 enabled: false },
  { id: 'guardian',      name: 'The Guardian',          category: 'General',              url: 'https://www.theguardian.com/world/rss',                                     enabled: false },
  { id: 'npr',           name: 'NPR News',              category: 'General',              url: 'https://feeds.npr.org/1001/rss.xml',                                        enabled: false },
  { id: 'ap',            name: 'AP News',               category: 'General',              url: 'https://feeds.apnews.com/rss/apf-topnews',                                  enabled: false },
  { id: 'aljazeera',     name: 'Al Jazeera',            category: 'General',              url: 'https://www.aljazeera.com/xml/rss/all.xml',                                 enabled: false },
  { id: 'bbc-tech',      name: 'BBC Technology',        category: 'Technology',           url: 'https://feeds.bbci.co.uk/news/technology/rss.xml',                          enabled: true  },
  { id: 'theverge',      name: 'The Verge',             category: 'Technology',           url: 'https://www.theverge.com/rss/index.xml',                                    enabled: false },
  { id: 'arstechnica',   name: 'Ars Technica',          category: 'Technology',           url: 'https://feeds.arstechnica.com/arstechnica/index',                           enabled: false },
  { id: 'wired',         name: 'Wired',                 category: 'Technology',           url: 'https://www.wired.com/feed/rss',                                            enabled: false },
  { id: 'techcrunch',    name: 'TechCrunch',            category: 'Technology',           url: 'https://techcrunch.com/feed/',                                              enabled: false },
  { id: 'hackernews',    name: 'Hacker News',           category: 'Technology',           url: 'https://hnrss.org/frontpage',                                               enabled: false },
  { id: 'newscientist',  name: 'New Scientist',         category: 'Science',              url: 'https://www.newscientist.com/feed/home/',                                   enabled: false },
  { id: 'nasa',          name: 'NASA',                  category: 'Science',              url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss',                            enabled: false },
  { id: 'sciencedaily',  name: 'Science Daily',         category: 'Science',              url: 'https://www.sciencedaily.com/rss/all.xml',                                  enabled: false },
  { id: 'bbc-business',  name: 'BBC Business',          category: 'Business',             url: 'https://feeds.bbci.co.uk/news/business/rss.xml',                            enabled: false },
  { id: 'ai-venturebeat',name: 'VentureBeat AI',        category: 'Artificial Intelligence', url: 'https://venturebeat.com/category/ai/feed/',                              enabled: false },
  { id: 'ai-mit-tr',     name: 'MIT Tech Review',       category: 'Artificial Intelligence', url: 'https://www.technologyreview.com/feed/',                                 enabled: false },
  { id: 'ai-verge',      name: 'The Verge AI',          category: 'Artificial Intelligence', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml',      enabled: false },
  { id: 'ai-openai',     name: 'OpenAI News',           category: 'Artificial Intelligence', url: 'https://openai.com/news/rss.xml',                                        enabled: false },
  { id: 'ai-deepmind',   name: 'DeepMind Blog',         category: 'Artificial Intelligence', url: 'https://deepmind.google/blog/rss.xml',                                   enabled: false },
  { id: 'ai-googleai',   name: 'Google AI Blog',        category: 'Artificial Intelligence', url: 'https://blog.research.google/feeds/posts/default',                       enabled: false },
  { id: 'ai-huggingface',name: 'Hugging Face',          category: 'Artificial Intelligence', url: 'https://huggingface.co/blog/feed.xml',                                   enabled: false },
  { id: 'ai-msresearch', name: 'Microsoft Research',    category: 'Artificial Intelligence', url: 'https://www.microsoft.com/en-us/research/feed/',                         enabled: false },
  { id: 'ai-ainews',     name: 'AI News',               category: 'Artificial Intelligence', url: 'https://artificialintelligence-news.com/feed/',                          enabled: false },
  { id: 'ai-ieee',       name: 'IEEE Spectrum AI',      category: 'Artificial Intelligence', url: 'https://spectrum.ieee.org/feeds/topic/artificial-intelligence.rss',      enabled: false },
  { id: 'ai-bair',       name: 'BAIR Blog',             category: 'Artificial Intelligence', url: 'https://bair.berkeley.edu/blog/feed.xml',                                enabled: false },
  { id: 'ai-kdnuggets',  name: 'KDnuggets',             category: 'Artificial Intelligence', url: 'https://www.kdnuggets.com/feed',                                         enabled: false },
  { id: 'ai-tds',        name: 'Towards Data Science',  category: 'Artificial Intelligence', url: 'https://towardsdatascience.com/feed',                                    enabled: false },
  { id: 'ai-gradient',   name: 'The Gradient',          category: 'Artificial Intelligence', url: 'https://thegradient.pub/rss/',                                           enabled: false },
  { id: 'ai-alignment',  name: 'AI Alignment Forum',    category: 'Artificial Intelligence', url: 'https://www.alignmentforum.org/feed.xml',                                enabled: false },
  { id: 'ai-lastweek',   name: 'Last Week in AI',       category: 'Artificial Intelligence', url: 'https://lastweekin.ai/feed',                                             enabled: false },
];

// RSS parser instance for native mode (rss-parser browser build loaded via <script>)
const nativeRssParser = typeof RSSParser !== 'undefined' ? new RSSParser({
  customFields: {
    item: [
      ['media:thumbnail', 'mediaThumbnail'],
      ['media:content',   'mediaContent'],
      ['media:group',     'mediaGroup'],
      ['content:encoded', 'contentEncoded'],
      ['yt:videoId',      'ytVideoId'],
    ],
  },
}) : null;

function getItemImageClient(item) {
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
  if (item.enclosure?.url && /image/i.test(item.enclosure.type || '')) return item.enclosure.url;
  const html = item.contentEncoded || item.content || '';
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

async function loadFeedNative(url) {
  const res  = await fetch(url);
  const text = await res.text();
  const feed = await nativeRssParser.parseString(text);
  return {
    title: feed.title || 'Feed',
    items: feed.items.map(item => ({
      id:          item.guid || item.link || item.title || '',
      title:       item.title || '',
      link:        item.link  || '',
      description: item.contentSnippet || item.summary || '',
      image:       getItemImageClient(item),
      pubDate:     item.pubDate || item.isoDate || null,
      author:      item.creator || item.author  || '',
      ytVideoId:   item.ytVideoId || null,
    })),
    fetchedAt: Date.now(),
  };
}

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  feeds:            [],
  customCategories: [],
  activeIndex:      0,
  view:             'feed',
  currentArticleUrl: null,
  allItems:         [],
  renderCount:      0,
  layout: localStorage.getItem('news_layout') || 'full',
  movingFeedId: null,
};

// ── DOM refs ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const feedView       = $('feed-view');
const articleView    = $('article-view');
const feedTitle      = $('feed-title');
const feedDots       = $('feed-dots');
const feedContainer  = $('feed-container');
const feedStatus     = $('feed-status');
const articleSite    = $('article-site');
const articleScroll  = $('article-scroll');
const articleContent = $('article-content');
const openBrowser    = $('btn-open-browser');
const settingsPanel  = $('settings-panel');
const settingsList   = $('settings-feed-list');
const catPicker      = $('cat-picker');
const catPickerOpts  = $('cat-picker-options');

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function generateId() { return Math.random().toString(36).slice(2, 10); }

function lsGet(url) {
  try { return JSON.parse(localStorage.getItem(LS_PREFIX + btoa(url).slice(0, 40))); }
  catch { return null; }
}
function lsSet(url, data) {
  try { localStorage.setItem(LS_PREFIX + btoa(url).slice(0, 40), JSON.stringify(data)); } catch {}
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function sortNewest(items) {
  return [...items].sort((a,b) => new Date(b.pubDate||0) - new Date(a.pubDate||0));
}

function faviconUrl(feedUrl) {
  try {
    const host = new URL(feedUrl).hostname.replace(/^(feeds?|rss|news)\./i, '');
    return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
  } catch { return ''; }
}

function isYoutubeUrl(url) {
  return /youtube\.com\/watch|youtu\.be\//i.test(url || '');
}

function youtubeVideoId(url, ytVideoId) {
  if (ytVideoId) return ytVideoId;
  try {
    const u = new URL(url);
    return u.searchParams.get('v') || u.pathname.split('/').pop() || '';
  } catch { return ''; }
}

// ── Config ────────────────────────────────────────────────────────────────────
async function loadConfig() {
  let feeds, customCategories;

  if (IS_NATIVE) {
    const saved = JSON.parse(localStorage.getItem('news_config') || 'null');
    customCategories = saved?.customCategories ?? [];
    const savedFeeds = saved?.feeds ?? null;
    if (!savedFeeds) {
      feeds = [...DEFAULT_FEEDS];
    } else {
      const existingIds = new Set(savedFeeds.map(f => f.id));
      feeds = [
        ...savedFeeds.map(f => f.category ? f : { ...f, category: DEFAULT_FEEDS.find(d => d.id === f.id)?.category || 'General' }),
        ...DEFAULT_FEEDS.filter(d => !existingIds.has(d.id)),
      ];
    }
  } else {
    const res  = await fetch('/api/config');
    const data = await res.json();
    feeds            = data.feeds            ?? data;
    customCategories = data.customCategories ?? [];
  }

  state.feeds            = feeds;
  state.customCategories = customCategories;
  const savedIdx = parseInt(localStorage.getItem(LS_IDX) || '0', 10);
  state.activeIndex = Math.min(savedIdx, Math.max(0, enabledFeeds().length - 1));
}

async function saveConfig() {
  const payload = { feeds: state.feeds, customCategories: state.customCategories };
  if (IS_NATIVE) {
    localStorage.setItem('news_config', JSON.stringify(payload));
  } else {
    await fetch('/api/config', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  }
}

function enabledFeeds() { return state.feeds.filter(f => f.enabled); }

function allCategories() {
  const fromFeeds = [...new Set(state.feeds.map(f => f.category || 'Other'))];
  return [...new Set([...DEFAULT_CATS, ...state.customCategories, ...fromFeeds])];
}

// ── Feed loading ──────────────────────────────────────────────────────────────
async function loadFeed(feedIndex, direction = 0) {
  const feeds = enabledFeeds();
  if (!feeds.length) {
    feedContainer.innerHTML = `<div class="error-state"><div class="error-icon">📭</div><p>No feeds enabled.<br>Open settings to add one.</p></div>`;
    feedTitle.textContent = 'No feeds';
    return;
  }
  const feed = feeds[feedIndex];
  feedTitle.textContent = feed.name;
  const favicon = $('feed-favicon');
  if (favicon) { favicon.src = faviconUrl(feed.url); favicon.style.display = ''; }
  localStorage.setItem(LS_IDX, feedIndex);
  renderDots(feeds.length, feedIndex);

  const cached = lsGet(feed.url);
  if (cached?.items) {
    initFeedItems(cached.items, direction);
    setStatus(`Cached · ${Math.round((Date.now()-cached.fetchedAt)/60000)}m ago`, false);
  } else {
    renderSkeletons(direction);
    setStatus('Loading…', false);
  }

  try {
    const data = IS_NATIVE
      ? await loadFeedNative(feed.url)
      : await fetch(`/api/feed?url=${encodeURIComponent(feed.url)}`).then(r => { if (!r.ok) throw new Error(); return r.json(); });
    lsSet(feed.url, data);
    if (state.activeIndex === feedIndex && state.view === 'feed') {
      initFeedItems(data.items, cached ? 0 : direction);
      setStatus('Updated just now', true);
    }
  } catch (err) {
    if (!cached) {
      feedContainer.innerHTML = `
        <div class="error-state">
          <div class="error-icon">⚠️</div>
          <p>Couldn't load <strong>${esc(feed.name)}</strong>.<br>${esc(err.message)}</p>
          <button class="btn-retry" onclick="App.retry()">Try Again</button>
        </div>`;
      setStatus('', false);
    } else {
      setStatus('Offline — showing cached data', false);
    }
  }
}

function setStatus(msg, autoHide) {
  if (!msg) { feedStatus.classList.add('hidden'); return; }
  feedStatus.textContent = msg;
  feedStatus.classList.remove('hidden');
  if (autoHide) setTimeout(() => feedStatus.classList.add('hidden'), 2500);
}

// ── Infinite scroll ───────────────────────────────────────────────────────────
let scrollObserver = null;

function initFeedItems(items, direction) {
  state.allItems    = sortNewest(items);
  state.renderCount = 0;
  const animClass = direction > 0 ? 'feed-entering-right'
                  : direction < 0 ? 'feed-entering-left' : '';
  feedContainer.innerHTML = '';
  const sentinel = document.createElement('div');
  sentinel.id = 'feed-sentinel';
  sentinel.style.height = '1px';
  feedContainer.appendChild(sentinel);
  if (animClass) {
    feedContainer.classList.add(animClass);
    feedContainer.addEventListener('animationend', () => feedContainer.classList.remove(animClass), { once: true });
  }
  feedContainer.scrollTop = 0;
  setupScrollObserver(sentinel);
  loadMoreItems();
}

function setupScrollObserver(sentinel) {
  if (scrollObserver) scrollObserver.disconnect();
  scrollObserver = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && state.view === 'feed') loadMoreItems();
  }, { root: feedContainer, rootMargin: '0px 0px 300px 0px', threshold: 0 });
  scrollObserver.observe(sentinel);
}

function loadMoreItems() {
  const { allItems, renderCount } = state;
  if (renderCount >= allItems.length) { showEndOfFeed(); return; }
  const batch = allItems.slice(renderCount, renderCount + BATCH_SIZE);
  state.renderCount += batch.length;
  const sentinel = $('feed-sentinel');
  const frag = document.createDocumentFragment();
  batch.forEach(item => {
    const el = document.createElement('article');
    el.className = 'card';
    el.dataset.url     = item.link        || '';
    el.dataset.title   = item.title       || '';
    el.dataset.desc    = item.description || '';
    el.dataset.img     = item.image       || '';
    el.dataset.ytId    = item.ytVideoId   || '';
    el.innerHTML = cardInnerHtml(item);
    frag.appendChild(el);
  });
  feedContainer.insertBefore(frag, sentinel);
  if (state.renderCount >= allItems.length) showEndOfFeed();
}

function showEndOfFeed() {
  if ($('feed-end')) return;
  const end = document.createElement('div');
  end.id = 'feed-end';
  end.className = 'feed-end';
  end.textContent = `${state.allItems.length} article${state.allItems.length !== 1 ? 's' : ''} · all caught up`;
  const sentinel = $('feed-sentinel');
  if (sentinel) feedContainer.insertBefore(end, sentinel);
  if (scrollObserver) scrollObserver.disconnect();
}

// ── Rendering ─────────────────────────────────────────────────────────────────
function renderDots(count, active) {
  feedDots.innerHTML = Array.from({length: count}, (_,i) =>
    `<span class="feed-dot ${i===active?'active':''}"></span>`).join('');
}

function cardInnerHtml(item) {
  const img = item.image
    ? `<div class="card-image"><img src="${esc(item.image)}" alt="" loading="lazy" onerror="this.closest('.card-image').remove()"></div>`
    : '';
  return `${img}<div class="card-body">
    <h2 class="card-title">${esc(item.title)}</h2>
    ${item.description ? `<p class="card-desc">${esc(item.description)}</p>` : ''}
    <div class="card-meta"><span class="meta-time">${timeAgo(item.pubDate)}</span><span class="meta-author">${item.author ? ' · '+esc(item.author) : ''}</span></div>
  </div>`;
}

function renderSkeletons(direction) {
  const animClass = direction > 0 ? 'feed-entering-right' : direction < 0 ? 'feed-entering-left' : '';
  feedContainer.innerHTML = Array(6).fill(0).map(() => `
    <div class="card skeleton-card">
      <div class="skeleton skeleton-image"></div>
      <div class="card-body">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-meta"></div>
      </div>
    </div>`).join('');
  if (animClass) {
    feedContainer.classList.add(animClass);
    feedContainer.addEventListener('animationend', () => feedContainer.classList.remove(animClass), { once: true });
  }
  feedContainer.scrollTop = 0;
}

// ── Feed switching ────────────────────────────────────────────────────────────
function switchFeed(delta, fromSwipe) {
  const feeds = enabledFeeds();
  if (feeds.length < 2) return;
  state.activeIndex = (state.activeIndex + delta + feeds.length) % feeds.length;
  loadFeed(state.activeIndex, fromSwipe ? 0 : delta);
}

// ── Article reader ────────────────────────────────────────────────────────────
async function openArticle(url, item) {
  state.view = 'article';
  state.currentArticleUrl = url;
  feedView.classList.add('slide-left');
  articleView.classList.add('active');
  articleScroll.scrollTop = 0;

  const ytId = youtubeVideoId(url, item.ytVideoId);
  const isYT  = isYoutubeUrl(url) || !!ytId;
  openBrowser.href = isYT ? url : `https://www.removepaywalls.com/${encodeURIComponent(url)}`;

  if (isYT && ytId) {
    articleSite.textContent = 'YouTube';
    articleContent.innerHTML = `
      <div class="yt-embed-wrap">
        <iframe src="https://www.youtube.com/embed/${esc(ytId)}"
          frameborder="0" allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
        </iframe>
      </div>
      <h1 class="article-title-display">${esc(item.title)}</h1>
      ${item.description ? `<div class="article-body yt-desc">${esc(item.description)}</div>` : ''}`;
    return;
  }

  articleContent.innerHTML = `
    <h1 class="article-title-display">${esc(item.title)}</h1>
    ${item.description ? `<p class="article-fallback-desc">${esc(item.description)}</p>` : ''}
    <div class="article-loading">
      <div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div>
      <div class="skeleton skeleton-para" style="height:200px"></div>
      <div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div>
    </div>`;

  try {
    let data;
    if (IS_NATIVE) {
      const html = await fetch(url, {
        headers: { 'Accept': 'text/html,application/xhtml+xml,*/*', 'Accept-Language': 'en-GB,en;q=0.9' },
      }).then(r => r.text());
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const base = doc.createElement('base');
      base.href = url;
      doc.head.prepend(base);
      const article = new Readability(doc).parse();
      if (!article) throw new Error('Could not extract article');
      data = { title: article.title, content: article.content, byline: article.byline, siteName: article.siteName, publishedTime: article.publishedTime };
    } else {
      const res = await fetch(`/api/article?url=${encodeURIComponent(url)}`);
      if (!res.ok) throw new Error();
      data = await res.json();
    }
    if (state.currentArticleUrl !== url) return;
    articleSite.textContent = data.siteName || '';
    articleContent.innerHTML = `
      <h1 class="article-title-display">${esc(data.title || item.title)}</h1>
      <div class="article-meta">
        ${data.byline ? `<span class="article-byline">${esc(data.byline)}</span>` : ''}
        ${data.publishedTime ? `<span class="article-time">${new Date(data.publishedTime).toLocaleString()}</span>` : ''}
      </div>
      <div class="article-body">${data.content}</div>`;
  } catch {
    if (state.currentArticleUrl !== url) return;
    articleSite.textContent = '';
    articleContent.innerHTML = `
      <h1 class="article-title-display">${esc(item.title)}</h1>
      ${item.description ? `<p class="article-fallback-desc">${esc(item.description)}</p>` : ''}
      <div class="article-load-error">
        <p>Full article could not be loaded.</p>
        <a href="${esc(url)}" target="_blank" rel="noopener">Open in Browser ↗</a>
      </div>`;
  }
}

function closeArticle() {
  state.view = 'feed';
  state.currentArticleUrl = null;
  articleView.classList.remove('active');
  feedView.classList.remove('slide-left');
  articleSite.textContent = '';
}

// ── Layout ────────────────────────────────────────────────────────────────────
const LAYOUTS = ['full', 'medium', 'compact', 'list'];

function applyLayout(layout) {
  LAYOUTS.forEach(l => feedContainer.classList.remove(l));
  feedContainer.classList.add(layout);
  document.querySelectorAll('.layout-btn').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.layout === layout));
}

function setLayout(layout) {
  state.layout = layout;
  localStorage.setItem('news_layout', layout);
  applyLayout(layout);
}

// ── Category move picker ──────────────────────────────────────────────────────
function openMovePicker(feedId) {
  state.movingFeedId = feedId;
  const feed = state.feeds.find(f => f.id === feedId);
  const cats = allCategories();
  catPickerOpts.innerHTML = cats.map(cat => `
    <button class="sort-option ${cat === (feed?.category||'Other') ? 'active' : ''}" data-cat="${esc(cat)}">
      <span>${esc(cat)}</span>
      <svg class="sort-tick" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
    </button>`).join('');
  catPickerOpts.querySelectorAll('.sort-option').forEach(btn =>
    btn.addEventListener('click', () => moveFeedToCategory(state.movingFeedId, btn.dataset.cat)));
  catPicker.classList.add('open');
}
function closeMovePicker() { catPicker.classList.remove('open'); state.movingFeedId = null; }

function moveFeedToCategory(feedId, newCat) {
  const feed = state.feeds.find(f => f.id === feedId);
  if (feed) { feed.category = newCat; saveConfig(); renderSettingsList(); }
  closeMovePicker();
}

// ── Custom categories ─────────────────────────────────────────────────────────
function promptAddCategory() {
  const name = prompt('New category name:');
  if (!name || !name.trim()) return;
  const trimmed = name.trim();
  if (allCategories().includes(trimmed)) { alert('Category already exists.'); return; }
  state.customCategories.push(trimmed);
  saveConfig();
  renderSettingsList();
  populateCategorySelect();
}

function promptRenameCategory(oldName) {
  const name = prompt('Rename category:', oldName);
  if (!name || !name.trim() || name.trim() === oldName) return;
  const newName = name.trim();
  if (allCategories().includes(newName)) { alert('That name is already in use.'); return; }
  state.customCategories = state.customCategories.map(c => c === oldName ? newName : c);
  state.feeds = state.feeds.map(f => f.category === oldName ? { ...f, category: newName } : f);
  saveConfig();
  renderSettingsList();
  populateCategorySelect();
}

function deleteCategory(name) {
  const hasFeed = state.feeds.some(f => f.category === name);
  if (hasFeed && !confirm(`"${name}" still has feeds. Move them to General and delete category?`)) return;
  state.feeds = state.feeds.map(f => f.category === name ? { ...f, category: 'General' } : f);
  state.customCategories = state.customCategories.filter(c => c !== name);
  saveConfig();
  renderSettingsList();
  populateCategorySelect();
}

function populateCategorySelect() {
  const sel = $('input-feed-category');
  if (!sel) return;
  const cats = allCategories();
  sel.innerHTML = cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
}

// ── Drag-to-reorder within a category ────────────────────────────────────────
function setupCategoryDrag(groupEl, category) {
  let dragging = null;

  groupEl.addEventListener('touchstart', e => {
    const grip = e.target.closest('.drag-grip');
    if (!grip) return;
    e.preventDefault();
    dragging = grip.closest('.settings-feed-item');
    dragging.classList.add('is-dragging');
  }, { passive: false });

  groupEl.addEventListener('touchmove', e => {
    if (!dragging) return;
    e.preventDefault();
    const y = e.touches[0].clientY;
    const siblings = [...groupEl.querySelectorAll('.settings-feed-item:not(.is-dragging)')];
    let placed = false;
    for (const sib of siblings) {
      const rect = sib.getBoundingClientRect();
      if (y < rect.top + rect.height * 0.5) {
        groupEl.insertBefore(dragging, sib);
        placed = true;
        break;
      }
    }
    if (!placed && siblings.length) {
      siblings[siblings.length - 1].after(dragging);
    }
  }, { passive: false });

  const commit = () => {
    if (!dragging) return;
    dragging.classList.remove('is-dragging');
    const newOrder = [...groupEl.querySelectorAll('.settings-feed-item')].map(el => el.dataset.feedId);
    reorderCategoryFeeds(category, newOrder);
    saveConfig();
    dragging = null;
  };
  groupEl.addEventListener('touchend',   commit, { passive: true });
  groupEl.addEventListener('touchcancel', commit, { passive: true });
}

function reorderCategoryFeeds(category, newIdOrder) {
  const reordered = newIdOrder.map(id => state.feeds.find(f => f.id === id)).filter(Boolean);
  let ri = 0;
  state.feeds = state.feeds.map(f =>
    (f.category || 'Other') === category ? reordered[ri++] : f);
}

// ── Settings panel ────────────────────────────────────────────────────────────
function openSettings() { renderSettingsList(); populateCategorySelect(); settingsPanel.classList.add('open'); }
function closeSettings() { settingsPanel.classList.remove('open'); }

const GRIP_SVG = `<svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" opacity=".35">
  <circle cx="4" cy="4" r="1.5"/><circle cx="10" cy="4" r="1.5"/>
  <circle cx="4" cy="10" r="1.5"/><circle cx="10" cy="10" r="1.5"/>
  <circle cx="4" cy="16" r="1.5"/><circle cx="10" cy="16" r="1.5"/>
</svg>`;

function renderSettingsList() {
  const groups = {};
  state.feeds.forEach(f => {
    const cat = f.category || 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(f);
  });

  // Ordered categories: defaults first, then custom, then any other derived ones
  const defaultOrder = [...DEFAULT_CATS, ...state.customCategories];
  const allCats = [...new Set([...defaultOrder, ...Object.keys(groups)])];
  const visibleCats = allCats.filter(c => groups[c]?.length || state.customCategories.includes(c));

  const isCustom = cat => state.customCategories.includes(cat);

  settingsList.innerHTML = visibleCats.map(cat => {
    const items = groups[cat] || [];
    const feedHtml = items.map(feed => `
      <div class="settings-feed-item" data-feed-id="${esc(feed.id)}">
        <div class="drag-grip" aria-label="Drag to reorder">${GRIP_SVG}</div>
        <div class="feed-item-info"><div class="feed-item-name">${esc(feed.name)}</div></div>
        <button class="btn-move-feed" data-feed-id="${esc(feed.id)}" title="Move to category">${esc(feed.category||'Other')} ▾</button>
        <label class="toggle">
          <input type="checkbox" ${feed.enabled ? 'checked' : ''} data-feed-id="${esc(feed.id)}">
          <span class="toggle-slider"></span>
        </label>
        <button class="btn-delete-feed" data-feed-id="${esc(feed.id)}" aria-label="Delete">&#10005;</button>
      </div>`).join('');

    const catActions = isCustom(cat) ? `
      <button class="btn-cat-action btn-rename-cat" data-cat="${esc(cat)}" title="Rename">✏️</button>
      <button class="btn-cat-action btn-delete-cat" data-cat="${esc(cat)}" title="Delete">🗑️</button>` : '';

    return `
      <div class="settings-category" data-category="${esc(cat)}">
        <div class="settings-category-header">
          <span class="settings-category-label">${esc(cat)}</span>
          ${catActions}
        </div>
        ${feedHtml}
      </div>`;
  }).join('');

  // Wire up events
  settingsList.querySelectorAll('input[type=checkbox]').forEach(cb => {
    cb.addEventListener('change', () => {
      const f = state.feeds.find(f => f.id === cb.dataset.feedId);
      if (f) { f.enabled = cb.checked; onFeedsChanged(); }
    });
  });
  settingsList.querySelectorAll('.btn-delete-feed').forEach(btn => {
    btn.addEventListener('click', () => {
      const f = state.feeds.find(f => f.id === btn.dataset.feedId);
      if (!f || !confirm(`Remove "${f.name}"?`)) return;
      state.feeds = state.feeds.filter(f => f.id !== btn.dataset.feedId);
      onFeedsChanged(); renderSettingsList();
    });
  });
  settingsList.querySelectorAll('.btn-move-feed').forEach(btn => {
    btn.addEventListener('click', () => openMovePicker(btn.dataset.feedId));
  });
  settingsList.querySelectorAll('.btn-rename-cat').forEach(btn => {
    btn.addEventListener('click', () => promptRenameCategory(btn.dataset.cat));
  });
  settingsList.querySelectorAll('.btn-delete-cat').forEach(btn => {
    btn.addEventListener('click', () => deleteCategory(btn.dataset.cat));
  });

  // Drag-to-reorder per category group
  settingsList.querySelectorAll('.settings-category').forEach(groupEl => {
    setupCategoryDrag(groupEl, groupEl.dataset.category);
  });
}

function onFeedsChanged() {
  saveConfig();
  const feeds = enabledFeeds();
  state.activeIndex = Math.min(state.activeIndex, Math.max(0, feeds.length - 1));
  renderDots(feeds.length, state.activeIndex);
  if (feeds.length) { feedTitle.textContent = feeds[state.activeIndex]?.name || ''; loadFeed(state.activeIndex, 0); }
}

function addFeed(name, url, category) {
  if (!name || !url) return;
  state.feeds.push({ id: generateId(), name: name.trim(), url: url.trim(), category: category || 'General', enabled: true });
  saveConfig(); renderSettingsList(); onFeedsChanged();
}

// ── Gesture handling ──────────────────────────────────────────────────────────
function setupGestures() {
  let tx = 0, ty = 0, dragging = false, pullX = 0;
  function onStart(x, y) { tx=x; ty=y; dragging=false; pullX=0; feedContainer.style.transition='none'; }
  function onMove(x, y) {
    if (state.view !== 'feed') return;
    const dx=x-tx, dy=y-ty;
    if (!dragging) { if (Math.abs(dx)<8) return; if (Math.abs(dx)<Math.abs(dy)*1.2) return; dragging=true; }
    pullX=dx;
    feedContainer.style.transform=`translateX(${pullX*0.35}px)`;
    feedContainer.style.opacity=String(1-Math.min(Math.abs(pullX)/500,0.25));
  }
  function onEnd() {
    if (!dragging) return;
    feedContainer.style.transition=''; feedContainer.style.transform=''; feedContainer.style.opacity='';
    dragging=false;
    if (pullX<-60) switchFeed(+1,true); else if (pullX>60) switchFeed(-1,true);
  }
  feedContainer.addEventListener('touchstart', e=>onStart(e.touches[0].clientX,e.touches[0].clientY), {passive:true});
  feedContainer.addEventListener('touchmove',  e=>{ if(dragging)e.preventDefault(); onMove(e.touches[0].clientX,e.touches[0].clientY); }, {passive:false});
  feedContainer.addEventListener('touchend',   onEnd, {passive:true});

  let atx=0, aty=0;
  articleView.addEventListener('touchstart', e=>{ atx=e.touches[0].clientX; aty=e.touches[0].clientY; }, {passive:true});
  articleView.addEventListener('touchend', e=>{
    const dx=e.changedTouches[0].clientX-atx, dy=e.changedTouches[0].clientY-aty;
    if (dx<-80 && Math.abs(dy)<60) closeArticle();
  }, {passive:true});
}

// ── Event wiring ──────────────────────────────────────────────────────────────
function setupEvents() {
  $('btn-prev')    .addEventListener('click', () => switchFeed(-1, false));
  $('btn-next')    .addEventListener('click', () => switchFeed(+1, false));
  $('btn-back')    .addEventListener('click', closeArticle);
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-close-settings').addEventListener('click', closeSettings);
  $('settings-overlay') .addEventListener('click', closeSettings);
  $('cat-picker-overlay').addEventListener('click', closeMovePicker);
  $('btn-add-category') .addEventListener('click', promptAddCategory);

  document.querySelectorAll('.layout-btn').forEach(btn =>
    btn.addEventListener('click', () => setLayout(btn.dataset.layout)));

  $('btn-add-feed').addEventListener('click', () => {
    const name = $('input-feed-name').value.trim();
    const url  = $('input-feed-url').value.trim();
    const cat  = $('input-feed-category').value;
    if (!name || !url) { alert('Please enter both a name and a URL.'); return; }
    addFeed(name, url, cat);
    $('input-feed-name').value = '';
    $('input-feed-url').value  = '';
  });

  feedContainer.addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (!card || card.classList.contains('skeleton-card')) return;
    openArticle(card.dataset.url, { title: card.dataset.title, description: card.dataset.desc, image: card.dataset.img, ytVideoId: card.dataset.ytId });
  });

  window.addEventListener('popstate', () => {
    if (state.view === 'article') { history.pushState(null,''); closeArticle(); }
  });
  history.pushState(null, '');

  document.addEventListener('keydown', e => {
    if (e.key==='ArrowRight') switchFeed(+1,false);
    if (e.key==='ArrowLeft')  switchFeed(-1,false);
    if (e.key==='Escape') {
      if (catPicker.classList.contains('open')) closeMovePicker();
      else if (state.view==='article') closeArticle();
      else if (settingsPanel.classList.contains('open')) closeSettings();
    }
  });
}

// ── Public API ────────────────────────────────────────────────────────────────
window.App = { retry: () => loadFeed(state.activeIndex, 0) };

// ── Boot ──────────────────────────────────────────────────────────────────────
async function init() {
  setupGestures();
  setupEvents();
  applyLayout(state.layout);

  try {
    await loadConfig();
  } catch {
    state.feeds = [
      { id:'bbc-news', name:'BBC News',       category:'General',    url:'https://feeds.bbci.co.uk/news/rss.xml',            enabled:true },
      { id:'bbc-tech', name:'BBC Technology', category:'Technology', url:'https://feeds.bbci.co.uk/news/technology/rss.xml', enabled:true },
    ];
    state.customCategories = [];
  }

  const feeds = enabledFeeds();
  if (!feeds.length) { feedTitle.textContent='No feeds'; renderDots(0,0); return; }
  state.activeIndex = Math.min(state.activeIndex, feeds.length-1);
  await loadFeed(state.activeIndex, 0);
}

init();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

if (IS_NATIVE && window.Capacitor?.Plugins?.App) {
  window.Capacitor.Plugins.App.addListener('backButton', () => {
    if (catPicker.classList.contains('open'))     { closeMovePicker(); return; }
    if (settingsPanel.classList.contains('open')) { closeSettings();   return; }
    if (state.view === 'article')                 { closeArticle();    return; }
    // On feed view — exit the app
    window.Capacitor.Plugins.App.exitApp();
  });
}
