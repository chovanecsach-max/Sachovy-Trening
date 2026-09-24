// ============================================================================
//  hra-postup.js — kam sa ukladá postup hráča v hrách zručností
// ----------------------------------------------------------------------------
//  Herný rámec (hra-engine.js) nevie, kde postup leží. Dostane „úložisko"
//  s dvoma funkciami:
//      nacitaj()                      → Promise s postupom { verzia, kapitoly }
//      uloz(postup, cislo, udalost)   → Promise (cislo = práve dohraná kapitola,
//                                        udalost = { pokusy, posledne })
//
//  Úložiská:
//    HraPostup.lokalne(hra, userId)   — len prehliadač (testovanie zo súboru)
//    HraPostup.databaza(hra, userId)  — tabuľka hra_postup v Supabase
//                                       + kópia v prehliadači pre prípad výpadku
//
//  DATABÁZA sa zapisuje LEN cez funkciu hra_zapis_postup (pozri hry-postup.sql).
//  Tá lepší výsledok nikdy neprepíše horším. Do training_log sa NEZAPISUJE —
//  hra je vysvetlenie zručnosti, nie tréning, a nesmie meniť ELO ani štatistiky.
//
//  PRENOS: postup, ktorý hráč nahral skôr, než existovala databáza (alebo ktorý
//  sa pre výpadok siete neodoslal), zostal v prehliadači. Pri načítaní sa
//  porovná s databázou a čo je v prehliadači lepšie, pošle sa hore.
//
//  Potrebuje: js/player.js (sbFetch) — len pre úložisko databaza.
// ============================================================================

(window.VERZIE = window.VERZIE || {})['hra-postup.js'] = '2026-09-24';

const HraPostup = (function () {
  'use strict';

  function prazdny() { return { verzia: 1, kapitoly: {} }; }

  function klucLokalne(hra, userId) { return 'hra_' + hra + '_' + (userId || 'lokalne'); }

  function citajLokalne(kluc) {
    try {
      const raw = localStorage.getItem(kluc);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && p.kapitoly) return p;
      }
    } catch (e) { /* prehliadač bez úložiska — hrá sa bez neho */ }
    return prazdny();
  }

  function pisLokalne(kluc, postup) {
    try { localStorage.setItem(kluc, JSON.stringify(postup)); } catch (e) {}
  }

  // Je záznam a v niečom lepší než b?
  function lepsi(a, b) {
    if (!a) return false;
    if (!b) return true;
    return (!!a.dokoncene && !b.dokoncene) ||
           (a.hviezdy || 0) > (b.hviezdy || 0) ||
           (a.najlepsie || 0) > (b.najlepsie || 0);
  }

  // Z dvoch záznamov tej istej kapitoly vyberie z každého to lepšie
  function zluc(a, b) {
    if (!a) return b;
    if (!b) return a;
    const cas = [a.naposledy, b.naposledy].filter(Boolean).sort();
    return {
      dokoncene: !!(a.dokoncene || b.dokoncene),
      hviezdy:   Math.max(a.hviezdy || 0, b.hviezdy || 0),
      najlepsie: Math.max(a.najlepsie || 0, b.najlepsie || 0),
      pokusy:    Math.max(a.pokusy || 0, b.pokusy || 0),
      naposledy: cas.length ? cas[cas.length - 1] : undefined
    };
  }

  // ── Len prehliadač ──────────────────────────────────────────────────────
  function lokalne(hra, userId) {
    const kluc = klucLokalne(hra, userId);
    return {
      nacitaj: () => Promise.resolve(citajLokalne(kluc)),
      uloz: (postup) => { pisLokalne(kluc, postup); return Promise.resolve(); }
    };
  }

  // ── Databáza ────────────────────────────────────────────────────────────
  function databaza(hra, userId) {
    const kluc = klucLokalne(hra, userId);

    function zapis(cislo, z, pokusy, posledne, kedy) {
      return sbFetch('rpc/hra_zapis_postup', {
        method: 'POST',
        body: JSON.stringify({
          p_hra: hra,
          p_kapitola: Number(cislo),
          p_dokoncene: !!z.dokoncene,
          p_hviezdy: z.hviezdy || 0,
          p_najlepsie: z.najlepsie || 0,
          p_posledne: (posledne === undefined) ? null : posledne,
          p_pokusy: pokusy,
          p_kedy: kedy || null
        })
      });
    }

    async function nacitaj() {
      const lok = citajLokalne(kluc);
      let riadky;
      try {
        riadky = await sbFetch('hra_postup?user_id=eq.' + encodeURIComponent(userId) +
                               '&hra=eq.' + encodeURIComponent(hra) +
                               '&select=kapitola,dokoncene,hviezdy,najlepsie,pokusy,naposledy') || [];
      } catch (e) {
        // Bez siete sa hrá z kópie v prehliadači; odošle sa pri ďalšom načítaní
        console.warn('Postup hry sa nenačítal z databázy, použijem kópiu z prehliadača:', e);
        return lok;
      }

      const db = {};
      riadky.forEach(r => {
        db[r.kapitola] = { dokoncene: r.dokoncene, hviezdy: r.hviezdy, najlepsie: r.najlepsie,
                           pokusy: r.pokusy, naposledy: r.naposledy };
      });

      const vysledok = prazdny();
      const cisla = new Set(Object.keys(lok.kapitoly).concat(Object.keys(db)));
      for (const c of cisla) {
        const l = lok.kapitoly[c], d = db[c];
        if (lepsi(l, d)) {
          // V prehliadači je niečo, čo databáza nemá — pošli to hore.
          // Ak kapitola v databáze ešte nie je, prenesú sa aj pokusy.
          const pokusy = d ? 0 : (l.pokusy || (l.dokoncene ? 1 : 0));
          try { await zapis(c, l, pokusy, undefined, l.naposledy); }
          catch (e) { console.warn('Postup kapitoly ' + c + ' sa neodoslal:', e); }
        }
        vysledok.kapitoly[c] = zluc(l, d);
      }
      pisLokalne(kluc, vysledok);
      return vysledok;
    }

    function uloz(postup, cislo, udalost) {
      pisLokalne(kluc, postup);             // kópia pre prípad výpadku siete
      if (cislo === undefined || cislo === null) return Promise.resolve();
      const u = udalost || {};
      return zapis(cislo, postup.kapitoly[cislo], (u.pokusy === undefined) ? 1 : u.pokusy, u.posledne, null);
    }

    return { nacitaj: nacitaj, uloz: uloz };
  }

  return {
    lokalne: lokalne,
    databaza: databaza,
    klucLokalne: klucLokalne,
    // pre testy
    _lepsi: lepsi,
    _zluc: zluc
  };
})();
