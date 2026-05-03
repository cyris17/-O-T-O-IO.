/* =========================================================
   leaderboard.js — Leaderboard (Most Viewed Gallery Items)
   ========================================================= */

const leaderboardModule = (() => {
  const sb = () => core._supabase;

  const rankClass = (i) => {
    if (i === 0) return 'rank-gold';
    if (i === 1) return 'rank-silver';
    if (i === 2) return 'rank-bronze';
    return '';
  };

  const rankEmoji = (i) => {
    if (i === 0) return '🥇';
    if (i === 1) return '🥈';
    if (i === 2) return '🥉';
    return `#${i + 1}`;
  };

  const renderEntries = (containerId, entries) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!entries?.length) {
      el.innerHTML = '<div style="color:rgba(234,246,255,.40);font-size:.85rem;padding:14px 0;">No data yet.</div>';
      return;
    }
    el.innerHTML = entries.map((entry, i) => `
      <div class="leaderboard-entry">
        <div class="leaderboard-rank ${rankClass(i)}">${rankEmoji(i)}</div>
        ${entry.avatar_url && !core.isVideoUrl(entry.avatar_url)
          ? `<img class="leaderboard-avatar" src="${core.escapeHtml(entry.avatar_url)}" alt="${core.escapeHtml(entry.name)}" />`
          : `<div class="leaderboard-avatar" style="background:linear-gradient(135deg,var(--miku),var(--pink));display:flex;align-items:center;justify-content:center;font-weight:950;color:#000;font-size:.9rem;">${core.escapeHtml((entry.name||'?')[0].toUpperCase())}</div>`}
        <div class="leaderboard-info">
          <div class="leaderboard-name">${core.escapeHtml(entry.name || 'Untitled')}</div>
          <div class="leaderboard-stat">${core.escapeHtml(entry.stat)}</div>
        </div>
      </div>
    `).join('');

    gsap.from(`#${containerId} .leaderboard-entry`, {
      opacity: 0, y: 16, duration: 0.5, stagger: 0.06, ease: 'power2.out'
    });
  };

  const load = async () => {
    await loadMostViewed();
  };

  const loadMostViewed = async () => {
    try {
      const { data, error } = await sb().from('gallery')
        .select('title,view_count,image_url')
        .order('view_count', { ascending: false })
        .limit(10);

      if (error) throw error;
      renderEntries('lb-viewed', (data || []).filter(d => (d.view_count || 0) > 0).map(d => ({
        name: d.title || 'Untitled',
        avatar_url: d.image_url,
        stat: `${d.view_count} view${d.view_count !== 1 ? 's' : ''}`
      })));
    } catch (e) {
      console.error('Leaderboard most viewed error:', e);
      renderEntries('lb-viewed', []);
    }
  };

  return { load };
})();
