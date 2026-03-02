/* =========================================================
   sections.js — Site sections: fetch, render, CRUD
   ========================================================= */

(() => {
  const sb = () => core._supabase;
  const s  = () => core._state;

  /* ── Fetch sections from Supabase ─────────────────────── */
  const fetchSections = async () => {
    try {
      const { data: sections } = await sb()
        .from('site_sections')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      s().sections = sections || [];
      renderSections();
      renderSectionsAdminList();
      renderNavLinks();
    } catch (e) {
      console.error('Sections fetch error:', e);
    }
  };

  /* ── Render nav links ─────────────────────────────────── */
  const renderNavLinks = () => {
    const nav = document.getElementById('nav-links');
    if (!nav) return;

    const enabled = (s().sections || []).filter(sec => !!sec.enabled);
    const links = [];
    links.push({ id: 'work',     label: 'Work' });
    links.push({ id: 'sections', label: 'Sections' });
    enabled.forEach(sec => links.push({ id: `sec-${sec.slug}`, label: sec.title || sec.slug }));
    links.push({ id: 'contact', label: 'Contact' });

    nav.innerHTML = '';
    links.forEach(l => {
      const el = document.createElement('div');
      el.className = 'nav-link';
      el.innerText = l.label;
      el.onclick = () => document.getElementById(l.id)?.scrollIntoView({ behavior: 'smooth' });
      nav.appendChild(el);
    });

    /* Category filter links */
    (s().galleryCategories || []).forEach(cat => {
      const el = document.createElement('div');
      el.className = 'nav-link nav-link--cat';
      el.textContent = cat;
      el.onclick = () => navigateToCategory(cat);
      nav.appendChild(el);
    });
  };

  /* ── Navigate to a gallery category ──────────────────── */
  const navigateToCategory = (cat) => {
    const work = document.getElementById('work');
    if (work) work.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => {
      if (typeof core.filterGallery === 'function') core.filterGallery(cat);
    }, 350);
  };

  /* ── Render public sections grid ──────────────────────── */
  const renderSections = () => {
    const grid = document.getElementById('sections-grid');
    if (!grid) return;

    const enabled = (s().sections || []).filter(sec => !!sec.enabled);
    grid.innerHTML = '';

    if (!enabled.length) {
      grid.innerHTML = `<div style="grid-column:1 / -1;color:rgba(234,246,255,.55);">No sections enabled. Add some from dashboard.</div>`;
      return;
    }

    enabled.forEach(sec => {
      const el = document.createElement('div');
      el.className = 'sec-card';
      el.id = `sec-${sec.slug}`;
      el.innerHTML = `
        <div class="sub">${core.escapeHtml(sec.subtitle || '')}</div>
        <h3>${core.escapeHtml(sec.title || '')}</h3>
        <div class="txt">${core.escapeHtml(sec.body || '')}</div>
      `;
      grid.appendChild(el);
    });
  };

  /* ── Render admin sections list ───────────────────────── */
  const renderSectionsAdminList = () => {
    const list = document.getElementById('sections-admin-list');
    if (!list) return;

    list.innerHTML = '';
    (s().sections || []).forEach(sec => {
      const card = document.createElement('div');
      card.style.cssText = 'grid-column:span 6;border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:14px;background:rgba(10,12,22,.45);';

      card.innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;">
          <div>
            <div style="font-weight:950;letter-spacing:1px;text-transform:uppercase;font-size:.82rem;">${core.escapeHtml(sec.slug)}</div>
            <div style="margin-top:6px;font-weight:950;font-size:1.05rem;">${core.escapeHtml(sec.title || '')}</div>
            <div style="margin-top:6px;color:rgba(234,246,255,.60);font-size:.86rem;text-transform:uppercase;letter-spacing:1.6px;">${core.escapeHtml(sec.subtitle || '')}</div>
            <div style="margin-top:10px;color:rgba(234,246,255,.65);font-size:.9rem;line-height:1.45;white-space:pre-line;">${core.escapeHtml((sec.body || '').slice(0, 140))}${(sec.body || '').length > 140 ? '…' : ''}</div>
            <div style="margin-top:10px;color:rgba(234,246,255,.55);font-size:.8rem;">enabled: <b>${sec.enabled ? 'true' : 'false'}</b> • sort: <b>${sec.sort_order ?? 0}</b></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;min-width:140px;">
            <button class="btn-soft" type="button" onclick="core.loadSectionToEditor(${sec.id})">Edit</button>
            <button class="btn-danger" type="button" onclick="core.deleteSection(${sec.id})">Delete</button>
          </div>
        </div>
      `;
      list.appendChild(card);
    });
  };

  /* ── Section editor helpers ───────────────────────────── */
  const clearSectionEditor = () => {
    s().editingSectionId = null;
    ['sec-slug', 'sec-title', 'sec-subtitle', 'sec-body'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const enEl = document.getElementById('sec-enabled');
    if (enEl) enEl.value = 'true';
    const sortEl = document.getElementById('sec-sort');
    if (sortEl) sortEl.value = '0';

    const btn = document.getElementById('btn-sec-main');
    if (btn) { btn.innerText = 'Add Section'; btn.onclick = () => core.createSection(); }
  };

  const loadSectionToEditor = (id) => {
    const sec = (s().sections || []).find(x => x.id === id);
    if (!sec) return;
    s().editingSectionId = id;

    const setVal = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v; };
    setVal('sec-slug',     sec.slug     || '');
    setVal('sec-title',    sec.title    || '');
    setVal('sec-subtitle', sec.subtitle || '');
    setVal('sec-body',     sec.body     || '');
    setVal('sec-enabled',  sec.enabled ? 'true' : 'false');
    setVal('sec-sort',     String(sec.sort_order ?? 0));

    const btn = document.getElementById('btn-sec-main');
    if (btn) { btn.innerText = 'Update Section'; btn.onclick = () => core.updateSection(); }
  };

  /* ── CRUD ─────────────────────────────────────────────── */
  const createSection = async () => {
    const slug  = document.getElementById('sec-slug')?.value.trim();
    const title = document.getElementById('sec-title')?.value.trim();
    const subtitle   = document.getElementById('sec-subtitle')?.value.trim();
    const body       = document.getElementById('sec-body')?.value;
    const enabled    = (document.getElementById('sec-enabled')?.value || 'true').toLowerCase() === 'true';
    const sort_order = parseInt(document.getElementById('sec-sort')?.value || '0', 10);

    if (!slug)  return alert('Slug is required.');
    if (!title) return alert('Title is required.');

    const { error } = await sb().from('site_sections').insert([{ slug, title, subtitle, body, enabled, sort_order }]);
    if (error) return alert(error.message);

    alert('Section added!');
    clearSectionEditor();
    fetchSections();
  };

  const updateSection = async () => {
    const id = s().editingSectionId;
    if (!id) return alert('No section loaded.');

    const slug       = document.getElementById('sec-slug')?.value.trim();
    const title      = document.getElementById('sec-title')?.value.trim();
    const subtitle   = document.getElementById('sec-subtitle')?.value.trim();
    const body       = document.getElementById('sec-body')?.value;
    const enabled    = (document.getElementById('sec-enabled')?.value || 'true').toLowerCase() === 'true';
    const sort_order = parseInt(document.getElementById('sec-sort')?.value || '0', 10);

    const { error } = await sb().from('site_sections')
      .update({ slug, title, subtitle, body, enabled, sort_order })
      .eq('id', id);

    if (error) return alert(error.message);
    alert('Section updated!');
    clearSectionEditor();
    fetchSections();
  };

  const deleteSection = async (id) => {
    if (!confirm('Delete this section?')) return;
    const { error } = await sb().from('site_sections').delete().eq('id', id);
    if (error) return alert(error.message);
    alert('Section deleted.');
    fetchSections();
  };

  const reloadSections = async () => {
    await fetchSections();
    alert('Sections refreshed.');
  };

  /* ── Register on core ─────────────────────────────────── */
  Object.assign(core, {
    fetchSections,
    renderSections,
    renderSectionsAdminList,
    renderNavLinks,
    navigateToCategory,
    createSection,
    updateSection,
    deleteSection,
    loadSectionToEditor,
    clearSectionEditor,
    reloadSections
  });
})();
