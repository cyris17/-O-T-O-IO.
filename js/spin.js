/* =========================================================
   spin.js — Spin-to-Win Wheel (Feature 10)
   ========================================================= */

const spinModule = (() => {
  const DEFAULT_PRIZES = [
    { name: '10% Off',      color: '#00ffd5', odds: 30 },
    { name: 'Free Item',    color: '#ff4fd8', odds: 5  },
    { name: 'Try Again',    color: '#7c4dff', odds: 40 },
    { name: '₹50 Off',     color: '#00ffa8', odds: 15 },
    { name: 'Mystery Prize',color: '#ff3b3b', odds: 10 }
  ];

  let isSpinning = false;
  let currentRotation = 0;

  /* ── Get prizes (from state or defaults) ──────────────── */
  const getPrizes = () => {
    const prizes = core._state.spinPrizes;
    return (Array.isArray(prizes) && prizes.length) ? prizes : DEFAULT_PRIZES;
  };

  /* ── Draw wheel on canvas ─────────────────────────────── */
  const drawWheel = () => {
    const canvas = document.getElementById('spin-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const prizes = getPrizes();
    const n = prizes.length;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r  = Math.min(cx, cy) - 10;
    const arc = (2 * Math.PI) / n;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    prizes.forEach((prize, i) => {
      const start = arc * i - Math.PI / 2;
      const end   = start + arc;

      /* Segment */
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = prize.color || '#7c4dff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.25)';
      ctx.lineWidth = 2;
      ctx.stroke();

      /* Text */
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#06060a';
      ctx.font = `bold ${Math.max(10, Math.min(14, 200 / n))}px Inter, sans-serif`;
      ctx.fillText(prize.name, r - 12, 5);
      ctx.restore();
    });

    /* Center circle */
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, 2 * Math.PI);
    ctx.fillStyle = '#05060a';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    /* Pointer triangle at top */
    ctx.save();
    ctx.translate(cx, 0);
    ctx.beginPath();
    ctx.moveTo(0, 14);
    ctx.lineTo(-10, -4);
    ctx.lineTo(10, -4);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,255,213,.6)';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.restore();
  };

  /* ── Weighted random prize selection ──────────────────── */
  const selectPrize = () => {
    const prizes = getPrizes();
    const total = prizes.reduce((sum, p) => sum + (p.odds || 1), 0);
    let rand = Math.random() * total;
    for (let i = 0; i < prizes.length; i++) {
      rand -= (prizes[i].odds || 1);
      if (rand <= 0) return { prize: prizes[i], index: i };
    }
    return { prize: prizes[prizes.length - 1], index: prizes.length - 1 };
  };

  /* ── Check if user can spin today ─────────────────────── */
  const canSpinToday = async (userId) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await core._supabase
        .from('spin_results')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', today + 'T00:00:00');
      return (count || 0) < (core._state.spinMaxPerDay || 1);
    } catch {
      return true;
    }
  };

  /* ── Handle spin button click ─────────────────────────── */
  const handleSpin = async () => {
    if (isSpinning) return;

    const state = core._state;

    /* Paid mode: redirect to payment link */
    if (!state.spinFreeMode && state.spinRazorpayLink) {
      /* Check if returning from payment (#spin-success) */
      if (window.location.hash !== '#spin-success') {
        window.location.href = state.spinRazorpayLink;
        return;
      }
    }

    /* Require sign-in */
    if (!state.currentUser) {
      core.requireSignIn('spin');
      return;
    }

    const user = state.currentUser;

    /* Check daily limit */
    const canSpin = await canSpinToday(user.id);
    if (!canSpin) {
      showResult({ name: 'Already Spun!' }, false, 'You have used your spin for today. Come back tomorrow!');
      return;
    }

    isSpinning = true;
    const btn = document.getElementById('btn-spin');
    if (btn) { btn.disabled = true; btn.classList.add('spin-spinning'); }

    const { prize, index } = selectPrize();
    const prizes = getPrizes();
    const n = prizes.length;
    const arc = 360 / n;

    /* Calculate target rotation so the chosen segment lands at the top pointer */
    const targetSegmentAngle = index * arc + arc / 2;
    const extraSpins = 5 * 360; /* 5 full rotations */
    const targetRotation = currentRotation + extraSpins + (360 - (currentRotation % 360)) + (360 - targetSegmentAngle);

    const canvas = document.getElementById('spin-canvas');
    if (canvas) {
      canvas.style.transition = 'transform 4s cubic-bezier(.17,.67,.12,1)';
      canvas.style.transform = `rotate(${targetRotation}deg)`;
      currentRotation = targetRotation;
    }

    setTimeout(async () => {
      isSpinning = false;
      if (btn) { btn.disabled = false; btn.classList.remove('spin-spinning'); }

      const won = prize.name.toLowerCase() !== 'try again';

      /* Save result to DB */
      try {
        const userName = user.user_metadata?.full_name || user.email;
        await core._supabase.from('spin_results').insert([{
          user_id: user.id,
          user_name: userName,
          prize_name: prize.name,
          won
        }]);

        /* Update user profile spin stats */
        const { data: profile } = await core._supabase
          .from('user_profiles').select('spin_count,spin_wins').eq('id', user.id).single();
        await core._supabase.from('user_profiles').update({
          spin_count: (profile?.spin_count || 0) + 1,
          spin_wins: won ? (profile?.spin_wins || 0) + 1 : (profile?.spin_wins || 0)
        }).eq('id', user.id);
      } catch (e) {
        console.error('Spin save error:', e);
      }

      showResult(prize, won);
    }, 4200);
  };

  /* ── Show result ──────────────────────────────────────── */
  const showResult = (prize, won, message) => {
    const resultEl = document.getElementById('spin-result');
    if (!resultEl) return;

    const user = core._state.currentUser;
    const userName = user?.user_metadata?.full_name || user?.email || '';
    const userEmail = user?.email || '';

    let waAlertHtml = '';
    if (won && core._state.whatsappPhone) {
      const winMsg = encodeURIComponent(
        `🎰 SPIN WIN ALERT!\nWinner: ${userName} (${userEmail})\nPrize: ${prize.name}\nTime: ${new Date().toLocaleString()}`
      );
      const waUrl = `https://wa.me/${core._state.whatsappPhone.replace(/\D/g, '')}?text=${winMsg}`;
      waAlertHtml = `<a class="btn-wa" href="${waUrl}" target="_blank" rel="noopener" style="display:inline-flex;margin-top:10px;"><i class="fab fa-whatsapp"></i> Claim Prize on WhatsApp</a>`;
    }

    resultEl.style.display = 'block';
    resultEl.innerHTML = `
      <div class="spin-result-box">
        <div class="spin-confetti">${won ? '🎉' : '😔'}</div>
        <div class="spin-result-prize">${core.escapeHtml(prize.name)}</div>
        <div style="color:rgba(234,246,255,.65);font-size:.88rem;margin-top:6px;">
          ${message || (won ? 'Congratulations! Contact us to claim your prize.' : 'Better luck next time!')}
        </div>
        ${waAlertHtml}
        <button class="btn-soft" style="margin-top:12px;width:auto;padding:10px 18px;" onclick="this.parentElement.parentElement.style.display='none'">Close</button>
      </div>
    `;

    gsap.from(resultEl, { opacity: 0, y: 20, duration: 0.5, ease: 'power3.out' });
  };

  /* ── Init ─────────────────────────────────────────────── */
  const init = () => {
    const canvas = document.getElementById('spin-canvas');
    if (!canvas) return;
    /* Draw after state is loaded */
    setTimeout(drawWheel, 500);

    /* Redraw if window resizes */
    window.addEventListener('resize', drawWheel);
  };

  /* Auto-init when DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  return { handleSpin, drawWheel, init };
})();
