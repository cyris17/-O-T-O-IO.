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

    editingMediaId: null
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
  const buildWhatsAppUrl = ({ phone, template, title, url, type, tags, customMessage }) => {
    const p = (phone || '').replace(/[^\d]/g, '');
    if (!p) return null;

    const tpl = (customMessage && customMessage.trim()) ? customMessage : (template || '');

    const msg = tpl
      .replaceAll('{title}', escapeForTemplate(title || 'Untitled'))
      .replaceAll('{url}', escapeForTemplate(url))
      .replaceAll('{type}', escapeForTemplate(type))
      .replaceAll('{tags}', escapeForTemplate(tagsToString(tags)));

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
        setText('disp-views', map.view_count);

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

        /* Re-render nav so category links stay in sync */
        if (typeof core.renderNavLinks === 'function') core.renderNavLinks();

        incrementView(map.view_count);
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

  /* ── View counter ─────────────────────────────────────── */
  const incrementView = async (curr) => {
    try {
      const n = parseInt(curr || 0) + 1;
      await supabase.from('site_content').update({ content: n }).eq('id', 'view_count');
      const el = document.getElementById('disp-views');
      if (el) el.innerText = n;
    } catch {}
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

    await fetchAll();

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

    /* Placeholders — filled by gallery.js / sections.js / admin.js */
    renderGallery() {},
    setupTilt() {},
    closeLightbox() {},
    onKeydown() {},
    fetchSections() {},
    loadAdminData() {}
  };
})();
