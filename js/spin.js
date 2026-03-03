/* =========================================================
   spin.js — Improved Spin-to-Win Wheel
   Features: Canvas gradient segments, RAF animation,
   Web Audio sounds, confetti, share card, multiple spin modes,
   streak bonus spins, daily limit per mode
   ========================================================= */

/*
   SQL required in Supabase (see SETUP.md):
   ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS streak_count INT DEFAULT 0;
   ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_visit_date DATE;
   ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS best_streak INT DEFAULT 0;
*/

const spinModule = (() => {
  const DEFAULT_PRIZES = [
    { name: '10% Off',      emoji: '🏷️', color: '#00ffd5', odds: 30 },
    { name: 'Free Item',    emoji: '🎁', color: '#ff4fd8', odds: 5  },
    { name: 'Try Again',    emoji: '🔄', color: '#7c4dff', odds: 35 },
    { name: '₹50 Off',     emoji: '💰', color: '#00ffa8', odds: 15 },
    { name: 'Mystery Prize',emoji: '❓', color: '#ff3b3b', odds: 10 },
    { name: 'JACKPOT',      emoji: '👑', color: '#FFD700', odds: 5  }
  ];

  let isSpinning = false;
  let currentRotation = 0;
  let rafId = null;
  let soundMuted = localStorage.getItem('spin_sound_muted') === '1';

  /* ── Audio context ────────────────────────────────────── */
  let audioCtx = null;
  const getAudioCtx = () => {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
    return audioCtx;
  };

  const playTone = (freq, type = 'sine', dur = 0.06, vol = 0.15, delay = 0) => {
    if (soundMuted) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur);
    } catch {}
  };

  const playTickSound = () => playTone(480 + Math.random() * 80, 'square', 0.04, 0.08);

  const playWinSound = () => {
    [0, 0.12, 0.24, 0.36].forEach((delay, i) => {
      const freqs = [523, 659, 784, 1047];
      playTone(freqs[i], 'sine', 0.18, 0.2, delay);
    });
  };

  const playLoseSound = () => {
    [0, 0.15].forEach((delay, i) => {
      playTone(i === 0 ? 330 : 220, 'sawtooth', 0.22, 0.12, delay);
    });
  };

  const playClickSound = () => playTone(800, 'sine', 0.05, 0.08);

  /* ── Get prizes ───────────────────────────────────────── */
  const getPrizes = () => {
    const prizes = core._state.spinPrizes;
    return (Array.isArray(prizes) && prizes.length) ? prizes : DEFAULT_PRIZES;
  };

  /* ── Canvas: draw wheel ───────────────────────────────── */
  const drawWheel = (rotation = 0) => {
    const canvas = document.getElementById('spin-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const prizes = getPrizes();
    const n = prizes.length;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const r  = Math.min(cx, cy) - 12;
    const arc = (2 * Math.PI) / n;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.translate(-cx, -cy);

    prizes.forEach((prize, i) => {
      const start = arc * i - Math.PI / 2;
      const end   = start + arc;
      const midAngle = start + arc / 2;
      const baseColor = prize.color || '#7c4dff';

      /* Gradient fill */
      const gx1 = cx + (r * 0.3) * Math.cos(midAngle);
      const gy1 = cy + (r * 0.3) * Math.sin(midAngle);
      const gx2 = cx + r * Math.cos(midAngle);
      const gy2 = cy + r * Math.sin(midAngle);
      const grad = ctx.createLinearGradient(gx1, gy1, gx2, gy2);
      grad.addColorStop(0, baseColor + 'ee');
      grad.addColorStop(1, adjustColor(baseColor, -40) + 'cc');

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      /* Neon border */
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end);
      ctx.closePath();
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 2;
      ctx.stroke();

      /* Segment divider glow */
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(start), cy + r * Math.sin(start));
      ctx.strokeStyle = 'rgba(255,255,255,.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      /* Text */
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);
      ctx.textAlign = 'right';
      const fontSize = Math.max(9, Math.min(13, 180 / n));
      ctx.font = `bold ${fontSize}px Inter, sans-serif`;

      /* Text shadow */
      ctx.shadowColor = 'rgba(0,0,0,.6)';
      ctx.shadowBlur = 4;

      const emoji = prize.emoji || '';
      const label = emoji ? `${emoji} ${prize.name}` : prize.name;
      ctx.fillStyle = '#fff';
      ctx.fillText(label, r - 14, fontSize / 3);
      ctx.restore();
    });

    ctx.restore();

    /* Outer ring */
    ctx.beginPath();
    ctx.arc(cx, cy, r + 8, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 3;
    ctx.stroke();

    /* LED dots on outer ring */
    const ledCount = 24;
    for (let i = 0; i < ledCount; i++) {
      const angle = (i / ledCount) * 2 * Math.PI + (rotation * Math.PI / 180);
      const ledR = r + 8;
      const lx = cx + ledR * Math.cos(angle);
      const ly = cy + ledR * Math.sin(angle);
      const lit = isSpinning ? (Math.floor(Date.now() / 60 + i) % 3 === 0) : (i % 3 === 0);
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, 2 * Math.PI);
      ctx.fillStyle = lit ? 'rgba(0,255,213,.9)' : 'rgba(255,255,255,.15)';
      if (lit) { ctx.shadowColor = '#00ffd5'; ctx.shadowBlur = 8; }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    /* Center hub */
    const hubGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
    hubGrad.addColorStop(0, 'rgba(30,34,55,.95)');
    hubGrad.addColorStop(1, 'rgba(10,12,22,.98)');
    ctx.beginPath();
    ctx.arc(cx, cy, 28, 0, 2 * Math.PI);
    ctx.fillStyle = hubGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,255,213,.40)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0,255,213,.4)';
    ctx.shadowBlur = isSpinning ? 20 : 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    /* SPIN text */
    ctx.textAlign = 'center';
    ctx.fillStyle = isSpinning ? 'var(--miku, #00ffd5)' : 'rgba(234,246,255,.85)';
    ctx.font = 'bold 8px Inter, sans-serif';
    ctx.fillText('SPIN', cx, cy + 3);

    /* Pointer */
    ctx.save();
    ctx.translate(cx, 8);
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(-10, -2);
    ctx.lineTo(10, -2);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,255,213,.8)';
    ctx.shadowBlur = 16;
    ctx.fill();
    ctx.restore();
  };

  const adjustColor = (hex, amount) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
    const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  /* ── Weighted prize selection ─────────────────────────── */
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

  /* ── Spin count checks ────────────────────────────────── */
  const getTodaySpinCount = async (userId, paymentFilter) => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      let query = core._supabase.from('spin_results')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', today + 'T00:00:00');
      if (paymentFilter === 'free') query = query.is('payment_id', null);
      if (paymentFilter === 'ad') query = query.eq('payment_id', 'ad_watch');
      const { count } = await query;
      return count || 0;
    } catch { return 0; }
  };

  const canSpinFree = async (userId) => {
    const s = core._state;
    if (!s.spinFreeMode) return false;
    const max = s.spinMaxPerDay || 1;
    /* Check streak bonus */
    let bonusSpins = 0;
    try {
      const { data: profile } = await core._supabase.from('user_profiles').select('streak_count').eq('id', userId).single();
      const streak = profile?.streak_count || 0;
      if (streak >= 30) bonusSpins = 5;
      else if (streak >= 14) bonusSpins = 3;
      else if (streak >= 7) bonusSpins = 2;
      else if (streak >= 3) bonusSpins = 1;
    } catch {}
    const count = await getTodaySpinCount(userId, 'free');
    return count < (max + bonusSpins);
  };

  const canSpinAd = async (userId) => {
    const s = core._state;
    if (!s.spinAdEnabled) return false;
    const count = await getTodaySpinCount(userId, 'ad');
    return count < (s.spinAdDailyLimit || 3);
  };

  /* ── RAF-based smooth spin animation ─────────────────── */
  const animateSpin = (targetRotation, onComplete) => {
    const startRotation = currentRotation;
    const totalDelta = targetRotation - startRotation;
    const startTime = performance.now();
    const duration = 5000 + Math.random() * 1500; /* 5-6.5s */

    /* Track ticks for sound */
    const prizes = getPrizes();
    const segAngle = 360 / prizes.length;
    let lastSegIdx = -1;

    const easeOut = (t) => 1 - Math.pow(1 - t, 4);

    const frame = (now) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const easedT = easeOut(t);
      const rot = startRotation + totalDelta * easedT;

      /* Tick sound on each new segment */
      const segIdx = Math.floor(((rot % 360) + 360) % 360 / segAngle) % prizes.length;
      if (segIdx !== lastSegIdx) {
        lastSegIdx = segIdx;
        if (t < 0.9) playTickSound();
      }

      drawWheel(rot);
      currentRotation = rot;

      if (t < 1) {
        rafId = requestAnimationFrame(frame);
      } else {
        currentRotation = targetRotation;
        drawWheel(targetRotation);
        if (onComplete) onComplete();
      }
    };

    rafId = requestAnimationFrame(frame);
  };

  /* ── Update spin buttons ──────────────────────────────── */
  const updateButtons = async () => {
    const wrap = document.getElementById('spin-buttons-wrap');
    if (!wrap) return;
    const s = core._state;
    const user = s.currentUser;

    let html = '';

    if (!user) {
      html = `<button class="spin-btn spin-btn-free" onclick="spinModule.handleSpin('free')">🎰 SPIN (Sign in to play)</button>`;
    } else {
      const [freeOk, adOk] = await Promise.all([canSpinFree(user.id), canSpinAd(user.id)]);

      if (s.spinFreeMode) {
        const freeCount = await getTodaySpinCount(user.id, 'free');
        const max = s.spinMaxPerDay || 1;
        html += `<button class="spin-btn spin-btn-free" onclick="spinModule.handleSpin('free')" ${!freeOk ? 'disabled' : ''}>
          🎰 FREE SPIN ${freeOk ? `(${Math.max(0, max - freeCount)} left today)` : '— Come back tomorrow!'}
        </button>`;
      }

      if (s.spinAdEnabled) {
        const adCount = await getTodaySpinCount(user.id, 'ad');
        const max = s.spinAdDailyLimit || 3;
        html += `<button class="spin-btn spin-btn-ad" onclick="spinModule.handleSpin('ad')" ${!adOk ? 'disabled' : ''}>
          📺 WATCH AD TO SPIN ${adOk ? `(${Math.max(0, max - adCount)} left today)` : '— Limit reached'}
        </button>`;
      }

      if (s.spinPayEnabled && s.spinRazorpayLink) {
        html += `<button class="spin-btn spin-btn-pay" onclick="spinModule.handleSpin('pay')">
          💳 PAY ${s.spinPriceText || '₹49'} TO SPIN
        </button>`;
      }

      if (!s.spinFreeMode && !s.spinAdEnabled && !s.spinPayEnabled) {
        html = `<button class="spin-btn spin-btn-free" onclick="spinModule.handleSpin('free')">🎰 SPIN NOW</button>`;
      }
    }

    wrap.innerHTML = html;
  };

  /* ── Watch Ad flow ────────────────────────────────────── */
  const watchAdAndSpin = () => {
    return new Promise((resolve, reject) => {
      const s = core._state;
      const adCfg = s.spinAdConfig;
      if (!adCfg?.image_url) {
        /* No ad configured, just resolve immediately */
        resolve();
        return;
      }

      const modal = document.getElementById('spin-ad-modal');
      const imgEl = document.getElementById('spin-ad-img');
      const linkEl = document.getElementById('spin-ad-link');
      const timerEl = document.getElementById('spin-ad-timer');
      const doneEl = document.getElementById('spin-ad-done');
      if (!modal) { resolve(); return; }

      imgEl.src = adCfg.image_url;
      linkEl.href = adCfg.link_url || '#';
      timerEl.style.display = 'block';
      doneEl.style.display = 'none';
      modal.classList.add('active');

      const dur = adCfg.duration || 5;
      let remaining = dur;
      timerEl.textContent = `Watch for ${remaining} second${remaining !== 1 ? 's' : ''}…`;

      const tick = setInterval(() => {
        remaining--;
        if (remaining > 0) {
          timerEl.textContent = `Watch for ${remaining} second${remaining !== 1 ? 's' : ''}…`;
        } else {
          clearInterval(tick);
          timerEl.style.display = 'none';
          doneEl.style.display = 'block';
          setTimeout(() => {
            modal.classList.remove('active');
            resolve();
          }, 1200);
        }
      }, 1000);
    });
  };

  /* ── Main spin handler ────────────────────────────────── */
  const handleSpin = async (mode = 'free') => {
    if (isSpinning) return;
    playClickSound();

    const s = core._state;

    /* Require sign-in */
    if (!s.currentUser) {
      core.requireSignIn('spin');
      return;
    }

    const user = s.currentUser;

    /* Mode: Pay */
    if (mode === 'pay') {
      if (s.spinRazorpayLink) {
        window.location.href = s.spinRazorpayLink;
      }
      return;
    }

    /* Mode: Ad */
    if (mode === 'ad') {
      const adOk = await canSpinAd(user.id);
      if (!adOk) {
        showResult({ name: 'Limit Reached', emoji: '❌' }, false, 'You\'ve used all your ad spins today.');
        return;
      }
      try {
        await watchAdAndSpin();
      } catch {
        return;
      }
    }

    /* Mode: Free */
    if (mode === 'free' || mode === 'ad') {
      if (mode === 'free') {
        const freeOk = await canSpinFree(user.id);
        if (!freeOk) {
          showResult({ name: 'Already Spun!', emoji: '⏰' }, false, 'Come back tomorrow for your free spin!');
          return;
        }
      }
    }

    isSpinning = true;
    updateButtons();
    const { prize, index } = selectPrize();
    const prizes = getPrizes();
    const n = prizes.length;
    const arc = 360 / n;

    /* Target rotation: many full spins + land on prize */
    const normalizedCurrent = ((currentRotation % 360) + 360) % 360;
    const segmentCenter = index * arc + arc / 2;
    const targetOffset = (360 - segmentCenter + 360) % 360;
    const extraSpins = (8 + Math.floor(Math.random() * 4)) * 360;
    const normalizedOffset = (360 - normalizedCurrent) % 360;
    const targetRotation = currentRotation + normalizedOffset + extraSpins + targetOffset;

    /* Animate */
    animateSpin(targetRotation, async () => {
      isSpinning = false;

      const won = (prize.name || '').toLowerCase() !== 'try again' && (prize.name || '').toLowerCase() !== 'limit reached';

      /* Save to DB */
      try {
        const userName = user.user_metadata?.full_name || user.email;
        const paymentId = mode === 'ad' ? 'ad_watch' : null;
        await core._supabase.from('spin_results').insert([{
          user_id: user.id,
          user_name: userName,
          prize_name: prize.name,
          won,
          payment_id: paymentId
        }]);

        /* Update user stats */
        const { data: profile } = await core._supabase
          .from('user_profiles').select('spin_count,spin_wins').eq('id', user.id).single();
        await core._supabase.from('user_profiles').update({
          spin_count: (profile?.spin_count || 0) + 1,
          spin_wins: won ? (profile?.spin_wins || 0) + 1 : (profile?.spin_wins || 0)
        }).eq('id', user.id);
      } catch (e) {
        console.error('Spin save error:', e);
      }

      if (won) {
        playWinSound();
        launchConfetti();
      } else {
        playLoseSound();
      }

      showResult(prize, won);
      updateButtons();
    });
  };

  /* ── Confetti ─────────────────────────────────────────── */
  const launchConfetti = () => {
    const colors = ['#00ffd5', '#ff4fd8', '#7c4dff', '#FFD700', '#ff3b3b', '#00ffa8'];
    for (let i = 0; i < 80; i++) {
      const el = document.createElement('div');
      el.className = 'confetti-particle';
      const color = colors[Math.floor(Math.random() * colors.length)];
      const x = Math.random() * window.innerWidth;
      const dur = 1.8 + Math.random() * 1.6;
      const delay = Math.random() * 0.5;
      el.style.cssText = `
        left:${x}px;top:-10px;
        background:${color};
        width:${6 + Math.random() * 6}px;
        height:${6 + Math.random() * 6}px;
        border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
        animation-duration:${dur}s;
        animation-delay:${delay}s;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), (dur + delay + 0.2) * 1000);
    }
  };

  /* ── Show result ──────────────────────────────────────── */
  const showResult = (prize, won, message) => {
    const resultEl = document.getElementById('spin-result');
    if (!resultEl) return;

    const user = core._state.currentUser;
    const userName = user?.user_metadata?.full_name || user?.email || '';
    const userEmail = user?.email || '';
    const emoji = prize.emoji || (won ? '🎉' : '😔');

    let waAlertHtml = '';
    if (won && core._state.whatsappPhone) {
      const winMsg = encodeURIComponent(
        `�� SPIN WIN ALERT!\nWinner: ${userName} (${userEmail})\nPrize: ${prize.name}\nTime: ${new Date().toLocaleString()}`
      );
      const waUrl = `https://wa.me/${core._state.whatsappPhone.replace(/\D/g, '')}?text=${winMsg}`;
      waAlertHtml = `<a class="btn-wa" href="${waUrl}" target="_blank" rel="noopener" style="display:inline-flex;margin-top:10px;"><i class="fab fa-whatsapp"></i> Claim Prize on WhatsApp</a>`;
    }

    /* Share card (only for wins) */
    let shareHtml = '';
    if (won) {
      const siteUrl = 'https://cyris17.github.io/Cryris/';
      const shareText = encodeURIComponent(`I just won ${emoji} ${prize.name} at Cyris Store! 🎰 Try your luck: ${siteUrl}`);
      const tweetText = encodeURIComponent(`I just won ${emoji} ${prize.name} at Cyris Store! 🎰`);
      shareHtml = `
        <div class="spin-share-card">
          <div class="spin-share-title">🎉 Share Your Win!</div>
          <div class="spin-share-btns">
            <a class="spin-share-btn spin-share-btn-wa" href="https://wa.me/?text=${shareText}" target="_blank" rel="noopener">
              <i class="fab fa-whatsapp"></i> WhatsApp
            </a>
            <a class="spin-share-btn spin-share-btn-tw" href="https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(siteUrl)}" target="_blank" rel="noopener">
              𝕏 Twitter
            </a>
            <button class="spin-share-btn" onclick="navigator.clipboard.writeText('I just won ${emoji} ${prize.name} at Cyris Store! 🎰 Try your luck: ${siteUrl}').then(()=>alert('Copied!'))">
              📋 Copy Link
            </button>
          </div>
          <button class="spin-share-skip" onclick="this.closest('.spin-share-card').style.display='none'">Maybe Later</button>
        </div>`;
    }

    resultEl.style.display = 'block';
    resultEl.innerHTML = `
      <div class="spin-result-box">
        <div class="spin-confetti">${emoji}</div>
        <div class="spin-result-prize">${core.escapeHtml(prize.name)}</div>
        <div style="color:rgba(234,246,255,.65);font-size:.88rem;margin-top:6px;">
          ${message || (won ? '🎉 Congratulations! Contact us to claim your prize.' : '😔 Better luck next time!')}
        </div>
        ${waAlertHtml}
        <button class="btn-soft" style="margin-top:12px;width:auto;padding:10px 18px;" onclick="this.closest('#spin-result').style.display='none'">Close</button>
      </div>
      ${shareHtml}
    `;

    gsap.from(resultEl, { opacity: 0, y: 20, duration: 0.5, ease: 'power3.out' });
  };

  /* ── Mute toggle ──────────────────────────────────────── */
  const toggleMute = () => {
    soundMuted = !soundMuted;
    localStorage.setItem('spin_sound_muted', soundMuted ? '1' : '0');
    const btn = document.getElementById('spin-mute-btn');
    if (btn) btn.textContent = soundMuted ? '🔇 Muted' : '🔊 Sound';
    if (!soundMuted) playClickSound();
  };

  /* ── LED animation loop ───────────────────────────────── */
  let ledAnimFrame = null;
  const startLedAnimation = () => {
    const canvas = document.getElementById('spin-canvas');
    if (!canvas || ledAnimFrame) return;
    const tick = () => {
      if (isSpinning) { ledAnimFrame = requestAnimationFrame(tick); return; }
      drawWheel(currentRotation);
      ledAnimFrame = setTimeout(() => { ledAnimFrame = requestAnimationFrame(tick); }, 100);
    };
    ledAnimFrame = requestAnimationFrame(tick);
  };

  /* ── Init ─────────────────────────────────────────────── */
  const init = () => {
    const canvas = document.getElementById('spin-canvas');
    if (!canvas) return;
    /* Responsive canvas size */
    const size = Math.min(400, window.innerWidth - 80);
    canvas.width = size;
    canvas.height = size;

    /* Init mute button text */
    const muteBtn = document.getElementById('spin-mute-btn');
    if (muteBtn) muteBtn.textContent = soundMuted ? '🔇 Muted' : '🔊 Sound';

    /* Draw after state is loaded */
    setTimeout(() => {
      drawWheel(0);
      startLedAnimation();
      updateButtons();
    }, 600);

    window.addEventListener('resize', () => {
      const s = Math.min(400, window.innerWidth - 80);
      canvas.width = s;
      canvas.height = s;
      drawWheel(currentRotation);
    });
  };

  /* Auto-init */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

  return { handleSpin, drawWheel, init, toggleMute, updateButtons };
})();
