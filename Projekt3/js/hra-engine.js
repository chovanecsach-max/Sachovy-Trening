// ============================================================================
//  hra-engine.js — herný rámec pre hry zručností
//                  (Šachový trh, Stráž na trhu, Vidlička na trhu, Hrozba na trhu)
// ----------------------------------------------------------------------------
//  Rámec nevie nič o konkrétnej hre. Dostane obsah (napr. OBSAH_TRH z
//  trh-obsah.js alebo OBSAH_STRAZ zo straz-obsah.js) a postará sa o všetko
//  ostatné:
//    • mapa kapitol, odomykanie, hviezdičky, zošit pravidiel, odznak,
//    • úvod kapitoly so sprievodcom Grošíkom,
//    • úlohy — Šachový trh: vazenie, obchod, anonie, kolko, pasca, najdi, stanok
//            — Stráž na trhu: pocet, slaba, ktora, najdiSlabe
//            — Vidlička na trhu: jeVidlicka, precoNie, ktoreTerce, najdiVidlicku,
//              najdiVidlicky,
//            — Hrozba na trhu: jeHrozba, precoNieHrozba, coHrozi, najdiHrozbu, najdiHrozby,
//    • body: správne +10, chyba −5, séria 5 správnych +10, úloha Nájdi
//      všetky bez chyby +10; skóre kapitoly neklesne pod nulu,
//    • po odpovedi rebrík výmeny (Šachový trh), stráž figúrky (Stráž na
//      trhu), rozbor vidličky so šípkami (Vidlička na trhu) alebo rozbor
//      hrozby so šípkami (Hrozba na trhu),
//    • záverečná skúška: náhodné pozície, časový limit, rozbor chýb
//      a odporúčanie kapitol na zopakovanie.
//
//  Texty, ktoré sa medzi hrami líšia (pochvaly, odznak, zošit…), môže obsah
//  hry prepísať v časti `texty`. Čo obsah neuvedie, platí ako v Šachovom trhu.
//
//  Správne odpovede pri úlohách so šachovnicou počíta VŽDY VisionCore —
//  rovnako ako generátor úloh. Obsah hry ich neurčuje.
//
//  POSTUP HRÁČA ukladá „úložisko", ktoré dodá stránka (js/hra-postup.js):
//  na webe tabuľka hra_postup v databáze, pri teste zo súboru len prehliadač.
//  Bez úložiska sa postup drží len v prehliadači (ako pred krokom 5).
//
//  Potrebuje: js/vision-core.js, js/rebrik-vymeny.js (a voliteľne sounds.js).
//  Spustenie: HraEngine.spusti({ obsah, koren, rola, userId, testovaci, uloziste })
// ============================================================================

(window.VERZIE = window.VERZIE || {})['hra-engine.js'] = '2026-10-02e';

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
  const MENO_FIGURKY_7 = { K: 'kráľom', Q: 'dámou', R: 'vežou', B: 'strelcom', N: 'jazdcom', P: 'pešiakom' };

  // Texty, ktoré si hra môže prepísať v obsahu (O.texty). Predvolené sú zo Šachového trhu.
  const TEXTY_PREDVOLENE = {
    pochvaly: ['Výborne! Správna odpoveď.', 'Presne tak!', 'Máš oko obchodníka.', 'Správne!', 'Dobre spočítané!'],
    odznak: 'Obchodník',
    zosit: 'Toto sú pravidlá, ktoré si už získal. Obchodník ich má vždy po ruke.',
    bublinaUlohy: 'Rozmýšľaj ako obchodník: čo dostanem a čo zaplatím?',
    odkazy: [{ text: 'Laboratórium výmeny', href: 'laboratorium.html' }],
    koniec3: 'Skvelý obchod! Tri hviezdičky.',
    koniec2: 'Dobrá práca! Na tri hviezdičky ti chýba len kúsok.',
    koniec1: 'Kapitola je za tebou. Skús ju ešte raz — pôjde to lepšie.'
  };

  let O = null;             // obsah hry
  let T = TEXTY_PREDVOLENE; // texty hry (predvolené + O.texty)
  let koren = null;         // DOM prvok, do ktorého sa hra kreslí
  let nast = {};            // { rola, userId, testovaci, cestaObrazkov }
  let postup = null;        // uložený postup hráča
  let uloziste = null;      // kam sa postup ukladá (hra-postup.js)
  let stav = null;          // rozohraná kapitola
  let casovac = null;       // časový limit úlohy (skúška)

  // ════════════════════════════════════════════════════════════════════
  //  Spustenie a postup
  // ════════════════════════════════════════════════════════════════════
  function spusti(moznosti) {
    O = moznosti.obsah;
    T = Object.assign({}, TEXTY_PREDVOLENE, O.texty || {});
    koren = moznosti.koren;
    nast = {
      rola: moznosti.rola || '',
      userId: moznosti.userId || '',
      testovaci: !!moznosti.testovaci,
      cestaObrazkov: moznosti.cestaObrazkov || 'img/Pieces/'
    };
    uloziste = moznosti.uloziste || lokalneUloziste();
    // Pravé tlačidlo myši neotvorí ponuku prehliadača — pri hre sa naň ľahko
    // klikne omylom (rovnako ako na úvodnej stránke)
    if (!spusti.bezPonuky) {
      document.addEventListener('contextmenu', e => e.preventDefault());
      spusti.bezPonuky = true;
    }
    skontrolujObsah();
    koren.innerHTML = '<div class="nacitavam-postup" style="text-align:center;padding:40px 10px;color:#64748b;">' +
                      'Načítavam tvoj postup…</div>';
    Promise.resolve()
      .then(() => uloziste.nacitaj())
      .catch(e => { console.warn('Postup sa nenačítal:', e); return null; })
      .then(p => {
        postup = (p && p.kapitoly) ? p : { verzia: 1, kapitoly: {} };
        ukazMapu();
      });
  }

  function jeTrener() { return ROLY_TRENEROV.includes(nast.rola); }
  function vidiTrenerskeRamceky() { return jeTrener() || nast.testovaci; }

  // Náhradné úložisko, keď stránka žiadne nedodá: len prehliadač
  function lokalneUloziste() {
    const kluc = 'hra_' + O.kluc + (O.verzia ? '_v' + O.verzia : '') + '_' + (nast.userId || 'lokalne');
    return {
      nacitaj: () => {
        try {
          const p = JSON.parse(localStorage.getItem(kluc) || 'null');
          if (p && p.kapitoly) return p;
        } catch (e) { /* prehliadač bez úložiska — hrá sa bez ukladania */ }
        return null;
      },
      uloz: (p) => { try { localStorage.setItem(kluc, JSON.stringify(p)); } catch (e) {} }
    };
  }

  // cislo = práve dohraná kapitola (pre databázu), udalost = { pokusy, posledne }.
  // Chyba zápisu hru nezastaví — kópia ostáva v prehliadači a odošle sa
  // pri ďalšom otvorení hry.
  function ulozPostup(cislo, udalost) {
    Promise.resolve()
      .then(() => uloziste.uloz(postup, cislo, udalost))
      .catch(e => console.warn('Postup sa neuložil do databázy (odošle sa neskôr):', e));
  }

  function postupKapitoly(k) {
    return postup.kapitoly[k.cislo] || { dokoncene: false, hviezdy: 0, najlepsie: 0 };
  }

  function maObsah(k) { return !!(k.skuska || k.priprava || (k.ulohy && k.ulohy.length > 0)); }
  function znackaKapitoly(k) { return k.znacka || (k.priprava ? 'P' : String(k.cislo)); }

  // Príprava na skúšku (30. 9. 2026): 20 pozícií ako na skúške, na každú o 60 s viac.
  // Kapitola s poľom `priprava` stojí v obsahu pred skúškou; číslo má vlastné
  // (napr. 20), aby sa uložený postup skúšky nemusel prečíslovať. Skúška sa
  // odomkne, keď hráč prípravu dokončí alebo ukončí skôr (tlačidlo Ukončiť tréning).
  function kapitolaSkusky() { return O.kapitoly.find(x => x.skuska) || null; }
  function jePriprava() { return !!(stav && stav.skuska && stav.skuska.priprava); }
  function skuskaVyzva() { return jePriprava() ? 'Príprava na skúšku!' : 'Skúška!'; }

  // Kapitola sa odomkne po dokončení predchádzajúcej (alebo tej, ktorú určí odomknePo)
  function predchodca(k) {
    if (k.odomknePo) return O.kapitoly.find(x => x.cislo === k.odomknePo) || null;
    const i = O.kapitoly.indexOf(k);
    return i > 0 ? O.kapitoly[i - 1] : null;
  }

  function jeOdomknuta(k) {
    if (jeTrener()) return true;
    const moj = postupKapitoly(k);
    if (moj.dokoncene || moj.pokusy) return true;      // už hraná kapitola ostáva otvorená
    const p = predchodca(k);
    return !p || postupKapitoly(p).dokoncene;
  }

  function zlozilSkusku() {
    return O.kapitoly.some(k => k.skuska && postupKapitoly(k).dokoncene);
  }

  // Legálny ťah strany, ktorej figúrka stojí na z
  function jeLegalny(board, uci) {
    const z = VC.sqIndex(uci.slice(0, 2)), na = VC.sqIndex(uci.slice(2, 4));
    const strana = VC.pieceColor(board[z]);
    return !!strana && VC.isLegal(board, { active: strana, castling: '-', ep: '-' }, z, na, '');
  }

  // Výpis rozporu medzi scenárom a výpočtom — pre autora obsahu
  function skontrolujObsah() {
    O.kapitoly.forEach(k => (k.ulohy || []).forEach(u => {
      if (u.ocakavane === undefined || !u.fen) return;
      const poz = VC.parseFen(u.fen);
      let vypocet;
      // Stráž na trhu: útočníci a obrancovia jednej figúrky, slabo pokryté figúrky
      const straz = pole => VC.strazFigurky(poz.board, VC.sqIndex(pole));
      if (u.typ === 'pocet') vypocet = straz(u.pole)[u.co === 'obrancovia' ? 'obrancovia' : 'utocnici'].length;
      else if (u.typ === 'slaba') vypocet = straz(u.pole).slaba;
      else if (u.typ === 'ktora') {
        const slabe = u.moznosti.filter(p => straz(p).slaba);
        vypocet = slabe.length === 1 ? slabe[0] : slabe;
      } else if (u.typ === 'najdiSlabe') {
        const v = VC.slaboPokryte(poz.board, poz.state);
        vypocet = v.dovod ? 'vyradená: ' + v.dovod : v.riesenia;
      }
      // Vidlička na trhu (zoznamy ťahov sa porovnávajú bez ohľadu na poradie)
      else if (u.typ === 'jeVidlicka') vypocet = VC.rozoberVidlicku(poz.board, u.tah).vidlicka;
      else if (u.typ === 'precoNie') {
        const r = VC.rozoberVidlicku(poz.board, u.tah);
        vypocet = r.vidlicka ? 'je to vidlička' : PRECO_Z_JADRA[r.dovod];
        const n = nesplnene(r);
        if (n.length > 1) console.warn('Úloha ' + u.id + ': ťah nesplní viac podmienok naraz: ' + n.join(', '));
        if (u.moznosti && !u.moznosti.includes(vypocet)) console.warn('Úloha ' + u.id + ': medzi možnosťami chýba ' + vypocet);
      }
      else if (u.typ === 'ktoreTerce') vypocet = VC.rozoberVidlicku(poz.board, u.tah).zapocitane.slice().sort();
      else if (u.typ === 'najdiVidlicku') {
        vypocet = VC.vidlickyStrany(poz.board, u.strana || poz.state.active).map(r => r.tah).sort();
      }
      else if (u.typ === 'najdiVidlicky') {
        const v = VC.vidlicky(poz.board, poz.state);
        vypocet = v.dovod ? 'vyradená: ' + v.dovod : v.riesenia.slice().sort();
      }
      // Hrozba na trhu
      else if (u.typ === 'jeHrozba') vypocet = VC.rozoberHrozbu(poz.board, u.tah, poz.state).hrozba;
      else if (u.typ === 'precoNieHrozba') {
        const r = VC.rozoberHrozbu(poz.board, u.tah, poz.state);
        vypocet = r.hrozba ? 'je to hrozba' : PRECO_Z_JADRA_H[r.dovod];
        const n = nesplneneHrozby(r);
        if (n.length > 1) console.warn('Úloha ' + u.id + ': ťah nesplní viac podmienok naraz: ' + n.join(', '));
        if (u.moznosti && !u.moznosti.includes(vypocet)) console.warn('Úloha ' + u.id + ': medzi možnosťami chýba ' + vypocet);
      }
      else if (u.typ === 'coHrozi') vypocet = VC.rozoberHrozbu(poz.board, u.tah, poz.state).terce.map(t => VC.sqName(t.pole)).sort();
      else if (u.typ === 'najdiHrozbu') {
        vypocet = VC.hrozbyStrany(poz.board, poz.state, u.strana || poz.state.active).map(r => r.tah).sort();
      }
      else if (u.typ === 'najdiHrozby') {
        const v = VC.hrozby(poz.board, poz.state);
        vypocet = v.dovod ? 'vyradená: ' + v.dovod : v.riesenia.slice().sort();
      }
      else if (u.typ === 'najdi') vypocet = VC.braniaSoZiskom(poz.board, poz.state).riesenia;
      else if (u.typ === 'pasca') vypocet = u.moznosti.filter(x => ziskNaSachovnici(poz.board, x) > 0);
      else if (u.tah && !jeLegalny(poz.board, u.tah)) vypocet = 'nelegalny';
      else if (u.tah) vypocet = ziskNaSachovnici(poz.board, u.tah);
      if (u.typ === 'stanok' && !(u.moznosti || []).includes(u.tah.slice(2, 4))) {
        console.warn('Úloha ' + u.id + ': medzi možnosťami chýba stánok ' + u.tah.slice(2, 4));
      }
      const bezPoradia = ['ktoreTerce', 'najdiVidlicku', 'najdiVidlicky', 'coHrozi', 'najdiHrozbu', 'najdiHrozby'].includes(u.typ) &&
                         Array.isArray(u.ocakavane);
      const ocakavane = bezPoradia ? u.ocakavane.slice().sort() : u.ocakavane;
      if (JSON.stringify(vypocet) !== JSON.stringify(ocakavane)) {
        console.warn('Úloha ' + u.id + ': scenár čaká ' + JSON.stringify(u.ocakavane) +
                     ', výpočet dáva ' + JSON.stringify(vypocet));
      }
    }));
    // Pozície skúšky: každá musí mať aspoň jedno riešenie
    O.kapitoly.filter(k => k.skuska).forEach(k => {
      const typ = k.skuska.typ || 'najdi';
      k.skuska.pozicie.forEach(fen => {
        if (!pocetRieseni(typ, fen)) console.warn('Skúška ' + k.cislo + ': pozícia bez riešenia ' + fen);
      });
    });
    // Pozície prípravy: majú riešenie a nie sú zo skúšky (inak by si ich hráč zapamätal)
    O.kapitoly.filter(k => k.priprava).forEach(k => {
      const ks = kapitolaSkusky();
      if (!ks) { console.warn('Príprava ' + k.cislo + ': hra nemá skúšku'); return; }
      const zoSkusky = new Set(ks.skuska.pozicie.map(f => f.split(' ')[0]));
      k.priprava.pozicie.forEach(fen => {
        if (!pocetRieseni(ks.skuska.typ || 'najdi', fen)) console.warn('Príprava: pozícia bez riešenia ' + fen);
        if (zoSkusky.has(fen.split(' ')[0])) console.warn('Príprava: pozícia je aj v skúške ' + fen);
      });
      if (k.priprava.pozicie.length < k.priprava.pocet) console.warn('Príprava: menej pozícií, ako sa vyberá');
    });
  }

  function ziskNaSachovnici(board, uci) {
    const z = VC.sqIndex(uci.slice(0, 2)), na = VC.sqIndex(uci.slice(2, 4));
    return VC.seeWithPins(board, z, na, VC.pieceColor(board[z]));
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

  function pochvala() { return T.pochvaly[Math.floor(Math.random() * T.pochvaly.length)]; }

  // Odznak za zloženú záverečnú skúšku (Obchodník, Strážca trhu…)
  function odznakHtml(velky) {
    return '<span class="odznak' + (velky ? ' velky' : '') + '"><span class="odznak-minca">★</span>' +
           '<span class="odznak-text">' + esc(T.odznak) + '</span></span>';
  }

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
    koren.querySelectorAll('[data-akcia="mapa"]').forEach(b => b.onclick = () => { zastavVsetko(); ukazMapu(); });
    koren.querySelectorAll('[data-akcia="menu"]').forEach(b => b.onclick = () => { zastavVsetko(); location.href = 'index.html'; });
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

  function bodov(n) {
    const a = Math.abs(n);
    if (a === 1) return n + ' bod';
    if (a >= 2 && a <= 4) return n + ' body';
    return n + ' bodov';
  }

  // Výsledok obchodu v minciach: „Zisk 2 mince“, „Strata 8 mincí“. Mince patria
  // k cenám figúrok a obchodom, body k skóre hráča — aby sa nepomiešali.
  function textObchodu(zisk) {
    if (zisk > 0) return 'Zisk ' + mince(zisk);
    if (zisk < 0) return 'Strata ' + mince(-zisk);
    return 'Výmena — zisk 0 mincí';
  }

  function formatCas(s) {
    s = Math.max(0, Math.ceil(s));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  // ════════════════════════════════════════════════════════════════════
  //  Mapa kapitol
  // ════════════════════════════════════════════════════════════════════
  function ukazMapu() {
    zastavVsetko();
    stav = null;
    const sObsahom = O.kapitoly.filter(k => maObsah(k) && !k.priprava);   // príprava hviezdičky nedáva
    const hviezd = sObsahom.reduce((s, k) => s + postupKapitoly(k).hviezdy, 0);

    let karty = '';
    O.kapitoly.forEach(k => {
      const p = postupKapitoly(k);
      const obsah = maObsah(k);
      const odomknuta = obsah && jeOdomknuta(k);
      let trieda = 'kapitola-karta' + (k.skuska ? ' skuska' : '') + (k.znacka ? ' bonus' : '') +
                   (k.priprava ? ' priprava' : '');
      let stavText;
      if (!obsah) { trieda += ' pripravujeme'; stavText = 'Pripravujeme'; }
      else if (!odomknuta) {
        trieda += ' zamknuta';
        const pred = predchodca(k);
        stavText = pred && pred.priprava ? 'Najprv prejdi prípravu na skúšku'
                                         : 'Najprv dokonči kapitolu ' + znackaKapitoly(pred);
      } else if (k.priprava) {
        if (p.pokusy) { trieda += ' dokoncena'; stavText = 'Najlepšie ' + p.najlepsie + ' / ' + k.priprava.pocet + ' · ' + p.pokusy + '×'; }
        else stavText = k.priprava.pocet + ' pozícií pred skúškou';
      } else if (k.skuska) {
        if (p.dokoncene) { trieda += ' dokoncena'; stavText = 'Zložená · najlepšie ' + p.najlepsie + ' / ' + k.skuska.pocet; }
        else if (p.pokusy) stavText = 'Najlepšie ' + p.najlepsie + ' / ' + k.skuska.pocet + ' · treba ' + k.skuska.hranica;
        else stavText = 'Skús to';
      } else if (p.dokoncene) { trieda += ' dokoncena'; stavText = 'Najlepšie: ' + p.najlepsie + ' b.'; }
      else stavText = 'Hraj';
      karty += '<button class="' + trieda + '" data-kapitola="' + k.cislo + '"' + (odomknuta ? '' : ' disabled') + '>' +
        '<span class="k-cislo">' + esc(znackaKapitoly(k)) + '</span>' +
        '<span class="k-text"><span class="k-nazov">' + esc(k.nazov) + '</span>' +
        '<span class="k-stav">' + esc(stavText) + '</span></span>' +
        (obsah && !k.priprava ? hviezdyHtml(p.hviezdy) : '') + '</button>';
    });

    koren.innerHTML = lista(false) +
      '<div class="mapa">' +
      grosikRiadok('vesely', esc(O.pozdrav), null, true) +
      '<div class="mapa-suhrn"><span class="mapa-hviezdy">★ ' + hviezd + ' / ' + (sObsahom.length * 3) +
      (zlozilSkusku() ? ' ' + odznakHtml(false) : '') + '</span>' +
      '<span class="mapa-tlacidla"><button class="accent" data-akcia="zosit">Zošit pravidiel</button>' +
      (T.odkazy || []).map(o => '<a class="odkaz-tlacidlo" href="' + esc(o.href) + '">' + esc(o.text) + '</a>').join('') +
      '</span></div>' +
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
    O.kapitoly.filter(k => maObsah(k) && !k.priprava).forEach(k => {
      const hotova = postupKapitoly(k).dokoncene || jeTrener();
      h += '<div class="zosit-riadok' + (hotova ? '' : ' zamknuty') + '"><span class="k-cislo">' + esc(znackaKapitoly(k)) + '</span>' +
           '<div><div class="zosit-kapitola">' + esc(k.nazov) + '</div>' +
           '<div class="zosit-pravidlo">' + (hotova ? esc(k.zapamataj) : 'Pravidlo získaš po dokončení kapitoly.') +
           '</div></div></div>';
    });
    koren.innerHTML = lista(false) +
      '<div class="zosit">' +
      grosikRiadok('vesely', esc(T.zosit), null, false) +
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
    if (u.typ === 'najdiSlabe') {
      const poz = VC.parseFen(u.fen);
      return BODY_SPRAVNE * VC.slaboPokryte(poz.board, poz.state).riesenia.length + BONUS_BEZ_CHYBY;
    }
    if (u.typ === 'najdiVidlicky') {
      const poz = VC.parseFen(u.fen);
      return BODY_SPRAVNE * VC.vidlicky(poz.board, poz.state).riesenia.length + BONUS_BEZ_CHYBY;
    }
    if (u.typ === 'najdiHrozby') {
      const poz = VC.parseFen(u.fen);
      return BODY_SPRAVNE * VC.hrozby(poz.board, poz.state).riesenia.length + BONUS_BEZ_CHYBY;
    }
    return BODY_SPRAVNE;
  }

  function ukazUvod(k) {
    zastavVsetko();
    const bublina = k.uvod.map(t => '<p>' + t + '</p>').join('') +
                    (k.cennik ? cennikHtml() : '') +
                    (k.uvodKoniec ? '<p>' + k.uvodKoniec + '</p>' : '');
    let info;
    if (k.priprava) {
      const s = kapitolaSkusky().skuska, pr = k.priprava;
      info = 'Pozícií: ' + pr.pocet + ' · čas: ' + (s.casZaklad + pr.casNavyse) + ' s + ' + s.casNaRiesenie +
             ' s na každé riešenie (o ' + pr.casNavyse + ' s viac ako na skúške) · tréning môžeš kedykoľvek ukončiť';
    } else if (k.skuska) {
      const s = k.skuska;
      info = 'Pozícií: ' + s.pocet + ' · na úspech treba aspoň ' + s.hranica + ' vyriešených úplne a bez chyby · ' +
             'čas: ' + s.casZaklad + ' s + ' + s.casNaRiesenie + ' s na každé riešenie';
    } else {
      const max = k.ulohy.reduce((sum, u) => sum + maxBodovUlohy(u), 0);
      info = 'Úloh: ' + k.ulohy.length + ' · najviac ' + max + ' bodov · za správnu odpoveď +' +
             BODY_SPRAVNE + ', za chybu ' + znak(BODY_CHYBA);
    }
    koren.innerHTML = lista(true) +
      '<div class="uvod">' +
      '<div class="uvod-hlava">' + (k.znacka || k.priprava ? '' : 'Kapitola ' + k.cislo + ' · ') + esc(k.nazov) + '</div>' +
      grosikRiadok('vesely', bublina, null, true) +
      (k.prePokrocilych ? '<details class="ramcek"><summary>Pre pokročilých</summary><p>' + esc(k.prePokrocilych) + '</p></details>' : '') +
      (k.preTrenerov && vidiTrenerskeRamceky()
        ? '<details class="ramcek trener"><summary>Pre trénerov</summary><p>' + esc(k.preTrenerov) + '</p></details>' : '') +
      '<div class="uvod-info">' + esc(info) + '</div>' +
      '<button class="primary velke" data-akcia="zacat">' +
      (k.skuska ? 'Začať skúšku' : (k.priprava ? 'Začať prípravu' : 'Začať úlohy')) + '</button></div>';
    naviazListu();
    koren.querySelector('[data-akcia="zacat"]').onclick = () => zacniKapitolu(k);
    window.scrollTo(0, 0);
  }

  // ════════════════════════════════════════════════════════════════════
  //  Priebeh kapitoly
  // ════════════════════════════════════════════════════════════════════
  function nahodnyVyber(pole, n) {
    const kopia = pole.slice();
    for (let i = kopia.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = kopia[i]; kopia[i] = kopia[j]; kopia[j] = t;
    }
    return kopia.slice(0, n);
  }

  // Počet riešení pozície v úlohe typu Nájdi všetky (pre časový limit skúšky)
  function pocetRieseni(typ, fen) {
    const poz = VC.parseFen(fen);
    if (typ === 'najdiSlabe') return VC.slaboPokryte(poz.board, poz.state).riesenia.length;
    if (typ === 'najdiVidlicky') return VC.vidlicky(poz.board, poz.state).riesenia.length;
    if (typ === 'najdiHrozby') return VC.hrozby(poz.board, poz.state).riesenia.length;
    return VC.braniaSoZiskom(poz.board, poz.state).riesenia.length;
  }

  function zacniKapitolu(k) {
    let ulohy = k.ulohy || [];
    let skuska = null;
    if (k.priprava) {
      // Ako skúška: rovnaký druh úloh a čas, len viac pozícií a na každú o casNavyse sekúnd viac
      const s = kapitolaSkusky().skuska, pr = k.priprava;
      const typ = s.typ || 'najdi';
      ulohy = nahodnyVyber(pr.pozicie, pr.pocet).map((fen, i) => {
        const n = pocetRieseni(typ, fen);
        return { id: 'P.' + (i + 1), typ: typ, fen: fen, limit: s.casZaklad + pr.casNavyse + s.casNaRiesenie * n,
                 vysvetlenie: '' };
      });
      skuska = { vysledky: [], diagnoza: {}, priprava: true };
    } else if (k.skuska) {
      const s = k.skuska;
      const typ = s.typ || 'najdi';    // Šachový trh: brania so ziskom, Stráž: najdiSlabe, Vidlička: najdiVidlicky
      ulohy = nahodnyVyber(s.pozicie, s.pocet).map((fen, i) => {
        const n = pocetRieseni(typ, fen);
        return { id: k.cislo + '.' + (i + 1), typ: typ, fen: fen, limit: s.casZaklad + s.casNaRiesenie * n,
                 vysvetlenie: '' };
      });
      skuska = { vysledky: [], diagnoza: {} };
    }
    stav = {
      kapitola: k,
      ulohy: ulohy,
      skuska: skuska,
      i: 0,
      skore: 0,
      seria: 0,
      spravnych: 0,
      chyb: 0,
      bonusy: 0,
      bonusySerie: 0,       // bonusy za sériu — idú nad maximum kapitoly
      max: ulohy.reduce((s, u) => s + maxBodovUlohy(u), 0)
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
      stav.bonusySerie += BONUS_SERIA;
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
    const u = stav.ulohy[stav.i];
    return '<span class="uloha-poradie">' + (k.priprava ? 'Príprava na skúšku' : (k.skuska ? 'Skúška' : (k.znacka ? 'Bonus' : 'Kapitola ' + k.cislo))) +
           ' · Úloha ' + (stav.i + 1) + ' / ' + stav.ulohy.length + '</span>' +
           (u && u.limit ? '<span class="cas" id="hraCas">⏱ ' + formatCas(u.limit) + '</span>'
                         : '<span class="seria" title="Séria správnych odpovedí — každých ' + DLZKA_SERIE +
                           ' = bonus">' + seria + '</span>') +
           '<span class="skore" id="hraSkore">' + bodov(stav.skore) + '</span>' +
           (k.priprava ? '<button class="secondary male" id="hraUkoncit">Ukončiť tréning</button>' : '');
  }

  // Príprava na skúšku: tlačidlo Ukončiť tréning — vyhodnotí to, čo hráč stihol
  function naviazUkoncenie() {
    const b = document.getElementById('hraUkoncit');
    if (b) b.onclick = () => { zastavVsetko(); ukazKoniec(); };
  }

  function obnovHlavu() {
    const el = document.getElementById('hraHlava');
    if (!el) return;
    const cas = document.getElementById('hraCas');
    const textCasu = cas ? cas.textContent : null;
    const trieda = cas ? cas.className : null;
    el.innerHTML = hlavaHtml();
    naviazUkoncenie();
    const novy = document.getElementById('hraCas');
    if (novy && textCasu !== null) { novy.textContent = textCasu; novy.className = trieda; }
  }

  // ── Časový limit (skúška) ────────────────────────────────────────────
  function spustiCasovac(sekund, priVyprsani) {
    zastavCasovac();
    const koniec = Date.now() + sekund * 1000;
    const tik = () => {
      const zostava = (koniec - Date.now()) / 1000;
      const el = document.getElementById('hraCas');
      if (el) {
        el.textContent = '⏱ ' + formatCas(zostava);
        el.className = 'cas' + (zostava <= 10 ? ' malo' : '');
      }
      if (zostava <= 0) { zastavCasovac(); priVyprsani(); }
    };
    casovac = setInterval(tik, 250);
    tik();
  }

  function zastavCasovac() {
    if (casovac) { clearInterval(casovac); casovac = null; }
  }

  // ── Obrazovka úlohy ───────────────────────────────────────────────────
  let sachovnica = null;
  let prehravac = null;

  function zastavPrehravac() {
    if (prehravac) prehravac.zastav();
  }

  function zastavVsetko() {
    zastavPrehravac();
    zastavCasovac();
  }

  function ukazUlohu() {
    zastavVsetko();
    prehravac = null;
    sachovnica = null;
    const u = stav.ulohy[stav.i];
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
      grosikRiadok('rozmysla', esc(T.bublinaUlohy), 'hraBublina', false) +
      '<div id="hraSpatna"></div>' +
      '</div></div></div>';
    naviazListu();
    naviazUkoncenie();

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
    zastavCasovac();
    const posledna = stav.i >= stav.ulohy.length - 1;
    const dokoncit = stav.skuska ? (stav.skuska.priprava ? 'Vyhodnotiť prípravu' : 'Vyhodnotiť skúšku') : 'Dokončiť kapitolu';
    nastavOdpovede(
      '<div class="vysledok ' + (spravne ? 'dobre' : 'zle') + '">' + textVysledku + '</div>' +
      '<button class="primary velke" id="hraDalej">' +
      (spravne ? (posledna ? dokoncit : 'Ďalej') : (posledna ? 'Rozumiem, ' + dokoncit.toLowerCase() : 'Rozumiem, ďalej')) +
      '</button>',
      el => {
        el.querySelector('#hraDalej').onclick = () => {
          zastavVsetko();
          if (posledna) ukazKoniec(); else { stav.i++; ukazUlohu(); }
        };
      });
  }

  // ── Rebrík výmeny po odpovedi ────────────────────────────────────────
  function spustiRebrik(uci) {
    if (!prehravac) return;
    prehravac.nacitaj(stav.ulohy[stav.i]._poz.board, uci);
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
                         (k.strana === p.strana ? 'beriem ' : 'súper berie ') + k.figurka +
                       (k.premena ? ' a mení sa na dámu' : '');
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
    const u = stav.ulohy[stav.i];
    const prepinac = (ineMoznosti && ineMoznosti.length > 1)
      ? '<div class="prepinac">Rebrík pre: ' + ineMoznosti.map(x =>
          '<button class="secondary male' + (x === uci ? ' vybrane' : '') + '" data-uci="' + x + '">' +
          esc(nazov(u, x)) + '</button>').join('') + '</div>'
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
    return ziskNaSachovnici(u._poz.board, uci);
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
  //  Rozbor chýb v skúške — ktorú kapitolu zopakovať
  // ════════════════════════════════════════════════════════════════════
  const DOVODY = {
    2: 'Prehliadnutá nekrytá figúrka',
    3: 'Prehliadnuté branie za druhú stranu',
    4: 'Prehliadnuté branie lacnejšou figúrkou',
    5: 'Rovná výmena označená ako zisk',
    6: 'Stratové branie krytej figúrky',
    7: 'Prehliadnuté druhé branie toho istého terča',
    8: 'Prehliadnutý zisk vďaka batérii',
    9: 'Prehliadnutý zisk vďaka väzbe'
  };

  function dovodChyby(zisk) {
    return zisk === 0 ? 5 : 6;
  }

  // Stojí za figúrkou z na línii k poľu na figúrka rovnakej farby, ktorá sa pridá? (batéria)
  function maBateriu(board, na) {
    const tr = Math.floor(na / 8), tc = na % 8;
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (!p || !VC.attacksSq(board, i, na)) continue;
      const pl = p.toLowerCase();
      if (pl === 'n' || pl === 'k') continue;
      const r = Math.floor(i / 8), c = i % 8;
      const dr = Math.sign(r - tr), dc = Math.sign(c - tc);
      const diag = dr !== 0 && dc !== 0;
      let rr = r + dr, cc = c + dc;
      while (rr >= 0 && rr < 8 && cc >= 0 && cc < 8) {
        const q = board[rr * 8 + cc];
        if (q) {
          if (VC.pieceColor(q) === VC.pieceColor(p)) {
            const ql = q.toLowerCase();
            if (ql === 'q' || (diag && ql === 'b') || (!diag && ql === 'r')) return true;
          }
          break;
        }
        rr += dr; cc += dc;
      }
    }
    return false;
  }

  function dovodPrehliadnutia(board, uci, najdene) {
    const z = VC.sqIndex(uci.slice(0, 2)), na = VC.sqIndex(uci.slice(2, 4));
    const strana = VC.pieceColor(board[z]);
    const superStrana = strana === 'w' ? 'b' : 'w';
    if (najdene.some(x => x.slice(2, 4) === uci.slice(2, 4))) return 7;
    // väzba: súperova figúrka na pole útočí, ale je viazaná na kráľa a brať späť nesmie
    // (kráľ, ktorý nesmie vstúpiť na kryté pole, sa za väzbu nepovažuje)
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (p && p.toLowerCase() !== 'k' && VC.pieceColor(p) === superStrana && VC.attacksSq(board, i, na) &&
          VC.pinAxis(board, i) !== null &&
          !VC.isLegal(board, { active: superStrana, castling: '-', ep: '-' }, i, na, '')) return 9;
    }
    if (maBateriu(board, na)) return 8;
    // za druhú stranu: hráč našiel brania súpera, ale za túto stranu ani jedno
    const farba = x => VC.pieceColor(board[VC.sqIndex(x.slice(0, 2))]);
    if (!najdene.some(x => farba(x) === strana) && najdene.some(x => farba(x) !== strana)) return 3;
    return VC.countAttackers(board, na, superStrana) === 0 ? 2 : 4;
  }

  function zapisDiagnozu(kapitola) {
    if (!stav.skuska) return;
    stav.skuska.diagnoza[kapitola] = (stav.skuska.diagnoza[kapitola] || 0) + 1;
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
      ukazPokracovanie(true, '+' + BODY_SPRAVNE + ' bodov · ' + textObchodu(zisk));
    } else {
      zapisChybu();
      grosikHovori('smutny', textChyby + ' ' + esc(u.vysvetlenie) + ' Pozri si rebrík výmeny.' + veta);
      ukazPokracovanie(false, znak(BODY_CHYBA) + ' bodov · ' + textObchodu(zisk));
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
      const legalny = jeLegalny(u._poz.board, u.tah);
      const zisk = legalny ? ziskTahu(u, u.tah) : null;
      const otazka = u.otazka || 'Je <b>{tah}</b> branie so ziskom?';
      document.getElementById('hraZadanie').innerHTML = otazka.replace('{tah}', esc(nazov(u, u.tah)));
      sachovnica.oznac(oznacTah(u.tah));
      nastavOdpovede('<div class="moznosti dve">' +
        '<button class="moznost ano" data-h="ano">Áno</button>' +
        '<button class="moznost nie" data-h="nie">Nie</button></div>',
        el => el.querySelectorAll('.moznost').forEach(b => b.onclick = () => {
          const odpoved = b.dataset.h === 'ano';
          if (!legalny) {
            // Ťah viazanou figúrkou: nie je to ani legálny ťah, rebrík sa neprehráva
            const dobre = !odpoved;
            vyznacVolbu(b, dobre);
            sachovnica.naKlik = null;
            if (dobre) {
              const bonus = zapisSpravne();
              grosikHovori('nadseny', pochvala() + ' ' + esc(u.vysvetlenie) + bonus);
              ukazPokracovanie(true, '+' + BODY_SPRAVNE + ' bodov · nelegálny ťah');
            } else {
              zapisChybu();
              grosikHovori('smutny', 'Pozor, tento ťah nie je ani legálny! ' + esc(u.vysvetlenie));
              ukazPokracovanie(false, znak(BODY_CHYBA) + ' bodov · nelegálny ťah');
            }
            return;
          }
          const dobre = odpoved === (zisk > 0);
          vyhodnotJednoBranie(u, dobre, b, zisk > 0
            ? 'Je to zisk ' + znak(zisk) + '!'
            : (zisk === 0 ? 'Nie je to zisk, je to len výmena.' : 'Nie je to zisk — stratil by si ' + mince(-zisk) + '.'));
        }));
      grosikHovori('rozmysla', 'Pozri sa, či figúrku niekto kryje, a spočítaj, čo dostaneš a čo zaplatíš.');
    }
  };

  // ── Ktorý stánok? — na ktorom poli sa počíta zisk brania ─────────────
  // Správny stánok je vždy cieľové pole ťahu: tam sa začína a končí výmena.
  TYPY.stanok = {
    priprav(u) {
      const spravne = u.tah.slice(2, 4);
      const zisk = ziskTahu(u, u.tah);
      document.getElementById('hraZadanie').innerHTML =
        'Na ktorom stánku sa počíta zisk ťahu <b>' + esc(nazov(u, u.tah)) + '</b>?';
      sachovnica.oznac(oznacTah(u.tah));
      nastavOdpovede('<div class="moznosti">' + u.moznosti.map(pole =>
        '<button class="moznost" data-h="' + pole + '">' + esc(pole) + '</button>').join('') + '</div>',
        el => el.querySelectorAll('.moznost').forEach(b => b.onclick = () => {
          const dobre = b.dataset.h === spravne;
          vyznacVolbu(b, dobre);
          el.querySelectorAll('.moznost').forEach(x => { if (x.dataset.h === spravne) x.classList.add('spravna'); });
          sachovnica.naKlik = null;
          panelRebrika(u.tah);
          spustiRebrik(u.tah);
          const naStanku = ' Na stánku ' + spravne + ': ' + textObchodu(zisk).toLowerCase() + '.';
          if (dobre) {
            const bonus = zapisSpravne();
            grosikHovori('nadseny', pochvala() + ' ' + esc(u.vysvetlenie) + naStanku + bonus);
            ukazPokracovanie(true, '+' + BODY_SPRAVNE + ' bodov · stánok ' + spravne);
          } else {
            zapisChybu();
            grosikHovori('smutny', 'Správne je ' + spravne + '. ' + esc(u.vysvetlenie) + naStanku);
            ukazPokracovanie(false, znak(BODY_CHYBA) + ' bodov · stánok ' + spravne);
          }
        }));
      grosikHovori('rozmysla', 'Stánok je pole, na ktorom sa berie. Tam sa uzatvára celý obchod.');
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
            ukazPokracovanie(true, '+' + BODY_SPRAVNE + ' bodov · ' + textObchodu(zisky[volba]));
          } else {
            zapisChybu();
            grosikHovori('smutny', esc(nazov(u, volba)) + ' je pasca: ' + textObchodu(zisky[volba]).toLowerCase() +
                         '. ' + esc(u.vysvetlenie) + ' Rebrík iného brania si pozrieš tlačidlom nad tabuľkou.');
            ukazPokracovanie(false, znak(BODY_CHYBA) + ' bodov · ' + textObchodu(zisky[volba]));
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
      const ul = { najdene: [], chybne: [], vybrane: null, hotovo: false, chybVUlohe: 0, casVyprsal: false };

      document.getElementById('hraZadanie').innerHTML = 'Nájdi všetky brania so ziskom <span class="slabo">(biele aj čierne)</span>';
      grosikHovori('rozmysla', stav.skuska
        ? skuskaVyzva() + ' Nájdi všetky brania so ziskom za oboch skôr, ako vyprší čas.'
        : 'Klikni na figúrku, ktorá má brať, a potom na figúrku, ktorú má zobrať. Hľadaj za bieleho aj za čierneho.');

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
        if (!ul.najdene.length && !ul.chybne.length && !ul.hotovo) h += '<div class="slabo">Zatiaľ nič.</div>';
        ul.najdene.forEach(x => {
          h += '<div class="zaznam dobre"><b>' + esc(nazov(u, x)) + '</b> ' + esc(vysvetlenieRiesenia[x]) + '</div>';
        });
        ul.chybne.forEach(x => {
          h += '<div class="zaznam zle"><b>' + esc(nazov(u, x)) + '</b> ' + textObchodu(ziskTahu(u, x)) + '</div>';
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
        if (ul.hotovo) return;
        ul.hotovo = true;
        ul.vybrane = null;
        zastavCasovac();
        sachovnica.naKlik = null;
        znacky();
        const vsetkyNajdene = ul.najdene.length === riesenia.length;
        const bezChyby = vsetkyNajdene && ul.chybVUlohe === 0 && !ul.casVyprsal;
        const prehliadnute = riesenia.filter(x => !ul.najdene.includes(x));
        let text;
        if (bezChyby) {
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
          text = (ul.casVyprsal ? 'Čas vypršal · ' : '') + 'Prehliadnuté: ' + prehliadnute.length;
          grosikHovori('smutny', (ul.casVyprsal ? 'Čas vypršal. ' : (vzdal ? 'Niečo ti ešte chýbalo. ' : '')) +
                       (u.vysvetlenie ? esc(u.vysvetlenie) : 'Pozri sa vpravo, čo si prehliadol.'));
        }
        // Skúška: zápis výsledku a rozbor chýb
        if (stav.skuska) {
          prehliadnute.forEach(x => zapisDiagnozu(dovodPrehliadnutia(u._poz.board, x, ul.najdene)));
          stav.skuska.vysledky.push({ fen: u.fen, bezChyby: bezChyby });
        }
        zoznam();
        ukazPokracovanie(bezChyby || (vsetkyNajdene && !stav.skuska), text);
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
              zapisDiagnozu(dovodChyby(branie.zisk));
              grosikHovori('smutny', esc(branie.nazov) + ' nie je branie so ziskom: ' +
                           textObchodu(branie.zisk).toLowerCase() + '. Pozri rebrík vpravo. ' + znak(BODY_CHYBA) + ' bodov.');
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

      if (u.limit) {
        spustiCasovac(u.limit, () => {
          if (ul.hotovo) return;
          ul.casVyprsal = true;
          zvuk('loss');
          dokonci(true);
        });
      }
    }
  };

  // ════════════════════════════════════════════════════════════════════
  //  Stráž figúrky (hra Stráž na trhu)
  // ----------------------------------------------------------------------
  //  Zlodeji = útočníci, strážnici = obrancovia. Počíta ich VisionCore presne
  //  ako tréning Slabo pokryté figúrky: batérie, figúrka za súperovou strelou,
  //  väzba na kráľa, kráľ na susednom poli. Figúrka je slabo pokrytá, keď
  //  strážnikov nie je viac ako zlodejov (aj 0 : 0); kráľ sa nehľadá.
  // ════════════════════════════════════════════════════════════════════
  function menoFig(p) { return MENO_FIGURKY[p.toUpperCase()]; }
  function menoNaPoli(board, sq) { return menoFig(board[sq]) + ' ' + VC.sqName(sq); }
  function jeZenskyRod(p) { return 'RQ'.includes(p.toUpperCase()); }
  function pokryty(p) { return jeZenskyRod(p) ? 'pokrytá' : 'pokrytý'; }
  function jeKral(p) { return !!p && p.toUpperCase() === 'K'; }

  // V kapitole 1 sa ešte len počíta — slovo „slabo pokrytá" príde až v kapitole 2
  function ukazujeVerdikt() { return !(stav && stav.kapitola && stav.kapitola.bezVerdiktu); }

  // Prvá figúrka na línii od strážnika k poľu — tá, za ktorou strážnik stojí
  function predNim(board, odkial, kam) {
    const r1 = Math.floor(odkial / 8), c1 = odkial % 8, r2 = Math.floor(kam / 8), c2 = kam % 8;
    const dr = Math.sign(r2 - r1), dc = Math.sign(c2 - c1);
    let r = r1 + dr, c = c1 + dc;
    while ((r !== r2 || c !== c2) && r >= 0 && r < 8 && c >= 0 && c < 8) {
      if (board[r * 8 + c]) return r * 8 + c;
      r += dr; c += dc;
    }
    return null;
  }

  // „Veža d1 — v batérii za vežou d2", „Veža e1 — za súperovou vežou e4"
  function popisStraznika(board, x, ciel) {
    let t = velkePismeno(menoFig(x.figurka)) + ' ' + x.pole;
    if (!x.cez) return t;
    const pred = predNim(board, x.i, ciel);
    if (pred === null) return t;
    const p = board[pred];
    const meno = MENO_FIGURKY_7[p.toUpperCase()] + ' ' + VC.sqName(pred);
    if (VC.pieceColor(p) === VC.pieceColor(x.figurka)) return t + ' — v batérii za ' + meno;
    return t + ' — za súperov' + (jeZenskyRod(p) ? 'ou ' : 'ým ') + meno;
  }

  function strazZnacky(board, sq, info) {
    const z = {};
    z[sq] = 'straz-ciel';
    if (jeKral(board[sq])) return z;
    info.utocnici.forEach(x => { z[x.i] = 'zlodej' + (x.cez ? ' za' : ''); });
    info.obrancovia.forEach(x => { z[x.i] = 'straznik' + (x.cez ? ' za' : ''); });
    return z;
  }

  function zlucZnacky(a, b) {
    const z = Object.assign({}, a || {});
    Object.keys(b).forEach(k => { z[k] = (z[k] ? z[k] + ' ' : '') + b[k]; });
    return z;
  }

  // Text do pása pod šachovnicou: „Jazdec d5 · Zlodeji 2 : Strážnici 2 → slabo pokrytý"
  function textStraze(board, sq, info, sVerdiktom) {
    const meno = velkePismeno(menoNaPoli(board, sq));
    if (jeKral(board[sq])) return { text: meno + ' — kráľa nehľadáme, nikto ho nesmie zobrať.', trieda: 'nula' };
    const pocty = 'Zlodeji ' + info.utocnici.length + ' : Strážnici ' + info.obrancovia.length;
    if (!sVerdiktom) return { text: meno + ' · ' + pocty, trieda: 'nula' };
    return {
      text: meno + ' · ' + pocty + ' → ' + (info.slaba ? 'slabo ' : 'dobre ') + pokryty(board[sq]),
      trieda: info.slaba ? 'minus' : 'plus'
    };
  }

  function nastavPasik(text, trieda) {
    const pasik = document.getElementById('hraPasik');
    if (!pasik) return;
    pasik.hidden = false;
    pasik.className = 'pasik' + (trieda ? ' ' + trieda : '');
    document.getElementById('hraPasikUcetBox').hidden = true;
    document.getElementById('hraPasikText').textContent = text;
  }

  // Karta „Stráž" do pravého panela
  function htmlStraze(board, sq, prepinac) {
    const p = board[sq];
    let h = '<div class="panel-karta straz-karta"><h3>Stráž: ' + esc(menoNaPoli(board, sq)) + '</h3>' + (prepinac || '');
    if (jeKral(p)) {
      return h + '<div class="slabo">Kráľa nehľadáme. Nikto ho nesmie zobrať, takže strážnikov nepotrebuje.</div></div>';
    }
    const info = VC.strazFigurky(board, sq);
    const zoznam = (pole, trieda) => pole.length
      ? '<ul class="straz-zoznam">' + pole.map(x => '<li class="' + trieda + (x.cez ? ' za' : '') + '">' +
          esc(popisStraznika(board, x, sq)) + '</li>').join('') + '</ul>'
      : '<div class="slabo straz-nikto">nikto</div>';
    h += '<div class="straz-nadpis zlodeji">Zlodeji (útočníci): ' + info.utocnici.length + '</div>' +
         zoznam(info.utocnici, 'zlodej') +
         '<div class="straz-nadpis straznici">Strážnici (obrancovia): ' + info.obrancovia.length + '</div>' +
         zoznam(info.obrancovia, 'straznik');
    if (ukazujeVerdikt()) {
      const ut = info.utocnici.length, ob = info.obrancovia.length;
      h += '<div class="straz-verdikt ' + (info.slaba ? 'slaba' : 'dobra') + '">' +
           (info.slaba
             ? (ob === 0 && ut === 0 ? 'Nikto ' + (jeZenskyRod(p) ? 'ju' : 'ho') + ' nestráži'
                                     : (ob === ut ? 'Strážnikov je rovnako ako zlodejov' : 'Strážnikov je menej ako zlodejov'))
               + ' → <b>slabo ' + pokryty(p) + '</b>.'
             : 'Strážnikov je viac ako zlodejov → <b>dobre ' + pokryty(p) + '</b>.') + '</div>';
      if (info.slaba) {
        h += '<div class="straz-veta">V tréningu uvidíš: „' + esc(VC.vysvetliSlaboPokrytu(board, VC.sqName(sq))) + '“</div>';
      }
    }
    h += '<div class="straz-legenda"><span><i class="lg ciel"></i>figúrka</span><span><i class="lg zlodej"></i>zlodej</span>' +
         '<span><i class="lg straznik"></i>strážnik</span><span><i class="lg za"></i>stojí v rade za inou</span></div>' +
         '<div class="slabo straz-tip">Klikni na hociktorú figúrku a uvidíš jej stráž.</div></div>';
    return h;
  }

  // Ukáže stráž figúrky na šachovnici, v páse a v paneli.
  //   o.zaklad   — značky, ktoré majú na šachovnici zostať (nájdené figúrky, kandidáti)
  //   o.panelPred — HTML nad kartou stráže (zoznam nájdených figúrok)
  //   o.prepinac — HTML s tlačidlami na prepínanie figúrok, o.poPaneli(el) ich naviaže
  //   o.pasik    — vlastný text pása (inak pás ukáže počty stráže)
  function ukazStraz(sq, o) {
    o = o || {};
    const board = stav.ulohy[stav.i]._poz.board;
    const info = VC.strazFigurky(board, sq);
    sachovnica.oznac(zlucZnacky(o.zaklad, strazZnacky(board, sq, info)));
    if (o.pasik) nastavPasik(o.pasik.text, o.pasik.trieda);
    else { const t = textStraze(board, sq, info, ukazujeVerdikt()); nastavPasik(t.text, t.trieda); }
    const el = document.getElementById('hraSpatna');
    if (el) {
      el.innerHTML = (o.panelPred || '') + htmlStraze(board, sq, o.prepinac);
      if (o.poPaneli) o.poPaneli(el);
    }
    return info;
  }

  // Po odpovedi: klik na ktorúkoľvek figúrku ukáže jej stráž
  function rezimPrezerania(moznosti) {
    const board = stav.ulohy[stav.i]._poz.board;
    sachovnica.naKlik = pole => { if (board[pole]) ukazStraz(pole, moznosti ? moznosti() : {}); };
  }

  // ── Rozbor chýb v skúške Stráže na trhu — ktorú kapitolu zopakovať ───
  //  2 Nikto ju nestráži · 3 Rovnako nestačí · 4 Počítajú sa kusy, nie ceny
  //  5 Za oboch, aj pešiaky · 6 Batéria · 7 Väzba
  //
  // Rozhodla o figúrke batéria alebo väzba? Porovná skutočný výsledok
  // s tým, čo by vyšlo bez figúrok v rade za inou (batéria) a keby sa
  // viazané figúrky počítali (väzba).
  function coRozhoduje(board, sq) {
    const info = VC.strazFigurky(board, sq);
    const ut = info.utocnici.length, ob = info.obrancovia.length;
    const slaba = ob <= ut;
    const priami = zoznam => zoznam.filter(x => !x.cez).length;
    const bateria = (priami(info.obrancovia) <= priami(info.utocnici)) !== slaba;
    let utV = ut, obV = ob;
    const zapocitane = new Set(info.utocnici.concat(info.obrancovia).map(x => x.i));
    for (let j = 0; j < 64; j++) {
      const p = board[j];
      if (!p || j === sq || zapocitane.has(j) || jeKral(p)) continue;
      if (!VC.attacksSq(board, j, sq) || VC.pinAxis(board, j) === null) continue;
      if (VC.pieceColor(p) === info.farba) obV++; else utV++;
    }
    const vazba = (obV <= utV) !== slaba;
    return { ut: ut, ob: ob, bateria: bateria, vazba: vazba };
  }

  // Hráč klikol na figúrku, ktorá slabo pokrytá nie je (alebo na kráľa)
  function dovodOmyluSlabej(board, sq) {
    if (jeKral(board[sq])) return 5;
    const r = coRozhoduje(board, sq);
    if (r.vazba) return 7;
    if (r.bateria) return 6;
    return 4;                       // dobre pokrytá figúrka — napr. veža napadnutá pešiakom
  }

  // Hráč prehliadol slabo pokrytú figúrku
  function dovodPrehliadnutejSlabej(board, pole, najdene, riesenia) {
    const sq = VC.sqIndex(pole);
    const r = coRozhoduje(board, sq);
    if (r.vazba) return 7;
    if (r.bateria) return 6;
    const farba = x => VC.pieceColor(board[VC.sqIndex(x)]);
    const moja = VC.pieceColor(board[sq]);
    // hľadal len za jednu stranu: za túto (aspoň 2 riešenia) nenašiel nič, za druhú áno
    if ((riesenia || []).filter(x => farba(x) === moja).length >= 2 &&
        !najdene.some(x => farba(x) === moja) && najdene.some(x => farba(x) !== moja)) return 5;
    if (r.ut === 0 && r.ob === 0) return 2;
    if (r.ut === r.ob) return 3;
    return board[sq].toLowerCase() === 'p' ? 5 : 2;
  }

  // ── Koľko? — koľko útočníkov (obrancov) má označená figúrka ──────────
  TYPY.pocet = {
    priprav(u) {
      const board = u._poz.board, sq = VC.sqIndex(u.pole);
      const obrancovia = u.co === 'obrancovia';
      const info = VC.strazFigurky(board, sq);
      const spravna = (obrancovia ? info.obrancovia : info.utocnici).length;
      document.getElementById('hraZadanie').innerHTML = 'Koľko ' +
        (obrancovia ? '<b>obrancov</b> (strážnikov)' : '<b>útočníkov</b> (zlodejov)') +
        ' má ' + esc(menoNaPoli(board, sq)) + '?';
      const z = {}; z[sq] = 'straz-ciel';
      sachovnica.oznac(z);
      const cisla = [];
      for (let c = 0; c <= Math.max(4, spravna); c++) cisla.push(c);
      nastavOdpovede('<div class="moznosti pocty">' + cisla.map(c =>
        '<button class="moznost" data-h="' + c + '">' + c + '</button>').join('') + '</div>',
        el => el.querySelectorAll('.moznost').forEach(b => b.onclick = () => {
          const dobre = Number(b.dataset.h) === spravna;
          vyznacVolbu(b, dobre);
          ukazStraz(sq);
          rezimPrezerania();
          const kto = obrancovia ? 'strážnikov' : 'zlodejov';
          if (dobre) {
            const bonus = zapisSpravne();
            grosikHovori('nadseny', pochvala() + ' ' + esc(u.vysvetlenie) + bonus);
            ukazPokracovanie(true, '+' + BODY_SPRAVNE + ' bodov · ' + kto + ': ' + spravna);
          } else {
            zapisChybu();
            grosikHovori('smutny', 'Správne je ' + spravna + '. ' + esc(u.vysvetlenie));
            ukazPokracovanie(false, znak(BODY_CHYBA) + ' bodov · ' + kto + ': ' + spravna);
          }
        }));
      grosikHovori('rozmysla', obrancovia
        ? 'Spočítaj strážnikov: figúrky jeho farby, ktoré by mohli brať späť na to isté pole.'
        : 'Spočítaj zlodejov: súperove figúrky, ktoré by ho mohli zobrať.');
    }
  };

  // ── Slabá? — je označená figúrka slabo pokrytá? (Áno / Nie) ──────────
  TYPY.slaba = {
    priprav(u) {
      const board = u._poz.board, sq = VC.sqIndex(u.pole);
      const p = board[sq];
      const info = VC.strazFigurky(board, sq);
      const ut = info.utocnici.length, ob = info.obrancovia.length;
      document.getElementById('hraZadanie').innerHTML = (u.otazka || 'Je {figurka} <b>slabo {pokryty}</b>?')
        .replace('{figurka}', esc(menoNaPoli(board, sq))).replace('{pokryty}', pokryty(p));
      const z = {}; z[sq] = 'straz-ciel';
      sachovnica.oznac(z);
      nastavOdpovede('<div class="moznosti dve">' +
        '<button class="moznost ano" data-h="ano">Áno</button>' +
        '<button class="moznost nie" data-h="nie">Nie</button></div>',
        el => el.querySelectorAll('.moznost').forEach(b => b.onclick = () => {
          const dobre = (b.dataset.h === 'ano') === info.slaba;
          vyznacVolbu(b, dobre);
          ukazStraz(sq);
          rezimPrezerania();
          const vysledok = (info.slaba ? 'slabo ' : 'dobre ') + pokryty(p) + ' ' + ut + ' : ' + ob;
          if (dobre) {
            const bonus = zapisSpravne();
            grosikHovori('nadseny', pochvala() + ' ' + esc(u.vysvetlenie) + bonus);
            ukazPokracovanie(true, '+' + BODY_SPRAVNE + ' bodov · ' + vysledok);
          } else {
            zapisChybu();
            grosikHovori('smutny', esc(velkePismeno(menoNaPoli(board, sq))) + (info.slaba ? ' je' : ' nie je') +
                         ' slabo ' + pokryty(p) + ': zlodeji ' + ut + ', strážnici ' + ob + '. ' + esc(u.vysvetlenie));
            ukazPokracovanie(false, znak(BODY_CHYBA) + ' bodov · ' + vysledok);
          }
        }));
      grosikHovori('rozmysla', 'Spočítaj zlodejov aj strážnikov. Figúrka je v bezpečí, len keď má viac strážnikov.');
    }
  };

  // ── Ktorá? — ktorá z označených figúrok je slabo pokrytá ─────────────
  TYPY.ktora = {
    priprav(u) {
      const board = u._poz.board;
      const polia = u.moznosti.map(x => VC.sqIndex(x));
      const slabe = polia.filter(sq => VC.strazFigurky(board, sq).slaba);
      const zaklad = {};
      polia.forEach(sq => { zaklad[sq] = 'kandidat'; });
      document.getElementById('hraZadanie').innerHTML = u.otazka || 'Ktorá z označených figúrok je <b>slabo pokrytá</b>?';
      sachovnica.oznac(zaklad);

      const prepinac = vybrane => '<div class="prepinac">Stráž pre: ' + polia.map(sq =>
        '<button class="secondary male' + (sq === vybrane ? ' vybrane' : '') + '" data-pole="' + sq + '">' +
        esc(menoNaPoli(board, sq)) + '</button>').join('') + '</div>';
      const moznosti = vybrane => ({
        zaklad: zaklad,
        prepinac: prepinac(vybrane),
        poPaneli: el => el.querySelectorAll('.prepinac button').forEach(b => b.onclick = () => ukaz(Number(b.dataset.pole)))
      });
      const ukaz = sq => ukazStraz(sq, moznosti(sq));

      let hotovo = false;
      const vyber = sq => {
        if (hotovo) return;
        hotovo = true;
        const dobre = slabe.includes(sq);
        document.querySelectorAll('#hraOdpovede .moznost').forEach(x => {
          const pole = Number(x.dataset.h);
          if (slabe.includes(pole)) x.classList.add('spravna');
          else if (pole === sq) x.classList.add('nespravna');
        });
        ukaz(sq);
        sachovnica.naKlik = pole => { if (board[pole]) ukazStraz(pole, moznosti(pole)); };
        const spravna = slabe.map(x => menoNaPoli(board, x)).join(', ');
        if (dobre) {
          const bonus = zapisSpravne();
          grosikHovori('nadseny', pochvala() + ' ' + esc(u.vysvetlenie) + bonus);
          ukazPokracovanie(true, '+' + BODY_SPRAVNE + ' bodov · slabo pokrytá: ' + spravna);
        } else {
          const info = VC.strazFigurky(board, sq);
          zapisChybu();
          grosikHovori('smutny', esc(velkePismeno(menoNaPoli(board, sq))) + ' nie je slabo ' + pokryty(board[sq]) +
                       ': zlodeji ' + info.utocnici.length + ', strážnici ' + info.obrancovia.length + '. ' +
                       esc(u.vysvetlenie));
          ukazPokracovanie(false, znak(BODY_CHYBA) + ' bodov · slabo pokrytá je ' + spravna);
        }
      };

      nastavOdpovede('<div class="moznosti">' + polia.map(sq =>
        '<button class="moznost" data-h="' + sq + '">' + esc(velkePismeno(menoNaPoli(board, sq))) + '</button>').join('') +
        '</div>',
        el => el.querySelectorAll('.moznost').forEach(b => b.onclick = () => vyber(Number(b.dataset.h))));
      sachovnica.naKlik = pole => { if (polia.includes(pole)) vyber(pole); };
      grosikHovori('rozmysla', 'Pri každej označenej figúrke spočítaj zlodejov a strážnikov. Môžeš kliknúť aj priamo na figúrku.');
    }
  };

  // ── Nájdi všetky slabo pokryté figúrky (za oboch) ────────────────────
  //  Presne ako tréning Slabo pokryté figúrky v menu Zručnosti: hráč kliká
  //  na figúrky (nie ťahy), hľadá za bieleho aj čierneho, kráľa nie.
  TYPY.najdiSlabe = {
    priprav(u) {
      const board = u._poz.board;
      const vysl = VC.slaboPokryte(board, u._poz.state);
      const riesenia = vysl.riesenia;                     // polia, napr. 'e4'
      const veta = {};
      riesenia.forEach((x, i) => { veta[x] = vysl.vysvetlenia[i]; });
      const ul = { najdene: [], chybne: [], hotovo: false, chybVUlohe: 0, casVyprsal: false };

      document.getElementById('hraZadanie').innerHTML =
        'Nájdi všetky <b>slabo pokryté</b> figúrky <span class="slabo">(biele aj čierne)</span>';
      grosikHovori('rozmysla', stav.skuska
        ? skuskaVyzva() + ' Nájdi všetky slabo pokryté figúrky za oboch skôr, ako vyprší čas.'
        : 'Klikni na každú slabo pokrytú figúrku — bielu aj čiernu. Keď už žiadnu nevidíš, stlač Hotovo.');

      const farba = pole => VC.pieceColor(board[VC.sqIndex(pole)]);
      const textPocitadla = () => {
        let t = 'Nájdené: ' + ul.najdene.length + ' / ' + riesenia.length;
        if (u.pomocka === 'strany') {
          const w = riesenia.filter(x => farba(x) === 'w'), b = riesenia.filter(x => farba(x) === 'b');
          t += ' · Biely ' + ul.najdene.filter(x => farba(x) === 'w').length + '/' + w.length +
               ' · Čierny ' + ul.najdene.filter(x => farba(x) === 'b').length + '/' + b.length;
        }
        return t;
      };

      const znacky = () => {
        const z = {};
        ul.najdene.forEach(x => { z[VC.sqIndex(x)] = 'slaba-najdena'; });
        ul.chybne.forEach(x => { z[VC.sqIndex(x)] = 'omyl'; });
        if (ul.hotovo) riesenia.filter(x => !ul.najdene.includes(x)).forEach(x => { z[VC.sqIndex(x)] = 'prehliadnuta'; });
        return z;
      };

      // Veta z tréningu so zvýraznenou figúrkou: „<b>Pešiak na a2</b>: útočníkov 1, obrancov 0…"
      const vetaHtml = x => {
        const m = /^(\S+ na [a-h][1-8]:?)\s*([\s\S]*)$/.exec(veta[x]);
        return m ? '<b>' + esc(m[1]) + '</b> ' + esc(m[2]) : esc(veta[x]);
      };

      const zoznamHtml = () => {
        let h = '<div class="panel-karta"><h3>Tvoje figúrky</h3>';
        if (!ul.najdene.length && !ul.chybne.length && !ul.hotovo) h += '<div class="slabo">Zatiaľ nič.</div>';
        ul.najdene.forEach(x => { h += '<div class="zaznam dobre">' + vetaHtml(x) + '</div>'; });
        ul.chybne.forEach(x => {
          const sq = VC.sqIndex(x);
          let t;
          if (jeKral(board[sq])) t = 'kráľa nehľadáme';
          else {
            const i = VC.strazFigurky(board, sq);
            t = 'zlodeji ' + i.utocnici.length + ' : strážnici ' + i.obrancovia.length + ' → dobre ' + pokryty(board[sq]);
          }
          h += '<div class="zaznam zle"><b>' + esc(velkePismeno(menoNaPoli(board, sq))) + '</b> ' + esc(t) + '</div>';
        });
        if (ul.hotovo) {
          riesenia.filter(x => !ul.najdene.includes(x)).forEach(x => {
            h += '<div class="zaznam prehliadnute">' + vetaHtml(x) + ' <span class="znacka-prehliadnuta">prehliadnutá</span></div>';
          });
        }
        return h + '</div>';
      };

      // Prekreslí šachovnicu, pás a panel; sq = figúrka, ktorej stráž sa ukáže
      const obnov = sq => {
        const zaklad = znacky();
        let pasik = textPocitadla();
        if (sq !== null && sq !== undefined) {
          const info = VC.strazFigurky(board, sq);
          if (!jeKral(board[sq])) {
            pasik += ' · ' + velkePismeno(menoNaPoli(board, sq)) + ': zlodeji ' + info.utocnici.length +
                     ' : strážnici ' + info.obrancovia.length;
          }
          ukazStraz(sq, { zaklad: zaklad, panelPred: zoznamHtml(), pasik: { text: pasik, trieda: '' } });
        } else {
          sachovnica.oznac(zaklad);
          nastavPasik(pasik, '');
          document.getElementById('hraSpatna').innerHTML = zoznamHtml();
        }
      };

      const dokonci = vzdal => {
        if (ul.hotovo) return;
        ul.hotovo = true;
        zastavCasovac();
        const vsetkyNajdene = ul.najdene.length === riesenia.length;
        const bezChyby = vsetkyNajdene && ul.chybVUlohe === 0 && !ul.casVyprsal;
        const prehliadnute = riesenia.filter(x => !ul.najdene.includes(x));
        let text;
        if (bezChyby) {
          pripocitaj(BONUS_BEZ_CHYBY);
          stav.bonusy += BONUS_BEZ_CHYBY;
          obnovHlavu();
          text = 'Všetky bez chyby: bonus +' + BONUS_BEZ_CHYBY;
          grosikHovori('nadseny', 'Našiel si všetky slabo pokryté figúrky a ani raz si sa nepomýlil! ' + esc(u.vysvetlenie));
        } else if (vsetkyNajdene) {
          text = 'Všetky nájdené';
          grosikHovori('vesely', 'Máš ich všetky. ' + esc(u.vysvetlenie));
        } else {
          stav.seria = 0;
          obnovHlavu();
          text = (ul.casVyprsal ? 'Čas vypršal · ' : '') + 'Prehliadnuté: ' + prehliadnute.length;
          grosikHovori('smutny', (ul.casVyprsal ? 'Čas vypršal. ' : (vzdal ? 'Niečo ti ešte chýbalo. ' : '')) +
                       'Prehliadnuté figúrky sú naoranžovo. ' + (u.vysvetlenie ? esc(u.vysvetlenie) + ' ' : '') +
                       'Klikni na figúrku a uvidíš jej stráž.');
        }
        // Skúška: zápis výsledku a rozbor chýb
        if (stav.skuska) {
          prehliadnute.forEach(x => zapisDiagnozu(dovodPrehliadnutejSlabej(board, x, ul.najdene, riesenia)));
          stav.skuska.vysledky.push({ fen: u.fen, bezChyby: bezChyby });
        }
        obnov(null);
        ukazPokracovanie(bezChyby || (vsetkyNajdene && !stav.skuska), text);
      };

      sachovnica.naKlik = pole => {
        const p = board[pole];
        if (ul.hotovo) { if (p) obnov(pole); return; }       // po skončení len prezeranie
        if (!p) { grosikHovori('rozmysla', 'Tu nič nestojí. Klikni na figúrku.'); return; }
        const meno = VC.sqName(pole);
        if (ul.najdene.includes(meno)) {
          grosikHovori('vesely', 'Túto už máš. Hľadaj ďalej.');
        } else if (riesenia.includes(meno)) {
          ul.najdene.push(meno);
          const bonus = zapisSpravne();
          grosikHovori('nadseny', pochvala() + ' ' + esc(veta[meno]) + bonus);
        } else if (ul.chybne.includes(meno)) {
          grosikHovori('rozmysla', jeKral(p) ? 'Kráľa nehľadáme.' : 'Túto si už skúšal — slabo ' + pokryty(p) + ' nie je.');
        } else {
          ul.chybne.push(meno);
          ul.chybVUlohe++;
          zapisChybu();
          zapisDiagnozu(dovodOmyluSlabej(board, pole));
          if (jeKral(p)) {
            grosikHovori('smutny', 'Kráľa nehľadáme — nikto ho nesmie zobrať, takže strážnikov nepotrebuje. ' +
                         znak(BODY_CHYBA) + ' bodov.');
          } else {
            const i = VC.strazFigurky(board, pole);
            grosikHovori('smutny', esc(velkePismeno(menoNaPoli(board, pole))) + ' nie je slabo ' + pokryty(p) +
                         ': zlodeji ' + i.utocnici.length + ', strážnici ' + i.obrancovia.length +
                         '. Strážnikov je viac. ' + znak(BODY_CHYBA) + ' bodov.');
          }
        }
        obnov(pole);
        if (ul.najdene.length === riesenia.length) dokonci(false);
      };

      nastavOdpovede('<button class="secondary velke" id="hraHotovo">Hotovo — viac ich nevidím</button>',
        el => el.querySelector('#hraHotovo').onclick = () => { if (!ul.hotovo) dokonci(true); });
      obnov(null);

      if (u.limit) {
        spustiCasovac(u.limit, () => {
          if (ul.hotovo) return;
          ul.casVyprsal = true;
          zvuk('loss');
          dokonci(true);
        });
      }
    }
  };

  // ════════════════════════════════════════════════════════════════════
  //  Vidlička (hra Vidlička na trhu)
  // ----------------------------------------------------------------------
  //  Či je ťah vidlička, počíta VisionCore.rozoberVidlicku presne ako tréning
  //  Vidlička. Po odpovedi hra ukáže ťah na šachovnici (pozícia po ťahu):
  //  vidličkár nazlato, zelené šípky k terčom, ktoré sa počítajú, sivé
  //  k ostatným napadnutým figúrkam, oranžová prerušovaná pri odkrytom útoku
  //  a červená od figúrky, ktorá môže vidličkára zobrať. V paneli sú štyri
  //  podmienky s ✓ / ✗: dva nové terče – terče stoja za to – bezpečné pole – šach.
  // ════════════════════════════════════════════════════════════════════
  const PRECO_NIE = {
    dva_terce: 'Nenapadne dva nové terče',
    cena:      'Terč nestojí za to',
    pole:      'Vidličkára zoberú',
    kral:      'Kráľ terč ubráni',
    vazba:     'Figúrka je viazaná'
  };
  const PRECO_Z_JADRA = {
    ziadny_novy_terc: 'dva_terce', jeden_novy_terc: 'dva_terce', terc_nestoji_za_to: 'cena',
    vidlickara_zoberu: 'pole', kral_ubrani: 'kral', nelegalny: 'vazba'
  };
  const FARBY_SIPOK = {
    tah: '#2563eb', pocita: '#16a34a', nepocita: '#94a3b8', odkryty: '#ea580c', hrozba: '#dc2626',
    najdena: '#16a34a', chybna: '#64748b', prehliadnuta: '#ea580c', vazba: '#dc2626'
  };

  // Mena v 4. páde s poľom: „vežu c8", „kráľa g8"
  function menoNaPoli4(p, pole) { return MENO_FIGURKY_4[p.toUpperCase()] + ' ' + pole; }
  function zoznamSlov(pole) {
    if (pole.length <= 1) return pole.join('');
    return pole.slice(0, -1).join(', ') + ' a ' + pole[pole.length - 1];
  }
  // Prídavné mená podľa rodu figúrky: „napádal / napádala", „krytý / krytá"
  function rod(p, muz, zena) { return jeZenskyRod(p) ? zena : muz; }
  function minceAku(n) {
    const a = Math.abs(n);
    if (a === 1) return n + ' mincu';
    if (a >= 2 && a <= 4) return n + ' mince';
    return n + ' mincí';
  }
  function stranaText(s, pad) {
    if (pad === 2) return s === 'w' ? 'bieleho' : 'čierneho';
    return s === 'w' ? 'biely' : 'čierny';
  }

  // Všetky nesplnené podmienky. Odpoveď v úlohe „Prečo nie?" platí, keď trafí
  // ktorúkoľvek z nich; hlavný dôvod (prvý podľa generátora) je PRECO_Z_JADRA.
  function nesplnene(r) {
    if (r.vidlicka) return [];
    if (!r.dosiahne) return ['vazba'];
    const out = [];
    const matTerc = !!(r.mat && r.mat.length && r.zapocitane.length === 1);
    const kralUbrani = !!(r.kral && r.kral.dovod === 'ustup_zachrani');
    if (r.noveTerce < 2 && !matTerc) out.push('dva_terce');
    if (r.noveTerce >= 2 && r.zapocitane.length < 2 && !kralUbrani && !matTerc) out.push('cena');
    if (!r.bezpecne) out.push('pole');
    if (kralUbrani) out.push('kral');
    return out;
  }

  // Figúrka, ktorá viaže figúrku na poli sq k jej kráľovi (alebo null)
  function viazac(board, sq) {
    const ax = VC.pinAxis(board, sq);
    if (!ax) return null;
    let r = Math.floor(sq / 8) + ax[0], c = sq % 8 + ax[1];
    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      if (board[r * 8 + c]) return r * 8 + c;
      r += ax[0]; c += ax[1];
    }
    return null;
  }

  // ── Šípky na šachovnici (SVG cez šachovnicu, 100 jednotiek na pole) ──
  function kresliSipky(zoznam) {
    const board = document.getElementById('hraBoard');
    if (!board) return;
    let svg = board.querySelector('svg.sipky');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'sipky');
      svg.setAttribute('viewBox', '0 0 800 800');
      svg.setAttribute('aria-hidden', 'true');
      board.appendChild(svg);
    }
    const stred = i => [(i % 8) * 100 + 50, Math.floor(i / 8) * 100 + 50];
    let h = '<defs>' + Object.keys(FARBY_SIPOK).map(t =>
      '<marker id="hrot-' + t + '" viewBox="0 0 10 10" refX="3" refY="5" markerWidth="3" markerHeight="3" ' +
      'orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="' + FARBY_SIPOK[t] + '"/></marker>').join('') + '</defs>';
    const kluce = new Set((zoznam || []).map(s => s.z + '-' + s.na));
    (zoznam || []).forEach(s => {
      const a = stred(s.z), b = stred(s.na);
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
      // dve šípky medzi tými istými poľami (tam aj späť) sa posunú vedľa seba
      const o = kluce.has(s.na + '-' + s.z) ? 11 : 0;
      const ox = -dy / d * o, oy = dx / d * o;
      const x1 = a[0] + dx / d * 18 + ox, y1 = a[1] + dy / d * 18 + oy;
      const pred = d < 150 ? 30 : 42;                 // krátka šípka (o jedno pole) končí bližšie
      const x2 = b[0] - dx / d * pred + ox, y2 = b[1] - dy / d * pred + oy;
      const hrubka = s.typ === 'tah' ? 15 : 12;
      h += '<line class="sipka ' + s.typ + '" x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) +
           '" y2="' + y2.toFixed(1) + '" stroke="' + FARBY_SIPOK[s.typ] + '" stroke-width="' + hrubka + '" stroke-linecap="round"' +
           ((s.typ === 'odkryty' || s.typ === 'vazba') ? ' stroke-dasharray="20 16"' : '') +
           ' opacity="0.82" marker-end="url(#hrot-' + s.typ + ')"/>';
    });
    svg.innerHTML = h;
  }

  // Vyznačený ťah: figúrka namodro, cieľové pole prerušovane (nie načerveno ako pri braní)
  function oznacTahVidlicky(uci) {
    const z = {};
    z[VC.sqIndex(uci.slice(0, 2))] = 'selected';
    z[VC.sqIndex(uci.slice(2, 4))] = 'tah-ciel';
    return z;
  }

  function sipkaTahu(uci, typ) {
    return { z: VC.sqIndex(uci.slice(0, 2)), na: VC.sqIndex(uci.slice(2, 4)), typ: typ || 'tah' };
  }

  // Pôvodná pozícia so šípkou ťahu (otázka Je to vidlička? / Prečo nie?)
  function ukazTahNaSachovnici(u, uci) {
    sachovnica.nastav(u._poz.board);
    sachovnica.oznac(oznacTahVidlicky(uci));
    kresliSipky([sipkaTahu(uci)]);
  }

  // Značky a šípky rozboru na šachovnici
  function rozborNaSachovnici(u, r, pred) {
    const board = u._poz.board;
    if (!r.dosiahne) {
      // viazaná figúrka: pôvodná pozícia, šípka väzby až ku kráľovi
      sachovnica.nastav(board);
      const z = oznacTahVidlicky(r.tah); z[r.z] = 'omyl';
      const v = viazac(board, r.z);
      const sipky = [sipkaTahu(r.tah)];
      if (v !== null) { z[v] = 'hrozi'; sipky.push({ z: v, na: VC.findKing(board, r.strana), typ: 'vazba' }); }
      sachovnica.oznac(z);
      kresliSipky(sipky);
      return;
    }
    if (pred) {
      sachovnica.nastav(board);
      const z = oznacTahVidlicky(r.tah);
      z[r.z] = 'vidlickar';
      sachovnica.oznac(z);
      // aj terče, ktoré figúrka napádala už z pôvodného poľa (sivé šípky)
      const sipky = [sipkaTahu(r.tah)];
      r.napadnute.filter(x => !x.novy).forEach(x => sipky.push({ z: r.z, na: x.i, typ: 'nepocita' }));
      kresliSipky(sipky);
      return;
    }
    sachovnica.nastav(r.poTahu);
    const z = {};
    z[r.z] = 'last-from';
    z[r.na] = 'vidlickar';
    const sipky = [];
    r.napadnute.forEach(x => {
      z[x.i] = x.pocita ? 'terc-pocita' : 'terc-nepocita';
      sipky.push({ z: r.na, na: x.i, typ: x.pocita ? 'pocita' : 'nepocita' });
    });
    r.odkryte.forEach(o => { sipky.push({ z: o.z, na: o.i, typ: 'odkryty' }); if (!z[o.i]) z[o.i] = 'terc-nepocita'; });
    (r.mat || []).forEach(pole => { z[VC.sqIndex(pole)] = 'mat-pole'; });
    if (r.ziskSupera !== null && !r.bezpecne) {
      const rb = VC.rebrikVidlicky(r.poTahu, r.na, r.strana === 'w' ? 'b' : 'w');
      if (rb.kroky[0]) { z[rb.kroky[0].z] = 'hrozi'; sipky.push({ z: rb.kroky[0].z, na: r.na, typ: 'hrozba' }); }
    }
    sachovnica.oznac(z);
    kresliSipky(sipky);
  }

  // Má súper legálne branie vidličkára? (kráľ nesmie brať krytú figúrku)
  function superMozeBratVidlickara(r) {
    const opp = r.strana === 'w' ? 'b' : 'w', st = { active: opp, castling: '-', ep: '-' };
    for (let i = 0; i < 64; i++) {
      const p = r.poTahu[i];
      if (p && VC.pieceColor(p) === opp && VC.isLegal(r.poTahu, st, i, r.na, '')) return true;
    }
    return false;
  }
  function lenKralNapada(r) {
    const u = utocniciNa(r.poTahu, r.na, r.strana === 'w' ? 'b' : 'w');
    return u.length > 0 && u.every(i => jeKral(r.poTahu[i]));
  }

  // Výmena na poli vidličkára z pohľadu hráča (kto vidličkuje)
  function htmlVymenyVidlickara(r) {
    const superStrana = r.strana === 'w' ? 'b' : 'w';
    const rb = VC.rebrikVidlicky(r.poTahu, r.na, superStrana);
    if (!rb.kroky.length) return '';
    let h = '<table class="rebrik vidl-rebrik"><thead><tr><th>Ťah</th><th class="cislo">Pre teba</th></tr></thead><tbody>';
    rb.kroky.forEach(k => {
      h += '<tr><td><span class="bodka ' + k.strana + '"></span>' + esc(k.tah) + ' <span class="slabo">— ' +
           (k.strana === superStrana ? 'súper berie ' : 'beriem späť ') + esc(k.figurka) + '</span></td>' +
           '<td class="cislo ' + RV.triedaZnamienka(-k.ucet) + '">' + znak(-k.ucet) + '</td></tr>';
    });
    const v = -rb.vysledok;
    h += '<tr class="koniec"><td>' + esc(RV.textKonca(rb.koniec)) + '</td><td class="cislo ' + RV.triedaZnamienka(v) +
         '"><b>' + znak(v) + '</b></td></tr></tbody></table>';
    return h;
  }

  // Karta „Rozbor vidličky" do pravého panela
  function htmlRozboru(u, r, pred) {
    const board = u._poz.board;
    const kus = r.kus, meno = MENO_FIGURKY[kus.toUpperCase()];
    let h = '<div class="panel-karta vidl-karta"><h3>Rozbor: ' + esc(r.nazov) + '</h3>';
    h += '<div class="vidl-verdikt ' + (r.vidlicka ? 'ano' : 'nie') + '">' +
         (r.vidlicka ? '✓ Je to vidlička.' : '✗ Nie je to vidlička — ' + esc(PRECO_NIE[PRECO_Z_JADRA[r.dovod]]).toLowerCase() + '.') +
         '</div>';
    if (!r.dosiahne) {
      const v = viazac(board, r.z);
      h += '<div class="vidl-text">' + esc(velkePismeno(menoNaPoli(board, r.z))) + ' je viazan' + rod(board[r.z], 'ý', 'á') +
           (v !== null ? ' ' + MENO_FIGURKY_7[board[v].toUpperCase()] + ' ' + VC.sqName(v) : '') +
           ' na kráľa. Nesmie sa pohnúť, lebo by kráľ ostal v šachu — takto vôbec nekradne.</div></div>';
      return h;
    }
    const riadok = (stavR, nazov, text) => '<li class="' + stavR + '"><span class="vidl-znak">' +
      (stavR === 'ok' ? '✓' : (stavR === 'zle' ? '✗' : '–')) + '</span><div><b>' + nazov + '</b><div class="vidl-text">' + text + '</div></div></li>';
    const nove = r.napadnute.filter(x => x.novy), stare = r.napadnute.filter(x => !x.novy);
    const matTerc = !!(r.mat && r.mat.length && r.zapocitane.length === 1);
    let li = '';

    // 1. Dva nové terče
    let t1 = nove.length ? 'Napadne ' + esc(zoznamSlov(nove.map(x => menoNaPoli4(x.figurka, x.pole)))) + '.'
                         : 'Nenapadne nič nové.';
    if (stare.length) {
      t1 += ' ' + esc(velkePismeno(zoznamSlov(stare.map(x => menoNaPoli4(x.figurka, x.pole))))) + ' ' +
            rod(kus, 'napádal', 'napádala') + ' už z poľa ' + VC.sqName(r.z) + ' — to nie je nový terč.';
    }
    if (r.odkryte.length) {
      const o = r.odkryte[0];
      t1 += ' ' + esc(velkePismeno(menoNaPoli(r.poTahu, o.z))) + ' teraz napáda ' + esc(menoNaPoli4(o.tercFigurka, o.terc)) +
            ', ale ' + rod(o.figurka, 'nepohol', 'nepohla') + ' sa — odkrytý útok sa do vidličky nepočíta.';
    }
    if (matTerc && nove.length < 2) t1 += ' Druhým terčom je hrozba matu.';
    li += riadok(nove.length >= 2 || matTerc ? 'ok' : 'zle', 'Dva nové terče', t1);

    // 2. Terče stoja za to
    const bezKrala = nove.filter(x => x.dovod !== 'kral');
    const t2 = bezKrala.length ? bezKrala.map(x => {
      const m = velkePismeno(menoNaPoli(r.poTahu, x.i));
      if (x.dovod === 'cennejsi') return esc(m) + ' — ' + rod(x.figurka, 'cennejší', 'cennejšia') + ' ako ' + meno + ' ✓';
      if (x.dovod === 'zisk') {
        const obrancov = VC.countAttackers(r.poTahu, x.i, r.strana === 'w' ? 'b' : 'w');
        return esc(m) + ' — ' + (obrancov === 0 ? 'nikto ' + rod(x.figurka, 'ho', 'ju') + ' nestráži'
                                                 : 'dá sa zobrať so ziskom ' + znak(x.zisk)) + ' ✓';
      }
      return esc(m) + ' — ' + rod(x.figurka, 'krytý', 'krytá') + ', nestojí za to ✗';
    }).join('<br>') : 'Okrem kráľa nenapadne žiadnu figúrku.';
    const stav2 = (r.zapocitane.length >= 2 || matTerc) ? 'ok' : (nove.length >= 2 ? 'zle' : 'nic');
    li += riadok(stav2, 'Terče stoja za to', t2);

    // 3. Bezpečné pole
    const zs = r.ziskSupera;
    // Jadro (rovnako ako generátor) započíta do výmeny aj kráľa, ktorý by bral krytú
    // figúrku. Taký ťah je nelegálny — hráčovi povieme, že súper vidličkára zobrať nemôže.
    const nemozeBrat = zs !== null && !superMozeBratVidlickara(r);
    // Figúrka, ktorú vidličkár zobral samotným ťahom (do výmeny na jeho poli sa nepočíta)
    const zobral = board[r.na] || null;
    const t3 = zs === null ? 'Súper nemá čím ' + rod(kus, 'ho', 'ju') + ' zobrať.'
             : nemozeBrat ? 'Súper ' + rod(kus, 'ho', 'ju') + ' zobrať nemôže' +
                            (lenKralNapada(r) ? ' — kráľ nesmie brať krytú figúrku.' : '.')
             : (zs < 0 ? 'Súper by ' + rod(kus, 'ho', 'ju') + ' mohol zobrať, ale stratil by ' + minceAku(-zs) + '.'
             : (zs === 0 ? 'Súper ' + rod(kus, 'ho', 'ju') + ' zoberie a nastane výmena — ' +
                           (zobral ? 'potom už nič ďalšie nestratí.' : 'nič nestratí.')
                         : 'Súper ' + rod(kus, 'ho', 'ju') + ' zoberie a získa ' + minceAku(zs) + '.')) +
               (zobral && zs !== null && zs >= 0
                 ? ' ' + esc(velkePismeno(menoNaPoli(board, r.na))) + ' ' + rod(zobral, 'padol', 'padla') +
                   ' už samotným ťahom. To je branie, nie vidlička.'
                 : '');
    li += riadok(r.bezpecne ? 'ok' : 'zle', 'Bezpečné pole', esc(velkePismeno(meno)) + ' na ' + VC.sqName(r.na) + ': ' + t3 +
                 (zs !== null && !nemozeBrat ? htmlVymenyVidlickara(r) : ''));

    // 4. Šach
    if (r.kral) {
      const k = r.kral;
      const cenne = nove.filter(x => x.pocita && x.dovod !== 'kral').map(x => menoNaPoli4(x.figurka, x.pole));
      let t4;
      if (k.dovod === 'cennejsi_terc') t4 = 'Šach a k tomu cennejší terč. Kráľ musí uhnúť a ' + esc(zoznamSlov(cenne)) + ' padne.';
      else if (k.dovod === 'ustupy_nezachrania') {
        t4 = k.ustupy.length ? 'Nech kráľ ustúpi kamkoľvek (' + k.ustupy.join(', ') + '), ' + esc(zoznamSlov(cenne)) + ' nezachráni.'
                             : 'Kráľ nemá kam ustúpiť, ' + esc(zoznamSlov(cenne)) + ' nezachráni.';
      } else if (k.dovod === 'ustup_zachrani') t4 = 'Kráľ ustúpi na ' + k.zachrani + ' a terč ubráni.';
      else t4 = 'Popri šachu nenapadne nič, čo stojí za to.';
      li += riadok(k.pocita ? 'ok' : 'zle', 'Šach', t4);
    }

    // Hrozba matu
    if (r.mat && (r.mat.length || r.matStary.length)) {
      if (r.mat.length) li += riadok('ok', 'Hrozba matu', 'Hrozí mat na ' + r.mat.join(', ') + '.' +
                                     (matTerc ? ' Súper nestihne kryť mat aj terč.' : ''));
      else li += riadok('zle', 'Hrozba matu', 'Mat na ' + r.matStary.join(', ') + ' hrozil už pred ťahom — tento ťah ho nevytvoril.');
    }
    h += '<ul class="vidl-podmienky">' + li + '</ul>';
    if (r.vidlicka) h += '<div class="straz-veta">V tréningu uvidíš: „' + esc(r.vysvetlenie) + '“</div>';
    h += '<div class="vidl-legenda"><span><i class="lg vidlickar"></i>vidličkár</span>' +
         '<span><i class="lc pocita"></i>terč sa počíta</span><span><i class="lc nepocita"></i>nepočíta sa</span>' +
         (r.odkryte.length ? '<span><i class="lc odkryty"></i>odkrytý útok</span>' : '') +
         (!r.bezpecne ? '<span><i class="lc hrozba"></i>zoberie vidličkára</span>' : '') + '</div>' +
         '<button class="secondary male vidl-prepni" data-akcia="vidlPrepni">' +
         (pred ? 'Ukáž pozíciu po ťahu' : 'Ukáž pozíciu pred ťahom') + '</button></div>';
    return h;
  }

  // Ukáže rozbor ťahu na šachovnici a v paneli.
  //   o.panelPred  — HTML nad kartou (zoznam v úlohe Nájdi všetky)
  //   o.poPaneli   — naviazanie tlačidiel v paneli
  //   o.pred       — ukázať pozíciu pred ťahom
  function ukazRozbor(u, r, o) {
    o = o || {};
    rozborNaSachovnici(u, r, !!o.pred);
    const el = document.getElementById('hraSpatna');
    if (!el) return;
    el.innerHTML = (o.panelPred || '') + htmlRozboru(u, r, !!o.pred);
    const prepni = el.querySelector('[data-akcia="vidlPrepni"]');
    if (prepni) prepni.onclick = () => ukazRozbor(u, r, Object.assign({}, o, { pred: !o.pred }));
    if (o.poPaneli) o.poPaneli(el);
  }

  // Spoločné vyhodnotenie úloh s jedným ťahom (Je to vidlička?, Prečo nie?, Ktoré terče?)
  function vyhodnotVidlicku(u, r, dobre, textDobre, textChyby, vysledok) {
    sachovnica.naKlik = null;
    ukazRozbor(u, r);
    if (dobre) {
      const bonus = zapisSpravne();
      grosikHovori('nadseny', pochvala() + ' ' + textDobre + bonus);
      ukazPokracovanie(true, '+' + BODY_SPRAVNE + ' bodov · ' + vysledok);
    } else {
      zapisChybu();
      grosikHovori('smutny', textChyby);
      ukazPokracovanie(false, znak(BODY_CHYBA) + ' bodov · ' + vysledok);
    }
  }

  // ── Je to vidlička? — Áno / Nie pri vyznačenom ťahu ─────────────────
  TYPY.jeVidlicka = {
    priprav(u) {
      const r = rozborTahuVidlicky(u, u.tah);
      document.getElementById('hraZadanie').innerHTML = (u.otazka || 'Je <b>{tah}</b> vidlička?').replace('{tah}', esc(r.nazov));
      ukazTahNaSachovnici(u, u.tah);
      nastavOdpovede('<div class="moznosti dve">' +
        '<button class="moznost ano" data-h="ano">Áno</button>' +
        '<button class="moznost nie" data-h="nie">Nie</button></div>',
        el => el.querySelectorAll('.moznost').forEach(b => b.onclick = () => {
          const dobre = (b.dataset.h === 'ano') === r.vidlicka;
          vyznacVolbu(b, dobre);
          const vysledok = r.vidlicka ? 'je to vidlička' : 'nie je to vidlička';
          vyhodnotVidlicku(u, r, dobre, esc(u.vysvetlenie),
            (r.vidlicka ? 'Je to vidlička! ' : 'Nie je to vidlička. ') + esc(u.vysvetlenie) + ' Pozri rozbor vpravo.', vysledok);
        }));
      grosikHovori('rozmysla', u.tip || stav.kapitola.tip ||
                   'Pozri sa, čo figúrka po ťahu napadne. Sú to dva nové terče, stoja za to a je pole bezpečné?');
    }
  };

  function rozborTahuVidlicky(u, uci) { return VC.rozoberVidlicku(u._poz.board, uci); }

  // ── Prečo nie? — prečo vyznačený ťah nie je vidlička ─────────────────
  TYPY.precoNie = {
    priprav(u) {
      const r = rozborTahuVidlicky(u, u.tah);
      const neplatne = nesplnene(r);
      const moznosti = u.moznosti || ['dva_terce', 'cena', 'pole', 'kral'];
      document.getElementById('hraZadanie').innerHTML =
        (u.otazka || '<b>{tah}</b> nie je vidlička. Prečo?').replace('{tah}', esc(r.nazov));
      ukazTahNaSachovnici(u, u.tah);
      nastavOdpovede('<div class="moznosti">' + moznosti.map(m =>
        '<button class="moznost" data-h="' + m + '">' + esc(PRECO_NIE[m]) + '</button>').join('') + '</div>',
        el => el.querySelectorAll('.moznost').forEach(b => b.onclick = () => {
          const dobre = neplatne.includes(b.dataset.h);
          vyznacVolbu(b, dobre);
          el.querySelectorAll('.moznost').forEach(x => { if (neplatne.includes(x.dataset.h)) x.classList.add('spravna'); });
          const spravne = neplatne.map(m => PRECO_NIE[m].toLowerCase()).join(', ');
          vyhodnotVidlicku(u, r, dobre, esc(u.vysvetlenie),
            'Správne je: ' + esc(spravne) + '. ' + esc(u.vysvetlenie), spravne);
        }));
      grosikHovori('rozmysla', 'Prejdi si podmienky jednu po druhej: dva nové terče, stoja za to, bezpečné pole, šach.');
    }
  };

  // ── Ktoré terče? — klikne na terče, ktoré sa do vidličky počítajú ────
  TYPY.ktoreTerce = {
    priprav(u) {
      const r = rozborTahuVidlicky(u, u.tah);
      const spravne = r.zapocitane.slice().sort();
      const kandidati = r.napadnute.map(x => x.i);
      const vybrane = new Set();
      let hotovo = false;
      document.getElementById('hraZadanie').innerHTML = (u.otazka || '<b>{tah}</b> — ktoré terče sa počítajú?')
        .replace('{tah}', esc(r.nazov));
      const kresli = () => {
        sachovnica.nastav(r.poTahu);
        const z = {};
        z[r.z] = 'last-from';
        z[r.na] = 'vidlickar';
        kandidati.forEach(i => { z[i] = vybrane.has(i) ? 'kandidat vybrany' : 'kandidat'; });
        sachovnica.oznac(z);
        kresliSipky([sipkaTahu(r.tah)]);
      };
      const odoslat = () => {
        if (hotovo) return;
        hotovo = true;
        const volba = Array.from(vybrane).map(VC.sqName).sort();
        const dobre = JSON.stringify(volba) === JSON.stringify(spravne);
        const text = spravne.length ? 'počítajú sa: ' + spravne.join(', ') : 'nepočíta sa žiadny';
        vyhodnotVidlicku(u, r, dobre, esc(u.vysvetlenie),
          'Nie celkom — ' + esc(text) + '. ' + esc(u.vysvetlenie), text);
      };
      sachovnica.naKlik = pole => {
        if (hotovo) return;
        if (!kandidati.includes(pole)) {
          grosikHovori('rozmysla', 'Klikaj na súperove figúrky, ktoré ' + MENO_FIGURKY[r.kus.toUpperCase()] + ' na ' +
                       VC.sqName(r.na) + ' napadá — sú označené namodro.');
          return;
        }
        if (vybrane.has(pole)) vybrane.delete(pole); else vybrane.add(pole);
        kresli();
      };
      nastavOdpovede('<button class="primary velke" id="hraTerceHotovo">Hotovo</button>',
        el => el.querySelector('#hraTerceHotovo').onclick = odoslat);
      kresli();
      grosikHovori('rozmysla', 'Namodro sú figúrky, ktoré ' + MENO_FIGURKY[r.kus.toUpperCase()] + ' po ťahu napadá. ' +
                   'Klikni na tie, ktoré sa do vidličky počítajú — aj na kráľa, ak sa počíta. Potom stlač Hotovo.');
    }
  };

  // Výber figúrky a cieľa na šachovnici (Nájdi vidličku, Nájdi všetky vidličky).
  //   povolenaStrana — 'w' / 'b' / null (obe)
  //   naTah(uci)     — hráč zahral ťah na dosiahnuteľné pole
  //   zaklad()       — značky a šípky, ktoré majú na šachovnici zostať
  //   slovo          — čo sa hľadá, 4. pád ('vidličku', 'hrozbu'); predvolene vidličku
  function vyberTahu(u, povolenaStrana, naTah, zaklad, slovo) {
    const board = u._poz.board;
    let vybrane = null, ciele = [];
    const kresli = () => {
      const zk = zaklad ? zaklad() : { znacky: {}, sipky: [] };
      const z = Object.assign({}, zk.znacky);
      if (vybrane !== null) {
        z[vybrane] = 'selected';
        ciele.forEach(i => { z[i] = (z[i] ? z[i] + ' ' : '') + 'moze'; });
      }
      sachovnica.oznac(z);
      kresliSipky(zk.sipky);
    };
    sachovnica.naKlik = pole => {
      const p = board[pole];
      if (vybrane !== null && ciele.includes(pole)) {
        const uci = VC.sqName(vybrane) + VC.sqName(pole);
        vybrane = null; ciele = [];
        kresli();          // zruší výber; naTah potom môže šachovnicu prekresliť po svojom
        naTah(uci);
        return;
      }
      if (p && (!povolenaStrana || VC.pieceColor(p) === povolenaStrana)) {
        if (vybrane === pole) { vybrane = null; ciele = []; }
        else {
          vybrane = pole;
          ciele = VC.dosiahnutelnePolia(board, pole, VC.pieceColor(p) === 'w' ? 'b' : 'w');
          if (!ciele.length) grosikHovori('rozmysla', velkePismeno(menoNaPoli(board, pole)) + ' sa nemôže pohnúť' +
                                           (VC.pinAxis(board, pole) ? ' — je viazan' + rod(p, 'ý', 'á') + ' na kráľa.' : '.'));
        }
      } else if (p) {
        grosikHovori('rozmysla', 'Teraz hľadáme ' + (slovo || 'vidličku') + ' ' + stranaText(povolenaStrana, 2) + '. Klikni na ' +
                     (povolenaStrana === 'w' ? 'bielu' : 'čiernu') + ' figúrku.');
        vybrane = null; ciele = [];
      } else {
        vybrane = null; ciele = [];
      }
      kresli();
    };
    kresli();
    return { kresli: kresli, zrus: () => { vybrane = null; ciele = []; } };
  }

  // ── Nájdi vidličku — hráč zahrá ťah jednej strany ────────────────────
  TYPY.najdiVidlicku = {
    priprav(u) {
      const board = u._poz.board;
      const strana = u.strana || u._poz.state.active;
      const vidlicky = VC.vidlickyStrany(board, strana);
      const naTahu = u._poz.state.active;
      document.getElementById('hraZadanie').innerHTML = u.otazka ||
        ('Nájdi vidličku <b>' + stranaText(strana, 2) + '</b>' +
         (strana !== naTahu ? ' <span class="slabo">(hoci je na ťahu ' + stranaText(naTahu) + ')</span>' : ''));
      let hotovo = false;
      const vyber = vyberTahu(u, strana, uci => {
        if (hotovo) return;
        hotovo = true;
        sachovnica.naKlik = null;
        const r = rozborTahuVidlicky(u, uci);
        if (r.vidlicka) {
          vyhodnotVidlicku(u, r, true, esc(r.vysvetlenie) + (u.vysvetlenie ? ' ' + esc(u.vysvetlenie) : ''), '', r.nazov);
          return;
        }
        // Chyba: rozbor hráčovho ťahu a prepínač na správnu vidličku
        const prepinac = zvoleny => '<div class="prepinac">Rozbor pre: ' + [uci].concat(vidlicky.map(x => x.tah)).map(t =>
          '<button class="secondary male' + (t === zvoleny ? ' vybrane' : '') + '" data-tah="' + t + '">' +
          esc(t === uci ? r.nazov + ' (tvoj ťah)' : vidlicky.find(x => x.tah === t).nazov) + '</button>').join('') + '</div>';
        const ukaz = t => {
          const rr = t === uci ? r : vidlicky.find(x => x.tah === t);
          ukazRozbor(u, rr, { panelPred: '<div class="panel-karta">' + prepinac(t) + '</div>',
                              poPaneli: el => el.querySelectorAll('.prepinac button').forEach(b => b.onclick = () => ukaz(b.dataset.tah)) });
        };
        zapisChybu();
        ukaz(uci);
        const spravne = vidlicky.map(x => x.nazov).join(', ');
        grosikHovori('smutny', esc(r.nazov) + ' nie je vidlička — ' + esc(PRECO_NIE[PRECO_Z_JADRA[r.dovod]]).toLowerCase() + '. ' +
                     'Vidlička bola ' + esc(spravne) + '. ' + (u.vysvetlenie ? esc(u.vysvetlenie) : ''));
        ukazPokracovanie(false, znak(BODY_CHYBA) + ' bodov · správne: ' + spravne);
      });
      nastavOdpovede('<div class="slabo stred">Klikni na figúrku a potom na pole, kam má ísť.</div>');
      grosikHovori('rozmysla', u.tip || 'Klikni na figúrku — ukážu sa polia, kam môže ísť. Potom klikni na pole, z ktorého napadne dva terče.');
      vyber.kresli();
    }
  };

  // ── Nájdi všetky vidličky (za oboch) — ako tréning v Zručnostiach ─────
  TYPY.najdiVidlicky = {
    priprav(u) {
      const board = u._poz.board;
      const vysl = VC.vidlicky(board, u._poz.state);
      const riesenia = vysl.riesenia;
      const rozbory = {};
      vysl.rozbory.forEach(r => { rozbory[r.tah] = r; });
      const ul = { najdene: [], chybne: [], hotovo: false, chybVUlohe: 0, casVyprsal: false, zobrazeny: null };
      const prezerane = {};             // rozbory ťahov, ktoré si hráč pozrel po skončení
      const strana = t => VC.pieceColor(board[VC.sqIndex(t.slice(0, 2))]);

      document.getElementById('hraZadanie').innerHTML = 'Nájdi všetky <b>vidličky</b> <span class="slabo">(biele aj čierne)</span>';
      grosikHovori('rozmysla', stav.skuska
        ? skuskaVyzva() + ' Nájdi všetky vidličky za oboch skôr, ako vyprší čas.'
        : 'Klikni na figúrku a potom na pole, kam má ísť. Hľadaj za bieleho aj za čierneho. Keď už žiadnu nevidíš, stlač Hotovo.');

      const pocitadlo = () => {
        let t = 'Nájdené: ' + ul.najdene.length + ' / ' + riesenia.length;
        if (u.pomocka === 'strany') {
          const w = riesenia.filter(x => strana(x) === 'w'), b = riesenia.filter(x => strana(x) === 'b');
          t += ' · Biely ' + ul.najdene.filter(x => strana(x) === 'w').length + '/' + w.length +
               ' · Čierny ' + ul.najdene.filter(x => strana(x) === 'b').length + '/' + b.length;
        }
        nastavPasik(t, '');
      };
      const zaklad = () => {
        const znacky = {}, sipky = [];
        ul.najdene.forEach(t => { sipky.push(sipkaTahu(t, 'najdena')); znacky[VC.sqIndex(t.slice(2, 4))] = 'najdene'; });
        ul.chybne.forEach(c => sipky.push(sipkaTahu(c.tah, 'chybna')));
        if (ul.hotovo) riesenia.filter(t => !ul.najdene.includes(t)).forEach(t => {
          sipky.push(sipkaTahu(t, 'prehliadnuta')); znacky[VC.sqIndex(t.slice(2, 4))] = 'prehliadnuta';
        });
        return { znacky: znacky, sipky: sipky };
      };
      const zoznamHtml = () => {
        let h = '<div class="panel-karta"><h3>Tvoje vidličky</h3>';
        if (!ul.najdene.length && !ul.chybne.length && !ul.hotovo) h += '<div class="slabo">Zatiaľ nič.</div>';
        ul.najdene.forEach(t => {
          h += '<div class="zaznam dobre klik" data-tah="' + t + '"><b>' + esc(rozbory[t].nazov) + '</b> ' + esc(rozbory[t].vysvetlenie) + '</div>';
        });
        ul.chybne.forEach(c => {
          h += '<div class="zaznam zle klik" data-tah="' + c.tah + '"><b>' + esc(c.r.nazov) + '</b> ' +
               esc(PRECO_NIE[PRECO_Z_JADRA[c.r.dovod]].toLowerCase()) + '</div>';
        });
        if (ul.hotovo) {
          riesenia.filter(t => !ul.najdene.includes(t)).forEach(t => {
            h += '<div class="zaznam prehliadnute klik" data-tah="' + t + '"><b>' + esc(rozbory[t].nazov) + '</b> ' +
                 esc(rozbory[t].vysvetlenie) + ' <span class="znacka-prehliadnuta">prehliadnutá</span></div>';
          });
        }
        return h + '<div class="slabo straz-tip">Klikni na riadok a uvidíš rozbor ťahu.</div></div>';
      };
      // Panel: zoznam + rozbor naposledy zahraného (alebo vybraného) ťahu.
      // Šachovnica ostáva v pôvodnej pozícii — hráč ešte hľadá ďalšie vidličky.
      const obnov = () => {
        vyber.kresli();
        pocitadlo();
        const el = document.getElementById('hraSpatna');
        let h = zoznamHtml();
        if (ul.zobrazeny) {
          const t = ul.zobrazeny;
          const r = rozbory[t] || (ul.chybne.find(c => c.tah === t) || {}).r || prezerane[t];
          if (r) h += htmlRozboru(u, r, true).replace(/<button class="secondary male vidl-prepni"[\s\S]*?<\/button>/, '');
        }
        el.innerHTML = h;
        el.querySelectorAll('.zaznam.klik').forEach(d => d.onclick = () => { ul.zobrazeny = d.dataset.tah; obnov(); });
      };
      const dokonci = vzdal => {
        if (ul.hotovo) return;
        ul.hotovo = true;
        zastavCasovac();
        sachovnica.naKlik = null;
        const vsetkyNajdene = ul.najdene.length === riesenia.length;
        const bezChyby = vsetkyNajdene && ul.chybVUlohe === 0 && !ul.casVyprsal;
        const prehliadnute = riesenia.filter(t => !ul.najdene.includes(t));
        let text;
        if (bezChyby) {
          pripocitaj(BONUS_BEZ_CHYBY);
          stav.bonusy += BONUS_BEZ_CHYBY;
          obnovHlavu();
          text = 'Všetky bez chyby: bonus +' + BONUS_BEZ_CHYBY;
          grosikHovori('nadseny', 'Našiel si všetky vidličky a ani raz si sa nepomýlil! ' + esc(u.vysvetlenie || ''));
        } else if (vsetkyNajdene) {
          text = 'Všetky nájdené';
          grosikHovori('vesely', 'Máš ich všetky. ' + esc(u.vysvetlenie || ''));
        } else {
          stav.seria = 0;
          obnovHlavu();
          text = (ul.casVyprsal ? 'Čas vypršal · ' : '') + 'Prehliadnuté: ' + prehliadnute.length;
          grosikHovori('smutny', (ul.casVyprsal ? 'Čas vypršal. ' : (vzdal ? 'Niečo ti ešte chýbalo. ' : '')) +
                       'Prehliadnuté vidličky sú naoranžovo. ' + (u.vysvetlenie ? esc(u.vysvetlenie) : ''));
          ul.zobrazeny = prehliadnute[0];
        }
        if (stav.skuska) {
          prehliadnute.forEach(t => zapisDiagnozu(dovodPrehliadnutejVidlicky(rozbory[t], u._poz.state.active)));
          stav.skuska.vysledky.push({ fen: u.fen, bezChyby: bezChyby });
        }
        obnov();
        // po skončení: klik na figúrku a pole ukáže rozbor akéhokoľvek ťahu
        vyber = vyberTahu(u, null, t => {
          if (!rozbory[t] && !ul.chybne.find(c => c.tah === t)) prezerane[t] = rozborTahuVidlicky(u, t);
          ul.zobrazeny = t;
          obnov();
        }, zaklad);
        ukazPokracovanie(bezChyby || (vsetkyNajdene && !stav.skuska), text);
      };
      let vyber = vyberTahu(u, null, t => {
        if (ul.hotovo) return;
        ul.zobrazeny = t;
        if (ul.najdene.includes(t)) {
          grosikHovori('vesely', 'Túto vidličku už máš. Hľadaj ďalej.');
        } else if (riesenia.includes(t)) {
          ul.najdene.push(t);
          const bonus = zapisSpravne();
          grosikHovori('nadseny', pochvala() + ' ' + esc(rozbory[t].vysvetlenie) + bonus);
        } else if (ul.chybne.find(c => c.tah === t)) {
          grosikHovori('rozmysla', 'Tento ťah si už skúšal — vidlička to nie je.');
        } else {
          const r = rozborTahuVidlicky(u, t);
          ul.chybne.push({ tah: t, r: r });
          ul.chybVUlohe++;
          zapisChybu();
          if (stav.skuska) zapisDiagnozu(dovodOmyluVidlicky(r));
          grosikHovori('smutny', esc(r.nazov) + ' nie je vidlička — ' + esc(PRECO_NIE[PRECO_Z_JADRA[r.dovod]]).toLowerCase() +
                       '. Rozbor je vpravo. ' + znak(BODY_CHYBA) + ' bodov.');
        }
        obnov();
        if (ul.najdene.length === riesenia.length) dokonci(false);
      }, zaklad);

      nastavOdpovede('<button class="secondary velke" id="hraHotovo">Hotovo — viac ich nevidím</button>',
        el => el.querySelector('#hraHotovo').onclick = () => { if (!ul.hotovo) dokonci(true); });
      obnov();

      if (u.limit) {
        spustiCasovac(u.limit, () => {
          if (ul.hotovo) return;
          ul.casVyprsal = true;
          zvuk('loss');
          dokonci(true);
        });
      }
    }
  };

  // ── Rozbor chýb v skúške Vidličky na trhu — ktorú kapitolu zopakovať ──
  //  1 Jeden ťah, dva terče · 2 Len nové terče · 3 Terč musí stáť za to
  //  4 Bezpečné pole · 5 Šach ako terč · 6 Hrozba matu · 7 Každá figúrka, obe strany · 8 Väzba
  //
  // Stojí pri poli sq figúrka farby `farba`, ktorá naň geometricky dosiahne, ale
  // kvôli väzbe na kráľa naň brať nesmie? (strážnik / zlodej, ktorý „nestráži")
  function viazanyNaPoli(board, sq, farba) {
    const b = board.slice();
    b[sq] = farba === 'w' ? 'p' : 'P';            // na poli stojí súperova figúrka
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p || VC.pieceColor(p) !== farba || jeKral(p) || !VC.attacksSq(b, i, sq)) continue;
      if (VC.pinAxis(b, i) !== null && !VC.isLegal(b, { active: farba, castling: '-', ep: '-' }, i, sq, '')) return true;
    }
    return false;
  }

  // Rozhodla o vidličke väzba? Terč sa dá zobrať so ziskom, lebo jeho strážnik je
  // viazaný, alebo vidličkár stojí bezpečne, lebo súperova figúrka, ktorá naň
  // dosiahne, je viazaná.
  function vazbaRozhoduje(r) {
    const superStrana = r.strana === 'w' ? 'b' : 'w';
    if (r.napadnute.some(x => x.pocita && x.dovod === 'zisk' && viazanyNaPoli(r.poTahu, x.i, superStrana))) return true;
    return viazanyNaPoli(r.poTahu, r.na, superStrana);
  }

  // Hráč označil ťah, ktorý vidlička nie je
  function dovodOmyluVidlicky(r) {
    if (!r.dosiahne) return 8;                      // ťah viazanou figúrkou
    const d = PRECO_Z_JADRA[r.dovod];
    if (d === 'pole') return 4;
    if (d === 'kral') return 5;
    if (d === 'cena') return 3;
    return 2;                                       // terč nie je nový, odkrytý útok
  }

  // Hráč vidličku prehliadol
  function dovodPrehliadnutejVidlicky(r, naTahu) {
    if (!r) return 1;
    if (r.druh === 'mat_a_terc') return 6;
    if (vazbaRozhoduje(r)) return 8;
    if (r.strana !== naTahu || r.figurka.toLowerCase() === 'k') return 7;
    if (r.druh === 'sach_kral_neubrani') return 5;
    const terce = r.napadnute.filter(x => x.pocita && x.dovod !== 'kral');
    if (terce.length && terce.every(x => x.figurka.toLowerCase() === 'p' && x.dovod === 'zisk')) return 3;
    return 1;
  }

  // ════════════════════════════════════════════════════════════════════
  //  Priama hrozba (hra Hrozba na trhu)
  // ----------------------------------------------------------------------
  //  Či je ťah priama hrozba, počíta VisionCore.rozoberHrozbu presne ako
  //  tréning Priame hrozby. Po odpovedi hra ukáže pozíciu po ťahu: hroziaca
  //  figúrka nazlato, zelená šípka od figúrky, ktorá by brala so ziskom,
  //  k terču, pole matu nafialovo, pole premeny s písmenom D a červená
  //  šípka k tomu, čo by po ťahu získal súper. V paneli sú tri podmienky
  //  s ✓ / ✗: tichý ťah – hrozí zisk alebo mat – súper nič nezíska.
  //  Hrozba premeny (30. 9. 2026): premena so ziskom sa počíta ako zisk.
  // ════════════════════════════════════════════════════════════════════
  const PRECO_NIE_H = {
    ticha: 'Nie je to tichý ťah',
    nic:   'Nič nové nehrozí',
    super: 'Súper niečo získa',
    vazba: 'Figúrka je viazaná'
  };
  const PRECO_Z_JADRA_H = {
    branie: 'ticha', premena: 'ticha', sach: 'ticha', nic_nehrozi: 'nic', super_ziska: 'super', super_mat: 'super',
    nelegalny: 'vazba'
  };

  // Všetky nesplnené podmienky (odpoveď v úlohe „Prečo nie?" platí, keď trafí
  // ktorúkoľvek z nich; hlavný dôvod podľa generátora je PRECO_Z_JADRA_H).
  // Terče bez kráľa (pri šachu jadro pripíše aj „branie" kráľa — to hrozba nie je)
  function terceH(r) { return r.terce.filter(t => !jeKral(t.figurka)); }

  function nesplneneHrozby(r) {
    if (r.hrozba) return [];
    if (!r.legalny) return ['vazba'];
    const out = [];
    if (r.branie || r.premena || r.sach) out.push('ticha');
    if (!terceH(r).length && !r.mat.length && !r.premeny.length) out.push('nic');
    if (r.superCiele.length || r.superPremeny.length || r.superMat.length) out.push('super');
    return out;
  }

  function rozborHrozby(u, uci) { return VC.rozoberHrozbu(u._poz.board, uci, u._poz.state); }
  function najlepsieZ(kto) { return kto.reduce((a, b) => (!a || b.zisk > a.zisk) ? b : a, null); }
  function superStranyH(s) { return s === 'w' ? 'b' : 'w'; }

  // Figúrky strany `farba`, ktoré na poli `pole` útočia (priamo, bez batérií)
  function utocniciNa(board, pole, farba) {
    const out = [];
    for (let i = 0; i < 64; i++) if (board[i] && VC.pieceColor(board[i]) === farba && VC.attacksSq(board, i, pole)) out.push(i);
    return out;
  }

  // Zisk súpera, keby zobral hroziacu figúrku (null = nemá čím brať)
  function ziskSuperaNaPohnutej(r) {
    const opp = superStranyH(r.strana), st = { active: opp, castling: '-', ep: '-' };
    let best = null;
    for (let i = 0; i < 64; i++) {
      const p = r.poTahu[i];
      if (!p || VC.pieceColor(p) !== opp || !VC.isLegal(r.poTahu, st, i, r.na, '')) continue;
      const g = VC.seeWithPins(r.poTahu, i, r.na, opp);
      if (best === null || g > best) best = g;
    }
    return best;
  }

  // Súperove figúrky, ktoré hroziaca figúrka po ťahu napadne, ale branie sa neoplatí
  function napadnuteBezZisku(r) {
    const opp = superStranyH(r.strana), out = [];
    const ciele = new Set(terceH(r).map(t => t.pole));
    for (let i = 0; i < 64; i++) {
      const p = r.poTahu[i];
      if (!p || VC.pieceColor(p) !== opp || jeKral(p) || ciele.has(i) || !VC.attacksSq(r.poTahu, r.na, i)) continue;
      out.push({ pole: i, figurka: p, zisk: VC.seeWithPins(r.poTahu, r.na, i, r.strana) });
    }
    return out;
  }

  // Figúrka strany `strana`, ktorá dá na poli `pole` mat jedným ťahom (len pre šípku)
  function matujuca(board, strana, pole) {
    const st = { active: strana, castling: '-', ep: '-' }, opp = superStranyH(strana);
    for (let z = 0; z < 64; z++) {
      const p = board[z];
      if (!p || VC.pieceColor(p) !== strana || !VC.isLegal(board, st, z, pole, 'q')) continue;
      const b = board.slice();
      b[pole] = (p.toLowerCase() === 'p' && (pole < 8 || pole >= 56)) ? (strana === 'w' ? 'Q' : 'q') : p;
      b[z] = '';
      if (VC.isKingInCheck(b, opp) && !VC.legalMoves(b, { active: opp, castling: '-', ep: '-' }).length) return z;
    }
    return null;
  }

  // Figúrky súpera, ktoré môžu hroziacu figúrku zobrať (ale nič tým nezískajú)
  function beruciPohnutu(r) {
    const opp = superStranyH(r.strana), st = { active: opp, castling: '-', ep: '-' }, out = [];
    for (let i = 0; i < 64; i++) {
      const p = r.poTahu[i];
      if (p && VC.pieceColor(p) === opp && VC.isLegal(r.poTahu, st, i, r.na, '')) out.push(i);
    }
    return out;
  }

  // Šachujúce figúrky po ťahu (pri úlohách „nie je to tichý ťah")
  function sachujuci(r) {
    const kral = VC.findKing(r.poTahu, superStranyH(r.strana));
    return kral === -1 ? [] : utocniciNa(r.poTahu, kral, r.strana).map(i => ({ z: i, na: kral }));
  }

  // Značky a šípky rozboru na šachovnici
  function rozborHrozbyNaSachovnici(u, r, pred) {
    const board = u._poz.board;
    if (!r.legalny) {
      sachovnica.nastav(board);
      const z = oznacTahVidlicky(r.tah); z[r.z] = 'omyl';
      const v = viazac(board, r.z);
      const sipky = [sipkaTahu(r.tah)];
      if (v !== null) { z[v] = 'hrozi'; sipky.push({ z: v, na: VC.findKing(board, r.strana), typ: 'vazba' }); }
      sachovnica.oznac(z);
      kresliSipky(sipky);
      return;
    }
    if (pred) {
      sachovnica.nastav(board);
      const z = oznacTahVidlicky(r.tah);
      z[r.z] = 'vidlickar';
      sachovnica.oznac(z);
      kresliSipky([sipkaTahu(r.tah)]);
      return;
    }
    sachovnica.nastav(r.poTahu);
    const z = {}, sipky = [];
    z[r.z] = 'last-from';
    z[r.na] = 'vidlickar';
    terceH(r).forEach(t => {
      z[t.pole] = 'terc-pocita';
      sipky.push({ z: najlepsieZ(t.kto).z, na: t.pole, typ: 'pocita' });
    });
    r.mat.forEach(p => {
      z[p] = 'mat-pole';
      const m = matujuca(r.poTahu, r.strana, p);
      if (m !== null) sipky.push({ z: m, na: p, typ: 'pocita' });
    });
    r.premeny.forEach(pr => {
      if (!z[pr.na]) z[pr.na] = 'premena-pole';
      sipky.push({ z: pr.z, na: pr.na, typ: 'pocita' });
    });
    if (!terceH(r).length && !r.mat.length && !r.premeny.length) {
      napadnuteBezZisku(r).forEach(x => { z[x.pole] = 'terc-nepocita'; sipky.push({ z: r.na, na: x.pole, typ: 'nepocita' }); });
    }
    if (r.sach) sachujuci(r).forEach(s => { z[s.na] = 'terc-nepocita'; sipky.push({ z: s.z, na: s.na, typ: 'nepocita' }); });
    r.superCiele.forEach(t => {
      z[t.pole] = 'hrozi';
      sipky.push({ z: najlepsieZ(t.kto).z, na: t.pole, typ: 'hrozba' });
    });
    r.superMat.forEach(p => {
      z[p] = 'mat-pole hrozi';
      const m = matujuca(r.poTahu, superStranyH(r.strana), p);
      if (m !== null) sipky.push({ z: m, na: p, typ: 'hrozba' });
    });
    r.superPremeny.forEach(pr => {
      z[pr.na] = 'premena-pole hrozi';
      sipky.push({ z: pr.z, na: pr.na, typ: 'hrozba' });
    });
    // Súper môže hroziacu figúrku zobrať, ale nič nezíska (výmena alebo strata) — sivá šípka
    if (!r.superCiele.some(t => t.pole === r.na)) {
      beruciPohnutu(r).forEach(i => sipky.push({ z: i, na: r.na, typ: 'nepocita' }));
    }
    sachovnica.oznac(z);
    kresliSipky(sipky);
  }

  // Ako hrozba vznikla, keď neberie figúrka, ktorá ťahala
  function textMechanizmu(t, kto, nb) {
    const meno = velkePismeno(menoNaPoli(nb, kto.z));
    if (t.mech === 'odkryty') return ' Je to odkrytý útok: ťah uvoľnil cestu figúrke ' + VC.sqName(kto.z) + '.';
    if (t.mech === 'podpora') return ' Pribudol druhý útočník, preto sa branie oplatí.';
    if (t.mech === 'uvolnenie') return ' ' + meno + ' bol' + rod(nb[kto.z], '', 'a') + ' viazan' + rod(nb[kto.z], 'ý', 'á') +
                                      ' na kráľa — ťah ' + rod(nb[kto.z], 'ho', 'ju') + ' uvoľnil.';
    if (t.mech === 'prerusenie') return ' Ťah sa postavil do cesty obrancovi a obrana sa prerušila.';
    if (t.mech === 'vazba') return ' Ťah zviazal obrancu na kráľa — viazaný strážnik nestráži.';
    if (t.mech === 'ine') return ' Rozhoduje celá výmena na tomto poli.';
    return '';
  }

  // Ako vznikla hrozba premeny (mech z jadra)
  function textMechanizmuPremeny(pr) {
    if (pr.mech === 'cesta') return ' Ťah uvoľnil pešiakovi pole premeny.';
    if (pr.mech === 'podpora') return ' Túto podporu priniesol práve tento ťah.';
    if (pr.mech === 'prerusenie') return ' Ťah sa postavil do cesty strážcovi poľa premeny.';
    if (pr.mech === 'vazba') return ' Ťah zviazal strážcu poľa premeny na kráľa — viazaný strážnik nestráži.';
    if (pr.mech === 'uvolnenie') return ' Pešiak bol viazaný na kráľa — ťah ho uvoľnil.';
    if (pr.mech === 'ine') return ' Rozhoduje celá výmena na poli premeny.';
    return '';
  }

  // Veta o premene: „Pešiak b7 by sa premenil na dámu na b8 so ziskom +8 — …"
  function textPremeny(pr) {
    return 'Pešiak ' + VC.sqName(pr.z) + ' by sa premenil na dámu na ' + VC.sqName(pr.na) + ' so ziskom ' + znak(pr.zisk) +
           (pr.zisk >= 8 ? ' — súper novú dámu nemôže zobrať so ziskom.'
                         : ' — súper novú dámu zoberie, ale ty berieš späť.');
  }

  // Rebrík výmeny pri premene: premena (+8), súper berie dámu, hráč berie späť…
  function htmlRebrikaPremeny(nb, pr, strana) {
    const opp = superStranyH(strana);
    const b = nb.slice(); b[pr.na] = strana === 'w' ? 'Q' : 'q'; b[pr.z] = '';
    let best = null;
    VC.legalMoves(b, { active: opp, castling: '-', ep: '-' }).forEach(([z, na]) => {
      if (na !== pr.na) return;
      const g = VC.seeWithPins(b, z, na, opp);
      if (!best || g > best.g) best = { z: z, g: g };
    });
    if (!best || best.g <= 0) return '';
    const rb = VC.rebrikVymeny(b, VC.sqName(best.z) + VC.sqName(pr.na));
    const bonus = 8;
    let h = '<table class="rebrik vidl-rebrik"><thead><tr><th>Keby si sa premenil</th><th class="cislo">Pre teba</th></tr></thead><tbody>';
    h += '<tr><td><span class="bodka ' + strana + '"></span>' + esc(VC.sqName(pr.z) + '–' + VC.sqName(pr.na) + 'D') +
         ' <span class="slabo">— pešiak sa mení na dámu</span></td><td class="cislo ' + RV.triedaZnamienka(bonus) + '">' +
         znak(bonus) + '</td></tr>';
    rb.kroky.forEach(k => {
      const ucet = bonus - k.ucet;
      h += '<tr><td><span class="bodka ' + k.strana + '"></span>' + esc(k.tah) + ' <span class="slabo">— ' +
           (k.strana === strana ? 'beriem ' : 'súper berie ') + esc(k.figurka) + '</span></td><td class="cislo ' +
           RV.triedaZnamienka(ucet) + '">' + znak(ucet) + '</td></tr>';
    });
    const vysledok = bonus - rb.vysledok;
    h += '<tr class="koniec"><td>' + esc(RV.textKonca(rb.koniec)) + '</td><td class="cislo ' + RV.triedaZnamienka(vysledok) +
         '"><b>' + znak(vysledok) + '</b></td></tr></tbody></table>';
    return h;
  }

  // Rebrík výmeny, keby hráč na terči naozaj bral (z jeho pohľadu)
  function htmlRebrikaHrozby(nb, kto, pole, strana) {
    const rb = VC.rebrikVymeny(nb, VC.sqName(kto.z) + VC.sqName(pole));
    if (!rb.kroky.length) return '';
    let h = '<table class="rebrik vidl-rebrik"><thead><tr><th>Keby si bral</th><th class="cislo">Pre teba</th></tr></thead><tbody>';
    rb.kroky.forEach(k => {
      h += '<tr><td><span class="bodka ' + k.strana + '"></span>' + esc(k.tah) + ' <span class="slabo">— ' +
           (k.strana === strana ? 'beriem ' : 'súper berie ') + esc(k.figurka) + (k.premena ? ' a mení sa na dámu' : '') +
           '</span></td><td class="cislo ' + RV.triedaZnamienka(k.ucet) + '">' + znak(k.ucet) + '</td></tr>';
    });
    h += '<tr class="koniec"><td>' + esc(RV.textKonca(rb.koniec)) + '</td><td class="cislo ' + RV.triedaZnamienka(rb.vysledok) +
         '"><b>' + znak(rb.vysledok) + '</b></td></tr></tbody></table>';
    return h;
  }

  // Karta „Rozbor hrozby" do pravého panela
  function htmlRozboruHrozby(u, r, pred) {
    const board = u._poz.board;
    const kus = r.figurka, meno = MENO_FIGURKY[kus.toUpperCase()];
    let h = '<div class="panel-karta vidl-karta"><h3>Rozbor: ' + esc(r.nazov) + '</h3>';
    h += '<div class="vidl-verdikt ' + (r.hrozba ? 'ano' : 'nie') + '">' +
         (r.hrozba ? '✓ Je to priama hrozba.'
                   : '✗ Nie je to hrozba — ' + esc(PRECO_NIE_H[PRECO_Z_JADRA_H[r.dovod]]).toLowerCase() + '.') + '</div>';
    if (!r.legalny) {
      const v = viazac(board, r.z);
      h += '<div class="vidl-text">' + esc(velkePismeno(menoNaPoli(board, r.z))) + ' je viazan' + rod(kus, 'ý', 'á') +
           (v !== null ? ' ' + MENO_FIGURKY_7[board[v].toUpperCase()] + ' ' + VC.sqName(v) : '') +
           ' na kráľa. Nesmie sa pohnúť, lebo by kráľ ostal v šachu.</div></div>';
      return h;
    }
    const riadok = (stavR, nazov, text) => '<li class="' + stavR + '"><span class="vidl-znak">' +
      (stavR === 'ok' ? '✓' : (stavR === 'zle' ? '✗' : '–')) + '</span><div><b>' + nazov + '</b><div class="vidl-text">' + text + '</div></div></li>';
    const nb = r.poTahu, opp = superStranyH(r.strana);
    let li = '';

    // 1. Tichý ťah
    let t1;
    if (r.branie) t1 = 'Ťah berie ' + esc(menoNaPoli4(board[r.na], VC.sqName(r.na))) + '. Branie nie je hrozba — ' +
                       'patrí do zručnosti Branie so ziskom.';
    else if (r.premena) t1 = 'Pešiak sa premení na dámu. Premena je zisk hneď, rovnako ako branie — nie tichý ťah.';
    else if (r.sach) {
      const s = sachujuci(r);
      const odkryty = s.length && !s.some(x => x.z === r.na);
      t1 = odkryty ? 'Ťah odkryje šach: ' + esc(menoNaPoli(nb, s[0].z)) + ' napadne kráľa. Aj odkrytý šach je šach, nie tichý ťah.'
                   : 'Ťah dáva šach. Šach nie je hrozba — šachy majú vlastnú zručnosť.';
    } else t1 = 'Ťah nič neberie a nedáva šach.';
    li += riadok(r.branie || r.premena || r.sach ? 'zle' : 'ok', 'Tichý ťah', t1);

    // 2. Hrozí zisk alebo mat
    let t2 = r.mat.length ? 'Hrozí mat na ' + r.mat.map(VC.sqName).join(', ') + '.' : '';
    const terce = terceH(r);
    terce.forEach((t, i) => {
      const kto = najlepsieZ(t.kto);
      const bezObrany = VC.countAttackers(nb, t.pole, opp) === 0;
      t2 += (i || r.mat.length ? '<br>' : '') + esc(velkePismeno(menoNaPoli(nb, kto.z))) + ' by ' + rod(nb[kto.z], 'zobral', 'zobrala') + ' ' +
            esc(menoNaPoli4(t.figurka, VC.sqName(t.pole))) + ' so ziskom ' + znak(t.zisk) +
            (bezObrany ? ' — nikto ' + rod(t.figurka, 'ho', 'ju') + ' nestráži.' : '.') + esc(textMechanizmu(t, kto, nb));
      if (i === 0 && !bezObrany) t2 += htmlRebrikaHrozby(nb, kto, t.pole, r.strana);
    });
    r.premeny.forEach((pr, i) => {
      t2 += (i || terce.length || r.mat.length ? '<br>' : '') + esc(textPremeny(pr)) + esc(textMechanizmuPremeny(pr));
      if (i === 0 && pr.zisk < 8) t2 += htmlRebrikaPremeny(nb, pr, r.strana);
    });
    if (!terce.length && !r.mat.length && !r.premeny.length) {
      t2 = 'Keby si bol hneď znova na ťahu, nemal by si nič, čo sa oplatí zobrať.';
      napadnuteBezZisku(r).forEach(x => {
        t2 += ' ' + esc(velkePismeno(meno)) + ' napadne ' + esc(menoNaPoli4(x.figurka, VC.sqName(x.pole))) + ', ale branie by ' +
              (x.zisk === 0 ? 'bola len výmena.' : 'prinieslo stratu ' + znak(x.zisk) + '.');
      });
      if (r.matStary.length) t2 += ' Mat na ' + r.matStary.map(VC.sqName).join(', ') + ' hrozil už pred ťahom — tento ťah ho nevytvoril.';
    }
    li += riadok(terce.length || r.mat.length || r.premeny.length ? 'ok' : 'zle', 'Hrozí zisk alebo mat', t2);

    // 3. Súper nič nezíska
    let t3 = '';
    r.superCiele.forEach((t, i) => {
      t3 += (i ? '<br>' : '') + 'Súper by zobral ' + esc(menoNaPoli4(t.figurka, VC.sqName(t.pole))) + ' so ziskom ' + znak(t.zisk) +
            (t.pole === r.na ? ' — hroziaca figúrka stojí na zlom poli.' : ' — pred ťahom to nešlo, tento ťah ' +
             rod(t.figurka, 'ho', 'ju') + ' odkryl.');
    });
    r.superPremeny.forEach(pr => {
      t3 += (t3 ? '<br>' : '') + 'Súperov pešiak ' + VC.sqName(pr.z) + ' by sa premenil na dámu na ' + VC.sqName(pr.na) +
            ' so ziskom ' + znak(pr.zisk) + ' — pred ťahom to nešlo, tento ťah mu to dovolil.';
    });
    if (r.superMat.length) t3 += (t3 ? '<br>' : '') + 'Súper by dal mat na ' + r.superMat.map(VC.sqName).join(', ') + '.';
    if (!t3) {
      const v = ziskSuperaNaPohnutej(r);
      t3 = v === null ? 'Súper nemá čím ' + rod(kus, 'ho', 'ju') + ' zobrať a nič iné nezíska.'
         : (v < 0 ? 'Súper by ' + rod(kus, 'ho', 'ju') + ' mohol zobrať, ale stratil by ' + minceAku(-v) + '.'
                  : 'Súper ' + rod(kus, 'ho', 'ju') + ' môže len vymeniť — výmena nie je zisk, hrozba platí.');
    }
    li += riadok(r.superCiele.length || r.superPremeny.length || r.superMat.length ? 'zle' : 'ok', 'Súper nič nezíska',
                 esc(velkePismeno(meno)) + ' na ' + VC.sqName(r.na) + ': ' + t3);

    h += '<ul class="vidl-podmienky">' + li + '</ul>';
    if (r.hrozba) h += '<div class="straz-veta">V tréningu uvidíš: „' + esc(r.vysvetlenie) + '“</div>';
    h += '<div class="vidl-legenda"><span><i class="lg vidlickar"></i>' + (r.hrozba ? 'hroziaca figúrka' : 'figúrka, ktorá ťahala') + '</span>' +
         (terce.length || r.premeny.length ? '<span><i class="lc pocita"></i>čo hrozí</span>' : '') +
         (r.superCiele.length || r.superPremeny.length ? '<span><i class="lc hrozba"></i>čo získa súper</span>' : '') + '</div>' +
         '<button class="secondary male vidl-prepni" data-akcia="hrozPrepni">' +
         (pred ? 'Ukáž pozíciu po ťahu' : 'Ukáž pozíciu pred ťahom') + '</button></div>';
    return h;
  }

  function ukazRozborHrozby(u, r, o) {
    o = o || {};
    rozborHrozbyNaSachovnici(u, r, !!o.pred);
    const el = document.getElementById('hraSpatna');
    if (!el) return;
    el.innerHTML = (o.panelPred || '') + htmlRozboruHrozby(u, r, !!o.pred);
    const prepni = el.querySelector('[data-akcia="hrozPrepni"]');
    if (prepni) prepni.onclick = () => ukazRozborHrozby(u, r, Object.assign({}, o, { pred: !o.pred }));
    if (o.poPaneli) o.poPaneli(el);
  }

  function vyhodnotHrozbu(u, r, dobre, textDobre, textChyby, vysledok) {
    sachovnica.naKlik = null;
    ukazRozborHrozby(u, r);
    if (dobre) {
      const bonus = zapisSpravne();
      grosikHovori('nadseny', pochvala() + ' ' + textDobre + bonus);
      ukazPokracovanie(true, '+' + BODY_SPRAVNE + ' bodov · ' + vysledok);
    } else {
      zapisChybu();
      grosikHovori('smutny', textChyby);
      ukazPokracovanie(false, znak(BODY_CHYBA) + ' bodov · ' + vysledok);
    }
  }

  const TIP_HROZBY = 'Predstav si, že súper vynechá ťah. Mohol by si potom niečo zobrať so ziskom? A nezíska tvojím ťahom niečo súper?';

  // ── Je to hrozba? — Áno / Nie pri vyznačenom ťahu ───────────────────
  TYPY.jeHrozba = {
    priprav(u) {
      const r = rozborHrozby(u, u.tah);
      document.getElementById('hraZadanie').innerHTML = (u.otazka || 'Je <b>{tah}</b> priama hrozba?').replace('{tah}', esc(r.nazov));
      ukazTahNaSachovnici(u, u.tah);
      nastavOdpovede('<div class="moznosti dve">' +
        '<button class="moznost ano" data-h="ano">Áno</button>' +
        '<button class="moznost nie" data-h="nie">Nie</button></div>',
        el => el.querySelectorAll('.moznost').forEach(b => b.onclick = () => {
          const dobre = (b.dataset.h === 'ano') === r.hrozba;
          vyznacVolbu(b, dobre);
          const vysledok = r.hrozba ? 'je to hrozba' : 'nie je to hrozba';
          vyhodnotHrozbu(u, r, dobre, esc(u.vysvetlenie),
            (r.hrozba ? 'Je to hrozba! ' : 'Nie je to hrozba. ') + esc(u.vysvetlenie) + ' Pozri rozbor vpravo.', vysledok);
        }));
      grosikHovori('rozmysla', u.tip || stav.kapitola.tip || TIP_HROZBY);
    }
  };

  // ── Prečo nie? — prečo vyznačený ťah nie je hrozba ──────────────────
  TYPY.precoNieHrozba = {
    priprav(u) {
      const r = rozborHrozby(u, u.tah);
      const neplatne = nesplneneHrozby(r);
      const moznosti = u.moznosti || ['ticha', 'nic', 'super'];
      document.getElementById('hraZadanie').innerHTML =
        (u.otazka || '<b>{tah}</b> nie je hrozba. Prečo?').replace('{tah}', esc(r.nazov));
      ukazTahNaSachovnici(u, u.tah);
      nastavOdpovede('<div class="moznosti">' + moznosti.map(m =>
        '<button class="moznost" data-h="' + m + '">' + esc(PRECO_NIE_H[m]) + '</button>').join('') + '</div>',
        el => el.querySelectorAll('.moznost').forEach(b => b.onclick = () => {
          const dobre = neplatne.includes(b.dataset.h);
          vyznacVolbu(b, dobre);
          el.querySelectorAll('.moznost').forEach(x => { if (neplatne.includes(x.dataset.h)) x.classList.add('spravna'); });
          const spravne = neplatne.map(m => PRECO_NIE_H[m].toLowerCase()).join(', ');
          vyhodnotHrozbu(u, r, dobre, esc(u.vysvetlenie),
            'Správne je: ' + esc(spravne) + '. ' + esc(u.vysvetlenie), spravne);
        }));
      grosikHovori('rozmysla', 'Prejdi si podmienky jednu po druhej: tichý ťah, hrozí zisk alebo mat, súper nič nezíska.');
    }
  };

  // ── Čo hrozí? — klikne na figúrky, ktoré by po ťahu zobral so ziskom ─
  TYPY.coHrozi = {
    priprav(u) {
      const r = rozborHrozby(u, u.tah);
      const spravne = r.terce.map(t => VC.sqName(t.pole)).sort();
      const opp = superStranyH(r.strana);
      const kandidati = [];
      for (let i = 0; i < 64; i++) {
        const p = r.poTahu[i];
        if (p && VC.pieceColor(p) === opp && !jeKral(p) && utocniciNa(r.poTahu, i, r.strana).length) kandidati.push(i);
      }
      const vybrane = new Set();
      let hotovo = false;
      document.getElementById('hraZadanie').innerHTML = (u.otazka || 'Po ťahu <b>{tah}</b> — čo by si mohol zobrať so ziskom?')
        .replace('{tah}', esc(r.nazov));
      const kresli = () => {
        sachovnica.nastav(r.poTahu);
        const z = {};
        z[r.z] = 'last-from';
        z[r.na] = 'vidlickar';
        kandidati.forEach(i => { z[i] = vybrane.has(i) ? 'kandidat vybrany' : 'kandidat'; });
        sachovnica.oznac(z);
        kresliSipky([sipkaTahu(r.tah)]);
      };
      const odoslat = () => {
        if (hotovo) return;
        hotovo = true;
        const volba = Array.from(vybrane).map(VC.sqName).sort();
        const dobre = JSON.stringify(volba) === JSON.stringify(spravne);
        const text = spravne.length ? 'hrozí zobrať: ' + spravne.join(', ') : 'nič sa nedá zobrať so ziskom';
        vyhodnotHrozbu(u, r, dobre, esc(u.vysvetlenie), 'Nie celkom — ' + esc(text) + '. ' + esc(u.vysvetlenie), text);
      };
      sachovnica.naKlik = pole => {
        if (hotovo) return;
        if (!kandidati.includes(pole)) {
          grosikHovori('rozmysla', 'Klikaj na súperove figúrky označené namodro — tie po ťahu niekto napáda.');
          return;
        }
        if (vybrane.has(pole)) vybrane.delete(pole); else vybrane.add(pole);
        kresli();
      };
      nastavOdpovede('<button class="primary velke" id="hraTerceHotovo">Hotovo</button>',
        el => el.querySelector('#hraTerceHotovo').onclick = odoslat);
      kresli();
      grosikHovori('rozmysla', 'Namodro sú súperove figúrky, na ktoré po ťahu niekto útočí. Klikni na tie, ktoré by si ' +
                   'zobral so ziskom, keby súper vynechal ťah. Potom stlač Hotovo.');
    }
  };

  // ── Nájdi hrozbu — hráč zahrá tichý ťah jednej strany ───────────────
  TYPY.najdiHrozbu = {
    priprav(u) {
      const board = u._poz.board;
      const strana = u.strana || u._poz.state.active;
      const hrozby = VC.hrozbyStrany(board, u._poz.state, strana);
      const naTahu = u._poz.state.active;
      document.getElementById('hraZadanie').innerHTML = u.otazka ||
        ('Nájdi priamu hrozbu <b>' + stranaText(strana, 2) + '</b>' +
         (strana !== naTahu ? ' <span class="slabo">(hoci je na ťahu ' + stranaText(naTahu) + ')</span>' : ''));
      let hotovo = false;
      const vyber = vyberTahu(u, strana, uci => {
        if (hotovo) return;
        hotovo = true;
        sachovnica.naKlik = null;
        const r = rozborHrozby(u, uci);
        if (r.hrozba) {
          vyhodnotHrozbu(u, r, true, esc(r.vysvetlenie) + (u.vysvetlenie ? ' ' + esc(u.vysvetlenie) : ''), '', r.nazov);
          return;
        }
        const prepinac = zvoleny => '<div class="prepinac">Rozbor pre: ' + [uci].concat(hrozby.map(x => x.tah)).map(t =>
          '<button class="secondary male' + (t === zvoleny ? ' vybrane' : '') + '" data-tah="' + t + '">' +
          esc(t === uci ? r.nazov + ' (tvoj ťah)' : hrozby.find(x => x.tah === t).nazov) + '</button>').join('') + '</div>';
        const ukaz = t => {
          const rr = t === uci ? r : hrozby.find(x => x.tah === t);
          ukazRozborHrozby(u, rr, { panelPred: '<div class="panel-karta">' + prepinac(t) + '</div>',
                                    poPaneli: el => el.querySelectorAll('.prepinac button').forEach(b => b.onclick = () => ukaz(b.dataset.tah)) });
        };
        zapisChybu();
        ukaz(uci);
        const spravne = hrozby.map(x => x.nazov).join(', ');
        grosikHovori('smutny', esc(r.nazov) + ' nie je hrozba — ' + esc(PRECO_NIE_H[PRECO_Z_JADRA_H[r.dovod]]).toLowerCase() + '. ' +
                     'Hrozba bola ' + esc(spravne) + '. ' + (u.vysvetlenie ? esc(u.vysvetlenie) : ''));
        ukazPokracovanie(false, znak(BODY_CHYBA) + ' bodov · správne: ' + spravne);
      }, null, 'hrozbu');
      nastavOdpovede('<div class="slabo stred">Klikni na figúrku a potom na pole, kam má ísť.</div>');
      grosikHovori('rozmysla', u.tip || 'Klikni na figúrku — ukážu sa polia, kam môže ísť. Hľadaj tichý ťah, po ktorom ' +
                   'by si nabudúce zobral niečo so ziskom.');
      vyber.kresli();
    }
  };

  // ── Nájdi všetky hrozby (za oboch) — ako tréning v Zručnostiach ───────
  TYPY.najdiHrozby = {
    priprav(u) {
      const board = u._poz.board;
      const vysl = VC.hrozby(board, u._poz.state);
      const riesenia = vysl.riesenia;
      const rozbory = {};
      vysl.rozbory.forEach(r => { rozbory[r.tah] = r; });
      const ul = { najdene: [], chybne: [], hotovo: false, chybVUlohe: 0, casVyprsal: false, zobrazeny: null };
      const prezerane = {};
      const strana = t => VC.pieceColor(board[VC.sqIndex(t.slice(0, 2))]);

      document.getElementById('hraZadanie').innerHTML = 'Nájdi všetky <b>priame hrozby</b> <span class="slabo">(biele aj čierne)</span>';
      grosikHovori('rozmysla', stav.skuska
        ? skuskaVyzva() + ' Nájdi všetky priame hrozby za oboch skôr, ako vyprší čas.'
        : 'Klikni na figúrku a potom na pole, kam má ísť. Hľadaj za bieleho aj za čierneho. Keď už žiadnu nevidíš, stlač Hotovo.');

      const pocitadlo = () => {
        let t = 'Nájdené: ' + ul.najdene.length + ' / ' + riesenia.length;
        if (u.pomocka === 'strany') {
          const w = riesenia.filter(x => strana(x) === 'w'), b = riesenia.filter(x => strana(x) === 'b');
          t += ' · Biely ' + ul.najdene.filter(x => strana(x) === 'w').length + '/' + w.length +
               ' · Čierny ' + ul.najdene.filter(x => strana(x) === 'b').length + '/' + b.length;
        }
        nastavPasik(t, '');
      };
      const zaklad = () => {
        const znacky = {}, sipky = [];
        ul.najdene.forEach(t => { sipky.push(sipkaTahu(t, 'najdena')); znacky[VC.sqIndex(t.slice(2, 4))] = 'najdene'; });
        ul.chybne.forEach(c => sipky.push(sipkaTahu(c.tah, 'chybna')));
        if (ul.hotovo) riesenia.filter(t => !ul.najdene.includes(t)).forEach(t => {
          sipky.push(sipkaTahu(t, 'prehliadnuta')); znacky[VC.sqIndex(t.slice(2, 4))] = 'prehliadnuta';
        });
        return { znacky: znacky, sipky: sipky };
      };
      const zoznamHtml = () => {
        let h = '<div class="panel-karta"><h3>Tvoje hrozby</h3>';
        if (!ul.najdene.length && !ul.chybne.length && !ul.hotovo) h += '<div class="slabo">Zatiaľ nič.</div>';
        ul.najdene.forEach(t => {
          h += '<div class="zaznam dobre klik" data-tah="' + t + '"><b>' + esc(rozbory[t].nazov) + '</b> ' + esc(rozbory[t].vysvetlenie) + '</div>';
        });
        ul.chybne.forEach(c => {
          h += '<div class="zaznam zle klik" data-tah="' + c.tah + '"><b>' + esc(c.r.nazov) + '</b> ' +
               esc(PRECO_NIE_H[PRECO_Z_JADRA_H[c.r.dovod]].toLowerCase()) + '</div>';
        });
        if (ul.hotovo) {
          riesenia.filter(t => !ul.najdene.includes(t)).forEach(t => {
            h += '<div class="zaznam prehliadnute klik" data-tah="' + t + '"><b>' + esc(rozbory[t].nazov) + '</b> ' +
                 esc(rozbory[t].vysvetlenie) + ' <span class="znacka-prehliadnuta">prehliadnutá</span></div>';
          });
        }
        return h + '<div class="slabo straz-tip">Klikni na riadok a uvidíš rozbor ťahu.</div></div>';
      };
      const obnov = () => {
        vyber.kresli();
        pocitadlo();
        const el = document.getElementById('hraSpatna');
        let h = zoznamHtml();
        if (ul.zobrazeny) {
          const t = ul.zobrazeny;
          const r = rozbory[t] || (ul.chybne.find(c => c.tah === t) || {}).r || prezerane[t];
          if (r) h += htmlRozboruHrozby(u, r, true).replace(/<button class="secondary male vidl-prepni"[\s\S]*?<\/button>/, '');
        }
        el.innerHTML = h;
        el.querySelectorAll('.zaznam.klik').forEach(d => d.onclick = () => { ul.zobrazeny = d.dataset.tah; obnov(); });
      };
      const dokonci = vzdal => {
        if (ul.hotovo) return;
        ul.hotovo = true;
        zastavCasovac();
        sachovnica.naKlik = null;
        const vsetkyNajdene = ul.najdene.length === riesenia.length;
        const bezChyby = vsetkyNajdene && ul.chybVUlohe === 0 && !ul.casVyprsal;
        const prehliadnute = riesenia.filter(t => !ul.najdene.includes(t));
        let text;
        if (bezChyby) {
          pripocitaj(BONUS_BEZ_CHYBY);
          stav.bonusy += BONUS_BEZ_CHYBY;
          obnovHlavu();
          text = 'Všetky bez chyby: bonus +' + BONUS_BEZ_CHYBY;
          grosikHovori('nadseny', 'Našiel si všetky hrozby a ani raz si sa nepomýlil! ' + esc(u.vysvetlenie || ''));
        } else if (vsetkyNajdene) {
          text = 'Všetky nájdené';
          grosikHovori('vesely', 'Máš ich všetky. ' + esc(u.vysvetlenie || ''));
        } else {
          stav.seria = 0;
          obnovHlavu();
          text = (ul.casVyprsal ? 'Čas vypršal · ' : '') + 'Prehliadnuté: ' + prehliadnute.length;
          grosikHovori('smutny', (ul.casVyprsal ? 'Čas vypršal. ' : (vzdal ? 'Niečo ti ešte chýbalo. ' : '')) +
                       'Prehliadnuté hrozby sú naoranžovo. ' + (u.vysvetlenie ? esc(u.vysvetlenie) : ''));
          ul.zobrazeny = prehliadnute[0];
        }
        if (stav.skuska) {
          prehliadnute.forEach(t => zapisDiagnozu(dovodPrehliadnutejHrozby(rozbory[t], u._poz.state.active)));
          stav.skuska.vysledky.push({ fen: u.fen, bezChyby: bezChyby });
        }
        obnov();
        vyber = vyberTahu(u, null, t => {
          if (!rozbory[t] && !ul.chybne.find(c => c.tah === t)) prezerane[t] = rozborHrozby(u, t);
          ul.zobrazeny = t;
          obnov();
        }, zaklad, 'hrozbu');
        ukazPokracovanie(bezChyby || (vsetkyNajdene && !stav.skuska), text);
      };
      let vyber = vyberTahu(u, null, t => {
        if (ul.hotovo) return;
        ul.zobrazeny = t;
        if (ul.najdene.includes(t)) {
          grosikHovori('vesely', 'Túto hrozbu už máš. Hľadaj ďalej.');
        } else if (riesenia.includes(t)) {
          ul.najdene.push(t);
          const bonus = zapisSpravne();
          grosikHovori('nadseny', pochvala() + ' ' + esc(rozbory[t].vysvetlenie) + bonus);
        } else if (ul.chybne.find(c => c.tah === t)) {
          grosikHovori('rozmysla', 'Tento ťah si už skúšal — hrozba to nie je.');
        } else {
          const r = rozborHrozby(u, t);
          ul.chybne.push({ tah: t, r: r });
          ul.chybVUlohe++;
          zapisChybu();
          if (stav.skuska) zapisDiagnozu(dovodOmyluHrozby(r));
          grosikHovori('smutny', esc(r.nazov) + ' nie je hrozba — ' + esc(PRECO_NIE_H[PRECO_Z_JADRA_H[r.dovod]]).toLowerCase() +
                       '. Rozbor je vpravo. ' + znak(BODY_CHYBA) + ' bodov.');
        }
        obnov();
        if (ul.najdene.length === riesenia.length) dokonci(false);
      }, zaklad, 'hrozbu');

      nastavOdpovede('<button class="secondary velke" id="hraHotovo">Hotovo — viac ich nevidím</button>',
        el => el.querySelector('#hraHotovo').onclick = () => { if (!ul.hotovo) dokonci(true); });
      obnov();

      if (u.limit) {
        spustiCasovac(u.limit, () => {
          if (ul.hotovo) return;
          ul.casVyprsal = true;
          zvuk('loss');
          dokonci(true);
        });
      }
    }
  };

  // ── Rozbor chýb v skúške Hrozby na trhu — ktorú kapitolu zopakovať ───
  //  1 Čo je hrozba · 2 Len tichý ťah · 3 Hrozba musí stáť za to · 4 Súper nič nezíska
  //  5 Hrozí iná figúrka · 6 Pokazená obrana · 7 Hrozba matu a premeny · 8 Každá figúrka, obe strany
  function dovodOmyluHrozby(r) {
    if (!r.legalny) return 6;                        // ťah viazanou figúrkou
    const d = PRECO_Z_JADRA_H[r.dovod];
    if (d === 'ticha') return 2;                     // branie, šach alebo premena
    if (d === 'super') return 4;
    return 3;                                        // nič nehrozí (krytý terč, výmena)
  }

  function dovodPrehliadnutejHrozby(r, naTahu) {
    if (!r) return 1;
    if (!r.terce.length && (r.mat.length || r.premeny.length)) return 7;   // hrozba matu alebo premeny
    const mech = r.terce.map(t => t.mech);
    if (mech.length && !mech.includes('priamy')) {
      return mech.some(m => m === 'prerusenie' || m === 'vazba' || m === 'uvolnenie') ? 6 : 5;
    }
    const kus = r.figurka.toLowerCase();
    if (r.strana !== naTahu || kus === 'k' || kus === 'p') return 8;
    const opp = superStranyH(r.strana);
    if (r.terce.some(t => VC.countAttackers(r.poTahu, t.pole, opp) > 0)) return 3;
    return 1;
  }

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
    zastavVsetko();
    if (stav.skuska) { ukazKoniecSkusky(); return; }
    const k = stav.kapitola;
    const hviezdy = hviezdyZaSkore(stav.skore, stav.max);
    const pred = postupKapitoly(k);
    const noveMaximum = stav.skore > pred.najlepsie;
    postup.kapitoly[k.cislo] = {
      dokoncene: true,
      hviezdy: Math.max(pred.hviezdy, hviezdy),
      najlepsie: Math.max(pred.najlepsie, stav.skore),
      pokusy: (pred.pokusy || 0) + 1,
      naposledy: new Date().toISOString()
    };
    ulozPostup(k.cislo, { pokusy: 1, posledne: stav.skore });

    const i = O.kapitoly.indexOf(k);
    const dalsia = O.kapitoly.slice(i + 1).find(x => maObsah(x) && jeOdomknuta(x));
    const nalada = hviezdy === 3 ? 'nadseny' : (hviezdy === 2 ? 'vesely' : 'rozmysla');
    const pozdrav = hviezdy === 3 ? T.koniec3 : (hviezdy === 2 ? T.koniec2 : T.koniec1);

    koren.innerHTML = lista(true) +
      '<div class="koniec">' +
      '<div class="uvod-hlava">' + (k.znacka ? '' : 'Kapitola ' + k.cislo + ' · ') + esc(k.nazov) + '</div>' +
      grosikRiadok(nalada, esc(pozdrav) + (noveMaximum && pred.dokoncene ? ' <b>Nový rekord!</b>' : ''), null, true) +
      '<div class="koniec-hviezdy">' + hviezdyHtml(hviezdy) + '</div>' +
      '<div class="koniec-cisla">' +
      '<div><span class="koniec-hodnota">' + stav.skore + '</span><span class="koniec-popis">bodov</span></div>' +
      '<div><span class="koniec-hodnota plus">' + stav.spravnych + '</span><span class="koniec-popis">správne</span></div>' +
      '<div><span class="koniec-hodnota minus">' + stav.chyb + '</span><span class="koniec-popis">chyby</span></div></div>' +
      // Maximum už obsahuje bonusy za úlohy Nájdi všetky bez chyby; navyše je len séria
      '<div class="koniec-pozn">Za odpovede sa dalo získať ' + stav.max + ' bodov' +
      (stav.bonusySerie ? ', za sériu správnych odpovedí si dostal ďalších ' + stav.bonusySerie : '') + '.</div>' +
      '<div class="zapamataj"><div class="zapamataj-nadpis">Zapamätaj si</div>' + esc(k.zapamataj) +
      '<div class="zapamataj-pozn">Pravidlo je teraz v tvojom zošite.</div></div>' +
      '<div class="koniec-tlacidla">' +
      (dalsia ? '<button class="primary velke" data-akcia="dalsia">' +
                (dalsia.skuska ? 'Na záverečnú skúšku →' : (dalsia.priprava ? 'Na prípravu na skúšku →' : 'Ďalšia kapitola →')) +
                '</button>' : '') +
      '<button class="secondary" data-akcia="znova">Skúsiť znova</button>' +
      '<button class="secondary" data-akcia="mapa">Kapitoly</button></div></div>';
    naviazListu();
    const d = koren.querySelector('[data-akcia="dalsia"]');
    if (d) d.onclick = () => ukazUvod(dalsia);
    koren.querySelector('[data-akcia="znova"]').onclick = () => ukazUvod(k);
    window.scrollTo(0, 0);
  }

  // Karta „Čo zopakovať“: kapitoly zoradené podľa počtu chýb (najviac tri —
  // dlhší zoznam by dieťa skôr odradil)
  function htmlOdporucani(diag, dovody) {
    const kapitolyNaZopakovanie = Object.keys(diag).map(Number).sort((a, b) => diag[b] - diag[a]).slice(0, 3);
    if (!kapitolyNaZopakovanie.length) return '';
    return '<div class="panel-karta odporucania"><h3>Čo zopakovať</h3>' +
      kapitolyNaZopakovanie.map(c => {
        const kap = O.kapitoly.find(x => x.cislo === c);
        return '<div class="odporucanie"><div><b>Kapitola ' + c + ' — ' + esc(kap ? kap.nazov : '') + '</b>' +
               '<div class="slabo">' + esc(dovody[c] || '') + ' (' + diag[c] + '×)</div></div>' +
               '<button class="secondary male" data-kapitola="' + c + '">Zopakovať</button></div>';
      }).join('') + '</div>';
  }

  function naviazOdporucania() {
    koren.querySelectorAll('.odporucanie button').forEach(b => b.onclick = () => {
      const kap = O.kapitoly.find(x => x.cislo === Number(b.dataset.kapitola));
      if (kap) ukazUvod(kap);
    });
  }

  // ── Koniec prípravy na skúšku ────────────────────────────────────────
  //  Bez hviezdičiek a odznaku. Uloží sa ako dokončená (aj keď ju hráč ukončil
  //  skôr) — tým sa odomkne skúška. Najlepšie = najviac pozícií bez chyby.
  function ukazKoniecPripravy() {
    const k = stav.kapitola;
    const ks = kapitolaSkusky();
    const s = ks.skuska;
    const vysl = stav.skuska.vysledky;
    const n = vysl.length;
    const vyriesene = vysl.filter(x => x.bezChyby).length;
    const pred = postupKapitoly(k);
    postup.kapitoly[k.cislo] = {
      dokoncene: true,
      hviezdy: 0,
      najlepsie: Math.max(pred.najlepsie || 0, vyriesene),
      pokusy: (pred.pokusy || 0) + 1,
      naposledy: new Date().toISOString()
    };
    ulozPostup(k.cislo, { pokusy: 1, posledne: vyriesene });

    const potrebne = s.hranica / s.pocet;                 // na skúške 8 z 10 = 80 %
    const percent = n ? Math.round(100 * vyriesene / n) : 0;
    const pripraveny = n >= 10 && vyriesene / n >= potrebne;
    const treba = Math.round(100 * potrebne);
    let text;
    if (!n) text = 'Tréning si ukončil hneď na začiatku. Skúška je odomknutá — veľa šťastia!';
    else if (n < 10) text = 'Vyriešil si ' + vyriesene + ' z ' + n + ' pozícií bez chyby. Na spoľahlivý odhad treba ' +
                            'aspoň 10 pozícií, ale skúška je už odomknutá.';
    else if (pripraveny) text = 'Vyriešil si ' + vyriesene + ' z ' + n + ' pozícií bez chyby (' + percent + ' %). ' +
                                'Na skúške treba ' + treba + ' % — si pripravený!';
    else text = 'Vyriešil si ' + vyriesene + ' z ' + n + ' pozícií bez chyby (' + percent + ' %). Na skúške treba ' +
                treba + ' %. Zopakuj si kapitoly nižšie alebo skús prípravu znova. Skúška je odomknutá, ' +
                'môžeš ísť aj na ňu.';

    const mriezka = vysl.map((x, i) => '<span class="skuska-pole ' + (x.bezChyby ? 'dobre' : 'zle') + '">' +
                                       (i + 1) + '</span>').join('');
    const nazaSkusku = '<button class="' + (pripraveny || !n ? 'primary velke' : 'secondary') +
                       '" data-akcia="skuska">Na záverečnú skúšku →</button>';
    koren.innerHTML = lista(true) +
      '<div class="koniec">' +
      '<div class="uvod-hlava">' + esc(k.nazov) + '</div>' +
      grosikRiadok(pripraveny ? 'nadseny' : (n ? 'rozmysla' : 'vesely'), esc(text), null, true) +
      (n ? '<div class="skuska-vysledok"><div class="skuska-cislo ' + (pripraveny ? 'plus' : 'minus') + '">' + vyriesene +
           ' / ' + n + '</div><div class="slabo">pozícií vyriešených úplne a bez chyby' +
           (n < k.priprava.pocet ? ' (tréning ukončený po ' + n + ' z ' + k.priprava.pocet + ')' : '') + '</div>' +
           '<div class="skuska-mriezka">' + mriezka + '</div></div>' : '') +
      htmlOdporucani(stav.skuska.diagnoza, s.dovody || DOVODY) +
      '<div class="koniec-tlacidla">' + nazaSkusku +
      '<button class="' + (pripraveny || !n ? 'secondary' : 'primary velke') + '" data-akcia="znova">Skúsiť prípravu znova</button>' +
      '<button class="secondary" data-akcia="mapa">Kapitoly</button></div></div>';
    naviazListu();
    koren.querySelector('[data-akcia="znova"]').onclick = () => ukazUvod(k);
    koren.querySelector('[data-akcia="skuska"]').onclick = () => ukazUvod(ks);
    naviazOdporucania();
    zvuk(pripraveny ? 'win' : 'loss');
    window.scrollTo(0, 0);
  }

  // ── Koniec záverečnej skúšky ─────────────────────────────────────────
  function ukazKoniecSkusky() {
    if (jePriprava()) { ukazKoniecPripravy(); return; }
    const k = stav.kapitola;
    const s = k.skuska;
    const vysl = stav.skuska.vysledky;
    const vyriesene = vysl.filter(x => x.bezChyby).length;
    const zlozena = vyriesene >= s.hranica;
    const hviezdy = zlozena ? Math.min(3, 1 + vyriesene - s.hranica) : 0;
    const pred = postupKapitoly(k);
    postup.kapitoly[k.cislo] = {
      dokoncene: pred.dokoncene || zlozena,
      hviezdy: Math.max(pred.hviezdy, hviezdy),
      najlepsie: Math.max(pred.najlepsie, vyriesene),
      pokusy: (pred.pokusy || 0) + 1,
      naposledy: new Date().toISOString()
    };
    ulozPostup(k.cislo, { pokusy: 1, posledne: vyriesene });

    const mriezka = vysl.map((x, i) => '<span class="skuska-pole ' + (x.bezChyby ? 'dobre' : 'zle') + '">' +
                                       (i + 1) + '</span>').join('');

    // Texty, ktoré si skúška môže určiť v obsahu (inak platia texty Šachového trhu)
    const dovody = s.dovody || DOVODY;
    const textZlozena = s.textZlozena ||
      'Teraz si naozajstný obchodník a môžeš trénovať Brania so ziskom v menu Zručnosti.';
    const odkaz = s.odkaz || { text: 'Trénovať Brania so ziskom →', href: 'skills.html?type=direct_attack' };

    // Odporúčania: kapitoly zoradené podľa počtu chýb
    const odporucania = htmlOdporucani(stav.skuska.diagnoza, dovody);

    const text = zlozena
      ? 'Skúška je zložená! Vyriešil si ' + vyriesene + ' z ' + vysl.length + ' pozícií bez chyby. ' + textZlozena
      : 'Vyriešil si ' + vyriesene + ' z ' + vysl.length + ' pozícií bez chyby. Na zloženie treba ' + s.hranica +
        '. Zopakuj si kapitoly nižšie a skús to znova — pozície budú zakaždým iné.';

    koren.innerHTML = lista(true) +
      '<div class="koniec">' +
      '<div class="uvod-hlava">' + esc(k.nazov) + '</div>' +
      grosikRiadok(zlozena ? 'nadseny' : 'rozmysla', esc(text), null, true) +
      (zlozena ? '<div class="koniec-odznak">' + odznakHtml(true) + '</div>' +
                 '<div class="koniec-hviezdy">' + hviezdyHtml(hviezdy) + '</div>' : '') +
      '<div class="skuska-vysledok"><div class="skuska-cislo ' + (zlozena ? 'plus' : 'minus') + '">' + vyriesene +
      ' / ' + vysl.length + '</div><div class="slabo">pozícií vyriešených úplne a bez chyby (treba ' + s.hranica + ')</div>' +
      '<div class="skuska-mriezka">' + mriezka + '</div></div>' +
      odporucania +
      (zlozena ? '<div class="zapamataj"><div class="zapamataj-nadpis">Zapamätaj si</div>' + esc(k.zapamataj) + '</div>' : '') +
      '<div class="koniec-tlacidla">' +
      (zlozena ? '<a class="odkaz-tlacidlo velke" href="' + esc(odkaz.href) + '">' + esc(odkaz.text) + '</a>' : '') +
      '<button class="' + (zlozena ? 'secondary' : 'primary velke') + '" data-akcia="znova">Skúsiť skúšku znova</button>' +
      '<button class="secondary" data-akcia="mapa">Kapitoly</button></div></div>';
    naviazListu();
    koren.querySelector('[data-akcia="znova"]').onclick = () => ukazUvod(k);
    naviazOdporucania();
    zvuk(zlozena ? 'win' : 'loss');
    window.scrollTo(0, 0);
  }

  return {
    spusti: spusti,
    // pre testy
    _hviezdyZaSkore: hviezdyZaSkore,
    _moznostiCisel: moznostiCisel,
    _dovodPrehliadnutia: dovodPrehliadnutia,
    _dovodOmyluSlabej: dovodOmyluSlabej,
    _dovodPrehliadnutejSlabej: dovodPrehliadnutejSlabej,
    _nesplnene: nesplnene,
    _dovodOmyluVidlicky: dovodOmyluVidlicky,
    _dovodPrehliadnutejVidlicky: dovodPrehliadnutejVidlicky,
    _vazbaRozhoduje: vazbaRozhoduje,
    _dovodOmyluHrozby: dovodOmyluHrozby,
    _dovodPrehliadnutejHrozby: dovodPrehliadnutejHrozby,
    _stav: () => stav
  };
})();
