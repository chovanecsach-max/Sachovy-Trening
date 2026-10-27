// ============================================================================
//  knihy.js — interaktívne knihy (Cesta stratéga)
// ----------------------------------------------------------------------------
//  Kniha = kapitoly (ukážka a päť úloh) a záverečný test. Obsah kapitol leží
//  v súboroch js/knihy/<kniha>/kNN.js a test.js. Vyrábajú sa z PGN knihy nástrojom
//  mimo webu — ručne sa neupravujú.
//
//  Stránky:  kniha.html?kniha=cesta-stratega-1            — obsah knihy
//            kniha-kapitola.html?kniha=cesta-stratega-1&k=3 — kapitola
//            kniha-test.html?kniha=cesta-stratega-1         — záverečný test
//
//  PRÍSTUP — rovnako ako pri hrách ho určuje tabuľka nastavenia:
//      riadok 'knihy:<kniha>' (napr. 'knihy:cesta-stratega-1'); keď chýba,
//      spoločný riadok 'knihy'; keď chýba aj ten, vidí knihu len admin.
//      Hodnoty: 'admin'    — len admin
//               'personal' — admin, hlavný tréner a tréneri
//               'vsetci'   — všetci vrátane hráčov
//  Vybraní testeri (tabuľka hry_testeri, admin panel → „Testuje hry“) vidia
//  knihy vždy. Zmena v SQL editore, pozri knihy-pristup.sql.
//
//  POSTUP (krok 1): ukladá sa len v prehliadači, každému používateľovi zvlášť
//  (kľúč kniha_<kniha>_<user_id>). Databáza príde v ďalšom kroku — stránky
//  kapitol volajú len ulozisko().nacitaj() a ulozisko().uloz(), takže sa
//  vymení iba táto časť. Do training_log sa NEZAPISUJE a ELO sa nemení.
//
//  Pri otvorení zo súboru (dvojklik, adresa file://) sa prihlásenie preskočí —
//  kniha sa dá vyskúšať pred nahratím na web (postup pod kľúčom „lokalne“).
//
//  Potrebuje: js/auth.js, js/player.js (sbFetch, vyzadujBezUdrzby,
//             vyzadujPlatnost, hlasPritomnost).
// ============================================================================

(window.VERZIE = window.VERZIE || {})['knihy.js'] = '2026-10-27';

const Knihy = (function () {
  'use strict';

  const PERSONAL = ['admin', 'hlavny_trener', 'trener'];

  // ── Knihy ───────────────────────────────────────────────────────────────
  //  verzia = značka obsahu; pri novom obsahu kapitol ju zmeň, aby prehliadač
  //  nevzal starý súbor z vyrovnávacej pamäte.
  const KNIHY = {
    'cesta-stratega-1': {
      nazov: 'Cesta stratéga',
      diel: '1. diel',
      popis: 'Stratégia pre hráčov do 1400 Elo',
      ikona: '🧭',
      priecinok: 'js/knihy/cesta-stratega-1/',
      verzia: '2026-10-27',
      kapitoly: [
        { cislo: 1,  nazov: 'Najprv súper a bezpečnosť',        subor: 'k01.js' },
        { cislo: 2,  nazov: 'Kto stojí lepšie',                 subor: 'k02.js' },
        { cislo: 3,  nazov: 'Slabý kráľ súpera',                subor: 'k03.js' },
        { cislo: 4,  nazov: 'Slabý pešiak súpera',              subor: 'k04.js' },
        { cislo: 5,  nazov: 'Slabé pole – domov pre jazdca',    subor: 'k05.js' },
        { cislo: 6,  nazov: 'Súperova zlá figúra',              subor: 'k06.js' },
        { cislo: 7,  nazov: 'Vlastný voľný pešiak',             subor: 'k07.js' },
        { cislo: 8,  nazov: 'Zlepši najhoršiu figúru',          subor: 'k08.js' },
        { cislo: 9,  nazov: 'Veže na otvorené stĺpce a 7. rad', subor: 'k09.js' },
        { cislo: 10, nazov: 'Výhodná výmena',                   subor: 'k10.js' },
        { cislo: 11, nazov: 'Vlastné slabiny a ťah s cieľom',   subor: 'k11.js' }
      ],
      ulohVKapitole: 5,
      test: { nazov: 'Test zo stratégie 1', subor: 'test.js', uloh: 30, hranica: 24 }
    }
  };
  const PRVA = Object.keys(KNIHY)[0];

  function jeLokalne() { return location.protocol === 'file:'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // ── Prístup ─────────────────────────────────────────────────────────────
  let _nastavenia = null;            // { 'knihy': 'admin', 'knihy:cesta-stratega-1': ... }
  async function nastavenia() {
    if (_nastavenia === null) {
      try {
        // rovnaký dotaz ako pri hrách (hra-postup.js): 'knihy' aj 'knihy:<kniha>'
        const rows = await sbFetch('nastavenia?kluc=like.knihy*&select=kluc,hodnota') || [];
        _nastavenia = {};
        rows.forEach(r => { _nastavenia[r.kluc] = r.hodnota; });
      } catch (e) {
        console.warn('Nastavenia kníh sa nenačítali, kniha ostáva zatvorená:', e);
        _nastavenia = {};               // pri chybe radšej zatvorené
      }
    }
    return _nastavenia;
  }

  // Komu je kniha otvorená: 'admin' | 'personal' | 'vsetci'
  async function uroven(kniha) {
    const n = await nastavenia();
    return n['knihy:' + kniha] || n['knihy'] || 'admin';
  }

  // Je prihlásený medzi vybranými testermi? Databáza mu povie len o ňom samom.
  let _tester = null;
  async function jeTester() {
    if (_tester !== null) return _tester;
    const userId = sessionStorage.getItem('user_id') || '';
    if (!userId) return (_tester = false);
    try {
      const rows = await sbFetch('hry_testeri?user_id=eq.' + encodeURIComponent(userId) +
                                 '&select=user_id&limit=1');
      _tester = !!(rows && rows.length);
    } catch (e) {
      _tester = false;
    }
    return _tester;
  }

  // Smie prihlásený vidieť túto knihu?
  async function pristupKKnihe(kniha, rola) {
    if (!KNIHY[kniha]) return false;
    rola = rola || sessionStorage.getItem('user_role') || '';
    if (rola === 'admin') return true;
    const u = await uroven(kniha);
    if (u === 'vsetci') return true;
    if (u === 'personal' && PERSONAL.includes(rola)) return true;
    return jeTester();
  }

  // Vidí aspoň jednu knihu? (podľa toho sa ukáže menu Knihy)
  async function pristup(rola) {
    for (const k of Object.keys(KNIHY)) {
      if (await pristupKKnihe(k, rola)) return true;
    }
    return false;
  }

  // Oznam namiesto obsahu stránky (kniha sa pripravuje, chyba načítania…)
  function oznam(ikona, nadpis, text, tlacidla) {
    tlacidla = tlacidla || [{ text: 'Späť na úvod', url: 'index.html' }];
    document.body.innerHTML =
      '<div style="max-width:520px;margin:60px auto;padding:26px;background:#fff;' +
      'border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.08);' +
      'font-family:Arial,sans-serif;text-align:center;color:#111827;">' +
      '<div style="font-size:40px;margin-bottom:10px;">' + ikona + '</div>' +
      '<h2 style="margin:0 0 10px;color:#b45309;">' + esc(nadpis) + '</h2>' +
      '<p style="color:#475569;font-size:15px;line-height:1.5;">' + esc(text) + '</p>' +
      tlacidla.map(t =>
        '<button onclick="location.href=\'' + t.url + '\'" style="margin:14px 4px 0;padding:11px 20px;' +
        'border:none;border-radius:10px;background:#1e3a5f;color:#fff;font-size:14px;' +
        'font-weight:bold;cursor:pointer;">' + esc(t.text) + '</button>').join('') +
      '</div>';
  }

  // Na stránke knihy: ak kniha ešte nie je sprístupnená, ukáže oznam a vráti false.
  async function vyzadujPristup(kniha) {
    if (await pristupKKnihe(kniha)) return true;
    const b = KNIHY[kniha];
    oznam('📚', (b ? b.nazov : 'Kniha') + ' sa pripravuje',
          'Na tejto knihe ešte pracujeme. Čoskoro ju nájdeš v menu Knihy.');
    return false;
  }

  // ── Postup v prehliadači ────────────────────────────────────────────────
  //  { verzia: 1, casti: { k1: { hviezdy: { '1.1': 3, … } }, …, test: { body: { '12.1': 1, … } } } }
  function klucLokalne(kniha, userId) {
    return 'kniha_' + kniha + '_' + (userId || 'lokalne');
  }
  function citaj(kluc) {
    try {
      const p = JSON.parse(localStorage.getItem(kluc) || 'null');
      if (p && p.casti) return p;
    } catch (e) { /* prehliadač bez úložiska — číta sa bez neho */ }
    return { verzia: 1, casti: {} };
  }
  function pis(kluc, p) {
    try { localStorage.setItem(kluc, JSON.stringify(p)); } catch (e) {}
  }

  // Úložisko jednej časti knihy (cast = 'k1' … 'k11' alebo 'test')
  function ulozisko(kniha, userId, cast) {
    const kluc = klucLokalne(kniha, userId);
    return {
      nacitaj: () => citaj(kluc).casti[cast] || {},
      uloz: (d) => {
        const p = citaj(kluc);
        p.casti[cast] = Object.assign({}, d, { naposledy: new Date().toISOString() });
        pis(kluc, p);
      }
    };
  }

  // Súhrn pre obsah knihy: po kapitolách hviezdy a vyriešené úlohy, pri teste body
  function prehlad(kniha, userId) {
    const b = KNIHY[kniha], p = citaj(klucLokalne(kniha, userId));
    const kapitoly = b.kapitoly.map(k => {
      const hv = (p.casti['k' + k.cislo] || {}).hviezdy || {};
      let hviezdy = 0, vyriesene = 0;
      Object.keys(hv).forEach(kolo => {
        if (/\.0$/.test(kolo)) return;               // ukážka sa nepočíta
        vyriesene++; hviezdy += hv[kolo] || 0;
      });
      return { cislo: k.cislo, nazov: k.nazov, hviezdy: hviezdy, max: 3 * b.ulohVKapitole,
               vyriesene: vyriesene, uloh: b.ulohVKapitole, ukazka: !!hv[k.cislo + '.0'] };
    });
    const body = (p.casti.test || {}).body || {};
    const odpovede = Object.keys(body);
    const test = {
      body: odpovede.filter(k => body[k] === 1).length,
      odpovedane: odpovede.length,
      uloh: b.test.uloh,
      hranica: b.test.hranica
    };
    test.zlozeny = test.body >= test.hranica;
    return { kapitoly: kapitoly, test: test };
  }

  // ── Stránky ─────────────────────────────────────────────────────────────
  function parametre() {
    const q = new URLSearchParams(location.search);
    const kniha = q.get('kniha') || PRVA;
    return { kniha: kniha, k: parseInt(q.get('k') || '', 10) };
  }
  function adresaObsahu(kniha) { return 'kniha.html?kniha=' + encodeURIComponent(kniha); }
  function adresaKapitoly(kniha, n) { return 'kniha-kapitola.html?kniha=' + encodeURIComponent(kniha) + '&k=' + n; }
  function adresaTestu(kniha) { return 'kniha-test.html?kniha=' + encodeURIComponent(kniha); }

  // Prihlásenie, údržba, platnosť a prístup. Vráti true, keď sa môže pokračovať.
  async function prihlasenie(kniha) {
    if (jeLokalne()) return true;                     // test zo súboru
    const ok = await refreshSession();
    if (!ok) { location.href = 'login.html'; return false; }
    if (!await vyzadujBezUdrzby()) return false;
    if (!await vyzadujPlatnost()) return false;
    if (!await vyzadujPristup(kniha)) return false;
    hlasPritomnost();
    return true;
  }
  function pouzivatel() {
    return jeLokalne() ? '' : (sessionStorage.getItem('user_id') || '');
  }

  // Obsah kapitoly alebo testu: súbor js/knihy/<kniha>/kNN.js sa pridá ako <script>
  // (funguje na webe aj pri otvorení zo súboru, kde fetch nejde).
  function nacitajData(kniha, subor) {
    const b = KNIHY[kniha], kluc = kniha + '/' + subor.replace(/\.js$/, '');
    const hotove = (window.KNIHA_DATA || {})[kluc];
    if (hotove) return Promise.resolve(hotove);
    return new Promise((ok, chyba) => {
      const s = document.createElement('script');
      s.src = b.priecinok + subor + '?v=' + encodeURIComponent(b.verzia);
      s.onload = () => {
        const d = (window.KNIHA_DATA || {})[kluc];
        if (d) ok(d); else chyba(new Error('v súbore ' + subor + ' chýba obsah'));
      };
      s.onerror = () => chyba(new Error('súbor ' + b.priecinok + subor + ' sa nenačítal'));
      document.head.appendChild(s);
    });
  }

  // Horná lišta stránky kapitoly a testu
  function lista(kniha) {
    const b = KNIHY[kniha];
    const h1 = document.getElementById('kniha-nazov');
    if (h1) h1.textContent = b.nazov + ' · ' + b.diel;
    const o = document.getElementById('tl-obsah');
    if (o) o.addEventListener('click', () => { location.href = adresaObsahu(kniha); });
    const d = document.getElementById('tl-domov');
    if (d) d.addEventListener('click', () => { location.href = 'index.html'; });
  }

  // Spustí stránku kapitoly (typ 'kapitola') alebo testu (typ 'test').
  // Samotný priebeh je v stránke: window.spustiKnihu(obsah, ulozisko, nav).
  async function spustiStranku(typ) {
    const p = parametre(), kniha = p.kniha, b = KNIHY[kniha];
    if (!b) { oznam('📚', 'Kniha sa nenašla', 'Táto kniha neexistuje. Vyber ju v menu Knihy.'); return; }
    if (!await prihlasenie(kniha)) return;

    let subor, cast, nav = { obsah: adresaObsahu(kniha) };
    if (typ === 'test') {
      subor = b.test.subor; cast = 'test';
    } else {
      const i = b.kapitoly.findIndex(k => k.cislo === p.k);
      if (i < 0) {
        oznam('📚', 'Kapitola sa nenašla', 'Vyber kapitolu v obsahu knihy.',
              [{ text: 'Obsah knihy', url: adresaObsahu(kniha) }]);
        return;
      }
      subor = b.kapitoly[i].subor; cast = 'k' + p.k;
      nav.dalsia = (i + 1 < b.kapitoly.length)
        ? { text: 'Ďalšia kapitola', url: adresaKapitoly(kniha, b.kapitoly[i + 1].cislo) }
        : { text: 'Na záverečný test', url: adresaTestu(kniha) };
    }
    lista(kniha);
    let obsah;
    try {
      obsah = await nacitajData(kniha, subor);
    } catch (e) {
      console.error(e);
      if (typeof reportError === 'function') { try { reportError('kniha: ' + e.message, kniha); } catch (x) {} }
      oznam('⚠️', 'Kapitola sa nenačítala', 'Skontroluj pripojenie a skús stránku načítať znova.',
            [{ text: 'Načítať znova', url: location.href }, { text: 'Obsah knihy', url: adresaObsahu(kniha) }]);
      return;
    }
    window.spustiKnihu(obsah, ulozisko(kniha, pouzivatel(), cast), nav);
  }

  return {
    KNIHY: KNIHY,
    pristup: pristup,
    pristupKKnihe: pristupKKnihe,
    uroven: uroven,
    jeTester: jeTester,
    vyzadujPristup: vyzadujPristup,
    prihlasenie: prihlasenie,
    pouzivatel: pouzivatel,
    parametre: parametre,
    prehlad: prehlad,
    ulozisko: ulozisko,
    adresaObsahu: adresaObsahu,
    adresaKapitoly: adresaKapitoly,
    adresaTestu: adresaTestu,
    oznam: oznam,
    spustiStranku: spustiStranku,
    jeLokalne: jeLokalne
  };
})();
