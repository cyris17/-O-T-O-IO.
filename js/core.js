/* =========================================================
   core.js — Supabase setup, state, utilities, init, routing
   ========================================================= */

const _SB_URL = 'https://zpztxadmcxgytplgxvib.supabase.co';
const _SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwenR4YWRtY3hneXRwbGd4dmliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNTg5NzksImV4cCI6MjA4NjYzNDk3OX0.A4W1jl1qvEkpUIfj6qPomDalPZUloL0bqqUA1YwMeo8';

const core = (() => {
  /* ── Config validation ────────────────────────────────── */
  const _isValidSbUrl = typeof _SB_URL === 'string' && /^https:\/\/.+\.supabase\.co$/.test(_SB_URL);
  const _isValidSbKey = typeof _SB_KEY === 'string' && _SB_KEY.startsWith('eyJ') && _SB_KEY.length > 100;
  if (!_isValidSbUrl) {
    console.error('[Cyris] _SB_URL is missing or invalid. Expected format: https://<ref>.supabase.co — running in fallback mode.');
  }
  if (!_isValidSbKey) {
    console.error('[Cyris] _SB_KEY looks invalid. Expected a JWT starting with "eyJ" — running in fallback mode.');
  }

  /* ── Supabase ─────────────────────────────────────────── */
  /* Guard: if the Supabase CDN script failed to load, or config is invalid,
     createClient is skipped.  Assigning null instead of throwing keeps the
     IIFE alive so the preloader-removal timers inside init() still run. */
  const supabase = (window.supabase && _isValidSbUrl && _isValidSbKey)
    ? window.supabase.createClient(_SB_URL, _SB_KEY)
    : null;
  const ASSETS_BUCKET = 'portfolio';

  /* ── Shared diagnostics state (admin debug panel) ─────── */
  const _diag = { sbHealthy: null, lastGalleryCount: null, lastError: null };

  /* ── State ────────────────────────────────────────────── */
  const state = {
    whatsappPhone: '',
    whatsappTemplate: 'Hello, I am interested in this {type}:\nTitle: {title}\nLink: {url}\nTags: {tags}',

    loaderWord1: 'CYRIS',
    loaderWord2: 'STUDIO',
    loaderColor1: '#00ffd5',
    loaderColor2: '#ff4fd8',

    uiEnableLightboxNav: true,
    uiEnableWatermark: true,
    uiWatermarkText: '© 2026 PORTFOLIO',
    uiWatermarkOpacity: 0.15,

    galleryItems: [],
    currentIndex: 0,
    activeCategory: 'all',
    galleryCategories: [],

    sections: [],
    editingSectionId: null,

    editingMediaId: null,

    /* New state */
    currentUser: null,
    newBadgeDays: 7,
    spinFreeMode: true,
    spinPayEnabled: false,
    spinRazorpayLink: '',
    spinPriceText: '₹49',
    spinMaxPerDay: 1,
    spinPrizes: [],
    mysteryPrize1Name: 'Mystery Prize 1',
    mysteryPrize2Name: 'Mystery Prize 2',
    pendingWaHref: null,
    pendingGateAction: null,

    /* Maintenance */
    maintenanceEnabled: false,

    /* Spin visibility */
    spinSectionVisible: true
  };

  /* ── Zoom state (shared with gallery.js) ─────────────── */
  const zoom = {
    scale: 1,
    minScale: 1,
    maxScale: 6,
    x: 0,
    y: 0,
    dragging: false,
    pointerX: 0,
    pointerY: 0
  };

  /* ── Utilities ────────────────────────────────────────── */
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const escapeForTemplate = (v) => (v ?? '').toString();

  const tagsToString = (tags) => {
    if (!tags) return '';
    if (Array.isArray(tags)) return tags.join(', ');
    return (tags || '').toString();
  };

  const parseTags = (raw) => {
    return (raw || '')
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
      .slice(0, 12);
  };

  const isVideoUrl = (url) => {
    try {
      const u = new URL(url);
      const p = (u.pathname || '').toLowerCase();
      return p.endsWith('.mp4') || p.endsWith('.mov') || p.endsWith('.webm') || p.endsWith('.m4v');
    } catch {
      const s = (url || '').toLowerCase();
      return s.includes('.mp4') || s.includes('.mov') || s.includes('.webm') || s.includes('.m4v');
    }
  };

  const escapeHtml = (str) => (str ?? '').toString()
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  /* Reject javascript: / data: / other dangerous URL schemes */
  const sanitizeUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol)) return '';
      return url;
    } catch {
      /* relative URLs pass through — they can't carry dangerous schemes */
      if (/^javascript:/i.test(url)) return '';
      return url;
    }
  };

  /* Race a promise against a timeout */
  const withTimeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`[Cyris] ${label || 'operation'} timed out after ${ms}ms`)), ms)
    )
  ]);

  /* Centralized query wrapper: timeout + one retry, never throws to caller */
  const safeQuery = async (label, fn, { timeoutMs = 7000, retries = 1 } = {}) => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await withTimeout(fn(), timeoutMs, label);
        return { ok: true, data: result.data ?? null, error: result.error ?? null };
      } catch (e) {
        if (attempt < retries) {
          console.warn(`[Cyris] ${label} attempt ${attempt + 1} failed, retrying…`, e.message);
        } else {
          const msg = e.message ?? String(e);
          console.error(`[Cyris] ${label} failed after ${retries + 1} attempt(s):`, msg);
          _diag.lastError = msg;
          return { ok: false, data: null, error: e };
        }
      }
    }
  };

  /* item.custom_wa_message overrides global template when non-empty */
  const buildWhatsAppUrl = ({ phone, template, title, url, type, tags, customMessage, username, email }) => {
    const p = (phone || '').replace(/[^\d]/g, '');
    if (!p) return null;

    const tpl = (customMessage && customMessage.trim()) ? customMessage : (template || '');

    const msg = tpl
      .replaceAll('{title}', escapeForTemplate(title || 'Untitled'))
      .replaceAll('{url}', escapeForTemplate(url))
      .replaceAll('{type}', escapeForTemplate(type))
      .replaceAll('{tags}', escapeForTemplate(tagsToString(tags)))
      .replaceAll('{username}', escapeForTemplate(username || ''))
      .replaceAll('{email}', escapeForTemplate(email || ''));

    return `https://wa.me/${p}?text=${encodeURIComponent(msg)}`;
  };

  /* ── DOM helpers ──────────────────────────────────────── */
  const setText = (id, val) => {
    if (val !== undefined && val !== null && val !== '') {
      const el = document.getElementById(id);
      if (el) el.innerText = val;
    }
  };

  const setHref = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    const safe = sanitizeUrl(val || '');
    if (safe && safe.length > 2) { el.href = safe; el.style.display = 'inline-block'; }
    else el.style.display = 'none';
  };

  /* ── Loader ───────────────────────────────────────────── */
  const applyLoaderToDom = () => {
    const w1 = document.getElementById('loader-w1');
    const w2 = document.getElementById('loader-w2');
    if (w1) w1.innerText = state.loaderWord1 || 'CYRIS';
    if (w2) w2.innerText = state.loaderWord2 || 'STUDIO';
    document.documentElement.style.setProperty('--loader-color1', state.loaderColor1 || '#00ffd5');
    document.documentElement.style.setProperty('--loader-color2', state.loaderColor2 || '#ff4fd8');
  };

  /* ── Scroll ───────────────────────────────────────────── */
  const handleScroll = () => {
    const btn = document.getElementById('btn-top');
    if (!btn) return;
    if (window.scrollY > 600) btn.classList.add('visible');
    else btn.classList.remove('visible');
  };

  const scrollToFooter = () => {
    const el = document.getElementById('contact');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  /* ── Data fetching ────────────────────────────────────── */
  const checkSupabaseHealth = async () => {
    if (!supabase) { _diag.sbHealthy = false; return false; }
    try {
      const result = await withTimeout(
        supabase.from('site_content').select('id').limit(1),
        3000,
        'health-check'
      );
      const healthy = !result.error;
      _diag.sbHealthy = healthy;
      return healthy;
    } catch (e) {
      console.warn('[Cyris] Supabase health check failed:', e.message);
      _diag.sbHealthy = false;
      return false;
    }
  };

  const fetchAll = async () => {
    await Promise.all([
      fetchContentAndGallery(),
      core.fetchSections()
    ]);
  };

  const fetchContentAndGallery = async () => {
    const counter = document.getElementById('gallery-counter');
    try {
      if (!supabase) throw new Error('Supabase client not initialized');

      const contentResult = await safeQuery(
        'site_content',
        () => supabase.from('site_content').select('*'),
        { timeoutMs: 6000 }
      );
      if (contentResult.ok && contentResult.data) {
        const content = contentResult.data;
        const map = {};
        content.forEach(c => { map[c.id] = c.content; });

        setText('disp-brand', map.site_name);
        setText('disp-footer-brand', map.site_name);
        setText('disp-hero-title', map.hero_title);
        setText('disp-hero-subtitle', map.hero_subtitle);

        if (map.hero_bg) {
          const el = document.getElementById('hero-bg-el');
          if (el) el.src = map.hero_bg;
        }
        if (map.logo_url) {
          const el = document.getElementById('brand-logo');
          if (el) el.src = map.logo_url;
          const mbl = document.getElementById('mobile-block-logo');
          if (mbl) mbl.src = map.logo_url;
        }

        setHref('link-insta', map.instagram);
        setHref('link-yt', map.youtube);
        setHref('link-wa', map.whatsapp);
        const mail = document.getElementById('btn-email-main');
        if (mail && map.email) mail.href = 'mailto:' + map.email;

        state.whatsappPhone = map.whatsapp_phone || '';
        state.whatsappTemplate = map.whatsapp_template || state.whatsappTemplate;

        state.loaderWord1 = map.loader_word1 || state.loaderWord1;
        state.loaderWord2 = map.loader_word2 || state.loaderWord2;
        state.loaderColor1 = map.loader_color1 || state.loaderColor1;
        state.loaderColor2 = map.loader_color2 || state.loaderColor2;
        applyLoaderToDom();

        state.uiEnableLightboxNav = (map.ui_enable_lightbox_nav || '1') === '1';
        state.uiEnableWatermark = (map.ui_enable_watermark || '1') === '1';
        state.uiWatermarkText = map.ui_watermark_text || state.uiWatermarkText;
        state.uiWatermarkOpacity = parseFloat(map.ui_watermark_opacity || state.uiWatermarkOpacity);
        document.documentElement.style.setProperty('--wm-opacity', String(clamp(state.uiWatermarkOpacity, 0.05, 0.4)));

        state.galleryCategories = (map.gallery_categories || '')
          .split(',').map(c => c.trim()).filter(Boolean);

        /* Spin settings */
        state.newBadgeDays = parseInt(map.new_badge_days || '7', 10) || 7;
        state.spinFreeMode = (map.spin_free_mode || '1') === '1';
        state.spinPayEnabled = (map.spin_pay_enabled || '0') === '1';
        state.spinRazorpayLink = map.razorpay_payment_link || '';
        state.spinPriceText = map.spin_price || '₹49';
        state.spinMaxPerDay = parseInt(map.spin_max_per_day || '1', 10) || 1;
        try { state.spinPrizes = JSON.parse(map.spin_prizes || '[]'); } catch { state.spinPrizes = []; }
        state.mysteryPrize1Name = map.mystery_prize_1_name || 'Mystery Prize 1';
        state.mysteryPrize2Name = map.mystery_prize_2_name || 'Mystery Prize 2';
        state.spinSectionVisible = (map.spin_section_visible || '1') === '1';

        /* Apply spin section visibility */
        const spinSection = document.getElementById('spin');
        if (spinSection) spinSection.style.display = state.spinSectionVisible ? '' : 'none';

        /* Maintenance mode */
        try {
          const maintRaw = map.site_maintenance;
          if (maintRaw) {
            const maint = JSON.parse(maintRaw);
            state.maintenanceEnabled = !!maint.enabled;
            if (maint.enabled) {
              showMaintenancePage(maint);
              return;
            }
          }
        } catch {}

        /* Update spin buttons (handled by spinModule after load) */
        if (typeof spinModule !== 'undefined') spinModule.updateButtons();

        incrementViewToday(map.views_today, map.views_today_date, map.view_count);
      }

      const galleryResult = await safeQuery(
        'gallery',
        () => supabase.from('gallery').select('*').order('created_at', { ascending: false }),
        { timeoutMs: 6000 }
      );
      const gallery = galleryResult.ok ? (galleryResult.data || []) : [];
      _diag.lastGalleryCount = gallery.length;
      core.renderGallery(gallery);
    } catch (e) {
      console.error('[Cyris] fetchContentAndGallery error:', e.message ?? e);
      _diag.lastError = e.message ?? String(e);
      core.renderGallery([]);
    } finally {
      /* Safety net: never leave gallery-counter stuck at "Loading…" */
      if (counter && (counter.textContent === 'Loading\u2026' || counter.textContent === 'Loading...')) {
        counter.textContent = '';
      }
    }
  };

  /* ── Fallback data shown when Supabase is unreachable ────── */
  const FALLBACK_GALLERY = [
    {
      id: 'fb-1',
      image_url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?q=80&w=800',
      title: 'Sample Work',
      description: 'Preview — connect your database to show real content.',
      tags: 'sample,preview',
      category: 'Preview',
      created_at: new Date().toISOString()
    },
    {
      id: 'fb-2',
      image_url: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?q=80&w=800',
      title: 'Sample Work',
      description: 'Preview — connect your database to show real content.',
      tags: 'sample,preview',
      category: 'Preview',
      created_at: new Date().toISOString()
    },
    {
      id: 'fb-3',
      image_url: 'https://images.unsplash.com/photo-1574169208507-84007bdd4b7a?q=80&w=800',
      title: 'Sample Work',
      description: 'Preview — connect your database to show real content.',
      tags: 'sample,preview',
      category: 'Preview',
      created_at: new Date().toISOString()
    }
  ];

  const FALLBACK_SECTIONS = [
    { id: 'fb-sec-1', slug: 'services', title: 'Services', subtitle: 'What We Offer', body: 'Photography, videography, and creative direction services for brands and creators.', enabled: true, sort_order: 1 },
    { id: 'fb-sec-2', slug: 'portfolio', title: 'Portfolio', subtitle: 'Selected Works', body: 'A curated collection of creative work spanning multiple genres and styles.', enabled: true, sort_order: 2 },
    { id: 'fb-sec-3', slug: 'about', title: 'About', subtitle: 'Our Story', body: 'Passionate creatives dedicated to telling stories through neon visuals and cinematic imagery.', enabled: true, sort_order: 3 }
  ];

  /* ── Fallback content when Supabase is unreachable ────── */
  const applyFallbackContent = () => {
    /* Gallery — render sample cards via the standard card UI */
    const feed = document.getElementById('gallery-feed');
    if (feed && !feed.children.length) {
      core.renderGallery(FALLBACK_GALLERY);
    }
    /* Safety: ensure counter is never left at "Loading…" */
    const counter = document.getElementById('gallery-counter');
    if (counter && (counter.textContent === 'Loading\u2026' || counter.textContent === 'Loading...')) {
      counter.textContent = '';
    }

    /* Sections — render fallback section cards */
    const sgrid = document.getElementById('sections-grid');
    if (sgrid && !sgrid.children.length) {
      state.sections = FALLBACK_SECTIONS;
      if (typeof core.renderSections === 'function') {
        core.renderSections();
      }
    }

    /* Leaderboard placeholders */
    ['lb-buyers', 'lb-spins', 'lb-raters', 'lb-viewed'].forEach(id => {
      const el = document.getElementById(id);
      if (el && !el.children.length) {
        el.innerHTML = '<div style="color:rgba(234,246,255,.40);font-size:.85rem;padding:14px 0;">No data yet.</div>';
      }
    });
  };

  /* ── View counters ────────────────────────────────────── */
  const incrementViewToday = async (todayCount, todayDate, totalCount) => {
    if (!supabase) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      let newToday;
      if (todayDate === today) {
        newToday = parseInt(todayCount || 0) + 1;
      } else {
        newToday = 1;
        await supabase.from('site_content').upsert({ id: 'views_today_date', content: today });
      }
      await supabase.from('site_content').upsert({ id: 'views_today', content: newToday });

      const newTotal = parseInt(totalCount || 0) + 1;
      await supabase.from('site_content').update({ content: newTotal }).eq('id', 'view_count');

      const elToday = document.getElementById('disp-views-today');
      if (elToday) elToday.innerText = newToday.toLocaleString();
      const elTotal = document.getElementById('disp-views');
      if (elTotal) elTotal.innerText = newTotal.toLocaleString();
    } catch {}
  };

  /* ── Inspirational Quotes ─────────────────────────────── */
  const FALLBACK_QUOTES = [
    { content: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
    { content: 'Creativity is intelligence having fun.', author: 'Albert Einstein' },
    { content: 'Art is not what you see, but what you make others see.', author: 'Edgar Degas' },
    { content: 'Every artist was first an amateur.', author: 'Ralph Waldo Emerson' },
    { content: 'Imagination is more important than knowledge.', author: 'Albert Einstein' },
    { content: 'The purpose of art is washing the dust of daily life off our souls.', author: 'Pablo Picasso' },
    { content: 'Vision is the art of seeing what is invisible to others.', author: 'Jonathan Swift' },
    { content: 'Photography is the story I fail to put into words.', author: 'Destin Sparks' },
    { content: 'A picture is worth a thousand words.', author: 'Napoleon Bonaparte' },
    { content: 'In photography, the smallest thing can be a great subject.', author: 'Henri Cartier-Bresson' }
  ];

  const fetchAndDisplayQuote = async () => {
    const el = document.getElementById('footer-quote');
    if (!el) return;

    let quote;
    try {
      const resp = await fetch('https://api.quotable.io/random');
      if (resp.ok) {
        const data = await resp.json();
        quote = { content: data.content, author: data.author };
      }
    } catch {}

    if (!quote) {
      quote = FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)];
    }

    el.innerHTML = `
      <blockquote>"${escapeHtml(quote.content)}"</blockquote>
      <cite>— ${escapeHtml(quote.author)}</cite>
    `;
  };

  /* ── Notifications ────────────────────────────────────── */
  const loadAndShowNotifications = async () => {
    if (!supabase) return;
    try {
      const dismissed = JSON.parse(localStorage.getItem('dismissed_notifs') || '[]');
      const now = new Date().toISOString();
      const { data } = await supabase.from('notifications')
        .select('*')
        .eq('active', true)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('sort_order', { ascending: true });

      const banner = document.getElementById('notif-banner');
      if (!banner || !data?.length) return;

      const visible = data.filter(n => !dismissed.includes(String(n.id)));
      if (!visible.length) return;

      banner.classList.add('active');
      banner.innerHTML = '';

      visible.forEach(n => {
        const slide = document.createElement('div');
        slide.className = 'notif-slide';
        if (n.link_url) {
          const safeNotifUrl = sanitizeUrl(n.link_url);
          if (safeNotifUrl) {
            slide.style.cursor = 'pointer';
            slide.onclick = () => window.open(safeNotifUrl, '_blank', 'noopener,noreferrer');
          }
        }

        const thumbHtml = n.media_url
          ? `<img class="notif-thumb" src="${escapeHtml(n.media_url)}" alt="" />`
          : `<div class="notif-dot"></div>`;

        slide.innerHTML = `
          ${thumbHtml}
          <div class="notif-content">
            <div class="notif-title">${escapeHtml(n.title || '')}</div>
            <div class="notif-desc">${escapeHtml(n.description || '')}</div>
          </div>
          <button class="notif-dismiss" title="Dismiss" data-id="${String(n.id)}">×</button>
        `;

        slide.querySelector('.notif-dismiss').addEventListener('click', (e) => {
          e.stopPropagation();
          const nid = e.currentTarget.dataset.id;
          const arr = JSON.parse(localStorage.getItem('dismissed_notifs') || '[]');
          arr.push(nid);
          localStorage.setItem('dismissed_notifs', JSON.stringify(arr));
          slide.remove();
          if (!banner.children.length) banner.classList.remove('active');
        });

        banner.appendChild(slide);
      });
    } catch {}
  };

  /* ── Maintenance Mode ─────────────────────────────────── */
  const showMaintenancePage = (maint) => {
    /* Let admin through even when site is in maintenance */
    const hash = window.location.hash.toLowerCase();
    const adminHashes = ['#admin', '#adminonly', '#dashboard', '#admin-login'];
    if (adminHashes.some(h => hash.startsWith(h))) return;

    const overlay = document.getElementById('maintenance-overlay');
    if (!overlay) return;
    overlay.classList.add('active');

    const msgEl = document.getElementById('maint-message');
    if (msgEl) msgEl.textContent = maint.message || "We'll be back soon!";

    /* Update site title */
    const siteTitle = document.getElementById('maint-site-title');
    const brandEl = document.getElementById('disp-brand');
    if (siteTitle && brandEl?.innerText) siteTitle.textContent = brandEl.innerText;

    /* Logo */
    const logoEl = document.getElementById('brand-logo');
    const logoWrap = document.getElementById('maint-logo-wrap');
    if (logoEl?.src && logoWrap) {
      logoWrap.innerHTML = `<img class="maint-logo" src="${escapeHtml(logoEl.src)}" alt="Logo" />`;
    }

    /* Countdown timer */
    if (maint.reopen_at) {
      const target = new Date(maint.reopen_at).getTime();
      const updateCountdown = () => {
        const diff = target - Date.now();
        const countEl = document.getElementById('maint-countdown');
        if (!countEl) return;
        if (diff <= 0) { countEl.textContent = 'Reopening soon!'; return; }
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        countEl.textContent = `Reopening in ${d}d ${h}h ${m}m ${s}s`;
        setTimeout(updateCountdown, 1000);
      };
      updateCountdown();
    }

    /* Listen for hash changes so admin can navigate in while maintenance is active */
    const onHashChange = () => {
      const newHash = window.location.hash.toLowerCase();
      if (adminHashes.some(h => newHash.startsWith(h))) {
        overlay.classList.remove('active');
        window.removeEventListener('hashchange', onHashChange);
      }
    };
    window.addEventListener('hashchange', onHashChange);
  };

  /* ── Profile Modal ────────────────────────────────────── */
  const openProfileModal = async () => {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;
    const u = state.currentUser;
    if (!u) { core.requireSignIn('profile'); return; }
    modal.classList.add('active');

    const contentEl = document.getElementById('profile-modal-content');
    if (contentEl) contentEl.innerHTML = '<div style="padding:40px;text-align:center;color:rgba(234,246,255,.50);">Loading profile…</div>';

    try {
      /* Fetch profile + counts in parallel */
      const [
        { data: profile },
        { count: ratingsCount },
        { count: reviewsCount },
        { data: spinHistory }
      ] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', u.id).single(),
        supabase.from('product_ratings').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
        supabase.from('site_reviews').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
        supabase.from('spin_results').select('*').eq('user_id', u.id).order('created_at', { ascending: false }).limit(20)
      ]);

      const name = profile?.display_name || u.user_metadata?.full_name || u.email || 'User';
      const email = profile?.email || u.email || '';
      const avatar = profile?.avatar_url || u.user_metadata?.avatar_url || '';
      const createdAt = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
      const streak = profile?.streak_count || 0;
      const bestStreak = profile?.best_streak || 0;

      /* Streak progress */
      const STREAK_REWARDS = [3, 7, 14, 30];
      const nextMilestone = STREAK_REWARDS.find(m => m > streak) || 30;
      const prevMilestone = STREAK_REWARDS.filter(m => m <= streak).pop() || 0;
      const streakPct = nextMilestone === prevMilestone ? 100 : Math.round(((streak - prevMilestone) / (nextMilestone - prevMilestone)) * 100);

      const avatarHtml = avatar
        ? `<img class="profile-avatar-large" src="${escapeHtml(avatar)}" alt="Avatar" />`
        : `<div class="profile-avatar-placeholder">${escapeHtml(name[0]?.toUpperCase() || '?')}</div>`;

      const formatRelTime = (iso) => {
        const diff = Date.now() - new Date(iso).getTime();
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 172800000) return 'Yesterday';
        return new Date(iso).toLocaleDateString();
      };

      const spinHistoryHtml = (spinHistory?.length)
        ? spinHistory.map(s => {
            const method = s.payment_id === 'ad_watch' ? 'Ad (legacy)' : (s.payment_id ? 'Paid' : 'Free');
            const emoji = (core._state.spinPrizes || []).find(p => p.name === s.prize_name)?.emoji || '🎰';
            return `
              <div class="spin-history-item">
                <div class="spin-hist-prize">${escapeHtml(emoji)} ${escapeHtml(s.prize_name || '')}</div>
                <div class="spin-hist-method">${method}</div>
                <div class="${s.won ? 'spin-hist-result-win' : 'spin-hist-result-lose'}">${s.won ? '🏆 WON' : '❌ Lost'}</div>
                <div class="spin-hist-date">${formatRelTime(s.created_at)}</div>
              </div>`;
          }).join('')
        : '<div style="color:rgba(234,246,255,.40);font-size:.85rem;padding:10px 0;">No spins yet! Try your luck 🎰</div>';

      if (contentEl) {
        contentEl.innerHTML = `
          <div class="profile-header">
            ${avatarHtml}
            <div class="profile-info-col">
              <div class="profile-name">${escapeHtml(name)}</div>
              <div class="profile-email">${escapeHtml(email)}</div>
              ${createdAt ? `<div class="profile-since">Member since ${escapeHtml(createdAt)}</div>` : ''}
              ${streak > 0 ? `<div class="profile-streak-badge">🔥 ${streak}-Day Streak</div>` : ''}
            </div>
          </div>

          <div class="profile-stats-grid">
            <div class="profile-stat-item">
              <div class="profile-stat-icon">🛒</div>
              <div class="profile-stat-value">${profile?.purchase_count || 0}</div>
              <div class="profile-stat-label">Purchases</div>
            </div>
            <div class="profile-stat-item">
              <div class="profile-stat-icon">💰</div>
              <div class="profile-stat-value">₹${parseFloat(profile?.total_spent || 0).toLocaleString()}</div>
              <div class="profile-stat-label">Total Spent</div>
            </div>
            <div class="profile-stat-item">
              <div class="profile-stat-icon">🎰</div>
              <div class="profile-stat-value">${profile?.spin_count || 0}</div>
              <div class="profile-stat-label">Spins</div>
            </div>
            <div class="profile-stat-item">
              <div class="profile-stat-icon">🏆</div>
              <div class="profile-stat-value">${profile?.spin_wins || 0}</div>
              <div class="profile-stat-label">Wins</div>
            </div>
            <div class="profile-stat-item">
              <div class="profile-stat-icon">⭐</div>
              <div class="profile-stat-value">${ratingsCount || 0}</div>
              <div class="profile-stat-label">Ratings Given</div>
            </div>
            <div class="profile-stat-item">
              <div class="profile-stat-icon">📝</div>
              <div class="profile-stat-value">${reviewsCount || 0}</div>
              <div class="profile-stat-label">Reviews</div>
            </div>
          </div>

          <div class="profile-streak-row">
            <div style="font-size:1.4rem;">🔥</div>
            <div class="streak-bar-wrap">
              <div style="font-weight:950;font-size:.82rem;">Current Streak: <span style="color:#ffab40;">${streak} days</span> &nbsp;•&nbsp; Best: <span style="color:var(--miku);">${bestStreak} days</span></div>
              <div class="streak-bar-track"><div class="streak-bar-fill" style="width:${streakPct}%"></div></div>
              <div class="streak-bar-label">Next reward at ${nextMilestone} days (${streakPct}% there)</div>
            </div>
          </div>

          <div class="profile-section-head">🎰 Spin History</div>
          <div class="spin-history-wrap">${spinHistoryHtml}</div>
        `;
      }
    } catch (e) {
      const contentEl2 = document.getElementById('profile-modal-content');
      if (contentEl2) contentEl2.innerHTML = `<div style="padding:40px;text-align:center;color:var(--danger);">Error loading profile: ${escapeHtml(e.message)}</div>`;
    }
  };

  const closeProfileModal = () => {
    const modal = document.getElementById('profile-modal');
    if (modal) modal.classList.remove('active');
  };

  /* ── Daily Streak Tracking ────────────────────────────── */
  const updateStreakBonus = async (userId) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      const { data: profile } = await supabase.from('user_profiles')
        .select('streak_count,last_visit_date,best_streak')
        .eq('id', userId).single();

      if (!profile) return;

      const last = profile.last_visit_date;
      let streak = profile.streak_count || 0;
      let best = profile.best_streak || 0;

      if (last === today) return; /* Already counted today */

      if (last === yesterday) {
        streak += 1;
      } else {
        streak = 1;
      }

      if (streak > best) best = streak;

      await supabase.from('user_profiles').update({
        streak_count: streak,
        last_visit_date: today,
        best_streak: best
      }).eq('id', userId);

      /* Show streak milestone popup */
      const REWARDS = { 3: 1, 7: 2, 14: 3, 30: 5 };
      if (REWARDS[streak]) {
        showStreakMilestone(streak, REWARDS[streak]);
      }

      /* Update streak display on spin section */
      const dispEl = document.getElementById('spin-streak-display');
      if (dispEl && streak > 0) {
        dispEl.innerHTML = `<div class="spin-streak-display">🔥 ${streak}-day streak</div>`;
      }
    } catch {}
  };

  const showStreakMilestone = (days, bonusSpins) => {
    const popup = document.createElement('div');
    popup.className = 'streak-popup';
    popup.innerHTML = `
      <div class="streak-popup-emoji">🔥</div>
      <div class="streak-popup-title">${days}-Day Streak!</div>
      <div class="streak-popup-sub">You earned ${bonusSpins} bonus spin${bonusSpins > 1 ? 's' : ''}!</div>
    `;
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 4000);
  };

  /* ── Google Auth ──────────────────────────────────────── */
  const signInWithGoogle = async () => {
    if (!supabase) { console.error('[Cyris] Cannot sign in — Supabase not configured.'); return; }
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname }
      });
    } catch (e) {
      console.error('Google sign-in error:', e);
    }
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
    state.currentUser = null;
    renderNavAuth();
  };

  const upsertUserProfile = async (user) => {
    try {
      await supabase.from('user_profiles').upsert({
        id: user.id,
        display_name: user.user_metadata?.full_name || user.email,
        avatar_url: user.user_metadata?.avatar_url || '',
        email: user.email
      });
    } catch {}
  };

  const renderNavAuth = () => {
    const wrap = document.getElementById('nav-auth');
    if (!wrap) return;
    const u = state.currentUser;
    if (!u) {
      wrap.innerHTML = `
        <button class="btn-signin" onclick="core.signInWithGoogle()">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Sign In
        </button>`;
    } else {
      const name = u.user_metadata?.full_name || u.email || 'User';
      const avatar = u.user_metadata?.avatar_url || '';
      wrap.innerHTML = `
        <div class="user-menu-wrap">
          <div class="user-avatar-btn" onclick="document.getElementById('user-dropdown').classList.toggle('open')">
            ${avatar ? `<img src="${escapeHtml(avatar)}" alt="Avatar" />` : `<div style="width:32px;height:32px;border-radius:999px;background:var(--miku);display:flex;align-items:center;justify-content:center;font-weight:950;color:#000;font-size:.85rem;">${escapeHtml(name[0].toUpperCase())}</div>`}
            <span class="user-disp-name">${escapeHtml(name)}</span>
            <i class="fas fa-chevron-down" style="font-size:.65rem;color:rgba(234,246,255,.50);"></i>
          </div>
          <div class="user-dropdown" id="user-dropdown">
            <button class="user-dropdown-item" onclick="document.getElementById('user-dropdown').classList.remove('open');core.openProfileModal()">👤 My Profile</button>
            <button class="user-dropdown-item" onclick="core.signOut()">🚪 Sign Out</button>
          </div>
        </div>`;
    }
  };

  const initAuth = async () => {
    if (!supabase) { renderNavAuth(); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      state.currentUser = session.user;
      await upsertUserProfile(session.user);
      updateStreakBonus(session.user.id);
    }
    renderNavAuth();

    supabase.auth.onAuthStateChange(async (_event, session) => {
      state.currentUser = session?.user || null;
      if (state.currentUser) {
        await upsertUserProfile(state.currentUser);
        updateStreakBonus(state.currentUser.id);
      }
      renderNavAuth();
      /* If there was a pending gate action, execute it now */
      if (state.currentUser && state.pendingGateAction) {
        const action = state.pendingGateAction;
        state.pendingGateAction = null;
        closeSignInGate();
        if (action === 'whatsapp' && state.pendingWaHref) {
          const safeWaHref = sanitizeUrl(state.pendingWaHref);
          if (safeWaHref) window.open(safeWaHref, '_blank', 'noopener,noreferrer');
          state.pendingWaHref = null;
        }
      }
    });
  };

  /* ── Sign-In Gate ─────────────────────────────────────── */
  const requireSignIn = (action, waHref) => {
    if (state.currentUser) return true;
    state.pendingGateAction = action;
    state.pendingWaHref = waHref || null;
    const modal = document.getElementById('signin-gate-modal');
    if (modal) modal.classList.add('active');
    return false;
  };

  const closeSignInGate = () => {
    const modal = document.getElementById('signin-gate-modal');
    if (modal) modal.classList.remove('active');
  };

  /* ── Admin diagnostics (visible only on admin routes) ─── */
  const _renderAdminDiag = () => {
    const panel = document.getElementById('admin-panel');
    if (!panel) return;
    const existing = document.getElementById('cyris-diag-bar');
    if (existing) existing.remove();

    const bar = document.createElement('div');
    bar.id = 'cyris-diag-bar';
    bar.style.cssText = 'position:sticky;top:0;z-index:9999;background:rgba(0,0,0,.85);border-bottom:1px solid rgba(0,255,213,.25);padding:6px 16px;font-size:.72rem;font-family:monospace;color:rgba(234,246,255,.7);display:flex;gap:16px;flex-wrap:wrap;';

    const sbStatus = _diag.sbHealthy === true ? '🟢 Supabase reachable'
      : _diag.sbHealthy === false ? '🔴 Supabase unreachable'
      : '⚪ Supabase untested';
    const galleryStatus = _diag.lastGalleryCount !== null
      ? `📷 Gallery: ${_diag.lastGalleryCount} item(s)` : '📷 Gallery: not fetched';
    const errStatus = _diag.lastError ? `⚠️ Last error: ${escapeHtml(String(_diag.lastError).slice(0, 80))}` : '';

    bar.innerHTML = `<span>${sbStatus}</span><span>${galleryStatus}</span>${errStatus ? `<span style="color:#ff6b6b;">${errStatus}</span>` : ''}`;
    panel.prepend(bar);
  };

  /* ── Auth / Routing ───────────────────────────────────── */
  const checkRoute = async () => {
    const h = window.location.hash;

    const showLogin = () => {
      document.getElementById('wrapper').style.display = 'none';
      document.getElementById('login-modal').style.display = 'flex';
      document.getElementById('admin-panel').style.display = 'none';
    };

    const showDashboard = () => {
      document.getElementById('wrapper').style.display = 'none';
      document.getElementById('login-modal').style.display = 'none';
      document.getElementById('admin-panel').style.display = 'block';
      core.loadAdminData();
      core.fetchSections();
      _renderAdminDiag();
    };

    if (h === '#adminonly') {
      showLogin();
      return;
    }

    if (h === '#dashboard') {
      if (!supabase) {
        window.location.hash = '#adminonly';
        showLogin();
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (!session) {
          window.location.hash = '#adminonly';
          showLogin();
          return;
        }
        showDashboard();
        return;
      } catch {
        window.location.hash = '#adminonly';
        showLogin();
        return;
      }
    }

    exitAdmin();
  };

  const login = async () => {
    const email = document.getElementById('auth-email').value;
    const pass = document.getElementById('auth-pass').value;
    const msg = document.getElementById('login-error');
    if (!supabase) { msg.innerText = 'Supabase not configured.'; return; }
    msg.innerText = 'Verifying Credentials...';
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) msg.innerText = error.message;
    else window.location.hash = '#dashboard';
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    exitAdmin();
  };

  const exitAdmin = () => {
    window.location.hash = '';
    document.getElementById('wrapper').style.display = 'block';
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'none';
  };

  /* ── Share ────────────────────────────────────────────── */
  const shareProfile = () => {
    if (navigator.share) navigator.share({ title: 'Portfolio', url: window.location.href });
    else { navigator.clipboard.writeText(window.location.href); alert('Copied!'); }
  };

  /* ── GSAP / Lenis init ────────────────────────────────── */
  const setupAnimations = () => {
    gsap.registerPlugin(ScrollTrigger);
    gsap.to('#hero-bg-el', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.hero', scrub: true } });
    gsap.to('.hero-content', { opacity: 1, y: 0, duration: 1.4, delay: 0.25, ease: 'power3.out' });
  };

  /* ── Mobile admin bypass ──────────────────────────────── */
  const checkMobileAdminBypass = () => {
    const hash = window.location.hash.toLowerCase();
    const adminHashes = ['#admin', '#adminonly', '#dashboard'];
    if (adminHashes.some(h => hash.startsWith(h))) {
      document.body.classList.add('admin-bypass');
    } else {
      document.body.classList.remove('admin-bypass');
    }
  };

/* ── App init ─────────────────────────────────────────── */
  const removePreloader = () => {
    const pl = document.getElementById('preloader');
    if (pl) { pl.classList.add('vanish'); pl.style.display = 'none'; }
  };

  const init = async () => {
    applyLoaderToDom();
    setTimeout(() => {
      const pl = document.getElementById('preloader');
      if (pl) pl.classList.add('vanish');
    }, 1200);

    /* Safety net: force-close preloader after 12s no matter what */
    const preloaderSafetyTimer = setTimeout(removePreloader, 12000);

    const lenis = new Lenis({ duration: 1.15, smooth: true });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);

    setupAnimations();
    core.setupTilt();

    /* Initialize auth first so user state is available */
    await initAuth().catch(e => console.error('[Cyris] initAuth error:', e));

    /* Check Supabase health before attempting queries */
    const healthy = await checkSupabaseHealth();
    if (!healthy) {
      console.warn('[Cyris] Supabase unreachable — loading app with fallback content');
      applyFallbackContent();
    } else {
      /* Wrap fetchAll in a timeout so a hanging query cannot block init */
      await withTimeout(fetchAll(), 8000, 'fetchAll').catch(e => {
        console.error('[Cyris] Initialization fetch error:', e.message ?? e);
        _diag.lastError = e.message ?? String(e);
        applyFallbackContent();
      });
    }

    /* Load notifications (non-blocking — failure is silent) */
    loadAndShowNotifications().catch(() => {});

    /* Fetch inspirational quote (non-blocking) */
    fetchAndDisplayQuote();

    clearTimeout(preloaderSafetyTimer);
    removePreloader();

    await checkRoute().catch(e => console.error('[Cyris] checkRoute error:', e));
    checkMobileAdminBypass();
    window.addEventListener('hashchange', () => {
      checkRoute().catch(() => {});
      checkMobileAdminBypass();
    });
    window.addEventListener('scroll', handleScroll);

    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('dragstart', e => e.preventDefault());

    const lb = document.getElementById('lightbox');
    if (lb) lb.addEventListener('click', core.closeLightbox);
    window.addEventListener('keydown', core.onKeydown);

    /* Leaderboard tabs */
    document.querySelectorAll('.lb-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.lb-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const panelId = btn.dataset.panel;
        document.querySelectorAll('.leaderboard-list').forEach(p => {
          p.style.display = p.id === panelId ? 'block' : 'none';
        });
      });
    });
    /* init first panel visible */
    document.querySelectorAll('.leaderboard-list').forEach((p, i) => {
      p.style.display = i === 0 ? 'block' : 'none';
    });

    /* Load leaderboard and reviews after data is ready (non-blocking) */
    if (typeof leaderboardModule !== 'undefined') Promise.resolve(leaderboardModule.load()).catch(() => {});
    if (typeof reviewsModule !== 'undefined') Promise.resolve(reviewsModule.load()).catch(() => {});
  };

  /* ── Public API ───────────────────────────────────────── */
  return {
    /* Exposed internals for cross-file access */
    _supabase: supabase,
    _state: state,
    _zoom: zoom,
    _ASSETS_BUCKET: ASSETS_BUCKET,

    /* Utilities */
    clamp,
    escapeHtml,
    escapeForTemplate,
    parseTags,
    isVideoUrl,
    tagsToString,
    buildWhatsAppUrl,
    setText,
    setHref,
    sanitizeUrl,
    withTimeout,
    safeQuery,

    /* Core methods */
    init,
    checkRoute,
    login,
    logout,
    exitAdmin,
    scrollToFooter,
    shareProfile,
    applyLoaderToDom,
    fetchContentAndGallery,

    /* Auth */
    signInWithGoogle,
    signOut,
    renderNavAuth,
    requireSignIn,
    closeSignInGate,

    /* Profile modal */
    openProfileModal,
    closeProfileModal,

    /* Maintenance */
    showMaintenancePage,

    /* Streak */
    updateStreakBonus,

    /* Placeholders — filled by gallery.js / sections.js / admin.js */
    renderGallery() {},
    setupTilt() {},
    closeLightbox() {},
    onKeydown() {},
    fetchSections() {},
    loadAdminData() {},
    loadAnalytics() {},
    saveSpinSettings() {},
    loadNotifications() {},
    addNotification() {},
    loadAdminReviews() {},
    markAsSold() {},
    unmarkSold() {},
    toggleMaintenance() {},
    saveMaintenance() {},
    toggleSpinVisibility() {}
  };
  window.core = publicAPI;
  return publicAPI;
})();
