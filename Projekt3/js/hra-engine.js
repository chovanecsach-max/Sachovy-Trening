// ============================================================================
//  hra-engine.js — herný rámec pre hry zručností (prvá hra: Šachový trh)
// ----------------------------------------------------------------------------
//  Rámec nevie nič o konkrétnej hre. Dostane obsah (napr. OBSAH_TRH z
//  trh-obsah.js) a postará sa o všetko ostatné:
//    • mapa kapitol, odomykanie, hviezdičky, zošit pravidiel,
//    • úvod kapitoly so sprievodcom Grošíkom,
//    • úlohy (typy: vazenie, obchod, anonie, kolko, pasca, najdi),
//    • body: správne +10, chyba −5, séria 5 správnych +10, úloha Nájdi
//      všetky bez chyby +10; skóre kapitoly neklesne pod nulu,
//    • po odpovedi rebrík výmeny na šachovnici (RebrikVymeny).
//
//  Správne odpovede pri úlohách so šachovnicou počíta VŽDY VisionCore —
//  rovnako ako generátor úloh. Obsah hry ich neurčuje.
//
//  POSTUP HRÁČA sa zatiaľ ukladá do prehliadača (localStorage). V kroku 5
//  pribudne tabuľka v databáze, aby postup videl aj tréner.
//
//  Potrebuje: js/vision-core.js, js/rebrik-vymeny.js (a voliteľne sounds.js).
//  Spustenie: HraEngine.spusti({ obsah, koren, rola, userId, testovaci })
// ============================================================================

const HraEngine = (function () {
  'use strict';

  const VC = VisionCore;
  const RV = RebrikVymeny;
  const esc = RV.esc;
  const znak = RV.znak;

  // ── Pravidlá bodovania (podľa scenára knihy) ──────────────────────────
  const BODY_SPRAVNE    = 10;
  const BODY_CHYBA      = -5;
  const BONUS_BEZ_CHYBY = 10;    // úloha Nájdi všetky vyriešená úplne a bez chyby
  const BONUS_SERIA     = 10;    // za každých 5 správnych odpovedí za sebou
  const DLZKA_SERIE     = 5;
  const HVIEZDY_3       = 0.9;   // podiel z maxima bodov
  const HVIEZDY_2       = 0.7;
  const ROLY_TRENEROV   = ['admin', 'hlavny_trener', 'trener'];

  const MENO_FIGURKY = { K: 'kráľ', Q: 'dáma', R: 'veža', B: 'strelec', N: 'jazdec', P: 'pešiak' };
  const MENO_FIGURKY_4 = { K: 'kráľa', Q: 'dámu', R: 'vežu', B: 'strelca', N: 'jazdca', P: 'pešiaka' };

  let O = null;             // obsah hry
  let koren = null;         // DOM prvok, do ktorého sa hra kreslí
  let nast = {};            // { rola, userId, testovaci, cestaObrazkov }
  let postup = null;        // uložený postup hráča
  let stav = null;          // rozohraná kapitola

  // ════════════════════════════════════════════════════════════════════
  //  Spustenie a postup
  // ════════════════════════════════════════════════════════════════════
  function spusti(moznosti) {
    O = moznosti.obsah;
    koren = moznosti.koren;
    nast = {
      rola: moznosti.rola || '',
      userId: moznosti.userId || '',
      testovaci: !!moznosti.testovaci,
      cestaObrazkov: moznosti.cestaObrazkov || 'img/Pieces/'
    };
    postup = nacitajPostup();
    skontrolujObsah();
    ukazMapu();
  }

  function jeTrener() { return ROLY_TRENEROV.includes(nast.rola); }
  function vidiTrenerskeRamceky() { return jeTrener() || nast.testovaci; }

  function klucPostupu() { return 'hra_' + O.kluc + '_' + (nast.userId || 'lokalne'); }

  function nacitajPostup() {
    try {
      const raw = localStorage.getItem(klucPostupu());
      if (raw) {
        const p = JSON.parse(raw);
        if (p && p.kapitoly) return p;
      }
    } catch (e) { /* prehliadač bez úložiska — hrá sa bez ukladania */ }
    return { verzia: 1, kapitoly: {} };
  }

  function ulozPostup() {
    try { localStorage.setItem(klucPostupu(), JSON.stringify(postup)); } catch (e) {}
  }

  function postupKapitoly(k) {
    return postup.kapitoly[k.cislo] || { dokoncene: false, hviezdy: 0, najlepsie: 0 };
  }

  function maObsah(k) { return k.ulohy && k.ulohy.length > 0; }

  function jeOdomknuta(k) {
    if (jeTrener()) return true;
    const i = O.kapitoly.indexOf(k);
    if (i <= 0) return true;
    return postupKapitoly(O.kapitoly[i - 1]).dokoncene;
  }

  // Výpis rozporu medzi scenárom a výpočtom — pre autora obsahu
  function skontrolujObsah() {
    O.kapitoly.forEach(k => (k.ulohy || []).forEach(u => {
      if (u.ocakavane === undefined || !u.fen) return;
      const poz = VC.parseFen(u.fen);
      let vypocet;
      if (u.typ === 'najdi') vypocet = VC.braniaSoZiskom(poz.board, poz.state).riesenia;
      else if (u.tah) vypocet = VC.seeWithPins(poz.board, VC.sqIndex(u.tah.slice(0, 2)), VC.sqIndex(u.tah.slice(2, 4)),
                                               VC.pieceColor(poz.board[VC.sqIndex(u.tah.slice(0, 2))]));
      if (JSON.stringify(vypocet) !== JSON.stringify(u.ocakavane)) {
        console.warn('Úloha ' + u.id + ': scenár čaká ' + JSON.stringify(u.ocakavane) +
                     ', výpočet dáva ' + JSON.stringify(vypocet));
      }
    }));
  }

  // ════════════════════════════════════════════════════════════════════
  //  Grošík
  // ════════════════════════════════════════════════════════════════════
  let _grosikId = 0;
  function grosikSvg(nalada) {
    const id = 'grosikZlato' + (++_grosikId);
    const usta = {
      vesely:   '<path d="M44 80 Q60 94 76 80" fill="none" stroke="#3b1d06" stroke-width="4" stroke-linecap="round"/>',
      nadseny:  '<path d="M43 78 Q60 100 77 78 Z" fill="#7c2d12" stroke="#3b1d06" stroke-width="3" stroke-linejoin="round"/>',
      smutny:   '<path d="M46 88 Q60 77 74 88" fill="none" stroke="#3b1d06" stroke-width="4" stroke-linecap="round"/>',
      rozmysla: '<path d="M48 85 Q56 82 72 84" fill="none" stroke="#3b1d06" stroke-width="4" stroke-linecap="round"/>'
    }[nalada] || '';
    return '<svg class="grosik" viewBox="0 0 120 120" aria-hidden="true">' +
      '<defs><radialGradient id="' + id + '" cx="38%" cy="35%" r="70%">' +
      '<stop offset="0%" stop-color="#fef3c7"/><stop offset="55%" stop-color="#fbbf24"/>' +
      '<stop offset="100%" stop-color="#b45309"/></radialGradient></defs>' +
      // čiapka obchodníka
      '<path d="M32 36 Q60 4 88 36 Z" fill="#9a3412"/>' +
      '<rect x="27" y="32" width="66" height="9" rx="4.5" fill="#7c2d12"/>' +
      // minca = tvár
      '<circle cx="60" cy="70" r="40" fill="url(#' + id + ')" stroke="#92400e" stroke-width="4"/>' +
      '<circle cx="60" cy="70" r="31" fill="none" stroke="#d97706" stroke-width="2" stroke-dasharray="3 5"/>' +
      '<circle cx="47" cy="64" r="5.5" fill="#1f2937"/><circle cx="73" cy="64" r="5.5" fill="#1f2937"/>' +
      '<circle cx="45.5" cy="62.5" r="1.8" fill="#fff"/><circle cx="71.5" cy="62.5" r="1.8" fill="#fff"/>' +
      '<circle cx="38" cy="78" r="5" fill="#f87171" opacity=".35"/><circle cx="82" cy="78" r="5" fill="#f87171" opacity=".35"/>' +
      usta + '</svg>';
  }

  function grosikRiadok(nalada, htmlBubliny, idBubliny, velky) {
    return '<div class="grosik-riadok' + (velky ? ' velky' : '') + '">' +
           '<div class="grosik-obal" id="' + (idBubliny ? idBubliny + 'Tvar' : '') + '">' + grosikSvg(nalada) + '</div>' +
           '<div class="bublina"' + (idBubliny ? ' id="' + idBubliny + '"' : '') + '>' + htmlBubliny + '</div></div>';
  }

  function grosikHovori(nalada, html) {
    const b = document.getElementById('hraBublina');
    const t = document.getElementById('hraBublinaTvar');
    if (b) b.innerHTML = html;
    if (t) t.innerHTML = grosikSvg(nalada);
  }

  const POCHVALY = ['Výborne! Dobrý obchod.', 'Presne tak!', 'Máš oko obchodníka.', 'Správne!', 'Tak sa to robí!'];
  function pochvala() { return POCHVALY[Math.floor(Math.random() * POCHVALY.length)]; }

  // ════════════════════════════════════════════════════════════════════
  //  Spoločné časti obrazovky
  // ════════════════════════════════════════════════════════════════════
  function lista(vKapitole) {
    return '<div class="hra-lista">' +
      '<div class="hra-titul"><div class="hra-nazov">' + esc(O.nazov) + '</div>' +
      '<div class="hra-podtitul">' + esc(O.podtitul) + '</div></div>' +
      '<div class="hra-lista-tlacidla">' +
      (vKapitole ? '<button class="secondary" data-akcia="mapa">Kapitoly</button>' : '') +
      '<button class="secondary" data-akcia="menu">Menu</button></div></div>' +
      (nast.testovaci ? '<div class="test-pas">Testovací režim — súbor otvorený z disku. ' +
        'Postup sa ukladá len v tomto prehliadači.</div>' : '');
  }

  function naviazListu() {
    koren.querySelectorAll('[data-akcia="mapa"]').forEach(b => b.onclick = () => { zastavPrehravac(); ukazMapu(); });
    koren.querySelectorAll('[data-akcia="menu"]').forEach(b => b.onclick = () => { location.href = 'index.html'; });
  }

  function hviezdyHtml(n) {
    let h = '';
    for (let i = 0; i < 3; i++) h += '<span class="' + (i < n ? 'hv plna' : 'hv') + '">★</span>';
    return '<span class="hviezdy">' + h + '</span>';
  }

  function figurkyHtml(retazec, biele) {
    return retazec.split('').map(f => {
      const ch = biele === false ? f.toLowerCase() : f.toUpperCase();
      const farba = ch === ch.toUpperCase() ? 'w' : 'b';
      return '<img class="stol-figurka" src="' + nast.cestaObrazkov + farba + ch.toUpperCase() + '.svg" alt="' +
             esc(MENO_FIGURKY[f.toUpperCase()]) + '">';
    }).join('');
  }

  function cenaSkupiny(retazec) {
    return retazec.split('').reduce((s, f) => s + VC.HODNOTA[f.toLowerCase()], 0);
  }

  function menoSkupiny(retazec, pad4) {
    const mena = retazec.split('').map(f => (pad4 ? MENO_FIGURKY_4 : MENO_FIGURKY)[f.toUpperCase()]);
    if (mena.length === 2 && mena[0] === mena[1]) {
      return pad4 ? 'dve ' + ({ 'vežu': 'veže', 'dámu': 'dámy', 'strelca': 'strelcov', 'jazdca': 'jazdcov', 'pešiaka': 'pešiakov' }[mena[0]] || mena[0])
                  : 'dve ' + ({ 'veža': 'veže', 'dáma': 'dámy', 'strelec': 'strelce', 'jazdec': 'jazdce', 'pešiak': 'pešiaky' }[mena[0]] || mena[0]);
    }
    return mena.join(' a ');
  }

  function velkePismeno(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function mince(n) {
    const a = Math.abs(n);
    if (a === 1) return n + ' minca';
    if (a >= 2 && a <= 4) return n + ' mince';
    return n + ' mincí';
  }

  // ════════════════════════════════════════════════════════════════════
  //  Mapa kapitol
  // ════════════════════════════════════════════════════════════════════
  function ukazMapu() {
    stav = null;
    const sObsahom = O.kapitoly.filter(maObsah);
    const hviezd = sObsahom.reduce((s, k) => s + postupKapitoly(k).hviezdy, 0);

    let karty = '';
    O.kapitoly.forEach(k => {
      const p = postupKapitoly(k);
      const obsah = maObsah(k);
      const odomknuta = obsah && jeOdomknuta(k);
      let trieda = 'kapitola-karta';
      let stavText;
      if (!obsah) { trieda += ' pripravujeme'; stavText = 'Pripravujeme'; }
      else if (!odomknuta) { trieda += ' zamknuta'; stavText = 'Najprv dokonči kapitolu ' + (k.cislo - 1); }
      else if (p.dokoncene) { trieda += ' dokoncena'; stavText = 'Najlepšie: ' + p.najlepsie + ' b.'; }
      else stavText = 'Hraj';
      karty += '<button class="' + trieda + '" data-kapitola="' + k.cislo + '"' + (odomknuta ? '' : ' disabled') + '>' +
        '<span class="k-cislo">' + k.cislo + '</span>' +
        '<span class="k-text"><span class="k-nazov">' + esc(k.nazov) + '</span>' +
        '<span class="k-stav">' + esc(stavText) + '</span></span>' +
        (obsah ? hviezdyHtml(p.hviezdy) : '') + '</button>';
    });

    koren.innerHTML = lista(false) +
      '<div class="mapa">' +
      grosikRiadok('vesely', esc(O.pozdrav), null, true) +
      '<div class="mapa-suhrn"><span class="mapa-hviezdy">★ ' + hviezd + ' / ' + (sObsahom.length * 3) + '</span>' +
      '<span class="mapa-tlacidla"><button class="accent" data-akcia="zosit">Zošit pravidiel</button>' +
      '<a class="odkaz-tlacidlo" href="laboratorium.html">Laboratórium výmeny</a></span></div>' +
      '<div class="kapitoly">' + karty + '</div>' +
      (nast.testovaci ? '<div class="test-akcie"><button class="secondary male" data-akcia="vymaz">Vymazať postup (test)</button></div>' : '') +
      '</div>';
    naviazListu();
    koren.querySelectorAll('.kapitola-karta').forEach(b => {
      b.onclick = () => {
        const k = O.kapitoly.find(x => x.cislo === Number(b.dataset.kapitola));
        if (k && maObsah(k) && jeOdomknuta(k)) ukazUvod(k);
      };
    });
    koren.querySelector('[data-akcia="zosit"]').onclick = ukazZosit;
    const vymaz = koren.querySelector('[data-akcia="vymaz"]');
    if (vymaz) vymaz.onclick = () => { postup = { verzia: 1, kapitoly: {} }; ulozPostup(); ukazMapu(); };
    window.scrollTo(0, 0);
  }

  // ════════════════════════════════════════════════════════════════════
  //  Zošit pravidiel
  // ════════════════════════════════════════════════════════════════════
  function ukazZosit() {
    let h = '';
    O.kapitoly.filter(maObsah).forEach(k => {
      const hotova = postupKapitoly(k).dokoncene || jeTrener();
      h += '<div class="zosit-riadok' + (hotova ? '' : ' zamknuty') + '"><span class="k-cislo">' + k.cislo + '</span>' +
           '<div><div class="zosit-kapitola">' + esc(k.nazov) + '</div>' +
           '<div class="zosit-pravidlo">' + (hotova ? esc(k.zapamataj) : 'Pravidlo získaš po dokončení kapitoly.') +
           '</div></div></div>';
    });
    koren.innerHTML = lista(false) +
      '<div class="zosit">' +
      grosikRiadok('vesely', 'Toto sú pravidlá, ktoré si už získal. Obchodník ich má vždy po ruke.', null, false) +
      '<h2>Zošit pravidiel</h2>' + h +
      '<button class="primary" data-akcia="spat">Späť na kapitoly</button></div>';
    naviazListu();
    koren.querySelector('[data-akcia="spat"]').onclick = ukazMapu;
    window.scrollTo(0, 0);
  }

  // ════════════════════════════════════════════════════════════════════
  //  Úvod kapitoly
  // ════════════════════════════════════════════════════════════════════
  function cennikHtml() {
    const riadky = [['P', 'Pešiak', 1], ['N', 'Jazdec', 3], ['B', 'Strelec', 3], ['R', 'Veža', 5], ['Q', 'Dáma', 9], ['K', 'Kráľ', null]];
    return '<div class="cennik">' + riadky.map(([f, meno, cena]) =>
      '<div class="cennik-riadok"><img src="' + nast.cestaObrazkov + 'w' + f + '.svg" alt="">' +
      '<span class="cennik-meno">' + meno + '</span>' +
      '<span class="cennik-cena">' + (cena === null ? 'nepredáva sa'
        : '<span class="minca mala"></span> ' + mince(cena)) + '</span></div>').join('') + '</div>';
  }

  function maxBodovUlohy(u) {
    if (u.typ === 'najdi') {
      const poz = VC.parseFen(u.fen);
      return BODY_SPRAVNE * VC.braniaSoZiskom(poz.board, poz.state).riesenia.length + BONUS_BEZ_CHYBY;
    }
    return BODY_SPRAVNE;
  }

  function ukazUvod(k) {
    const bublina = k.uvod.map(t => '<p>' + t + '</p>').join('') +
                    (k.cennik ? cennikHtml() : '') +
                    (k.uvodKoniec ? '<p>' + k.uvodKoniec + '</p>' : '');
    const max = k.ulohy.reduce((s, u) => s + maxBodovUlohy(u), 0);
    koren.innerHTML = lista(true) +
      '<div class="uvod">' +
      '<div class="uvod-hlava">Kapitola ' + k.cislo + ' · ' + esc(k.nazov) + '</div>' +
      grosikRiadok('vesely', bublina, null, true) +
      (k.prePokrocilych ? '<details class="ramcek"><summary>Pre pokročilých</summary><p>' + esc(k.prePokrocilych) + '</p></details>' : '') +
      (k.preTrenerov && vidiTrenerskeRamceky()
        ? '<details class="ramcek trener"><summary>Pre trénerov</summary><p>' + esc(k.preTrenerov) + '</p></details>' : '') +
      '<div class="uvod-info">Úloh: ' + k.ulohy.length + ' · najviac ' + max + ' bodov · za správnu odpoveď +' +
      BODY_SPRAVNE + ', za chybu ' + znak(BODY_CHYBA) + '</div>' +
      '<button class="primary velke" data-akcia="zacat">Začať úlohy</button></div>';
    naviazListu();
    koren.querySelector('[data-akcia="zacat"]').onclick = () => zacniKapitolu(k);
    window.scrollTo(0, 0);
  }

  // ════════════════════════════════════════════════════════════════════
  //  Priebeh kapitoly
  // ════════════════════════════════════════════════════════════════════
  function zacniKapitolu(k) {
    stav = {
      kapitola: k,
      i: 0,
      skore: 0,
      seria: 0,
      spravnych: 0,
      chyb: 0,
      bonusy: 0,
      max: k.ulohy.reduce((s, u) => s + maxBodovUlohy(u), 0)
    };
    ukazUlohu();
  }

  // Pripočíta body; skóre kapitoly nikdy neklesne pod nulu.
  function pripocitaj(body) {
    stav.skore = Math.max(0, stav.skore + body);
  }

  // Správna odpoveď: body, séria. Vracia text bonusu (alebo '').
  function zapisSpravne() {
    stav.spravnych++;
    pripocitaj(BODY_SPRAVNE);
    stav.seria++;
    let bonus = '';
    if (stav.seria >= DLZKA_SERIE) {
      pripocitaj(BONUS_SERIA);
      stav.bonusy += BONUS_SERIA;
      stav.seria = 0;
      bonus = ' <b>Séria ' + DLZKA_SERIE + ' správnych: bonus +' + BONUS_SERIA + '!</b>';
    }
    zvuk('win');
    obnovHlavu();
    return bonus;
  }

  function zapisChybu() {
    stav.chyb++;
    pripocitaj(BODY_CHYBA);
    stav.seria = 0;
    zvuk('loss');
    obnovHlavu();
  }

  function zvuk(typ) {
    try { if (typeof playSound === 'function') playSound(typ); } catch (e) {}
  }

  function hlavaHtml() {
    const k = stav.kapitola;
    let seria = '';
    for (let i = 0; i < DLZKA_SERIE; i++) seria += '<span class="' + (i < stav.seria ? 'bod plny' : 'bod') + '"></span>';
    return '<span class="uloha-poradie">Kapitola ' + k.cislo + ' · Úloha ' + (stav.i + 1) + ' / ' + k.ulohy.length + '</span>' +
           '<span class="seria" title="Séria správnych odpovedí — každých ' + DLZKA_SERIE + ' = bonus">' + seria + '</span>' +
           '<span class="skore"><span class="minca mala"></span> <span id="hraSkore">' + stav.skore + '</span> b.</span>';
  }

  function obnovHlavu() {
    const el = document.getElementById('hraHlava');
    if (el) el.innerHTML = hlavaHtml();
  }

  // ── Obrazovka úlohy ───────────────────────────────────────────────────
  let sachovnica = null;
  let prehravac = null;

  function zastavPrehravac() {
    if (prehravac) prehravac.zastav();
  }

  function ukazUlohu() {
    zastavPrehravac();
    prehravac = null;
    sachovnica = null;
    const u = stav.kapitola.ulohy[stav.i];
    const naSachovnici = !!u.fen;

    koren.innerHTML = lista(true) +
      '<div class="uloha-obrazovka">' +
      '<div class="uloha-hlava" id="hraHlava">' + hlavaHtml() + '</div>' +
      '<div class="uloha-layout">' +
      '<div class="uloha-lavy">' +
      '<h2 class="zadanie" id="hraZadanie"></h2>' +
      (naSachovnici ? '<div class="board-area"><div class="board" id="hraBoard"></div></div>'
                    : '<div class="stol" id="hraStol"></div>') +
      '<div class="pasik" id="hraPasik" hidden><span id="hraPasikText"></span>' +
      '<span class="ucet" id="hraPasikUcetBox" hidden><span class="minca"></span><span id="hraPasikUcet">0</span></span></div>' +
      '<div class="odpovede" id="hraOdpovede"></div>' +
      '</div>' +
      '<div class="uloha-pravy">' +
      grosikRiadok('rozmysla', 'Rozmýšľaj ako obchodník: čo dostanem a čo zaplatím?', 'hraBublina', false) +
      '<div id="hraSpatna"></div>' +
      '</div></div></div>';
    naviazListu();

    if (naSachovnici) {
      sachovnica = new RV.Sachovnica(document.getElementById('hraBoard'), { cestaObrazkov: nast.cestaObrazkov });
      u._poz = VC.parseFen(u.fen);
      sachovnica.nastav(u._poz.board);
      prehravac = new RV.Prehravac(sachovnica, { onZmena: kresliPrehravanie, rychlost: 1100 });
    }

    const typ = TYPY[u.typ];
    if (!typ) {
      document.getElementById('hraZadanie').textContent = 'Neznámy typ úlohy: ' + u.typ;
      return;
    }
    typ.priprav(u);
    window.scrollTo(0, 0);
  }

  // Tlačidlá pod šachovnicou
  function nastavOdpovede(html, naviaz) {
    const el = document.getElementById('hraOdpovede');
    el.innerHTML = html;
    if (naviaz) naviaz(el);
  }

  // Po vyhodnotení: výsledok a tlačidlo Ďalej / Rozumiem
  function ukazPokracovanie(spravne, textVysledku) {
    const posledna = stav.i >= stav.kapitola.ulohy.length - 1;
    nastavOdpovede(
      '<div class="vysledok ' + (spravne ? 'dobre' : 'zle') + '">' + textVysledku + '</div>' +
      '<button class="primary velke" id="hraDalej">' +
      (spravne ? (posledna ? 'Dokončiť kapitolu' : 'Ďalej') : (posledna ? 'Rozumiem, dokončiť' : 'Rozumiem, ďalej')) +
      '</button>',
      el => {
        el.querySelector('#hraDalej').onclick = () => {
          zastavPrehravac();
          if (posledna) ukazKoniec(); else { stav.i++; ukazUlohu(); }
        };
      });
  }

  // ── Rebrík výmeny po odpovedi ────────────────────────────────────────
  function spustiRebrik(uci) {
    if (!prehravac) return;
    prehravac.nacitaj(stav.kapitola.ulohy[stav.i]._poz.board, uci);
    prehravac.prehraj();
  }

  function kresliPrehravanie(p) {
    // pás pod šachovnicou
    const pasik = document.getElementById('hraPasik');
    if (!pasik) return;
    const text = document.getElementById('hraPasikText');
    const ucetBox = document.getElementById('hraPasikUcetBox');
    const ucetEl = document.getElementById('hraPasikUcet');
    if (!p.rebrik) { pasik.hidden = true; return; }
    pasik.hidden = false;
    ucetBox.hidden = false;
    pasik.className = 'pasik';
    const ucet = p.ucet();
    ucetEl.textContent = znak(ucet);
    ucetEl.className = RV.triedaZnamienka(ucet);
    if (p.jeNaKonci()) {
      const v = p.rebrik.vysledok;
      pasik.className = 'pasik ' + RV.triedaZnamienka(v);
      ucetEl.className = '';
      text.textContent = v > 0 ? 'Branie so ziskom' : (v < 0 ? 'Strata' : 'Výmena — nič nezískaš');
    } else if (p.k === 0) {
      text.textContent = 'Pozrime sa na ' + (p.rebrik.kroky[0] ? p.rebrik.kroky[0].tah : p.uci);
    } else {
      const k = p.rebrik.kroky[p.k - 1];
      text.textContent = 'Krok ' + p.k + '/' + p.pocetKrokov() + ': ' + k.tah + ' — ' +
                         (k.strana === p.strana ? 'beriem ' : 'súper berie ') + k.figurka;
    }
    // tabuľka v paneli
    const tab = document.getElementById('hraRebrikTabulka');
    if (tab) tab.innerHTML = RV.htmlRebrika(p);
    const btn = document.getElementById('hraRebrikPrehraj');
    if (btn) btn.textContent = p.bezi() ? '⏸ Pauza' : '▶ Prehraj znova';
  }

  // Panel s rebríkom (a voliteľne s prepínačom medzi viacerými braniami)
  function panelRebrika(uci, ineMoznosti) {
    const el = document.getElementById('hraSpatna');
    const prepinac = (ineMoznosti && ineMoznosti.length > 1)
      ? '<div class="prepinac">Rebrík pre: ' + ineMoznosti.map(x =>
          '<button class="secondary male' + (x === uci ? ' vybrane' : '') + '" data-uci="' + x + '">' +
          esc(VC.nazovTahu(stav.kapitola.ulohy[stav.i]._poz.board, VC.sqIndex(x.slice(0, 2)), VC.sqIndex(x.slice(2, 4)))) +
          '</button>').join('') + '</div>'
      : '';
    el.innerHTML = '<div class="panel-karta"><h3>Rebrík výmeny</h3>' + prepinac +
      '<div id="hraRebrikTabulka"></div>' +
      '<div class="rebrik-tlacidla">' +
      '<button class="secondary male" id="hraRebrikSpat">◀ Späť</button>' +
      '<button class="secondary male" id="hraRebrikPrehraj">▶ Prehraj znova</button>' +
      '<button class="secondary male" id="hraRebrikDalej">Ďalej ▶</button></div></div>';
    el.querySelectorAll('.prepinac button').forEach(b => b.onclick = () => {
      panelRebrika(b.dataset.uci, ineMoznosti);
      spustiRebrik(b.dataset.uci);
    });
    el.querySelector('#hraRebrikSpat').onclick = () => prehravac.spat();
    el.querySelector('#hraRebrikDalej').onclick = () => { prehravac.zastav(); prehravac.dalej(); };
    el.querySelector('#hraRebrikPrehraj').onclick = () => {
      if (prehravac.bezi()) prehravac.zastav(); else prehravac.prehraj();
    };
  }

  // Statická tabuľka rebríka (bez šachovnice) — pri chybe v úlohe Nájdi všetky
  function statickyRebrik(board, uci) {
    const r = VC.rebrikVymeny(board, uci);
    const p = { rebrik: r, k: r.kroky.length, strana: VC.pieceColor(board[VC.sqIndex(uci.slice(0, 2))]),
                jeNaKonci: () => true };
    return RV.htmlRebrika(p);
  }

  function nazov(u, uci) {
    return VC.nazovTahu(u._poz.board, VC.sqIndex(uci.slice(0, 2)), VC.sqIndex(uci.slice(2, 4)));
  }

  function ziskTahu(u, uci) {
    const z = VC.sqIndex(uci.slice(0, 2)), na = VC.sqIndex(uci.slice(2, 4));
    return VC.seeWithPins(u._poz.board, z, na, VC.pieceColor(u._poz.board[z]));
  }

  // Možnosti pre otázku „Koľko?" — správna a 5 blízkych, zoradené od najväčšej
  function moznostiCisel(spravna) {
    const s = new Set([spravna]);
    [spravna + 1, spravna - 1, spravna + 2, spravna - 2, 0, -spravna, spravna + 3, spravna - 3, spravna + 4]
      .forEach(c => { if (c >= -9 && c <= 9 && s.size < 6) s.add(c); });
    return Array.from(s).sort((a, b) => b - a);
  }

  function tlacidlaCisel(moznosti, naKlik) {
    nastavOdpovede('<div class="moznosti cisla">' + moznosti.map(c =>
      '<button class="moznost" data-h="' + c + '">' + znak(c) + '</button>').join('') + '</div>',
      el => el.querySelectorAll('.moznost').forEach(b => b.onclick = () => naKlik(Number(b.dataset.h), b)));
  }

  function vyznacVolbu(tlacidlo, spravne) {
    if (!tlacidlo) return;
    tlacidlo.classList.add(spravne ? 'spravna' : 'nespravna');
  }

  // ════════════════════════════════════════════════════════════════════
  //  Typy úloh
  // ════════════════════════════════════════════════════════════════════
  const TYPY = {};

  // ── Váženie: čo má väčšiu cenu? ───────────────────────────────────────
  TYPY.vazenie = {
    priprav(u) {
      const ca = cenaSkupiny(u.a), cb = cenaSkupiny(u.b);
      const spravna = ca > cb ? 'a' : (cb > ca ? 'b' : 'rovnako');
      document.getElementById('hraZadanie').textContent = 'Čo má väčšiu cenu?';
      const stol = document.getElementById('hraStol');
      const karta = (x, kluc) => '<div class="stol-karta" data-k="' + kluc + '"><div class="stol-figurky">' +
        figurkyHtml(x) + '</div><div class="stol-meno">' + esc(velkePismeno(menoSkupiny(x))) + '</div>' +
        '<div class="stol-cena" hidden>' + mince(cenaSkupiny(x)) + '</div></div>';
      stol.innerHTML = '<div class="stol-rad">' + karta(u.a, 'a') + '<div class="stol-vs">alebo</div>' + karta(u.b, 'b') + '</div>';

      nastavOdpovede('<div class="moznosti">' +
        '<button class="moznost" data-h="a">' + esc(velkePismeno(menoSkupiny(u.a))) + '</button>' +
        '<button class="moznost" data-h="rovnako">Majú rovnakú cenu</button>' +
        '<button class="moznost" data-h="b">' + esc(velkePismeno(menoSkupiny(u.b))) + '</button></div>',
        el => el.querySelectorAll('.moznost').forEach(b => b.onclick = () => {
          const dobre = b.dataset.h === spravna;
          stol.querySelectorAll('.stol-cena').forEach(c => c.hidden = false);
          stol.querySelectorAll('.stol-karta').forEach(c => {
            if (spravna !== 'rovnako' && c.dataset.k === spravna) c.classList.add('vitaz');
          });
          vyznacVolbu(b, dobre);
          if (dobre) {
            const bonus = zapisSpravne();
            grosikHovori('nadseny', pochvala() + ' ' + esc(u.vysvetlenie) + bonus);
            ukazPokracovanie(true, '+' + BODY_SPRAVNE + ' bodov');
          } else {
            zapisChybu();
            grosikHovori('smutny', 'Nie celkom. ' + esc(u.vysvetlenie));
            ukazPokracovanie(false, znak(BODY_CHYBA) + ' bodov');
          }
        }));
    }
  };

  // ── Obchod: dal som, dostal som — koľko som zarobil? ──────────────────
  TYPY.obchod = {
    priprav(u) {
      const spravna = cenaSkupiny(u.dostal) - cenaSkupiny(u.dal);
      document.getElementById('hraZadanie').innerHTML =
        'Dal som ' + esc(menoSkupiny(u.dal, true)) + ', dostal som ' + esc(menoSkupiny(u.dostal, true)) +
        '. Koľko som zarobil?';
      const stol = document.getElementById('hraStol');
      stol.innerHTML = '<div class="stol-rad">' +
        '<div class="stol-karta"><div class="stol-popis">Dal som</div><div class="stol-figurky">' + figurkyHtml(u.dal) + '</div>' +
        '<div class="stol-cena minus" hidden>' + znak(-cenaSkupiny(u.dal)) + '</div></div>' +
        '<div class="stol-vs">→</div>' +
        '<div class="stol-karta"><div class="stol-popis">Dostal som</div><div class="stol-figurky">' + figurkyHtml(u.dostal, false) + '</div>' +
        '<div class="stol-cena plus" hidden>' + znak(cenaSkupiny(u.dostal)) + '</div></div></div>';
      tlacidlaCisel(moznostiCisel(spravna), (h, b) => {
        const dobre = h === spravna;
        stol.querySelectorAll('.stol-cena').forEach(c => c.hidden = false);
        vyznacVolbu(b, dobre);
        document.querySelectorAll('#hraOdpovede .moznost').forEach(x => {
          if (Number(x.dataset.h) === spravna) x.classList.add('spravna');
        });
        if (dobre) {
          const bonus = zapisSpravne();
          grosikHovori('nadseny', pochvala() + ' ' + esc(u.vysvetlenie) + bonus);
          ukazPokracovanie(true, '+' + BODY_SPRAVNE + ' bodov');
        } else {
          zapisChybu();
          grosikHovori('smutny', 'Správne je ' + znak(spravna) + '. ' + esc(u.vysvetlenie));
          ukazPokracovanie(false, znak(BODY_CHYBA) + ' bodov');
        }
      });
    }
  };

  // Spoločné vyhodnotenie úloh s jedným braním (anonie, kolko)
  function vyhodnotJednoBranie(u, dobre, tlacidlo, textChyby) {
    const zisk = ziskTahu(u, u.tah);
    vyznacVolbu(tlacidlo, dobre);
    sachovnica.naKlik = null;
    panelRebrika(u.tah);
    spustiRebrik(u.tah);
    const veta = zisk > 0
      ? ' V tréningu uvidíš: „' + esc(VC.vysvetliBranie(u._poz.board, u._poz.state, u.tah, VC.pieceColor(u._poz.board[VC.sqIndex(u.tah.slice(0, 2))]))) + '“'
      : '';
    if (dobre) {
      const bonus = zapisSpravne();
      grosikHovori('nadseny', pochvala() + ' ' + esc(u.vysvetlenie) + veta + bonus);
      ukazPokracovanie(true, '+' + BODY_SPRAVNE + ' bodov · ' + RV.textVerdiktu(zisk));
    } else {
      zapisChybu();
      grosikHovori('smutny', textChyby + ' ' + esc(u.vysvetlenie) + ' Pozri si rebrík výmeny.' + veta);
      ukazPokracovanie(false, znak(BODY_CHYBA) + ' bodov · ' + RV.textVerdiktu(zisk));
    }
  }

  function oznacTah(uci) {
    const z = {};
    z[VC.sqIndex(uci.slice(0, 2))] = 'selected';
    z[VC.sqIndex(uci.slice(2, 4))] = 'ciel';
    return z;
  }

  // ── Áno / Nie ─────────────────────────────────────────────────────────
  TYPY.anonie = {
    priprav(u) {
      const zisk = ziskTahu(u, u.tah);
      document.getElementById('hraZadanie').innerHTML = 'Je <b>' + esc(nazov(u, u.tah)) + '</b> branie so ziskom?';
      sachovnica.oznac(oznacTah(u.tah));
      nastavOdpovede('<div class="moznosti dve">' +
        '<button class="moznost ano" data-h="ano">Áno</button>' +
        '<button class="moznost nie" data-h="nie">Nie</button></div>',
        el => el.querySelectorAll('.moznost').forEach(b => b.onclick = () => {
          const odpoved = b.dataset.h === 'ano';
          const dobre = odpoved === (zisk > 0);
          vyhodnotJednoBranie(u, dobre, b, zisk > 0
            ? 'Je to zisk ' + znak(zisk) + '!'
            : (zisk === 0 ? 'Nie je to zisk, je to len výmena.' : 'Nie je to zisk — stratil by si ' + mince(-zisk) + '.'));
        }));
      grosikHovori('rozmysla', 'Pozri sa, či figúrku niekto kryje, a spočítaj, čo dostaneš a čo zaplatíš.');
    }
  };

  // ── Koľko? ────────────────────────────────────────────────────────────
  TYPY.kolko = {
    priprav(u) {
      const zisk = ziskTahu(u, u.tah);
      document.getElementById('hraZadanie').innerHTML = 'Koľko mincí získaš ťahom <b>' + esc(nazov(u, u.tah)) + '</b>?';
      sachovnica.oznac(oznacTah(u.tah));
      tlacidlaCisel(moznostiCisel(zisk), (h, b) => {
        document.querySelectorAll('#hraOdpovede .moznost').forEach(x => {
          if (Number(x.dataset.h) === zisk) x.classList.add('spravna');
        });
        vyhodnotJednoBranie(u, h === zisk, b, 'Správne je ' + znak(zisk) + '.');
      });
      grosikHovori('rozmysla', 'Spočítaj celú výmenu: čo dostaneš, čo súper zoberie späť a čo ti na konci zostane.');
    }
  };

  // ── Pasca: ktoré z braní je so ziskom? ────────────────────────────────
  TYPY.pasca = {
    priprav(u) {
      const zisky = {};
      u.moznosti.forEach(x => { zisky[x] = ziskTahu(u, x); });
      document.getElementById('hraZadanie').textContent = 'Len jedno z týchto braní je so ziskom. Ktoré?';
      const z = {};
      u.moznosti.forEach(x => { z[VC.sqIndex(x.slice(0, 2))] = 'selected'; z[VC.sqIndex(x.slice(2, 4))] = 'ciel'; });
      sachovnica.oznac(z);
      nastavOdpovede('<div class="moznosti">' + u.moznosti.map(x =>
        '<button class="moznost" data-h="' + x + '">' + esc(nazov(u, x)) + '</button>').join('') + '</div>',
        el => el.querySelectorAll('.moznost').forEach(b => b.onclick = () => {
          const volba = b.dataset.h;
          const dobre = zisky[volba] > 0;
          vyznacVolbu(b, dobre);
          el.querySelectorAll('.moznost').forEach(x => { if (zisky[x.dataset.h] > 0) x.classList.add('spravna'); });
          sachovnica.naKlik = null;
          panelRebrika(volba, u.moznosti);
          spustiRebrik(volba);
          if (dobre) {
            const bonus = zapisSpravne();
            grosikHovori('nadseny', pochvala() + ' ' + esc(u.vysvetlenie) + bonus);
            ukazPokracovanie(true, '+' + BODY_SPRAVNE + ' bodov · ' + RV.textVerdiktu(zisky[volba]));
          } else {
            zapisChybu();
            grosikHovori('smutny', esc(nazov(u, volba)) + ' je pasca: ' + RV.textVerdiktu(zisky[volba]).toLowerCase() +
                         '. ' + esc(u.vysvetlenie) + ' Rebrík iného brania si pozrieš tlačidlom nad tabuľkou.');
            ukazPokracovanie(false, znak(BODY_CHYBA) + ' bodov · ' + RV.textVerdiktu(zisky[volba]));
          }
        }));
      grosikHovori('rozmysla', 'Pri každom braní si spočítaj celú výmenu. Jedno z nich je pasca.');
    }
  };

  // ── Nájdi všetky brania so ziskom (za oboch) ──────────────────────────
  TYPY.najdi = {
    priprav(u) {
      const vysl = VC.braniaSoZiskom(u._poz.board, u._poz.state);
      const vsetky = VC.vsetkyBrania(u._poz.board, u._poz.state);
      const riesenia = vysl.riesenia;
      const vysvetlenieRiesenia = {};
      riesenia.forEach((x, i) => { vysvetlenieRiesenia[x] = vysl.vysvetlenia[i]; });
      const ul = { najdene: [], chybne: [], vybrane: null, hotovo: false, chybVUlohe: 0 };

      document.getElementById('hraZadanie').innerHTML = 'Nájdi všetky brania so ziskom <span class="slabo">(biele aj čierne)</span>';
      grosikHovori('rozmysla', 'Klikni na figúrku, ktorá má brať, a potom na figúrku, ktorú má zobrať. ' +
                   'Hľadaj za bieleho aj za čierneho.');

      const strana = x => VC.pieceColor(u._poz.board[VC.sqIndex(x.slice(0, 2))]);
      const pocitadlo = () => {
        let t = 'Nájdené: ' + ul.najdene.length + ' / ' + riesenia.length;
        if (u.pomocka === 'strany') {
          const w = riesenia.filter(x => strana(x) === 'w'), b = riesenia.filter(x => strana(x) === 'b');
          t += ' · Biely ' + ul.najdene.filter(x => strana(x) === 'w').length + '/' + w.length +
               ' · Čierny ' + ul.najdene.filter(x => strana(x) === 'b').length + '/' + b.length;
        }
        const pasik = document.getElementById('hraPasik');
        pasik.hidden = false;
        pasik.className = 'pasik';
        document.getElementById('hraPasikText').textContent = t;
        document.getElementById('hraPasikUcetBox').hidden = true;
      };

      const znacky = () => {
        const z = {};
        ul.najdene.forEach(x => { z[VC.sqIndex(x.slice(2, 4))] = 'najdene'; });
        if (ul.vybrane !== null) z[ul.vybrane] = 'selected';
        sachovnica.oznac(z);
      };

      const zoznam = () => {
        const el = document.getElementById('hraSpatna');
        let h = '<div class="panel-karta"><h3>Tvoje brania</h3>';
        if (!ul.najdene.length && !ul.chybne.length) h += '<div class="slabo">Zatiaľ nič.</div>';
        ul.najdene.forEach(x => {
          h += '<div class="zaznam dobre"><b>' + esc(nazov(u, x)) + '</b> ' + esc(vysvetlenieRiesenia[x]) + '</div>';
        });
        ul.chybne.forEach(x => {
          h += '<div class="zaznam zle"><b>' + esc(nazov(u, x)) + '</b> ' + RV.textVerdiktu(ziskTahu(u, x)) + '</div>';
        });
        if (ul.hotovo) {
          riesenia.filter(x => !ul.najdene.includes(x)).forEach(x => {
            h += '<div class="zaznam prehliadnute"><b>' + esc(nazov(u, x)) + '</b> prehliadnuté — ' +
                 esc(vysvetlenieRiesenia[x]) + '</div>';
          });
        }
        h += '</div>';
        if (ul.poslednyRebrik) {
          h += '<div class="panel-karta"><h3>Rebrík: ' + esc(nazov(u, ul.poslednyRebrik)) + '</h3>' +
               statickyRebrik(u._poz.board, ul.poslednyRebrik) + '</div>';
        }
        el.innerHTML = h;
      };

      const dokonci = (vzdal) => {
        ul.hotovo = true;
        ul.vybrane = null;
        sachovnica.naKlik = null;
        znacky();
        const vsetkyNajdene = ul.najdene.length === riesenia.length;
        let text;
        if (vsetkyNajdene && ul.chybVUlohe === 0) {
          pripocitaj(BONUS_BEZ_CHYBY);
          stav.bonusy += BONUS_BEZ_CHYBY;
          obnovHlavu();
          text = 'Všetky bez chyby: bonus +' + BONUS_BEZ_CHYBY;
          grosikHovori('nadseny', 'Našiel si všetky brania so ziskom a ani raz si sa nepomýlil! ' + esc(u.vysvetlenie));
        } else if (vsetkyNajdene) {
          text = 'Všetky nájdené';
          grosikHovori('vesely', 'Máš ich všetky. ' + esc(u.vysvetlenie));
        } else {
          stav.seria = 0;
          obnovHlavu();
          text = 'Prehliadnuté: ' + (riesenia.length - ul.najdene.length);
          grosikHovori('smutny', (vzdal ? 'Niečo ti ešte chýbalo. ' : '') + esc(u.vysvetlenie));
        }
        zoznam();
        ukazPokracovanie(vsetkyNajdene, text);
      };

      sachovnica.naKlik = pole => {
        if (ul.hotovo) return;
        if (ul.vybrane !== null && ul.vybrane !== pole) {
          const uci = VC.sqName(ul.vybrane) + VC.sqName(pole);
          const branie = vsetky.find(x => x.uci === uci);
          if (branie) {
            ul.vybrane = null;
            if (ul.najdene.includes(uci)) {
              grosikHovori('vesely', 'Toto branie už máš. Hľadaj ďalej.');
            } else if (riesenia.includes(uci)) {
              ul.najdene.push(uci);
              ul.poslednyRebrik = null;
              const bonus = zapisSpravne();
              grosikHovori('nadseny', pochvala() + ' ' + esc(vysvetlenieRiesenia[uci]) + bonus);
            } else if (!ul.chybne.includes(uci)) {
              ul.chybne.push(uci);
              ul.chybVUlohe++;
              ul.poslednyRebrik = uci;
              zapisChybu();
              grosikHovori('smutny', esc(branie.nazov) + ' nie je branie so ziskom: ' +
                           RV.textVerdiktu(branie.zisk).toLowerCase() + '. Pozri rebrík vpravo. ' + znak(BODY_CHYBA) + ' bodov.');
            } else {
              ul.poslednyRebrik = uci;
              grosikHovori('rozmysla', 'Toto branie si už skúšal — nie je so ziskom.');
            }
            znacky(); pocitadlo(); zoznam();
            if (ul.najdene.length === riesenia.length) dokonci(false);
            return;
          }
          if (!u._poz.board[pole]) {
            ul.vybrane = null;
            znacky();
            grosikHovori('rozmysla', 'To nie je branie. Klikni na figúrku, ktorú chceš zobrať.');
            return;
          }
        }
        if (u._poz.board[pole]) {
          ul.vybrane = (ul.vybrane === pole) ? null : pole;
        } else {
          ul.vybrane = null;
        }
        znacky();
      };

      nastavOdpovede('<button class="secondary velke" id="hraHotovo">Hotovo — viac ich nevidím</button>',
        el => el.querySelector('#hraHotovo').onclick = () => { if (!ul.hotovo) dokonci(true); });
      znacky(); pocitadlo(); zoznam();
    }
  };

  // ════════════════════════════════════════════════════════════════════
  //  Koniec kapitoly
  // ════════════════════════════════════════════════════════════════════
  function hviezdyZaSkore(skore, max) {
    const podiel = max > 0 ? Math.min(1, skore / max) : 1;
    if (podiel >= HVIEZDY_3) return 3;
    if (podiel >= HVIEZDY_2) return 2;
    return 1;
  }

  function ukazKoniec() {
    const k = stav.kapitola;
    const hviezdy = hviezdyZaSkore(stav.skore, stav.max);
    const pred = postupKapitoly(k);
    const noveMaximum = stav.skore > pred.najlepsie;
    postup.kapitoly[k.cislo] = {
      dokoncene: true,
      hviezdy: Math.max(pred.hviezdy, hviezdy),
      najlepsie: Math.max(pred.najlepsie, stav.skore),
      naposledy: new Date().toISOString()
    };
    ulozPostup();

    const i = O.kapitoly.indexOf(k);
    const dalsia = O.kapitoly[i + 1];
    const dalsiaHratelna = dalsia && maObsah(dalsia);
    const nalada = hviezdy === 3 ? 'nadseny' : (hviezdy === 2 ? 'vesely' : 'rozmysla');
    const pozdrav = hviezdy === 3 ? 'Skvelý obchod! Tri hviezdičky.' :
                    (hviezdy === 2 ? 'Dobrá práca! Na tri hviezdičky ti chýba len kúsok.' :
                     'Kapitola je za tebou. Skús ju ešte raz — pôjde to lepšie.');

    koren.innerHTML = lista(true) +
      '<div class="koniec">' +
      '<div class="uvod-hlava">Kapitola ' + k.cislo + ' · ' + esc(k.nazov) + '</div>' +
      grosikRiadok(nalada, esc(pozdrav) + (noveMaximum && pred.dokoncene ? ' <b>Nový rekord!</b>' : ''), null, true) +
      '<div class="koniec-hviezdy">' + hviezdyHtml(hviezdy) + '</div>' +
      '<div class="koniec-cisla">' +
      '<div><span class="koniec-hodnota">' + stav.skore + '</span><span class="koniec-popis">bodov</span></div>' +
      '<div><span class="koniec-hodnota plus">' + stav.spravnych + '</span><span class="koniec-popis">správne</span></div>' +
      '<div><span class="koniec-hodnota minus">' + stav.chyb + '</span><span class="koniec-popis">chyby</span></div></div>' +
      '<div class="koniec-pozn">Za odpovede sa dalo získať ' + stav.max + ' bodov' +
      (stav.bonusy ? ', bonusy ti pridali ďalších ' + stav.bonusy : '') + '.</div>' +
      '<div class="zapamataj"><div class="zapamataj-nadpis">Zapamätaj si</div>' + esc(k.zapamataj) +
      '<div class="zapamataj-pozn">Pravidlo je teraz v tvojom zošite.</div></div>' +
      '<div class="koniec-tlacidla">' +
      (dalsiaHratelna ? '<button class="primary velke" data-akcia="dalsia">Ďalšia kapitola →</button>' : '') +
      '<button class="secondary" data-akcia="znova">Skúsiť znova</button>' +
      '<button class="secondary" data-akcia="mapa">Kapitoly</button></div></div>';
    naviazListu();
    const d = koren.querySelector('[data-akcia="dalsia"]');
    if (d) d.onclick = () => ukazUvod(dalsia);
    koren.querySelector('[data-akcia="znova"]').onclick = () => ukazUvod(k);
    window.scrollTo(0, 0);
  }

  return {
    spusti: spusti,
    // pre testy
    _hviezdyZaSkore: hviezdyZaSkore,
    _moznostiCisel: moznostiCisel,
    _stav: () => stav
  };
})();
