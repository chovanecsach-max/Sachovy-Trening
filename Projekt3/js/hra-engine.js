// ============================================================================
//  hra-engine.js — herný rámec pre hry zručností
//                  (Šachový trh, Stráž na trhu)
// ----------------------------------------------------------------------------
//  Rámec nevie nič o konkrétnej hre. Dostane obsah (napr. OBSAH_TRH z
//  trh-obsah.js alebo OBSAH_STRAZ zo straz-obsah.js) a postará sa o všetko
//  ostatné:
//    • mapa kapitol, odomykanie, hviezdičky, zošit pravidiel, odznak,
//    • úvod kapitoly so sprievodcom Grošíkom,
//    • úlohy — Šachový trh: vazenie, obchod, anonie, kolko, pasca, najdi, stanok
//            — Stráž na trhu: pocet, slaba, ktora, najdiSlabe,
//    • body: správne +10, chyba −5, séria 5 správnych +10, úloha Nájdi
//      všetky bez chyby +10; skóre kapitoly neklesne pod nulu,
//    • po odpovedi rebrík výmeny (Šachový trh) alebo stráž figúrky
//      (Stráž na trhu) na šachovnici,
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

(window.VERZIE = window.VERZIE || {})['hra-engine.js'] = '2026-09-27';

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
    pochvaly: ['Výborne! Dobrý obchod.', 'Presne tak!', 'Máš oko obchodníka.', 'Správne!', 'Tak sa to robí!'],
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

  function maObsah(k) { return !!(k.skuska || (k.ulohy && k.ulohy.length > 0)); }
  function znackaKapitoly(k) { return k.znacka || String(k.cislo); }

  // Kapitola sa odomkne po dokončení predchádzajúcej (alebo tej, ktorú určí odomknePo)
  function predchodca(k) {
    if (k.odomknePo) return O.kapitoly.find(x => x.cislo === k.odomknePo) || null;
    const i = O.kapitoly.indexOf(k);
    return i > 0 ? O.kapitoly[i - 1] : null;
  }

  function jeOdomknuta(k) {
    if (jeTrener()) return true;
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
      else if (u.typ === 'najdi') vypocet = VC.braniaSoZiskom(poz.board, poz.state).riesenia;
      else if (u.typ === 'pasca') vypocet = u.moznosti.filter(x => ziskNaSachovnici(poz.board, x) > 0);
      else if (u.tah && !jeLegalny(poz.board, u.tah)) vypocet = 'nelegalny';
      else if (u.tah) vypocet = ziskNaSachovnici(poz.board, u.tah);
      if (u.typ === 'stanok' && !(u.moznosti || []).includes(u.tah.slice(2, 4))) {
        console.warn('Úloha ' + u.id + ': medzi možnosťami chýba stánok ' + u.tah.slice(2, 4));
      }
      if (JSON.stringify(vypocet) !== JSON.stringify(u.ocakavane)) {
        console.warn('Úloha ' + u.id + ': scenár čaká ' + JSON.stringify(u.ocakavane) +
                     ', výpočet dáva ' + JSON.stringify(vypocet));
      }
    }));
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
    const sObsahom = O.kapitoly.filter(maObsah);
    const hviezd = sObsahom.reduce((s, k) => s + postupKapitoly(k).hviezdy, 0);

    let karty = '';
    O.kapitoly.forEach(k => {
      const p = postupKapitoly(k);
      const obsah = maObsah(k);
      const odomknuta = obsah && jeOdomknuta(k);
      let trieda = 'kapitola-karta' + (k.skuska ? ' skuska' : '') + (k.znacka ? ' bonus' : '');
      let stavText;
      if (!obsah) { trieda += ' pripravujeme'; stavText = 'Pripravujeme'; }
      else if (!odomknuta) {
        trieda += ' zamknuta';
        stavText = 'Najprv dokonči kapitolu ' + znackaKapitoly(predchodca(k));
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
        (obsah ? hviezdyHtml(p.hviezdy) : '') + '</button>';
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
    O.kapitoly.filter(maObsah).forEach(k => {
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
    return BODY_SPRAVNE;
  }

  function ukazUvod(k) {
    zastavVsetko();
    const bublina = k.uvod.map(t => '<p>' + t + '</p>').join('') +
                    (k.cennik ? cennikHtml() : '') +
                    (k.uvodKoniec ? '<p>' + k.uvodKoniec + '</p>' : '');
    let info;
    if (k.skuska) {
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
      '<div class="uvod-hlava">' + (k.znacka ? '' : 'Kapitola ' + k.cislo + ' · ') + esc(k.nazov) + '</div>' +
      grosikRiadok('vesely', bublina, null, true) +
      (k.prePokrocilych ? '<details class="ramcek"><summary>Pre pokročilých</summary><p>' + esc(k.prePokrocilych) + '</p></details>' : '') +
      (k.preTrenerov && vidiTrenerskeRamceky()
        ? '<details class="ramcek trener"><summary>Pre trénerov</summary><p>' + esc(k.preTrenerov) + '</p></details>' : '') +
      '<div class="uvod-info">' + esc(info) + '</div>' +
      '<button class="primary velke" data-akcia="zacat">' + (k.skuska ? 'Začať skúšku' : 'Začať úlohy') + '</button></div>';
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

  function zacniKapitolu(k) {
    let ulohy = k.ulohy || [];
    let skuska = null;
    if (k.skuska) {
      const s = k.skuska;
      ulohy = nahodnyVyber(s.pozicie, s.pocet).map((fen, i) => {
        const poz = VC.parseFen(fen);
        const n = VC.braniaSoZiskom(poz.board, poz.state).riesenia.length;
        return { id: k.cislo + '.' + (i + 1), typ: 'najdi', fen: fen, limit: s.casZaklad + s.casNaRiesenie * n,
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
    return '<span class="uloha-poradie">' + (k.skuska ? 'Skúška' : (k.znacka ? 'Bonus' : 'Kapitola ' + k.cislo)) +
           ' · Úloha ' + (stav.i + 1) + ' / ' + stav.ulohy.length + '</span>' +
           (u && u.limit ? '<span class="cas" id="hraCas">⏱ ' + formatCas(u.limit) + '</span>'
                         : '<span class="seria" title="Séria správnych odpovedí — každých ' + DLZKA_SERIE +
                           ' = bonus">' + seria + '</span>') +
           '<span class="skore"><span class="minca mala"></span> <span id="hraSkore">' + stav.skore + '</span> b.</span>';
  }

  function obnovHlavu() {
    const el = document.getElementById('hraHlava');
    if (!el) return;
    const cas = document.getElementById('hraCas');
    const textCasu = cas ? cas.textContent : null;
    const trieda = cas ? cas.className : null;
    el.innerHTML = hlavaHtml();
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
    const dokoncit = stav.skuska ? 'Vyhodnotiť skúšku' : 'Dokončiť kapitolu';
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
          const naStanku = ' Na stánku ' + spravne + ': ' + RV.textVerdiktu(zisk).toLowerCase() + '.';
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
      const ul = { najdene: [], chybne: [], vybrane: null, hotovo: false, chybVUlohe: 0, casVyprsal: false };

      document.getElementById('hraZadanie').innerHTML = 'Nájdi všetky brania so ziskom <span class="slabo">(biele aj čierne)</span>';
      grosikHovori('rozmysla', stav.skuska
        ? 'Skúška! Nájdi všetky brania so ziskom za oboch skôr, ako vyprší čas.'
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
        ? 'Skúška! Nájdi všetky slabo pokryté figúrky za oboch skôr, ako vyprší čas.'
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
        const m = /^(\S+ na [a-h][1-8])([\s\S]*)$/.exec(veta[x]);
        return m ? '<b>' + esc(m[1]) + '</b>' + esc(m[2]) : esc(veta[x]);
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
        if (stav.skuska) stav.skuska.vysledky.push({ fen: u.fen, bezChyby: bezChyby });
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
      '<div class="koniec-pozn">Za odpovede sa dalo získať ' + stav.max + ' bodov' +
      (stav.bonusy ? ', bonusy ti pridali ďalších ' + stav.bonusy : '') + '.</div>' +
      '<div class="zapamataj"><div class="zapamataj-nadpis">Zapamätaj si</div>' + esc(k.zapamataj) +
      '<div class="zapamataj-pozn">Pravidlo je teraz v tvojom zošite.</div></div>' +
      '<div class="koniec-tlacidla">' +
      (dalsia ? '<button class="primary velke" data-akcia="dalsia">' +
                (dalsia.skuska ? 'Na záverečnú skúšku →' : 'Ďalšia kapitola →') + '</button>' : '') +
      '<button class="secondary" data-akcia="znova">Skúsiť znova</button>' +
      '<button class="secondary" data-akcia="mapa">Kapitoly</button></div></div>';
    naviazListu();
    const d = koren.querySelector('[data-akcia="dalsia"]');
    if (d) d.onclick = () => ukazUvod(dalsia);
    koren.querySelector('[data-akcia="znova"]').onclick = () => ukazUvod(k);
    window.scrollTo(0, 0);
  }

  // ── Koniec záverečnej skúšky ─────────────────────────────────────────
  function ukazKoniecSkusky() {
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

    // Odporúčania: kapitoly zoradené podľa počtu chýb
    const diag = stav.skuska.diagnoza;
    // najviac tri — dlhší zoznam by dieťa skôr odradil
    const kapitolyNaZopakovanie = Object.keys(diag).map(Number).sort((a, b) => diag[b] - diag[a]).slice(0, 3);
    let odporucania = '';
    if (kapitolyNaZopakovanie.length) {
      odporucania = '<div class="panel-karta odporucania"><h3>Čo zopakovať</h3>' +
        kapitolyNaZopakovanie.map(c => {
          const kap = O.kapitoly.find(x => x.cislo === c);
          return '<div class="odporucanie"><div><b>Kapitola ' + c + ' — ' + esc(kap ? kap.nazov : '') + '</b>' +
                 '<div class="slabo">' + esc(DOVODY[c] || '') + ' (' + diag[c] + '×)</div></div>' +
                 '<button class="secondary male" data-kapitola="' + c + '">Zopakovať</button></div>';
        }).join('') + '</div>';
    }

    const text = zlozena
      ? 'Skúška je zložená! Vyriešil si ' + vyriesene + ' z ' + vysl.length + ' pozícií bez chyby. ' +
        'Teraz si naozajstný obchodník a môžeš trénovať Brania so ziskom v menu Zručnosti.'
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
      (zlozena ? '<a class="odkaz-tlacidlo velke" href="skills.html?type=direct_attack">Trénovať Brania so ziskom →</a>' : '') +
      '<button class="' + (zlozena ? 'secondary' : 'primary velke') + '" data-akcia="znova">Skúsiť skúšku znova</button>' +
      '<button class="secondary" data-akcia="mapa">Kapitoly</button></div></div>';
    naviazListu();
    koren.querySelector('[data-akcia="znova"]').onclick = () => ukazUvod(k);
    koren.querySelectorAll('.odporucanie button').forEach(b => b.onclick = () => {
      const kap = O.kapitoly.find(x => x.cislo === Number(b.dataset.kapitola));
      if (kap) ukazUvod(kap);
    });
    zvuk(zlozena ? 'win' : 'loss');
    window.scrollTo(0, 0);
  }

  return {
    spusti: spusti,
    // pre testy
    _hviezdyZaSkore: hviezdyZaSkore,
    _moznostiCisel: moznostiCisel,
    _dovodPrehliadnutia: dovodPrehliadnutia,
    _stav: () => stav
  };
})();
