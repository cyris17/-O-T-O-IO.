/* =========================================================
   admin.js — Admin panel: branding, hero, links, loader,
               UI options, assets upload, media modal,
               analytics, notifications, spin settings,
               mark as sold, reviews manager
   ========================================================= */

(() => {
  const sb = () => core._supabase;
  const s  = () => core._state;

  /* ── Asset upload helpers ─────────────────────────────── */
  const requireImage = (file, { maxBytes }) => {
    if (!file) return 'Select an image first.';
    if (!file.type.startsWith('image/')) return 'File must be an image.';
    if (file.size > maxBytes) return `File too large. Max ${(maxBytes / 1024 / 1024).toFixed(0)}MB.`;
    return null;
  };

  const uploadAssetToStorage = async (file, prefix) => {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const safeExt = ext.replace(/[^a-z0-9]/g, '') || 'jpg';
    const name = `${prefix}_${Date.now()}.${safeExt}`;

    const { error } = await sb().storage.from(core._ASSETS_BUCKET).upload(name, file, { upsert: true });
    if (error) throw error;

    const { data } = sb().storage.from(core._ASSETS_BUCKET).getPublicUrl(name);
    return data.publicUrl;
  };

  /* ── Load admin data into form fields ─────────────────── */
  const loadAdminData = () => {
    const getTxt = (id) => document.getElementById(id)?.innerText || '';
    const val   = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };

    val('edit-brand',    getTxt('disp-brand'));
    val('edit-title',    getTxt('disp-hero-title'));
    val('edit-subtitle', getTxt('disp-hero-subtitle'));

    const insta = document.getElementById('link-insta');
    const yt    = document.getElementById('link-yt');
    const wa    = document.getElementById('link-wa');
    const mail  = document.getElementById('btn-email-main');
    if (insta) val('edit-insta',  insta.href);
    if (yt)    val('edit-yt',     yt.href);
    if (wa)    val('edit-wa',     wa.href);
    if (mail)  val('edit-email',  mail.href.replace('mailto:', ''));

    val('edit-wa-phone',    s().whatsappPhone || '');
    val('edit-wa-template', s().whatsappTemplate || '');

    val('edit-loader-w1', s().loaderWord1 || '');
    val('edit-loader-w2', s().loaderWord2 || '');
    val('edit-loader-c1', s().loaderColor1 || '');
    val('edit-loader-c2', s().loaderColor2 || '');

    val('edit-ui-nav',        s().uiEnableLightboxNav ? '1' : '0');
    val('edit-ui-wm',         s().uiEnableWatermark   ? '1' : '0');
    val('edit-ui-wm-text',    s().uiWatermarkText  || '');
    val('edit-ui-wm-opacity', String(s().uiWatermarkOpacity || 0.15));

    /* Spin settings */
    val('spin-free-mode', s().spinFreeMode ? '1' : '0');
    val('spin-ad-enabled', s().spinAdEnabled ? '1' : '0');
    val('spin-ad-daily', String(s().spinAdDailyLimit || 3));
    val('spin-pay-enabled', s().spinPayEnabled ? '1' : '0');
    val('spin-price-text', s().spinPriceText || '');
    val('spin-max-per-day', String(s().spinMaxPerDay || 1));
    val('spin-razorpay-link', s().spinRazorpayLink || '');
    val('new-badge-days', String(s().newBadgeDays || 7));
    if (s().spinPrizes?.length) {
      val('spin-prizes-json', JSON.stringify(s().spinPrizes, null, 2));
    }
    if (s().spinAdConfig) {
      val('spin-ad-config-json', JSON.stringify(s().spinAdConfig, null, 2));
    }

    loadGalleryCategories();
    loadAnalytics();
    loadNotifications();
    loadAdminReviews();
    loadSpinResults();
    loadMaintenanceStatus();
    loadAdSlots();
  };

  /* ── Gallery Categories ───────────────────────────────── */
  const loadGalleryCategories = async () => {
    const cats = s().galleryCategories || [];
    const el = document.getElementById('edit-gallery-categories');
    if (el) el.value = cats.join(', ');
  };

  const saveGalleryCategories = async () => {
    const val = document.getElementById('edit-gallery-categories')?.value || '';
    await sb().from('site_content').upsert({ id: 'gallery_categories', content: val });
    alert('Categories saved!');
    core.fetchContentAndGallery();
  };

  /* ── Analytics Dashboard ──────────────────────────────── */
  const loadAnalytics = async () => {
    const grid = document.getElementById('analytics-grid');
    if (!grid) return;
    grid.innerHTML = '<div style="color:rgba(234,246,255,.45);font-size:.82rem;">Loading…</div>';

    try {
      const [
        { count: userCount },
        { count: salesCount },
        { data: salesData },
        { count: spinCount },
        { count: spinWins },
        { data: reviewData },
        { count: reviewCount },
        { count: galleryCount },
        { data: contentData },
        { data: topViewed }
      ] = await Promise.all([
        sb().from('user_profiles').select('*', { count: 'exact', head: true }),
        sb().from('product_sales').select('*', { count: 'exact', head: true }),
        sb().from('product_sales').select('amount'),
        sb().from('spin_results').select('*', { count: 'exact', head: true }),
        sb().from('spin_results').select('*', { count: 'exact', head: true }).eq('won', true),
        sb().from('site_reviews').select('rating'),
        sb().from('site_reviews').select('*', { count: 'exact', head: true }),
        sb().from('gallery').select('*', { count: 'exact', head: true }),
        sb().from('site_content').select('id,content').in('id', ['view_count', 'views_today']),
        sb().from('gallery').select('title,view_count').order('view_count', { ascending: false }).limit(1)
      ]);

      const totalRevenue = (salesData || []).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
      const avgRating = reviewData?.length
        ? (reviewData.reduce((sum, r) => sum + r.rating, 0) / reviewData.length).toFixed(1)
        : '—';

      const contentMap = {};
      (contentData || []).forEach(c => { contentMap[c.id] = c.content; });

      const topProduct = topViewed?.[0];

      const stats = [
        { icon: '👥', label: 'Total Users', value: (userCount || 0).toLocaleString() },
        { icon: '👁️', label: 'Views Today', value: parseInt(contentMap.views_today || 0).toLocaleString() },
        { icon: '👁️', label: 'Total Views', value: parseInt(contentMap.view_count || 0).toLocaleString() },
        { icon: '🔥', label: 'Most Viewed', value: topProduct ? `${topProduct.title || 'Untitled'} (${topProduct.view_count})` : '—' },
        { icon: '💰', label: 'Products Sold', value: (salesCount || 0).toLocaleString() },
        { icon: '💰', label: 'Total Revenue', value: `₹${totalRevenue.toLocaleString()}` },
        { icon: '🎰', label: 'Total Spins', value: (spinCount || 0).toLocaleString() },
        { icon: '🎰', label: 'Spin Wins', value: (spinWins || 0).toLocaleString() },
        { icon: '⭐', label: 'Avg Site Rating', value: avgRating !== '—' ? `${avgRating}/5` : '—' },
        { icon: '📝', label: 'Total Reviews', value: (reviewCount || 0).toLocaleString() },
        { icon: '📦', label: 'Gallery Items', value: (galleryCount || 0).toLocaleString() }
      ];

      grid.innerHTML = stats.map(stat => `
        <div class="analytics-stat">
          <div class="analytics-stat-icon">${stat.icon}</div>
          <div class="analytics-stat-label">${stat.label}</div>
          <div class="analytics-stat-value">${stat.value}</div>
        </div>
      `).join('');
    } catch (e) {
      grid.innerHTML = `<div style="color:var(--danger);font-size:.82rem;">Error loading analytics: ${core.escapeHtml(e.message)}</div>`;
    }
  };

  /* ── Notification Manager ─────────────────────────────── */
  const loadNotifications = async () => {
    const list = document.getElementById('notif-admin-list');
    if (!list) return;

    try {
      const { data } = await sb().from('notifications').select('*').order('sort_order', { ascending: true });
      list.innerHTML = '';
      if (!data?.length) {
        list.innerHTML = '<div class="tiny">No notifications yet.</div>';
        return;
      }
      data.forEach(n => {
        const div = document.createElement('div');
        div.className = 'notif-admin-item';
        div.innerHTML = `
          <div class="notif-admin-info">
            <div class="notif-admin-title">${core.escapeHtml(n.title || '')}</div>
            <div class="notif-admin-meta">${core.escapeHtml(n.description || '')} • <span class="${n.active ? 'notif-status-active' : 'notif-status-inactive'}">${n.active ? 'Active' : 'Inactive'}</span></div>
          </div>
          <button class="btn-danger" style="padding:6px 10px;font-size:.7rem;" data-id="${n.id}">Delete</button>
        `;
        div.querySelector('[data-id]').addEventListener('click', async () => {
          if (!confirm('Delete notification?')) return;
          await sb().from('notifications').delete().eq('id', n.id);
          loadNotifications();
        });
        list.appendChild(div);
      });
    } catch (e) {
      list.innerHTML = `<div class="tiny" style="color:var(--danger);">Error: ${core.escapeHtml(e.message)}</div>`;
    }
  };

  const addNotification = async () => {
    const title = document.getElementById('notif-title')?.value?.trim();
    if (!title) return alert('Title is required.');
    const description = document.getElementById('notif-desc')?.value || '';
    const media_url   = document.getElementById('notif-media')?.value?.trim() || null;
    const link_url    = document.getElementById('notif-link')?.value?.trim() || null;
    const active      = (document.getElementById('notif-active')?.value || 'true').toLowerCase() === 'true';
    const sort_order  = parseInt(document.getElementById('notif-sort')?.value || '0', 10);
    const expiresEl   = document.getElementById('notif-expires');
    const expires_at  = expiresEl?.value ? new Date(expiresEl.value).toISOString() : null;

    const { error } = await sb().from('notifications').insert([{
      title, description, media_url, link_url, active, sort_order, expires_at
    }]);
    if (error) return alert(error.message);
    alert('Notification added!');
    loadNotifications();
  };

  /* ── Spin Settings ────────────────────────────────────── */
  const saveSpinSettings = async () => {
    const freeMode   = document.getElementById('spin-free-mode')?.value || '1';
    const adEnabled  = document.getElementById('spin-ad-enabled')?.value || '0';
    const adDaily    = document.getElementById('spin-ad-daily')?.value || '3';
    const payEnabled = document.getElementById('spin-pay-enabled')?.value || '0';
    const priceText  = document.getElementById('spin-price-text')?.value || '';
    const maxPerDay  = document.getElementById('spin-max-per-day')?.value || '1';
    const razorLink  = document.getElementById('spin-razorpay-link')?.value || '';
    const badgeDays  = document.getElementById('new-badge-days')?.value || '7';
    const prizesRaw  = document.getElementById('spin-prizes-json')?.value || '[]';
    const adCfgRaw   = document.getElementById('spin-ad-config-json')?.value || 'null';

    try { JSON.parse(prizesRaw); } catch { return alert('Invalid prizes JSON.'); }
    try { if (adCfgRaw !== 'null') JSON.parse(adCfgRaw); } catch { return alert('Invalid ad config JSON.'); }

    /* Odds validation */
    try {
      const prizes = JSON.parse(prizesRaw);
      if (prizes.length) {
        const total = prizes.reduce((sum, p) => sum + (p.odds || 0), 0);
        const el = document.getElementById('spin-odds-validation');
        if (el) {
          if (Math.abs(total - 100) > 0.01) {
            el.innerHTML = `<span style="color:var(--danger);">⚠️ Odds sum to ${total}% (should be 100%)</span>`;
          } else {
            el.innerHTML = `<span style="color:var(--good);">✅ Odds sum to 100%</span>`;
          }
        }
      }
    } catch {}

    await sb().from('site_content').upsert([
      { id: 'spin_free_mode',         content: freeMode },
      { id: 'spin_ad_enabled',        content: adEnabled },
      { id: 'spin_ad_daily_limit',    content: adDaily },
      { id: 'spin_pay_enabled',       content: payEnabled },
      { id: 'spin_price',             content: priceText },
      { id: 'spin_max_per_day',       content: maxPerDay },
      { id: 'razorpay_payment_link',  content: razorLink },
      { id: 'new_badge_days',         content: badgeDays },
      { id: 'spin_prizes',            content: prizesRaw },
      { id: 'spin_ad_config',         content: adCfgRaw }
    ]);
    alert('Spin settings saved!');
    await core.fetchContentAndGallery();
  };

  /* ── Spin Results ─────────────────────────────────────── */
  const loadSpinResults = async () => {
    const list = document.getElementById('spin-results-list');
    if (!list) return;
    try {
      const { data } = await sb().from('spin_results')
        .select('*').order('created_at', { ascending: false }).limit(20);
      if (!data?.length) { list.innerHTML = '<div class="tiny">No spins yet.</div>'; return; }
      list.innerHTML = data.map(r => `
        <div style="display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.06);margin-bottom:6px;">
          <span style="font-size:.8rem;flex:1;">${core.escapeHtml(r.user_name || 'Anonymous')} — <b>${core.escapeHtml(r.prize_name || '')}</b></span>
          <span style="font-size:.72rem;color:${r.won ? 'var(--good)' : 'rgba(234,246,255,.40)'};">${r.won ? '🏆 Won' : 'Try again'}</span>
          <span style="font-size:.70rem;color:rgba(234,246,255,.35);">${new Date(r.created_at).toLocaleDateString()}</span>
        </div>
      `).join('');
    } catch {}
  };

  /* ── Reviews Manager ──────────────────────────────────── */
  const loadAdminReviews = async () => {
    const list = document.getElementById('admin-reviews-list');
    if (!list) return;
    try {
      const { data } = await sb().from('site_reviews').select('*').order('created_at', { ascending: false });
      if (!data?.length) { list.innerHTML = '<div class="tiny">No reviews yet.</div>'; return; }
      list.innerHTML = data.map(r => `
        <div style="display:flex;gap:12px;align-items:flex-start;padding:12px;border-radius:12px;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.08);margin-bottom:8px;">
          <div style="flex:1;">
            <div style="font-weight:950;font-size:.82rem;">${core.escapeHtml(r.display_name || 'Anonymous')}</div>
            <div style="color:#ffd700;font-size:.75rem;margin:2px 0;">${'★'.repeat(r.rating || 0)}</div>
            <div style="font-size:.82rem;color:rgba(234,246,255,.70);margin-top:4px;">${core.escapeHtml(r.review_text || '')}</div>
          </div>
          <button class="btn-danger" style="padding:6px 10px;font-size:.7rem;flex-shrink:0;" data-review-id="${r.id}">Delete</button>
        </div>
      `).join('');
      list.querySelectorAll('[data-review-id]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Delete this review?')) return;
          await sb().from('site_reviews').delete().eq('id', btn.dataset.reviewId);
          loadAdminReviews();
        });
      });
    } catch (e) {
      list.innerHTML = `<div class="tiny" style="color:var(--danger);">Error: ${core.escapeHtml(e.message)}</div>`;
    }
  };

  /* ── Save branding ────────────────────────────────────── */
  const saveBranding = async () => {
    await sb().from('site_content').upsert({ id: 'site_name', content: document.getElementById('edit-brand').value });
    alert('Saved!');
    core.fetchContentAndGallery();
  };

  /* ── Save hero ────────────────────────────────────────── */
  const saveHero = async () => {
    await sb().from('site_content').upsert([
      { id: 'hero_title',    content: document.getElementById('edit-title').value },
      { id: 'hero_subtitle', content: document.getElementById('edit-subtitle').value }
    ]);
    alert('Saved!');
    core.fetchContentAndGallery();
  };

  /* ── Save links ───────────────────────────────────────── */
  const saveLinks = async () => {
    await sb().from('site_content').upsert([
      { id: 'instagram', content: document.getElementById('edit-insta').value },
      { id: 'youtube',   content: document.getElementById('edit-yt').value },
      { id: 'whatsapp',  content: document.getElementById('edit-wa').value },
      { id: 'email',     content: document.getElementById('edit-email').value }
    ]);
    alert('Saved!');
    core.fetchContentAndGallery();
  };

  /* ── Save WhatsApp settings ───────────────────────────── */
  const saveWhatsAppSettings = async () => {
    await sb().from('site_content').upsert([
      { id: 'whatsapp_phone',    content: document.getElementById('edit-wa-phone').value },
      { id: 'whatsapp_template', content: document.getElementById('edit-wa-template').value }
    ]);
    alert('WhatsApp saved!');
    core.fetchContentAndGallery();
  };

  /* ── Save loader ──────────────────────────────────────── */
  const saveLoader = async () => {
    await sb().from('site_content').upsert([
      { id: 'loader_word1',  content: document.getElementById('edit-loader-w1').value },
      { id: 'loader_word2',  content: document.getElementById('edit-loader-w2').value },
      { id: 'loader_color1', content: document.getElementById('edit-loader-c1').value },
      { id: 'loader_color2', content: document.getElementById('edit-loader-c2').value }
    ]);
    alert('Loader saved!');
    core.fetchContentAndGallery();
  };

  /* ── Save UI options ──────────────────────────────────── */
  const saveUI = async () => {
    await sb().from('site_content').upsert([
      { id: 'ui_enable_lightbox_nav', content: document.getElementById('edit-ui-nav').value },
      { id: 'ui_enable_watermark',    content: document.getElementById('edit-ui-wm').value },
      { id: 'ui_watermark_text',      content: document.getElementById('edit-ui-wm-text').value },
      { id: 'ui_watermark_opacity',   content: document.getElementById('edit-ui-wm-opacity').value }
    ]);
    alert('UI saved!');
    core.fetchContentAndGallery();
  };

  /* ── Upload logo ──────────────────────────────────────── */
  const uploadLogo = async () => {
    const file = document.getElementById('upload-logo')?.files[0];
    const err = requireImage(file, { maxBytes: 5 * 1024 * 1024 });
    if (err) return alert(err);

    const btn = document.getElementById('btn-upload-logo');
    if (btn) { btn.innerText = 'Uploading...'; btn.disabled = true; }

    try {
      const url = await uploadAssetToStorage(file, 'logo');
      await sb().from('site_content').upsert({ id: 'logo_url', content: url });
      const el = document.getElementById('brand-logo');
      if (el) el.src = url;
      alert('Logo uploaded!');
      await core.fetchContentAndGallery();
    } catch (e) {
      alert(e?.message || 'Upload failed');
    } finally {
      if (btn) { btn.innerText = 'Upload Logo'; btn.disabled = false; }
    }
  };

  /* ── Upload wallpaper ─────────────────────────────────── */
  const uploadWallpaper = async () => {
    const file = document.getElementById('upload-wallpaper')?.files[0];
    const err = requireImage(file, { maxBytes: 20 * 1024 * 1024 });
    if (err) return alert(err);

    const btn = document.getElementById('btn-upload-wallpaper');
    if (btn) { btn.innerText = 'Uploading...'; btn.disabled = true; }

    try {
      const url = await uploadAssetToStorage(file, 'wallpaper');
      await sb().from('site_content').upsert({ id: 'hero_bg', content: url });
      const el = document.getElementById('hero-bg-el');
      if (el) el.src = url;
      alert('Wallpaper uploaded!');
      await core.fetchContentAndGallery();
    } catch (e) {
      alert(e?.message || 'Upload failed');
    } finally {
      if (btn) { btn.innerText = 'Upload Wallpaper'; btn.disabled = false; }
    }
  };

  /* ── Media modal ──────────────────────────────────────── */
  const openMediaModal = async (item) => {
    s().editingMediaId = item.id;

    const url = item.image_url || '';
    const isVid = core.isVideoUrl(url);

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };

    setVal('amm-url',        url);
    setVal('amm-title',      item.title || '');
    setVal('amm-desc',       item.description || '');
    setVal('amm-tags',       item.tags || '');
    setVal('amm-price',      item.price || '');
    setVal('amm-custom-wa',  item.custom_wa_message || '');
    setVal('amm-additional', item.additional_media || '');

    /* Populate category select */
    const catSel = document.getElementById('amm-category');
    if (catSel) {
      const cats = s().galleryCategories || [];
      catSel.innerHTML = '<option value="">— No category —</option>' +
        cats.map(c => `<option value="${core.escapeHtml(c)}">${core.escapeHtml(c)}</option>`).join('');
      catSel.value = item.category || '';
    }

    /* Clear file input */
    const fileInput = document.getElementById('amm-additional-upload');
    if (fileInput) fileInput.value = '';

    const typeEl = document.getElementById('amm-type');
    if (typeEl) typeEl.innerText = isVid ? 'VIDEO' : 'IMAGE';

    const preview = document.getElementById('amm-preview');
    if (preview) {
      preview.innerHTML =
        `<div class="badge" id="amm-type">${isVid ? 'VIDEO' : 'IMAGE'}</div>` +
        (isVid
          ? `<video src="${url}" controls playsinline style="width:100%;height:100%;object-fit:cover;background:#000"></video>`
          : `<img src="${url}" alt="Preview" />`);
    }

    /* Sold section */
    const soldInfoWrap = document.getElementById('sold-info-wrap');
    if (soldInfoWrap) {
      if (item.sold) {
        soldInfoWrap.innerHTML = `<div class="sold-info">SOLD to <b>${core.escapeHtml(item.buyer_name || 'Unknown')}</b></div>`;
      } else {
        soldInfoWrap.innerHTML = '';
      }
    }

    /* Load users for buyer dropdown */
    const buyerSel = document.getElementById('amm-buyer-select');
    if (buyerSel) {
      buyerSel.innerHTML = '<option value="">Select buyer…</option>';
      try {
        const { data: users } = await sb().from('user_profiles').select('id,display_name,email').order('display_name');
        (users || []).forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.id;
          opt.textContent = `${u.display_name || u.email} (${u.email})`;
          opt.dataset.name = u.display_name || u.email;
          buyerSel.appendChild(opt);
        });
      } catch {}
    }

    renderAdditionalThumbs();
    document.getElementById('admin-media-modal')?.classList.add('active');
  };

  const closeMediaModal = () => {
    document.getElementById('admin-media-modal')?.classList.remove('active');
    s().editingMediaId = null;
  };

  const copyMediaUrl = async () => {
    const url = document.getElementById('amm-url')?.value || '';
    try {
      await navigator.clipboard.writeText(url);
      alert('Media URL copied!');
    } catch {
      alert('Copy failed. Please copy manually.');
    }
  };

  const saveMediaModal = async () => {
    const id = s().editingMediaId;
    if (!id) return alert('No media selected.');

    const getVal = (elId) => document.getElementById(elId)?.value || '';

    const title             = getVal('amm-title');
    const description       = getVal('amm-desc');
    const tags              = getVal('amm-tags');
    const price             = getVal('amm-price');
    const category          = getVal('amm-category');
    const custom_wa_message = getVal('amm-custom-wa');
    const additional_media  = getVal('amm-additional');

    const { error } = await sb().from('gallery')
      .update({ title, description, tags, price, category, custom_wa_message, additional_media })
      .eq('id', id);

    if (error) return alert(error.message);

    alert('Saved!');
    closeMediaModal();
    core.fetchContentAndGallery();
  };

  const deleteMediaFromModal = async () => {
    const id = s().editingMediaId;
    if (!id) return;
    if (!confirm('Delete this media item?')) return;
    await core.deleteMedia(id);
    closeMediaModal();
  };

  /* ── Mark as Sold ─────────────────────────────────────── */
  const markAsSold = async () => {
    const id = s().editingMediaId;
    if (!id) return;

    const buyerSel = document.getElementById('amm-buyer-select');
    const buyerId = buyerSel?.value;
    const buyerName = buyerSel?.options[buyerSel.selectedIndex]?.dataset.name || '';
    const amountStr = document.getElementById('amm-sold-amount')?.value || '0';
    const amount = parseFloat(amountStr) || 0;

    if (!buyerId) return alert('Select a buyer.');
    if (!confirm(`Mark this item as sold to ${buyerName} for ${amount}?`)) return;

    try {
      /* Update gallery item */
      await sb().from('gallery').update({
        sold: true,
        buyer_id: buyerId,
        buyer_name: buyerName
      }).eq('id', id);

      /* Insert into product_sales */
      await sb().from('product_sales').insert([{
        product_id: id,
        buyer_id: buyerId,
        buyer_name: buyerName,
        amount
      }]);

      /* Update buyer's profile */
      const { data: profile } = await sb().from('user_profiles').select('purchase_count,total_spent').eq('id', buyerId).single();
      await sb().from('user_profiles').update({
        purchase_count: (profile?.purchase_count || 0) + 1,
        total_spent: (parseFloat(profile?.total_spent || 0) + amount)
      }).eq('id', buyerId);

      alert('Marked as sold!');
      closeMediaModal();
      core.fetchContentAndGallery();
    } catch (e) {
      alert(e?.message || 'Error marking as sold');
    }
  };

  const unmarkSold = async () => {
    const id = s().editingMediaId;
    if (!id) return;
    if (!confirm('Unmark this item as sold?')) return;
    try {
      await sb().from('gallery').update({ sold: false, buyer_id: null, buyer_name: null }).eq('id', id);
      alert('Unmarked!');
      closeMediaModal();
      core.fetchContentAndGallery();
    } catch (e) {
      alert(e?.message || 'Error');
    }
  };

  /* ── Additional media upload & thumbs ────────────────── */
  const renderAdditionalThumbs = () => {
    const container = document.getElementById('amm-additional-thumbs');
    if (!container) return;
    const textarea = document.getElementById('amm-additional');
    const urls = (textarea?.value || '').split(/[\n,]/).map(u => u.trim()).filter(Boolean);
    container.innerHTML = '';
    urls.forEach(url => {
      const isVid = core.isVideoUrl(url);
      const safeUrl = core.escapeHtml(url);
      const wrap = document.createElement('div');
      wrap.className = 'amm-thumb';
      wrap.innerHTML = isVid
        ? `<video src="${safeUrl}" muted playsinline></video>`
        : `<img src="${safeUrl}" alt="" />`;
      const del = document.createElement('button');
      del.className = 'amm-thumb-del';
      del.type = 'button';
      del.innerHTML = '<i class="fas fa-xmark"></i>';
      del.addEventListener('click', () => removeAdditionalMedia(url));
      wrap.appendChild(del);
      container.appendChild(wrap);
    });
  };

  const removeAdditionalMedia = (url) => {
    const textarea = document.getElementById('amm-additional');
    if (!textarea) return;
    const urls = textarea.value.split(/[\n,]/).map(u => u.trim()).filter(Boolean);
    textarea.value = urls.filter(u => u !== url).join('\n');
    renderAdditionalThumbs();
  };

  const uploadAdditionalMedia = async () => {
    const fileInput = document.getElementById('amm-additional-upload');
    const files = fileInput?.files;
    if (!files || files.length === 0) return alert('Select files first!');

    const ALLOWED_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'mp4', 'mov', 'webm', 'm4v']);

    const btn = document.querySelector('[onclick="core.uploadAdditionalMedia()"]');
    if (btn) { btn.innerText = 'Uploading...'; btn.disabled = true; }

    try {
      const urls = [];
      for (const file of files) {
        const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!ALLOWED_EXTS.has(ext)) { alert(`File type ".${ext}" is not allowed.`); continue; }
        const name = `additional_${crypto.randomUUID()}.${ext}`;
        const { error } = await sb().storage.from(core._ASSETS_BUCKET).upload(name, file, { upsert: true });
        if (error) throw error;
        const { data } = sb().storage.from(core._ASSETS_BUCKET).getPublicUrl(name);
        urls.push(data.publicUrl);
      }

      const textarea = document.getElementById('amm-additional');
      if (textarea && urls.length) {
        const existing = textarea.value.trim();
        textarea.value = existing ? existing + '\n' + urls.join('\n') : urls.join('\n');
      }
      if (fileInput) fileInput.value = '';
      renderAdditionalThumbs();
    } catch (e) {
      alert(e?.message || 'Upload failed');
    } finally {
      if (btn) { btn.innerText = 'Upload Files'; btn.disabled = false; }
    }
  };

  /* ── Maintenance Mode ─────────────────────────────────── */
  const loadMaintenanceStatus = async () => {
    const statusEl = document.getElementById('maint-admin-status');
    const toggleBtn = document.getElementById('maint-toggle-btn');
    try {
      const { data } = await sb().from('site_content').select('content').eq('id', 'site_maintenance').single();
      if (data?.content) {
        const maint = JSON.parse(data.content);
        if (statusEl) {
          statusEl.innerHTML = maint.enabled
            ? `<span style="color:var(--danger);">🔴 Site is CLOSED — "${maint.message || ''}"</span>`
            : `<span style="color:var(--good);">🟢 Site is LIVE</span>`;
        }
        if (toggleBtn) {
          if (maint.enabled) {
            toggleBtn.textContent = '🔴 SITE IS CLOSED — Click to Reopen';
            toggleBtn.className = 'maint-toggle-btn maint-toggle-closed';
            toggleBtn.onclick = () => core.reopenSite();
          } else {
            toggleBtn.textContent = '🟢 SITE IS LIVE — Click to Close Site';
            toggleBtn.className = 'maint-toggle-btn maint-toggle-live';
            toggleBtn.onclick = () => core.toggleMaintenance();
          }
        }
      } else {
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--good);">🟢 Site is LIVE</span>';
      }
    } catch {}
  };

  const toggleMaintenance = () => {
    const form = document.getElementById('maint-form');
    if (form) form.style.display = form.style.display === 'none' ? 'block' : 'none';
  };

  const saveMaintenance = async () => {
    const msg = document.getElementById('maint-msg-input')?.value || "We'll be back soon!";
    const reopenAt = document.getElementById('maint-reopen-input')?.value || null;
    const payload = JSON.stringify({
      enabled: true,
      message: msg,
      reopen_at: reopenAt ? new Date(reopenAt).toISOString() : null
    });
    await sb().from('site_content').upsert({ id: 'site_maintenance', content: payload });
    alert('Site closed for maintenance!');
    const form = document.getElementById('maint-form');
    if (form) form.style.display = 'none';
    loadMaintenanceStatus();
  };

  const reopenSite = async () => {
    if (!confirm('Reopen the site?')) return;
    const payload = JSON.stringify({ enabled: false, message: '', reopen_at: null });
    await sb().from('site_content').upsert({ id: 'site_maintenance', content: payload });
    alert('Site is now LIVE!');
    loadMaintenanceStatus();
  };

  /* ── Ad Slots ─────────────────────────────────────────── */
  const loadAdSlots = async () => {
    const list = document.getElementById('ad-slots-list');
    if (!list) return;
    try {
      const { data } = await sb().from('site_content').select('content').eq('id', 'ad_slots').single();
      const slots = data?.content ? JSON.parse(data.content) : [];
      if (!slots.length) {
        list.innerHTML = '<div class="tiny">No ad slots configured yet.</div>';
        return;
      }
      list.innerHTML = slots.map(slot => `
        <div class="ad-slot-card">
          <div class="ad-slot-info">
            <div class="ad-slot-name">${core.escapeHtml(slot.name || slot.id)}</div>
            <div class="tiny">
              ${slot.image_url ? `<span>Image: ${core.escapeHtml(slot.image_url.slice(0, 40))}…</span>` : '<span>No image</span>'}
              &nbsp;•&nbsp;
              <span class="${slot.active ? 'ad-slot-status-active' : 'ad-slot-status-inactive'}">${slot.active ? '✅ Active' : '⬜ Inactive'}</span>
            </div>
          </div>
          <button class="btn-soft" style="padding:6px 10px;font-size:.7rem;" onclick="core.loadAdSlotToEditor('${slot.id}')">Edit</button>
        </div>
      `).join('');
    } catch (e) {
      if (list) list.innerHTML = `<div class="tiny" style="color:var(--danger);">Error: ${core.escapeHtml(e.message)}</div>`;
    }
  };

  const loadAdSlotToEditor = async (slotId) => {
    const selEl = document.getElementById('ad-slot-id');
    if (selEl) selEl.value = slotId;
    try {
      const { data } = await sb().from('site_content').select('content').eq('id', 'ad_slots').single();
      const slots = data?.content ? JSON.parse(data.content) : [];
      const slot = slots.find(s => s.id === slotId);
      if (slot) {
        const imgEl = document.getElementById('ad-slot-image');
        const linkEl = document.getElementById('ad-slot-link');
        const activeEl = document.getElementById('ad-slot-active');
        if (imgEl) imgEl.value = slot.image_url || '';
        if (linkEl) linkEl.value = slot.link_url || '';
        if (activeEl) activeEl.value = slot.active ? 'true' : 'false';
      }
    } catch {}
  };

  const saveAdSlot = async () => {
    const slotId   = document.getElementById('ad-slot-id')?.value || 'header';
    const imageUrl = document.getElementById('ad-slot-image')?.value?.trim() || '';
    const linkUrl  = document.getElementById('ad-slot-link')?.value?.trim() || '';
    const active   = document.getElementById('ad-slot-active')?.value === 'true';

    const SLOT_NAMES = { header: 'Header Banner', gallery: 'Gallery Between Items', footer: 'Footer Banner' };

    try {
      const { data } = await sb().from('site_content').select('content').eq('id', 'ad_slots').single();
      let slots = data?.content ? JSON.parse(data.content) : [];
      const existing = slots.findIndex(s => s.id === slotId);
      const newSlot = { id: slotId, name: SLOT_NAMES[slotId] || slotId, type: 'image', image_url: imageUrl, link_url: linkUrl, active };
      if (existing >= 0) slots[existing] = newSlot;
      else slots.push(newSlot);
      await sb().from('site_content').upsert({ id: 'ad_slots', content: JSON.stringify(slots) });
      alert('Ad slot saved!');
      loadAdSlots();
      core.applyAdSlots();
    } catch (e) {
      alert(e?.message || 'Error saving ad slot');
    }
  };

  /* ── Register on core ─────────────────────────────────── */
  Object.assign(core, {
    loadAdminData,
    saveBranding,
    saveHero,
    saveLinks,
    saveWhatsAppSettings,
    saveLoader,
    saveUI,
    saveGalleryCategories,
    uploadLogo,
    uploadWallpaper,
    openMediaModal,
    closeMediaModal,
    copyMediaUrl,
    saveMediaModal,
    deleteMediaFromModal,
    renderAdditionalThumbs,
    removeAdditionalMedia,
    uploadAdditionalMedia,
    loadAnalytics,
    loadNotifications,
    addNotification,
    saveSpinSettings,
    loadAdminReviews,
    markAsSold,
    unmarkSold,
    toggleMaintenance,
    saveMaintenance,
    reopenSite,
    loadAdSlots,
    loadAdSlotToEditor,
    saveAdSlot
  });
})();
