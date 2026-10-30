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
//  POSTUP sa ukladá do databázy (tabuľky kniha_postup a kniha_test, pozri
//  knihy-postup.sql) LEN cez funkcie kniha_zapis_ulohu a kniha_zapis_test.
//  Tie lepší výsledok nikdy neprepíšu horším a v teste nechajú prvú odpoveď.
//  Kópia postupu ostáva aj v prehliadači (kľúč kniha_<kniha>_<user_id>):
//  keď databáza nie je dostupná, kniha funguje z kópie a čo sa neodoslalo,
//  pošle sa pri ďalšom otvorení. Do training_log sa NEZAPISUJE, ELO sa nemení.
//
//  TEST: počíta sa prvá odpoveď. „Začať test odznova“ začne nový pokus
//  (pokus 2, 3, …); staré pokusy ostávajú v databáze pre trénera.
//
//  ODOMYKANIE: kapitola sa hráčovi odomkne, keď vyrieši všetky úlohy
//  predchádzajúcej kapitoly; test po dokončení poslednej kapitoly.
//  Tréneri, hlavný tréner a admin majú otvorené všetko. Tester ostáva hráčom —
//  odomyká sa mu postupne ako ostatným.
//
//  Pri otvorení zo súboru (dvojklik, adresa file://) sa prihlásenie preskočí,
//  všetko je otvorené a postup sa ukladá len v prehliadači (kľúč „lokalne“).
//
//  Potrebuje: js/auth.js, js/player.js (sbFetch, vyzadujBezUdrzby,
//             vyzadujPlatnost, hlasPritomnost).
// ============================================================================

(window.VERZIE = window.VERZIE || {})['knihy.js'] = '2026-10-30d';

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
      verzia: '2026-10-29c',
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
      // cislo = číslo „kapitoly“ testu v obsahu (úlohy 12.1 – 12.30)
      test: { nazov: 'Test zo stratégie 1', subor: 'test.js', cislo: 12, uloh: 30, hranica: 24, odznak: 'Stratég 1' }
    },
    // 2. diel vzniká po kapitolách: v zozname sú len hotové kapitoly, test sa pripravuje.
    //  vlastnyPristup: riadi sa len riadkom 'knihy:cesta-stratega-2' (nie spoločným 'knihy'),
    //  takže kým ho admin nepridá, vidí 2. diel len admin a testeri.
    'cesta-stratega-2': {
      nazov: 'Cesta stratéga',
      diel: '2. diel',
      popis: 'Stratégia pre hráčov do 1600 Elo',
      ikona: '🧭',
      priecinok: 'js/knihy/cesta-stratega-2/',
      verzia: '2026-10-30d',
      vlastnyPristup: true,
      kapitoly: [
        { cislo: 1,  nazov: 'Súperov plán – profylaxia',        subor: 'k01.js' },
        { cislo: 2,  nazov: 'Materiál verzus aktivita',         subor: 'k02.js' },
        { cislo: 3,  nazov: 'Útok na kráľa – oslabiť a otvoriť', subor: 'k03.js' }
      ],
      ulohVKapitole: 5,
      test: { nazov: 'Test zo stratégie 2', subor: 'test.js', cislo: 12, uloh: 30, hranica: 24, odznak: 'Stratég 2',
              pripravuje: true }
    }
  };
  const PRVA = Object.keys(KNIHY)[0];

  function jeLokalne() { return location.protocol === 'file:'; }
  function rola() { return sessionStorage.getItem('user_role') || ''; }
  function jePersonal(r) { return PERSONAL.includes(r === undefined ? rola() : r); }
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
    const n = await nastavenia(), b = KNIHY[kniha] || {};
    if (b.vlastnyPristup) return n['knihy:' + kniha] || 'admin';
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
  async function pristupKKnihe(kniha, r) {
    if (!KNIHY[kniha]) return false;
    r = r || rola();
    if (r === 'admin') return true;
    const u = await uroven(kniha);
    if (u === 'vsetci') return true;
    if (u === 'personal' && PERSONAL.includes(r)) return true;
    return jeTester();
  }

  // Vidí aspoň jednu knihu? (podľa toho sa ukáže menu Knihy)
  async function pristup(r) {
    for (const k of Object.keys(KNIHY)) {
      if (await pristupKKnihe(k, r)) return true;
    }
    return false;
  }

  // Oznam namiesto obsahu stránky (kniha sa pripravuje, zamknutá kapitola…)
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

  // ── Postup ──────────────────────────────────────────────────────────────
  //  Tvar postupu (v pamäti aj v kópii v prehliadači):
  //  { verzia: 2, casti: {
  //      k1: { hviezdy: { '1.0': 3, '1.1': 2, … } }, …,
  //      test: { pokus: 2, body: { '12.1': 1, '12.2': 0, … },      ← práve prebiehajúci pokus
  //              predosle: [ { pokus: 1, body: 18, odpovedane: 30 } ] } } }
  //  Kópia z kroku 1 (verzia 1, test bez čísla pokusu) sa číta ako pokus 1.
  function klucLokalne(kniha, userId) {
    return 'kniha_' + kniha + '_' + (userId || 'lokalne');
  }
  function citaj(kluc) {
    try {
      const p = JSON.parse(localStorage.getItem(kluc) || 'null');
      if (p && p.casti) return p;
    } catch (e) { /* prehliadač bez úložiska — číta sa bez neho */ }
    return { verzia: 2, casti: {} };
  }
  function pis(kluc, p) {
    try { localStorage.setItem(kluc, JSON.stringify(p)); } catch (e) {}
  }
  function cisla(kolo) {                    // '3.2' → kapitola 3, úloha 2
    const t = String(kolo).split('.');
    return { kapitola: parseInt(t[0], 10), uloha: parseInt(t[1], 10) };
  }
  function spocitaj(body) {
    const k = Object.keys(body || {});
    return { body: k.filter(x => body[x] === 1).length, odpovedane: k.length };
  }

  // Zápis do databázy — len cez funkcie z knihy-postup.sql
  function zapisUlohu(kniha, kolo, hviezdy, pokusy) {
    const c = cisla(kolo);
    return sbFetch('rpc/kniha_zapis_ulohu', {
      method: 'POST',
      body: JSON.stringify({ p_kniha: kniha, p_kapitola: c.kapitola, p_uloha: c.uloha,
                             p_hviezdy: hviezdy, p_pokusy: pokusy })
    });
  }
  function zapisTest(kniha, pokus, kolo, bod) {
    return sbFetch('rpc/kniha_zapis_test', {
      method: 'POST',
      body: JSON.stringify({ p_kniha: kniha, p_pokus: pokus, p_uloha: cisla(kolo).uloha, p_bod: bod })
    });
  }

  // Postup z databázy: { casti: { k3: { hviezdy } }, pokusy: { 1: { '12.1': 1, … } } }
  async function citajDb(kniha, userId) {
    const q = 'user_id=eq.' + encodeURIComponent(userId) + '&kniha=eq.' + encodeURIComponent(kniha);
    const [ulohy, test] = await Promise.all([
      sbFetch('kniha_postup?' + q + '&select=kapitola,uloha,hviezdy'),
      sbFetch('kniha_test?' + q + '&select=pokus,uloha,bod')
    ]);
    const tc = KNIHY[kniha].test.cislo, casti = {}, pokusy = {};
    (ulohy || []).forEach(r => {
      const c = casti['k' + r.kapitola] = casti['k' + r.kapitola] || { hviezdy: {} };
      c.hviezdy[r.kapitola + '.' + r.uloha] = r.hviezdy;
    });
    (test || []).forEach(r => {
      (pokusy[r.pokus] = pokusy[r.pokus] || {})[tc + '.' + r.uloha] = r.bod;
    });
    return { casti: casti, pokusy: pokusy };
  }

  // Načíta postup: z databázy a z kópie v prehliadači; čo je v kópii lepšie
  // (neodoslané pri výpadku, odohrané v kroku 1), pošle do databázy.
  async function nacitajPostup(kniha, userId) {
    const kluc = klucLokalne(kniha, userId), lok = citaj(kluc);
    const lt = lok.casti.test;
    if (lt) { lt.pokus = lt.pokus || 1; lt.body = lt.body || {}; lt.predosle = lt.predosle || []; }
    if (!userId || jeLokalne()) return lok;

    let db;
    try {
      db = await citajDb(kniha, userId);
    } catch (e) {
      console.warn('Postup v knihe sa nenačítal z databázy, použijem kópiu z prehliadača:', e);
      return lok;
    }

    const spolu = { verzia: 2, casti: {} }, odoslat = [];
    // kapitoly: z každej úlohy lepší výsledok
    const kapitoly = new Set(Object.keys(lok.casti).concat(Object.keys(db.casti)));
    kapitoly.delete('test');
    kapitoly.forEach(c => {
      const a = (lok.casti[c] || {}).hviezdy || {}, b = (db.casti[c] || {}).hviezdy || {}, hv = {};
      new Set(Object.keys(a).concat(Object.keys(b))).forEach(kolo => {
        hv[kolo] = Math.max(a[kolo] || 0, b[kolo] || 0);
        if ((a[kolo] || 0) > (b[kolo] || 0)) odoslat.push(() => zapisUlohu(kniha, kolo, a[kolo], 0));
      });
      spolu.casti[c] = { hviezdy: hv };
    });
    // test: odpovede z kópie, ktoré v databáze chýbajú (prvá odpoveď v databáze má prednosť)
    const pokusy = db.pokusy;
    if (lt) {
      const pb = pokusy[lt.pokus] = pokusy[lt.pokus] || {};
      Object.keys(lt.body).forEach(kolo => {
        if (kolo in pb) return;
        pb[kolo] = lt.body[kolo];
        odoslat.push(() => zapisTest(kniha, lt.pokus, kolo, lt.body[kolo]));
      });
    }
    const cisloPokusov = Object.keys(pokusy).map(Number).filter(n => Object.keys(pokusy[n]).length);
    const pokus = Math.max(1, lt ? lt.pokus : 1, ...cisloPokusov);
    if (cisloPokusov.length || lt) {
      spolu.casti.test = {
        pokus: pokus,
        body: Object.assign({}, pokusy[pokus] || {}),
        predosle: cisloPokusov.filter(n => n !== pokus).sort((x, y) => x - y)
                              .map(n => Object.assign({ pokus: n }, spocitaj(pokusy[n])))
      };
    }
    pis(kluc, spolu);

    // odoslanie na pozadí, po jednom; pri chybe ostane v kópii na budúce
    (async () => {
      for (const f of odoslat) {
        try { await f(); } catch (e) { console.warn('Postup v knihe sa neodoslal, skúsim nabudúce:', e); return; }
      }
    })();
    return spolu;
  }

  // Úložisko jednej časti knihy (cast = 'k1' … 'k11' alebo 'test') pre stránku kapitoly/testu.
  //   nacitaj()            → { hviezdy } alebo { body, pokus, predosle }
  //   uloz(d, udalost)     → zapíše kópiu; udalost = { kolo, vysledok } (kapitola)
  //                          alebo { kolo, bod } (prvá odpoveď v teste) pošle do databázy
  //   novyPokus()          → test: začne nový pokus (staré odpovede ostanú v databáze)
  function ulozisko(kniha, userId, cast, postup) {
    const kluc = klucLokalne(kniha, userId), sDb = !!userId && !jeLokalne();
    postup = postup || citaj(kluc);
    function stav() {
      if (!postup.casti[cast]) postup.casti[cast] = (cast === 'test')
        ? { pokus: 1, body: {}, predosle: [] } : { hviezdy: {} };
      return postup.casti[cast];
    }
    function chyba(e) { console.warn('Postup v knihe sa neuložil do databázy, uloží sa pri ďalšom otvorení:', e); }
    return {
      nacitaj: () => stav(),
      uloz: (d, udalost) => {
        const c = stav();
        if (cast === 'test') c.body = Object.assign({}, d.body || {});
        else c.hviezdy = Object.assign({}, d.hviezdy || {});
        pis(kluc, postup);
        if (!sDb || !udalost) return;
        (cast === 'test'
          ? zapisTest(kniha, c.pokus, udalost.kolo, udalost.bod)
          : zapisUlohu(kniha, udalost.kolo, udalost.vysledok, 1)).catch(chyba);
      },
      pokus: () => stav().pokus || 1,
      predosle: () => (stav().predosle || []).slice(),
      novyPokus: () => {
        const c = stav(), s = spocitaj(c.body);
        if (s.odpovedane) {                     // prázdny pokus sa nepočíta
          c.predosle = (c.predosle || []).concat([Object.assign({ pokus: c.pokus || 1 }, s)]);
          c.pokus = (c.pokus || 1) + 1;
        }
        c.body = {};
        pis(kluc, postup);
      }
    };
  }

  // Súhrn pre obsah knihy: po kapitolách hviezdy a vyriešené úlohy, pri teste body
  function prehlad(kniha, postup) {
    const b = KNIHY[kniha];
    const kapitoly = b.kapitoly.map(k => {
      const hv = (postup.casti['k' + k.cislo] || {}).hviezdy || {};
      let hviezdy = 0, vyriesene = 0;
      for (let u = 1; u <= b.ulohVKapitole; u++) {
        const h = hv[k.cislo + '.' + u] || 0;
        if (h > 0) { vyriesene++; hviezdy += h; }
      }
      return { cislo: k.cislo, nazov: k.nazov, hviezdy: hviezdy, max: 3 * b.ulohVKapitole,
               vyriesene: vyriesene, uloh: b.ulohVKapitole, ukazka: !!hv[k.cislo + '.0'] };
    });
    const t = postup.casti.test || { pokus: 1, body: {}, predosle: [] };
    const s = spocitaj(t.body), pred = t.predosle || [];
    const najlepsi = pred.concat([Object.assign({ pokus: t.pokus || 1 }, s)])
                         .reduce((a, x) => (x.body > a.body ? x : a), { pokus: 0, body: -1 });
    const test = {
      body: s.body, odpovedane: s.odpovedane, pokus: t.pokus || 1, predosle: pred,
      uloh: b.test.uloh, hranica: b.test.hranica,
      najlepsi: najlepsi.body >= 0 ? najlepsi : null
    };
    test.zlozeny = !!test.najlepsi && test.najlepsi.body >= test.hranica;
    return { kapitoly: kapitoly, test: test };
  }

  // Čo je hráčovi otvorené. { kapitoly: { 1: true, 2: false, … }, test, dokoncena(n) }
  function odomknutie(kniha, postup, r) {
    const b = KNIHY[kniha];
    const vsetko = jeLokalne() || jePersonal(r);
    const dokoncena = n => {
      const hv = (postup.casti['k' + n] || {}).hviezdy || {};
      for (let u = 1; u <= b.ulohVKapitole; u++) if (!(hv[n + '.' + u] > 0)) return false;
      return true;
    };
    const kapitoly = {};
    b.kapitoly.forEach((k, i) => {
      kapitoly[k.cislo] = vsetko || i === 0 || dokoncena(b.kapitoly[i - 1].cislo);
    });
    const posledna = b.kapitoly[b.kapitoly.length - 1].cislo;
    const test = !b.test.pripravuje && (vsetko || dokoncena(posledna));
    return { kapitoly: kapitoly, test: test, vsetko: vsetko,
             dokoncena: dokoncena, posledna: posledna };
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

    const obsahUrl = adresaObsahu(kniha);
    let subor, cast, i = -1;
    if (typ === 'test' && b.test.pripravuje) {
      oznam('📚', b.test.nazov + ' sa pripravuje', 'Záverečný test tohto dielu ešte pripravujeme.',
            [{ text: 'Obsah knihy', url: obsahUrl }]);
      return;
    }
    if (typ === 'test') {
      subor = b.test.subor; cast = 'test';
    } else {
      i = b.kapitoly.findIndex(k => k.cislo === p.k);
      if (i < 0) {
        oznam('📚', 'Kapitola sa nenašla', 'Vyber kapitolu v obsahu knihy.',
              [{ text: 'Obsah knihy', url: obsahUrl }]);
        return;
      }
      subor = b.kapitoly[i].subor; cast = 'k' + p.k;
    }

    const userId = pouzivatel();
    let obsah, postup;
    try {
      [obsah, postup] = await Promise.all([nacitajData(kniha, subor), nacitajPostup(kniha, userId)]);
    } catch (e) {
      console.error(e);
      if (typeof reportError === 'function') { try { reportError('kniha: ' + e.message, kniha); } catch (x) {} }
      oznam('⚠️', 'Kapitola sa nenačítala', 'Skontroluj pripojenie a skús stránku načítať znova.',
            [{ text: 'Načítať znova', url: location.href }, { text: 'Obsah knihy', url: obsahUrl }]);
      return;
    }

    // zamknuté kapitoly a test
    const o = odomknutie(kniha, postup);
    if (typ === 'test' && !o.test) {
      oznam('🔒', 'Test je zatiaľ zamknutý',
            'Záverečný test sa odomkne, keď vyriešiš všetky úlohy v kapitole ' + o.posledna + '.',
            [{ text: 'Kapitola ' + o.posledna, url: adresaKapitoly(kniha, o.posledna) },
             { text: 'Obsah knihy', url: obsahUrl }]);
      return;
    }
    if (typ !== 'test' && !o.kapitoly[p.k]) {
      const pred = b.kapitoly[i - 1].cislo;
      oznam('🔒', 'Kapitola ' + p.k + ' je zatiaľ zamknutá',
            'Odomkne sa, keď vyriešiš všetky úlohy v kapitole ' + pred + '.',
            [{ text: 'Kapitola ' + pred, url: adresaKapitoly(kniha, pred) },
             { text: 'Obsah knihy', url: obsahUrl }]);
      return;
    }

    const nav = { obsah: obsahUrl, vsetko: o.vsetko };
    if (typ !== 'test') {
      nav.dalsia = (i + 1 < b.kapitoly.length)
        ? { text: 'Ďalšia kapitola', url: adresaKapitoly(kniha, b.kapitoly[i + 1].cislo),
            zamknute: 'Ďalšia kapitola sa odomkne, keď vyriešiš všetky úlohy tejto kapitoly.' }
        : (b.test.pripravuje ? null
        : { text: 'Na záverečný test', url: adresaTestu(kniha),
            zamknute: 'Záverečný test sa odomkne, keď vyriešiš všetky úlohy tejto kapitoly.' });
    }
    lista(kniha);
    window.spustiKnihu(obsah, ulozisko(kniha, userId, cast, postup), nav);
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
    nacitajPostup: nacitajPostup,
    nacitajData: nacitajData,
    prehlad: prehlad,
    odomknutie: odomknutie,
    ulozisko: ulozisko,
    adresaObsahu: adresaObsahu,
    adresaKapitoly: adresaKapitoly,
    adresaTestu: adresaTestu,
    oznam: oznam,
    spustiStranku: spustiStranku,
    jeLokalne: jeLokalne,
    jePersonal: jePersonal
  };
})();
