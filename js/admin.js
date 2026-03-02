/* =========================================================
   admin.js — Admin panel: branding, hero, links, loader,
              UI options, assets upload, media modal
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
  const openMediaModal = (item) => {
    s().editingMediaId = item.id;

    const url = item.image_url || '';
    const isVid = core.isVideoUrl(url);

    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };

    setVal('amm-url',            url);
    setVal('amm-title',          item.title || '');
    setVal('amm-desc',           item.description || '');
    setVal('amm-tags',           item.tags || '');
    setVal('amm-category',       item.category || '');
    setVal('amm-custom-wa',      item.custom_wa_message || '');
    setVal('amm-additional',     item.additional_media || '');

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
    const category          = getVal('amm-category');
    const custom_wa_message = getVal('amm-custom-wa');
    const additional_media  = getVal('amm-additional');

    const { error } = await sb().from('gallery')
      .update({ title, description, tags, category, custom_wa_message, additional_media })
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

  /* ── Register on core ─────────────────────────────────── */
  Object.assign(core, {
    loadAdminData,
    saveBranding,
    saveHero,
    saveLinks,
    saveWhatsAppSettings,
    saveLoader,
    saveUI,
    uploadLogo,
    uploadWallpaper,
    openMediaModal,
    closeMediaModal,
    copyMediaUrl,
    saveMediaModal,
    deleteMediaFromModal
  });
})();
