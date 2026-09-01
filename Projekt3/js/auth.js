// auth.js — centrálna autentifikačná knižnica
// Načítava sa na každej stránke PRED player.js

const SUPABASE_URL = "https://wdjsilryllqksdtmaehy.supabase.co";
const SUPABASE_KEY = "sb_publishable_45gFQhgPScrDjDCVC0B4Iw_q6uZKf9m";

// Inicializácia Supabase klienta pre Auth
// POZOR na try/catch: `supabase` je globálna premenná z knižnice, ktorá sa ťahá
// z CDN. Keď sa knižnica nenačíta (výpadok siete, blokovanie), pôvodné
// `const { createClient } = supabase;` vyhodilo chybu hneď na tomto riadku a
// NIČ ďalšie z auth.js už nevzniklo — vrátane hlásenia chýb aj poistky na konci
// súboru. Stránka potom ostala nemá a v error_log nebolo ani slovo. Takto
// klient síce nebude, ale zvyšok súboru dobehne a hráč sa aspoň dozvie prečo.
let sbClient = null;
try {
  sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) {
  console.error('Knižnica Supabase sa nenačítala:', e);
}

// ─── Pomocné funkcie ──────────────────────────────────────────────────────────

function getCurrentUser() {
  return {
    id: sessionStorage.getItem('user_id'),
    email: sessionStorage.getItem('user_email'),
    role: sessionStorage.getItem('user_role'),
    nick: sessionStorage.getItem('user_nick'),
    name: sessionStorage.getItem('user_name'),
    surname: sessionStorage.getItem('user_surname')
  };
}

function isLoggedIn() {
  return !!sessionStorage.getItem('user_id');
}

function getUserRole() {
  return sessionStorage.getItem('user_role') || 'hrac';
}

function isAdmin() { return getUserRole() === 'admin'; }
function isTrener() { return getUserRole() === 'trener'; }
function isHlavnyTrener() { return getUserRole() === 'hlavny_trener'; }
function isHrac() { return getUserRole() === 'hrac'; }
function isAdminOrTrener() { return isAdmin() || isTrener() || isHlavnyTrener(); }

async function logout() {
  await sbClient.auth.signOut();
  sessionStorage.clear();
  location.href = 'login.html';
}

// ─── Ochrana stránky ──────────────────────────────────────────────────────────

function requireLogin() {
  if (!isLoggedIn()) {
    location.href = 'login.html';
    return false;
  }
  return true;
}

function requireRole(role) {
  if (!requireLogin()) return false;
  const userRole = getUserRole();
  if (role === 'admin' && !isAdmin()) {
    alert('Prístup len pre administrátora.');
    location.href = 'index.html';
    return false;
  }
  if (role === 'trener' && !isAdminOrTrener()) {
    alert('Prístup len pre trénera alebo administrátora.');
    location.href = 'index.html';
    return false;
  }
  return true;
}

// ─── Obnoviť session zo Supabase (pri F5) ────────────────────────────────────

async function refreshSession() {
  if (isLoggedIn()) return true;

  try {
    const { data } = await sbClient.auth.getSession();
    if (!data.session) return false;

    const userId = data.session.user.id;

    // Načítaj profil cez REST API
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${data.session.access_token}`
        }
      }
    );
    const profiles = await res.json();
    if (!profiles || !profiles.length) return false;
    const profile = profiles[0];

    sessionStorage.setItem('user_id', userId);
    sessionStorage.setItem('user_email', data.session.user.email);
    sessionStorage.setItem('user_role', profile.role);
    sessionStorage.setItem('user_nick', profile.nick_name || '');
    sessionStorage.setItem('user_name', profile.name || '');
    sessionStorage.setItem('user_surname', profile.surname || '');

    return true;
  } catch(e) {
    console.error('refreshSession error:', e);
    return false;
  }
}


// ─── Automatické hlásenie chýb do tabuľky error_log ─────────────────────────
// Každá neočakávaná JS chyba na ktorejkoľvek stránke sa potichu zapíše do
// databázy (stránka, správa, stack, prehliadač, prípadne prihlásený user).
// Admin ich vidí v Table Editore alebo cez SQL. Hlásenie samo nikdy nesmie
// spôsobiť ďalšiu chybu ani spomaliť stránku — všetko je v try/catch a
// obmedzené na max. 5 hlásení na jedno načítanie stránky.
(function () {
  let reportedCount = 0;

  async function reportError(message, stack) {
    try {
      if (reportedCount >= 5) return;
      reportedCount++;

      let token = SUPABASE_KEY;
      try {
        const { data } = await sbClient.auth.getSession();
        if (data?.session?.access_token) token = data.session.access_token;
      } catch (e) {}

      let userId = null;
      try {
        userId = sessionStorage.getItem('user_id') || null;
      } catch (e) {}

      await fetch(`${SUPABASE_URL}/rest/v1/error_log`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          user_id: userId,
          page: (location.pathname || '').slice(0, 200),
          message: String(message || 'neznáma chyba').slice(0, 2000),
          stack: String(stack || '').slice(0, 4000),
          user_agent: (navigator.userAgent || '').slice(0, 300)
        })
      });
    } catch (e) { /* hlásenie chýb nesmie nikdy samo zlyhať nahlas */ }
  }

  window.addEventListener('error', function (ev) {
    reportError(ev.message, ev.error && ev.error.stack);
  });

  window.addEventListener('unhandledrejection', function (ev) {
    const r = ev.reason;
    reportError(r && r.message ? r.message : String(r), r && r.stack);
  });

  // ─── Poistka: načítala sa stránka celá? ───────────────────────────────────
  // Keď výpadok siete zhltne jeden zo súborov — najčastejšie js/player.js —
  // stránka sa vykreslí a vyzerá normálne, ale nefunguje na nej nič. Hráč
  // nevidí dôvod, zavrie to a povie, že „to nejde"; v error_log ostane len
  // následok v tvare „getCurrentPlayer is not defined".
  //
  // Chybu pri sťahovaní súboru bežný listener na 'error' NEZACHYTÍ: taká
  // udalosť nebublá. Loví sa v zachytávacej fáze, teda s tretím parametrom
  // true. Sledujú sa len značky <script> — chýbajúci obrázok figúrky je
  // nepríjemnosť, nie dôvod strašiť hráča pruhom cez pol obrazovky.

  // Ak je na stránke tento súbor, po načítaní musí existovať táto funkcia.
  // Stačí jedna zo súboru: keď chýba ona, chýba celý súbor.
  const KONTROLY = [
    { subor: 'js/player.js',   funkcia: 'sbFetch' },
    { subor: 'js/training.js', funkcia: 'getExcludedPuzzleIds' },
    { subor: 'js/sounds.js',   funkcia: 'playSound' },
    { subor: 'js/koncovky.js', funkcia: 'classifyEndgame' }
  ];

  function ukazPruh() {
    if (document.getElementById('nacitanieChyba')) return;   // stačí raz
    const ciel = document.body || document.documentElement;
    if (!ciel) return;
    const d = document.createElement('div');
    d.id = 'nacitanieChyba';
    d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;'
      + 'padding:10px 14px;background:#fef2f2;border-bottom:2px solid #fca5a5;'
      + 'color:#b91c1c;font:600 14px/1.4 Arial,sans-serif;text-align:center;';
    d.innerHTML = '⚠️ Stránka sa nenačítala celá, preto nemusí fungovať. '
      + '<button type="button" style="margin-left:8px;padding:5px 12px;border:none;'
      + 'border-radius:8px;background:#b91c1c;color:#fff;font-size:13px;'
      + 'cursor:pointer;">Načítať znova</button>';
    d.querySelector('button').onclick = function () { location.reload(); };
    ciel.appendChild(d);
  }

  window.addEventListener('error', function (ev) {
    const el = ev.target;
    // Neošetrená chyba v kóde má za cieľ window — tú rieši listener vyššie
    if (!el || el === window || el.tagName !== 'SCRIPT') return;
    reportError('súbor sa nenačítal: ' + (el.src || '(bez src)'), 'výpadok pri sťahovaní');
    ukazPruh();
  }, true);

  window.addEventListener('load', function () {
    const chyba = [];
    if (typeof supabase === 'undefined' || !sbClient) chyba.push('knižnica Supabase');
    KONTROLY.forEach(function (k) {
      const jeNaStranke = !!document.querySelector('script[src*="' + k.subor + '"]');
      if (jeNaStranke && typeof window[k.funkcia] !== 'function') chyba.push(k.subor);
    });
    if (!chyba.length) return;
    reportError('stránka sa nenačítala celá — chýba: ' + chyba.join(', '), '');
    ukazPruh();
  });
})();
