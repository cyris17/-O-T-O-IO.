/* =========================================================
   core.js — Supabase setup, state, utilities, init, routing
   ========================================================= */

const _SB_URL = 'https://zpztxadmcxgytplgxvib.supabase.co';
const _SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwenR4YWRtY3hneXRwbGd4dmliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNTg5NzksImV4cCI6MjA4NjYzNDk3OX0.A4W1jl1qvEkpUIfj6qPomDalPZUloL0bqqUA1YwMeo8';

const core = (() => {
  /* ── Supabase ─────────────────────────────────────────── */
  const supabase = window.supabase.createClient(_SB_URL, _SB_KEY);
  const ASSETS_BUCKET = 'portfolio';

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
    spinRazorpayLink: '',
    spinPriceText: '₹49',
    spinMaxPerDay: 1,
    spinPrizes: [],
    pendingWaHref: null,
    pendingGateAction: null
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
    if (val && val.length > 2) { el.href = val; el.style.display = 'inline-block'; }
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
  const fetchAll = async () => {
    await Promise.all([
      fetchContentAndGallery(),
      core.fetchSections()
    ]);
  };

  const fetchContentAndGallery = async () => {
    try {
      const { data: content } = await supabase.from('site_content').select('*');
      if (content) {
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
        state.spinRazorpayLink = map.razorpay_payment_link || '';
        state.spinPriceText = map.spin_price || '₹49';
        state.spinMaxPerDay = parseInt(map.spin_max_per_day || '1', 10) || 1;
        try { state.spinPrizes = JSON.parse(map.spin_prizes || '[]'); } catch { state.spinPrizes = []; }

        /* Update spin button text */
        const btnSpin = document.getElementById('btn-spin');
        if (btnSpin) {
          if (state.spinFreeMode || !state.spinRazorpayLink) {
            btnSpin.textContent = '🎰 SPIN NOW (FREE)';
          } else {
            btnSpin.textContent = `🎰 PAY ${state.spinPriceText} TO SPIN`;
          }
        }

        incrementViewToday(map.views_today, map.views_today_date, map.view_count);
      }

      const { data: gallery } = await supabase
        .from('gallery')
        .select('*')
        .order('created_at', { ascending: false });

      core.renderGallery(gallery || []);
    } catch (e) {
      console.error('API Error:', e);
    }
  };

  /* ── View counters ────────────────────────────────────── */
  const incrementViewToday = async (todayCount, todayDate, totalCount) => {
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
        if (n.link_url) { slide.style.cursor = 'pointer'; slide.onclick = () => window.open(n.link_url, '_blank'); }

        const thumbHtml = n.media_url
          ? `<img class="notif-thumb" src="${escapeHtml(n.media_url)}" alt="" />`
          : `<div class="notif-dot"></div>`;

        slide.innerHTML = `
          ${thumbHtml}
          <div class="notif-content">
            <div class="notif-title">${escapeHtml(n.title || '')}</div>
            <div class="notif-desc">${escapeHtml(n.description || '')}</div>
          </div>
          <button class="notif-dismiss" title="Dismiss" data-id="${n.id}">×</button>
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

  /* ── Google Auth ──────────────────────────────────────── */
  const signInWithGoogle = async () => {
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
    await supabase.auth.signOut();
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
            <button class="user-dropdown-item" onclick="document.getElementById('user-dropdown').classList.remove('open')">👤 My Profile</button>
            <button class="user-dropdown-item" onclick="core.signOut()">🚪 Sign Out</button>
          </div>
        </div>`;
    }
  };

  const initAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      state.currentUser = session.user;
      await upsertUserProfile(session.user);
    }
    renderNavAuth();

    supabase.auth.onAuthStateChange(async (_event, session) => {
      state.currentUser = session?.user || null;
      if (state.currentUser) await upsertUserProfile(state.currentUser);
      renderNavAuth();
      /* If there was a pending gate action, execute it now */
      if (state.currentUser && state.pendingGateAction) {
        const action = state.pendingGateAction;
        state.pendingGateAction = null;
        closeSignInGate();
        if (action === 'whatsapp' && state.pendingWaHref) {
          window.open(state.pendingWaHref, '_blank', 'noopener');
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
    };

    if (h === '#adminonly') {
      showLogin();
      return;
    }

    if (h === '#dashboard') {
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
    msg.innerText = 'Verifying Credentials...';
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) msg.innerText = error.message;
    else window.location.hash = '#dashboard';
  };

  const logout = async () => {
    await supabase.auth.signOut();
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

  /* ── App init ─────────────────────────────────────────── */
  const init = async () => {
    applyLoaderToDom();
    setTimeout(() => {
      const pl = document.getElementById('preloader');
      if (pl) pl.classList.add('vanish');
    }, 1200);

    const lenis = new Lenis({ duration: 1.15, smooth: true });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);

    setupAnimations();
    core.setupTilt();

    /* Initialize auth first so user state is available */
    await initAuth();

    await fetchAll();

    /* Load notifications */
    await loadAndShowNotifications();

    /* Fetch inspirational quote */
    fetchAndDisplayQuote();

    const pl = document.getElementById('preloader');
    if (pl) pl.classList.add('vanish');

    await checkRoute();
    window.addEventListener('hashchange', () => checkRoute());
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

    /* Load leaderboard and reviews after data is ready */
    if (typeof leaderboardModule !== 'undefined') leaderboardModule.load();
    if (typeof reviewsModule !== 'undefined') reviewsModule.load();
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
    unmarkSold() {}
  };
})();
