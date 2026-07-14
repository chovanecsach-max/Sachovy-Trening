// ─────────────────────────────────────────────────────────────────────────────
//  sounds.js — zvukové efekty (Web Audio API), zdieľané všetkými stránkami.
//  Pôvodne inline v training.html; vyčlenené, keď error_log odhalil, že
//  skills.html volal playSound() bez definície (chýbajúca hláška o úspechu).
//  Použitie: <script src="js/sounds.js"></script> a potom playSound('win'|'loss').
// ─────────────────────────────────────────────────────────────────────────────

// ─── Zvuky ───────────────────────────────────────────────────────────────────

let _audioCtx = null;
let _activeOscs = [];   // aktívne oscilátory — pred novým zvukom ich zabijeme
let _keepAlive = null;  // tichý uzol — drží audio stream zahriaty

function getAudioContext() {
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch(e) { return null; }
  }
  return _audioCtx;
}

// Tichý keepalive — bráni prehliadaču uspať audio výstup po dlhšom tichu.
// Bez neho sa pri prebudení streamu môže prehrať zaseknutý starý zvuk.
function ensureKeepAlive(ctx) {
  if (_keepAlive || !ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.0001; // prakticky nepočuteľné
    osc.frequency.value = 30;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    _keepAlive = osc;
  } catch(e) {}
}

// Zabi všetky predchádzajúce oscilátory — žiadne zvyšky z minulých zvukov
function killActiveSounds() {
  for (const osc of _activeOscs) {
    try { osc.stop(0); } catch(e) {}
    try { osc.disconnect(); } catch(e) {}
  }
  _activeOscs = [];
}

// Prebuď AudioContext čo najskôr — pri prvom mousedown na stránke
document.addEventListener('mousedown', () => {
  const ctx = getAudioContext();
  if (ctx) {
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => ensureKeepAlive(ctx)).catch(() => {});
    } else {
      ensureKeepAlive(ctx);
    }
  }
}, { once: true });

function playSound(type) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    // Po dlhšej nečinnosti môže byť context uspatý — prebuď ho.
    // Zvuk naplánuj s malou rezervou (60 ms), aby audio hardware stihol
    // nabehnúť a tóny zazneli postupne, nie zlepené naraz.
    const schedule = () => {
      if (ctx.state !== 'running') return;
      ensureKeepAlive(ctx);   // drž stream zahriaty
      killActiveSounds();      // zabij prípadné zvyšky starých zvukov
      const t0 = ctx.currentTime + 0.06; // rezerva na rozbeh hardvéru
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === 'win') {
        osc.frequency.setValueAtTime(520, t0);
        osc.frequency.setValueAtTime(780, t0 + 0.12);
        gain.gain.setValueAtTime(0.25, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.4);
        osc.start(t0);
        osc.stop(t0 + 0.4);
      } else {
        osc.frequency.setValueAtTime(340, t0);
        osc.frequency.setValueAtTime(200, t0 + 0.15);
        gain.gain.setValueAtTime(0.25, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
        osc.start(t0);
        osc.stop(t0 + 0.35);
      }
      _activeOscs.push(osc);
      osc.onended = () => {
        _activeOscs = _activeOscs.filter(o => o !== osc);
        try { osc.disconnect(); } catch(e) {}
      };
    };

    if (ctx.state === 'suspended') {
      ctx.resume().then(schedule).catch(() => {});
    } else {
      schedule();
    }
  } catch(e) {}
}
