/* =========================================================
   leaderboard.js — Leaderboard (Feature 11) &
                    Website Reviews (Feature 14)
   ========================================================= */

/* ── Leaderboard ──────────────────────────────────────── */
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

  const avatarHtml = (avatarUrl, name) => {
    if (avatarUrl) return `<img class="leaderboard-avatar" src="${core.escapeHtml(avatarUrl)}" alt="${core.escapeHtml(name)}" />`;
    const initials = (name || '?')[0].toUpperCase();
    return `<div class="leaderboard-avatar" style="background:linear-gradient(135deg,var(--miku),var(--pink));display:flex;align-items:center;justify-content:center;font-weight:950;color:#000;font-size:.9rem;">${core.escapeHtml(initials)}</div>`;
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
        ${avatarHtml(entry.avatar_url, entry.name)}
        <div class="leaderboard-info">
          <div class="leaderboard-name">${core.escapeHtml(entry.name || 'Anonymous')}</div>
          <div class="leaderboard-stat">${core.escapeHtml(entry.stat)}</div>
        </div>
      </div>
    `).join('');

    gsap.from(`#${containerId} .leaderboard-entry`, {
      opacity: 0, y: 16, duration: 0.5, stagger: 0.06, ease: 'power2.out'
    });
  };

  const load = async () => {
    await Promise.all([
      loadBuyers(),
      loadSpinWinners(),
      loadTopRaters(),
      loadMostViewed()
    ]);
  };

  const loadBuyers = async () => {
    try {
      const { data } = await sb().from('user_profiles')
        .select('display_name,avatar_url,purchase_count,total_spent')
        .order('purchase_count', { ascending: false })
        .limit(10);

      renderEntries('lb-buyers', (data || []).filter(u => u.purchase_count > 0).map(u => ({
        name: u.display_name || 'Anonymous',
        avatar_url: u.avatar_url,
        stat: `${u.purchase_count} purchase${u.purchase_count !== 1 ? 's' : ''} • ₹${parseFloat(u.total_spent || 0).toLocaleString()} spent`
      })));
    } catch {}
  };

  const loadSpinWinners = async () => {
    try {
      const { data } = await sb().from('spin_results')
        .select('user_name,prize_name,created_at')
        .eq('won', true)
        .order('created_at', { ascending: false })
        .limit(10);

      renderEntries('lb-spins', (data || []).map((r, i) => ({
        name: r.user_name || 'Anonymous',
        avatar_url: null,
        stat: `Won: ${r.prize_name} on ${new Date(r.created_at).toLocaleDateString()}`
      })));
    } catch {}
  };

  const loadTopRaters = async () => {
    try {
      const { data } = await sb().from('product_ratings')
        .select('user_name,user_id');

      if (!data?.length) { renderEntries('lb-raters', []); return; }

      const counts = {};
      data.forEach(r => {
        const key = r.user_id || r.user_name;
        if (!counts[key]) counts[key] = { name: r.user_name, count: 0 };
        counts[key].count++;
      });

      const sorted = Object.values(counts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      renderEntries('lb-raters', sorted.map(u => ({
        name: u.name || 'Anonymous',
        avatar_url: null,
        stat: `${u.count} rating${u.count !== 1 ? 's' : ''} given`
      })));
    } catch {}
  };

  const loadMostViewed = async () => {
    try {
      const { data } = await sb().from('gallery')
        .select('title,view_count,image_url')
        .order('view_count', { ascending: false })
        .limit(10);

      renderEntries('lb-viewed', (data || []).filter(d => d.view_count > 0).map(d => ({
        name: d.title || 'Untitled',
        avatar_url: core.isVideoUrl(d.image_url) ? null : d.image_url,
        stat: `${d.view_count} view${d.view_count !== 1 ? 's' : ''}`
      })));
    } catch {}
  };

  return { load };
})();

/* ── Reviews ──────────────────────────────────────────── */
const reviewsModule = (() => {
  const sb = () => core._supabase;
  let userReviewRating = 0;

  const load = async () => {
    await Promise.all([
      loadReviews(),
      renderWriteForm()
    ]);
  };

  const loadReviews = async () => {
    try {
      const { data } = await sb().from('site_reviews')
        .select('*').order('created_at', { ascending: false });

      const grid = document.getElementById('reviews-grid');
      const overallWrap = document.getElementById('reviews-overall-wrap');

      if (!data?.length) {
        if (grid) grid.innerHTML = '<div style="color:rgba(234,246,255,.40);font-size:.85rem;">No reviews yet. Be the first!</div>';
        return;
      }

      const avg = (data.reduce((sum, r) => sum + r.rating, 0) / data.length).toFixed(1);
      if (overallWrap) {
        overallWrap.innerHTML = `
          <div class="reviews-overall">
            <div class="reviews-big-rating">⭐ ${avg}</div>
            <div>
              <div class="reviews-big-label">Average Rating</div>
              <div class="reviews-big-count">from ${data.length} review${data.length !== 1 ? 's' : ''}</div>
            </div>
          </div>`;
      }

      if (grid) {
        grid.innerHTML = data.map(r => `
          <div class="review-card">
            <div class="review-card-header">
              ${r.avatar_url
                ? `<img class="review-user-avatar" src="${core.escapeHtml(r.avatar_url)}" alt="${core.escapeHtml(r.display_name || '')}" />`
                : `<div class="review-user-avatar" style="background:linear-gradient(135deg,var(--miku),var(--pink));display:flex;align-items:center;justify-content:center;font-weight:950;color:#000;">${core.escapeHtml((r.display_name || '?')[0].toUpperCase())}</div>`}
              <div>
                <div class="review-user-name">${core.escapeHtml(r.display_name || 'Anonymous')}</div>
                <div class="review-date">${new Date(r.created_at).toLocaleDateString()}</div>
              </div>
            </div>
            <div class="review-stars-display">${'★'.repeat(r.rating || 0)}${'☆'.repeat(5 - (r.rating || 0))}</div>
            <div class="review-text">${core.escapeHtml(r.review_text || '')}</div>
          </div>
        `).join('');

        gsap.from('#reviews-grid .review-card', {
          scrollTrigger: { trigger: '#reviews-grid', start: 'top 90%' },
          opacity: 0, y: 20, duration: 0.5, stagger: 0.08, ease: 'power2.out'
        });
      }
    } catch {}
  };

  const renderWriteForm = async () => {
    const wrap = document.getElementById('write-review-wrap');
    if (!wrap) return;

    const user = core._state.currentUser;
    if (!user) {
      wrap.innerHTML = `
        <div class="sign-in-to-review">
          <button class="btn-google" style="width:auto;padding:12px 20px;display:inline-flex;" onclick="core.signInWithGoogle()">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Sign in to Write a Review
          </button>
        </div>`;
      return;
    }

    /* Check if user already submitted a review */
    let existingReview = null;
    try {
      const { data } = await sb().from('site_reviews').select('*').eq('user_id', user.id).single();
      existingReview = data;
    } catch {}

    userReviewRating = existingReview?.rating || 0;

    wrap.innerHTML = `
      <div class="write-review-box">
        <h4>${existingReview ? '✏️ Update Your Review' : '✍️ Write a Review'}</h4>
        <div class="review-star-row" id="review-star-row">
          ${[1,2,3,4,5].map(n => `
            <span class="review-star ${n <= userReviewRating ? 'lit' : ''}" data-rating="${n}">★</span>
          `).join('')}
        </div>
        <textarea id="review-text-input" class="admin-textarea" rows="3" placeholder="Share your experience…" style="margin-bottom:10px;">${core.escapeHtml(existingReview?.review_text || '')}</textarea>
        <button class="btn-action" style="margin-top:0;width:auto;padding:12px 24px;" onclick="reviewsModule.submitReview()">
          ${existingReview ? 'Update Review' : 'Submit Review'}
        </button>
      </div>`;

    /* Star interaction */
    document.querySelectorAll('#review-star-row .review-star').forEach(star => {
      star.addEventListener('click', () => {
        userReviewRating = parseInt(star.dataset.rating);
        document.querySelectorAll('#review-star-row .review-star').forEach((s, i) => {
          s.classList.toggle('lit', i < userReviewRating);
        });
      });
      star.addEventListener('mouseenter', () => {
        const n = parseInt(star.dataset.rating);
        document.querySelectorAll('#review-star-row .review-star').forEach((s, i) => {
          s.classList.toggle('lit', i < n);
        });
      });
      star.addEventListener('mouseleave', () => {
        document.querySelectorAll('#review-star-row .review-star').forEach((s, i) => {
          s.classList.toggle('lit', i < userReviewRating);
        });
      });
    });
  };

  const submitReview = async () => {
    const user = core._state.currentUser;
    if (!user) return alert('Please sign in first.');
    if (!userReviewRating) return alert('Please select a star rating.');

    const text = document.getElementById('review-text-input')?.value?.trim() || '';
    if (!text) return alert('Please write a review.');

    try {
      await sb().from('site_reviews').upsert({
        user_id: user.id,
        display_name: user.user_metadata?.full_name || user.email,
        avatar_url: user.user_metadata?.avatar_url || null,
        rating: userReviewRating,
        review_text: text
      });
      await load();
    } catch (e) {
      alert(e?.message || 'Error submitting review.');
    }
  };

  return { load, submitReview };
})();
