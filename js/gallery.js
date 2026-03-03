/* =========================================================
   gallery.js — Gallery rendering, lightbox, zoom, tilt,
                media upload/delete
   ========================================================= */

(() => {
  const s = () => core._state;
  const z = () => core._zoom;

  /* ── Zoom helpers ─────────────────────────────────────── */
  const resetZoom = () => {
    const zs = z();
    zs.scale = 1; zs.x = 0; zs.y = 0;
  };

  const applyZoomTransform = (mediaEl) => {
    const zs = z();
    mediaEl.style.transform =
      `translate(calc(-50% + ${zs.x}px), calc(-50% + ${zs.y}px)) scale(${zs.scale})`;
  };

  /* ── Gallery filter tabs ──────────────────────────────── */
  const renderFilterTabs = (items) => {
    const container = document.getElementById('gallery-filters');
    if (!container) return;

    const cats = new Set();
    (s().galleryCategories || []).forEach(cat => { if (cat) cats.add(cat); });
    items.forEach(item => {
      const cat = (item.category || '').trim();
      if (cat) cats.add(cat);
    });

    container.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'filter-tab' + (s().activeCategory === 'all' ? ' active' : '');
    allBtn.textContent = 'All';
    allBtn.addEventListener('click', () => filterGallery('all'));
    container.appendChild(allBtn);

    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-tab' + (s().activeCategory === cat ? ' active' : '');
      btn.textContent = cat;
      btn.dataset.cat = cat;
      btn.addEventListener('click', () => filterGallery(cat));
      container.appendChild(btn);
    });
  };

  const filterGallery = (cat) => {
    s().activeCategory = cat;

    document.querySelectorAll('.filter-tab').forEach(btn => {
      const btnCat = btn.dataset.cat || 'all';
      btn.classList.toggle('active', btnCat === cat);
    });

    document.querySelectorAll('.tilt-card').forEach(card => {
      const cardCat = card.dataset.category || '';
      const visible = cat === 'all' || cardCat === cat;
      if (visible) {
        card.style.display = '';
        gsap.to(card, { opacity: 1, duration: 0.35, ease: 'power2.out' });
      } else {
        gsap.to(card, {
          opacity: 0, duration: 0.25, ease: 'power2.in',
          onComplete: () => { card.style.display = 'none'; }
        });
      }
    });
  };

  /* ── Parse additional media ───────────────────────────── */
  const parseAdditionalMedia = (raw) => {
    if (!raw) return [];
    return raw.split(/[\n,]/).map(u => u.trim()).filter(Boolean);
  };

  /* ── Is NEW (within badge days) ───────────────────────── */
  const isNewItem = (createdAt) => {
    if (!createdAt) return false;
    const days = s().newBadgeDays || 7;
    const diff = Date.now() - new Date(createdAt).getTime();
    return diff < days * 24 * 60 * 60 * 1000;
  };

  /* ── Render gallery ───────────────────────────────────── */
  const renderGallery = (items) => {
    s().galleryItems = items;

    const feed      = document.getElementById('gallery-feed');
    const adminList = document.getElementById('admin-list');
    const counter   = document.getElementById('gallery-counter');

    if (!feed) return;
    feed.innerHTML = '';
    if (adminList) adminList.innerHTML = '';
    if (counter) counter.innerText = `${items.length} Works`;

    renderFilterTabs(items);

    items.forEach((item, i) => {
      const url      = item.image_url;
      const title    = item.title || 'Untitled';
      const desc     = item.description || '';
      const tags     = core.parseTags(item.tags);
      const category = (item.category || '').trim();
      const isVid    = core.isVideoUrl(url);
      const type     = isVid ? 'video' : 'photo';
      const price    = item.price || '';
      const sold     = !!item.sold;
      const isNew    = isNewItem(item.created_at);

      const extraMedia = parseAdditionalMedia(item.additional_media);
      const totalMedia = 1 + extraMedia.length;

      const card = document.createElement('div');
      card.className = 'tilt-card';
      if (category) card.dataset.category = category;

      const mediaHtml = isVid
        ? `<video src="${url}#t=0.1" preload="metadata" muted loop playsinline onmouseover="this.play()" onmouseout="this.pause()"></video><div class="play-badge"><i class="fas fa-play"></i></div>`
        : `<img src="${url}" loading="lazy" decoding="async" alt="${core.escapeHtml(title)}">`;

      const user = s().currentUser;
      const userName = user?.user_metadata?.full_name || user?.email || '';
      const userEmail = user?.email || '';

      const waHref = core.buildWhatsAppUrl({
        phone: s().whatsappPhone,
        template: s().whatsappTemplate,
        title, url, type, tags,
        customMessage: item.custom_wa_message || '',
        username: userName,
        email: userEmail
      });

      const watermarkHtml = s().uiEnableWatermark
        ? `<div class="watermark">${core.escapeHtml(s().uiWatermarkText)}</div>`
        : '';

      const chipsHtml = tags.length
        ? `<div class="tag-chips">${tags.slice(0, 5).map((t, di) =>
            `<span class="chip" style="animation-delay:${di * 0.06}s">${core.escapeHtml(t)}</span>`
          ).join('')}</div>`
        : '';

      const countBadge = totalMedia > 1
        ? `<div class="media-count-badge"><i class="fas fa-images"></i> ${totalMedia}</div>`
        : '';

      const newBadgeHtml = isNew ? `<div class="new-badge">NEW</div>` : '';
      const soldBadgeHtml = sold ? `<div class="sold-badge">SOLD</div>` : '';
      const priceBadgeHtml = price ? `<div class="price-badge">${core.escapeHtml(price)}</div>` : '';

      const avgRating = parseFloat(item.avg_rating || 0);
      const ratingCount = parseInt(item.rating_count || 0);
      const viewCount = parseInt(item.view_count || 0);

      const ratingHtml = ratingCount > 0
        ? `<div class="rating-display"><span class="stars">⭐</span> ${avgRating.toFixed(1)} <span class="count">(${ratingCount})</span></div>`
        : '';
      const viewHtml = viewCount > 0
        ? `<span class="view-count-badge"><i class="fas fa-eye"></i> ${viewCount}</span>`
        : '';

      card.innerHTML = `
        <div class="card-inner">
          ${mediaHtml}
          ${watermarkHtml}
          ${chipsHtml}
          ${countBadge}
          ${newBadgeHtml}
          ${soldBadgeHtml}
          ${priceBadgeHtml}
        </div>
        <div class="card-info">
          <div class="card-title">${core.escapeHtml(title)}${viewHtml}</div>
          ${desc ? `<div class="card-desc">${core.escapeHtml(desc)}</div>` : ''}
          ${ratingHtml}
          <div class="card-actions">
            ${waHref
              ? `<a class="btn-wa wa-contact-btn" href="${waHref}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Contact</a>`
              : `<span style="color:rgba(234,246,255,.55);font-size:0.85rem;">(Admin: set WhatsApp phone to enable contact)</span>`}
          </div>
        </div>
      `;

      card.addEventListener('click', () => openLightboxByIndex(i));

      /* Sign-in gate for WhatsApp contact */
      if (waHref) {
        card.querySelector('.wa-contact-btn')?.addEventListener('click', e => {
          e.stopPropagation();
          if (!s().currentUser) {
            e.preventDefault();
            core.requireSignIn('whatsapp', waHref);
          }
        });
      }

      gsap.from(card, {
        scrollTrigger: { trigger: card, start: 'top 90%' },
        opacity: 0, y: 30, duration: 0.8,
        delay: (i % 3) * 0.08
      });

      feed.appendChild(card);

      /* Inject gallery ad slot after every 6th item */
      if ((i + 1) % 6 === 0) {
        const adSlots = core._state.adSlots || [];
        const gallerySlot = adSlots.find(s => s.id === 'gallery');
        if (gallerySlot?.active && gallerySlot?.image_url) {
          const adDiv = document.createElement('div');
          adDiv.id = `ad-gallery-slot-${i}`;
          adDiv.className = 'ad-slot active';
          adDiv.style.cssText = 'grid-column:1/-1;text-align:center;margin:4px 0;position:relative;';
          const safeImg = core.escapeHtml(gallerySlot.image_url);
          const safeLink = core.escapeHtml(gallerySlot.link_url || '#');
          adDiv.innerHTML = `<span class="ad-slot-label">Ad</span><a href="${safeLink}" target="_blank" rel="noopener sponsored"><img src="${safeImg}" alt="Advertisement" loading="lazy" style="max-width:100%;border-radius:12px;display:inline-block;" /></a>`;
          feed.appendChild(adDiv);
        }
      }

      /* Admin thumbnail */
      if (adminList) {
        const thumb = document.createElement('div');
        thumb.className = 'thumb';
        thumb.innerHTML = `
          ${isVid
            ? `<video src="${url}#t=0.1" preload="metadata" muted></video>`
            : `<img src="${url}" alt="">`}
          <button class="thumb-del" type="button" title="Delete"><i class="fas fa-trash"></i></button>
          <div class="thumb-overlay">
            <button class="thumb-btn" type="button">Edit</button>
          </div>
        `;
        thumb.querySelector('.thumb-del').addEventListener('click', e => {
          e.stopPropagation();
          core.deleteMedia(item.id);
        });
        thumb.querySelector('.thumb-btn').addEventListener('click', e => {
          e.stopPropagation();
          core.openMediaModal(item);
        });
        adminList.appendChild(thumb);
      }
    });

    if (s().activeCategory !== 'all') filterGallery(s().activeCategory);
  };

  /* ── Product View Tracker ─────────────────────────────── */
  const trackProductView = async (itemId) => {
    try {
      /* Fetch current then increment (safe for all Supabase versions) */
      const { data } = await core._supabase.from('gallery').select('view_count').eq('id', itemId).single();
      const newCount = parseInt(data?.view_count || 0) + 1;
      await core._supabase.from('gallery').update({ view_count: newCount }).eq('id', itemId);
    } catch {}
  };

  /* ── Rating System ────────────────────────────────────── */
  const renderLightboxRatings = (item, container) => {
    const user = s().currentUser;
    const avgRating = parseFloat(item.avg_rating || 0);
    const ratingCount = parseInt(item.rating_count || 0);

    const wrap = document.createElement('div');
    wrap.className = 'lb-ratings';
    wrap.id = 'lb-rating-wrap';

    const renderStars = (currentRating) => {
      wrap.innerHTML = '';
      for (let i = 1; i <= 5; i++) {
        const star = document.createElement('span');
        star.className = 'lb-star' + (i <= currentRating ? ' lit' : '') + (!user ? ' readonly' : '');
        star.textContent = '★';
        star.title = user ? `Rate ${i} star${i > 1 ? 's' : ''}` : 'Sign in to rate';
        if (user) {
          star.addEventListener('mouseenter', () => {
            wrap.querySelectorAll('.lb-star').forEach((s, si) => {
              s.classList.toggle('lit', si < i);
            });
          });
          star.addEventListener('mouseleave', () => {
            wrap.querySelectorAll('.lb-star').forEach((s, si) => {
              s.classList.toggle('lit', si < currentRating);
            });
          });
          star.addEventListener('click', async () => {
            await submitRating(item.id, i);
            renderStars(i);
          });
        }
        wrap.appendChild(star);
      }
      if (ratingCount > 0 || avgRating > 0) {
        const info = document.createElement('span');
        info.style.cssText = 'font-size:.72rem;color:rgba(234,246,255,.45);margin-left:4px;';
        info.textContent = ratingCount > 0 ? `${avgRating.toFixed(1)} (${ratingCount})` : '';
        wrap.appendChild(info);
      }
    };

    /* Load user's existing rating */
    const loadUserRating = async () => {
      if (!user) { renderStars(Math.round(avgRating)); return; }
      try {
        const { data } = await core._supabase.from('product_ratings')
          .select('rating').eq('product_id', item.id).eq('user_id', user.id).single();
        renderStars(data?.rating || Math.round(avgRating));
      } catch {
        renderStars(Math.round(avgRating));
      }
    };

    loadUserRating();
    container.appendChild(wrap);
  };

  const submitRating = async (productId, rating) => {
    const user = s().currentUser;
    if (!user) return;
    try {
      await core._supabase.from('product_ratings').upsert({
        product_id: productId,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email,
        rating
      });
      /* Recalculate average */
      const { data: ratings } = await core._supabase.from('product_ratings')
        .select('rating').eq('product_id', productId);
      if (ratings?.length) {
        const avg = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
        await core._supabase.from('gallery').update({
          avg_rating: Math.round(avg * 10) / 10,
          rating_count: ratings.length
        }).eq('id', productId);
      }
    } catch (e) {
      console.error('Rating error:', e);
    }
  };

  /* ── Lightbox ─────────────────────────────────────────── */
  const openLightboxByIndex = async (idx) => {
    s().currentIndex = idx;
    const item = s().galleryItems[idx];
    if (!item) return;

    /* Track view */
    if (item.id) trackProductView(item.id);

    const extraMedia = parseAdditionalMedia(item.additional_media);
    const allMedia   = [item.image_url, ...extraMedia];

    openLightbox(item.image_url, core.isVideoUrl(item.image_url), {
      title:       item.title || 'Untitled',
      tags:        core.parseTags(item.tags),
      customWaMsg: item.custom_wa_message || '',
      allMedia,
      price:       item.price || '',
      sold:        item.sold || false,
      buyerName:   item.buyer_name || '',
      item
    });
  };

  const openLightbox = (url, isVid, meta = {}) => {
    const box  = document.getElementById('lightbox');
    const wrap = document.getElementById('lightbox-content');
    if (!box || !wrap) return;

    const title       = meta.title       || 'Untitled';
    const tags        = meta.tags        || [];
    const customWaMsg = meta.customWaMsg || '';
    const allMedia    = meta.allMedia    || [url];
    const price       = meta.price       || '';
    const sold        = meta.sold        || false;
    const buyerName   = meta.buyerName   || '';
    const item        = meta.item        || null;
    const type        = isVid ? 'video' : 'photo';

    const user = s().currentUser;
    const userName = user?.user_metadata?.full_name || user?.email || '';
    const userEmail = user?.email || '';

    const waHref = core.buildWhatsAppUrl({
      phone: s().whatsappPhone,
      template: s().whatsappTemplate,
      title, url, type, tags,
      customMessage: customWaMsg,
      username: userName,
      email: userEmail
    });

    resetZoom();

    /* Gallery-level prev/next arrows */
    const navHtml = s().uiEnableLightboxNav ? `
      <button class="nav-arrow" id="lb-prev" type="button" title="Previous"><i class="fas fa-chevron-left"></i></button>
      <button class="nav-arrow" id="lb-next" type="button" title="Next"><i class="fas fa-chevron-right"></i></button>
    ` : '';

    /* Inner product prev/next (multiple media per item) */
    const hasMultiple = allMedia.length > 1;
    const innerNavHtml = hasMultiple ? `
      <div class="lb-inner-nav">
        <button class="lb-inner-arrow" id="lb-inner-prev" type="button"><i class="fas fa-chevron-left"></i></button>
        <button class="lb-inner-arrow" id="lb-inner-next" type="button"><i class="fas fa-chevron-right"></i></button>
      </div>
      <div class="lb-inner-dots" id="lb-inner-dots">
        ${allMedia.map((_, di) => `<div class="lb-dot${di === 0 ? ' active' : ''}"></div>`).join('')}
      </div>
    ` : '';

    const buildMediaTag = (u, t) => {
      const v = core.isVideoUrl(u);
      return v
        ? `<video class="zoom-media" src="${u}" controls autoplay playsinline style="background:#000;"></video>`
        : `<img class="zoom-media" src="${u}" alt="${core.escapeHtml(t)}" decoding="async" loading="eager" style="background:#000;">`;
    };

    const tagsPill = tags.length
      ? `<div class="pill">Tags: ${core.escapeHtml(tags.join(', '))}</div>`
      : '';

    const pricePill = price
      ? `<div class="pill price-pill">🏷️ ${core.escapeHtml(price)}</div>`
      : '';

    const soldPill = sold
      ? `<div class="pill" style="background:rgba(255,59,59,.18);border-color:rgba(255,59,59,.35);color:#ffa0a0;">SOLD${buyerName ? ` to ${core.escapeHtml(buyerName)}` : ''}</div>`
      : '';

    wrap.innerHTML = `
      <div class="zoom-stage" id="zoom-stage">
        ${buildMediaTag(url, title)}
        ${innerNavHtml}

        <div class="lightbox-bottombar">
          <div class="left">
            <div class="pill">${core.escapeHtml(title)}</div>
            ${pricePill}
            ${soldPill}
            ${tagsPill}
            ${!isVid
              ? `<div class="pill">Wheel/Pinch to zoom • Drag to pan</div>`
              : `<div class="pill">Video</div>`}
          </div>
          <div class="right">
            ${waHref ? `<a class="btn-wa wa-lb-contact" href="${waHref}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Contact</a>` : ''}
            <button class="pill" id="btn-reset-zoom" type="button">Reset</button>
          </div>
        </div>

        <div style="position:absolute;left:16px;top:16px;z-index:16;display:flex;gap:10px;">
          ${navHtml}
        </div>
      </div>
    `;

    /* Ratings widget */
    if (item) {
      const bottomLeft = wrap.querySelector('.lightbox-bottombar .left');
      if (bottomLeft) renderLightboxRatings(item, bottomLeft);
    }

    /* Sign-in gate for lightbox contact button */
    if (waHref) {
      wrap.querySelector('.wa-lb-contact')?.addEventListener('click', e => {
        if (!s().currentUser) {
          e.preventDefault();
          e.stopPropagation();
          core.requireSignIn('whatsapp', waHref);
        }
      });
    }

    const stage = document.getElementById('zoom-stage');

    /* Current media reference (mutable) */
    let curMedia = stage.querySelector('.zoom-media');
    let curIsVid = isVid;
    let innerIdx = 0;
    applyZoomTransform(curMedia);

    /* ── Zoom event listeners ─────────────────────────── */
    stage.addEventListener('wheel', (e) => {
      if (curIsVid) return;
      e.preventDefault();
      const zs = z();
      const step = (-e.deltaY) > 0 ? 0.12 : -0.12;
      zs.scale = core.clamp(zs.scale + step, zs.minScale, zs.maxScale);
      if (zs.scale === 1) { zs.x = 0; zs.y = 0; }
      applyZoomTransform(curMedia);
    }, { passive: false });

    stage.addEventListener('pointerdown', (e) => {
      if (curIsVid) return;
      const zs = z();
      zs.dragging = true;
      stage.classList.add('dragging');
      zs.pointerX = e.clientX;
      zs.pointerY = e.clientY;
      stage.setPointerCapture(e.pointerId);
    });

    stage.addEventListener('pointermove', (e) => {
      if (curIsVid) return;
      const zs = z();
      if (!zs.dragging || zs.scale <= 1) return;
      zs.x += e.clientX - zs.pointerX;
      zs.y += e.clientY - zs.pointerY;
      zs.pointerX = e.clientX;
      zs.pointerY = e.clientY;
      applyZoomTransform(curMedia);
    });

    stage.addEventListener('pointerup', () => {
      z().dragging = false;
      stage.classList.remove('dragging');
    });

    let lastPinchDist = null;
    stage.addEventListener('touchmove', (e) => {
      if (curIsVid || e.touches.length !== 2) { lastPinchDist = null; return; }
      e.preventDefault();
      const dx   = e.touches[0].clientX - e.touches[1].clientX;
      const dy   = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (lastPinchDist) {
        const zs  = z();
        zs.scale  = core.clamp(zs.scale + (dist - lastPinchDist) * 0.002, zs.minScale, zs.maxScale);
        if (zs.scale === 1) { zs.x = 0; zs.y = 0; }
        applyZoomTransform(curMedia);
      }
      lastPinchDist = dist;
    }, { passive: false });

    /* Double-tap to zoom */
    let lastTap = 0;
    stage.addEventListener('touchend', (e) => {
      if (curIsVid) return;
      const now = Date.now();
      if (now - lastTap < 300 && e.changedTouches.length === 1) {
        const zs   = z();
        const rect = stage.getBoundingClientRect();
        const t    = e.changedTouches[0];
        if (zs.scale > 1) {
          resetZoom();
        } else {
          zs.scale = 2;
          zs.x = (rect.width  / 2 - (t.clientX - rect.left)) * (zs.scale - 1);
          zs.y = (rect.height / 2 - (t.clientY - rect.top )) * (zs.scale - 1);
        }
        applyZoomTransform(curMedia);
        e.preventDefault();
      }
      lastTap = now;
    }, { passive: false });

    document.getElementById('btn-reset-zoom')?.addEventListener('click', e => {
      e.stopPropagation();
      resetZoom();
      applyZoomTransform(curMedia);
    });

    /* Gallery-level prev/next */
    if (s().uiEnableLightboxNav) {
      document.getElementById('lb-prev')?.addEventListener('click', e => { e.stopPropagation(); prevItem(); });
      document.getElementById('lb-next')?.addEventListener('click', e => { e.stopPropagation(); nextItem(); });
    }

    /* Inner media switcher */
    const switchInner = (newIdx) => {
      innerIdx = ((newIdx % allMedia.length) + allMedia.length) % allMedia.length;
      const newUrl = allMedia[innerIdx];
      curIsVid = core.isVideoUrl(newUrl);
      resetZoom();

      const oldEl = stage.querySelector('.zoom-media');
      const tmp   = document.createElement('div');
      tmp.innerHTML = buildMediaTag(newUrl, title);
      const newEl = tmp.firstElementChild;
      stage.insertBefore(newEl, oldEl);
      applyZoomTransform(newEl);
      gsap.fromTo(newEl, { opacity: 0 }, { opacity: 1, duration: 0.28 });
      oldEl.remove();
      curMedia = newEl;

      document.querySelectorAll('#lb-inner-dots .lb-dot').forEach((d, di) => {
        d.classList.toggle('active', di === innerIdx);
      });
    };

    if (hasMultiple) {
      document.getElementById('lb-inner-prev')?.addEventListener('click', e => {
        e.stopPropagation();
        switchInner(innerIdx - 1);
      });
      document.getElementById('lb-inner-next')?.addEventListener('click', e => {
        e.stopPropagation();
        switchInner(innerIdx + 1);
      });
    }

    box.classList.add('active');
  };

  const closeLightbox = () => {
    const box = document.getElementById('lightbox');
    if (!box) return;
    box.classList.remove('active');
    setTimeout(() => {
      const c = document.getElementById('lightbox-content');
      if (c) c.innerHTML = '';
    }, 200);
  };

  const prevItem = () => {
    const items = s().galleryItems;
    if (!items.length) return;
    openLightboxByIndex((s().currentIndex - 1 + items.length) % items.length);
  };

  const nextItem = () => {
    const items = s().galleryItems;
    if (!items.length) return;
    openLightboxByIndex((s().currentIndex + 1) % items.length);
  };

  const onKeydown = (e) => {
    const box = document.getElementById('lightbox');
    if (!box || !box.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (!s().uiEnableLightboxNav) return;
    if (e.key === 'ArrowLeft')  prevItem();
    if (e.key === 'ArrowRight') nextItem();
  };

  /* ── Tilt effect ──────────────────────────────────────── */
  const setupTilt = () => {
    let last = 0;
    document.addEventListener('mousemove', (e) => {
      const now = performance.now();
      if (now - last < 16) return;
      last = now;

      document.querySelectorAll('.tilt-card').forEach(card => {
        const rect = card.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right ||
            e.clientY < rect.top  || e.clientY > rect.bottom) {
          const inner = card.querySelector('.card-inner');
          if (inner) inner.style.transform = 'rotateX(0deg) rotateY(0deg)';
          return;
        }
        const rotateX = ((e.clientY - rect.top  - rect.height / 2) / (rect.height / 2)) * -3;
        const rotateY = ((e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2)) *  3;
        const inner = card.querySelector('.card-inner');
        if (inner) inner.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      });
    });
  };

  /* ── Media upload / delete ────────────────────────────── */
  const uploadMedia = async () => {
    const fileInput = document.getElementById('upload-media');
    const files = fileInput?.files;
    if (!files || files.length === 0) return alert('Select file(s) first!');

    const btn = document.getElementById('btn-upload-media');
    const total = files.length;
    let successCount = 0;
    let failCount = 0;

    for (let idx = 0; idx < total; idx++) {
      const file = files[idx];
      if (btn) { btn.innerText = `Uploading ${idx + 1}/${total}…`; btn.disabled = true; }

      try {
        const ext  = file.name.split('.').pop();
        const name = `media_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
        const { error } = await core._supabase.storage.from(core._ASSETS_BUCKET).upload(name, file, { upsert: true });
        if (error) throw error;

        const { data }  = core._supabase.storage.from(core._ASSETS_BUCKET).getPublicUrl(name);
        const mediaUrl  = data.publicUrl;
        const autoType  = core.isVideoUrl(mediaUrl) ? 'video' : 'image';

        const { error: insErr } = await core._supabase.from('gallery')
          .insert([{ image_url: mediaUrl, title: '', description: '', tags: '', media_type: autoType }]);
        if (insErr) throw insErr;

        successCount++;
      } catch (e) {
        failCount++;
        console.error('Upload failed for', file.name, e);
      }
    }

    if (btn) {
      btn.innerText = failCount === 0
        ? `Done! ${successCount} uploaded`
        : `Done: ${successCount} ok, ${failCount} failed`;
      btn.disabled = false;
      setTimeout(() => { btn.innerText = 'Upload to Gallery'; }, 3000);
    }

    if (successCount > 0) await core.fetchContentAndGallery();
    if (failCount > 0) alert(`${failCount} file(s) failed to upload.`);
  };

  const deleteMedia = async (id) => {
    const { error } = await core._supabase.from('gallery').delete().eq('id', id);
    if (error) return alert(error.message);
    core.fetchContentAndGallery();
  };

  /* ── Register on core ─────────────────────────────────── */
  Object.assign(core, {
    renderGallery,
    setupTilt,
    openLightbox,
    openLightboxByIndex,
    closeLightbox,
    onKeydown,
    uploadMedia,
    deleteMedia
  });
})();
