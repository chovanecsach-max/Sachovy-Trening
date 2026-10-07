// ============================================================================
//  vizualizacia-zadania.js — zadania vizualizácie (X-krát aspoň Y bodov v šprinte)
// ----------------------------------------------------------------------------
//  Zadanie v tabuľke assignments (pozri vizualizacia-zadania.sql):
//      skill         = 'viz_' + typ úloh       napr. 'viz_farba'
//      target_type   = 'sprint'
//      target_value  = koľko šprintov treba    (X)
//      viz_dlzka     = 60 alebo 120 sekúnd
//      viz_min_skore = aspoň koľko bodov       (Y)
//  Započíta sa každý šprint daného typu a dĺžky s aspoň Y bodmi, ktorý hráč
//  odohral PO zadaní (tabuľka vizualizacia_sprint). Termín sa správa ako pri
//  ostatných zadaniach: splnenie po termíne sa ráta, len sa ukáže „po termíne“.
//
//  Používa: zadania.html, zadania-prehlad.html, index.html (odznak),
//           vizualizacia-prehlad.html (vytváranie zadaní).
//  Potrebuje: js/player.js (sbFetch).
// ============================================================================

(window.VERZIE = window.VERZIE || {})['vizualizacia-zadania.js'] = '2026-10-07';

const VizZadania = (function () {
  'use strict';

  const TYPY = {
    polia:     'Nájdi pole',
    farba:     'Farba poľa',
    diagonala: 'Diagonála',
    jazdec:    'Cesta jazdca',
    stvorec:   'Pravidlo štvorca',
    mix:       'Mix'
  };

  const pl = (n, one, few, many) => n === 1 ? one : (n >= 2 && n <= 4 ? few : many);

  // Je to zadanie vizualizácie?
  const je = a => !!a && a.target_type === 'sprint';

  // 'viz_farba' → 'farba'
  const typ = a => String(a.skill || '').replace(/^viz_/, '');

  // Názvy pre stĺpec „Zručnosť“ (kľúč = assignments.skill)
  const NAZVY_ZRUCNOSTI = {};
  Object.keys(TYPY).forEach(t => { NAZVY_ZRUCNOSTI['viz_' + t] = '👁️ Vizualizácia: ' + TYPY[t]; });

  // „Farba poľa · šprint 60 s“
  const popis = a => `${TYPY[typ(a)] || typ(a)} · šprint ${a.viz_dlzka} s`;

  // „5× aspoň 20 bodov“
  const ciel = a => `${a.target_value}× aspoň ${a.viz_min_skore} ${pl(a.viz_min_skore, 'bod', 'body', 'bodov')}`;

  // Odkaz do vizualizácie, ktorý rovno pripraví správny šprint
  const odkaz = a => `vizualizacia.html?typ=${encodeURIComponent(typ(a))}&sprint=${a.viz_dlzka}` +
                     `&x=${a.target_value}&y=${a.viz_min_skore}`;

  // Šprinty hráčov od daného času. Čas cez toISOString() – znak „+“ z PostgREST
  // by sa v adrese čítal ako medzera. Po dávkach, Supabase vracia max. 1000 riadkov.
  async function nacitaj(userIds, odISO) {
    const ids = [...new Set(userIds)].filter(Boolean);
    if (!ids.length) return [];
    const od = new Date(odISO).toISOString();
    const PAGE = 1000;
    let vsetky = [];
    for (let i = 0; i < ids.length; i += 100) {      // krátke adresy
      const cast = ids.slice(i, i + 100).join(',');
      let off = 0;
      while (true) {
        const rows = await sbFetch(
          `vizualizacia_sprint?user_id=in.(${cast})&created_at=gte.${od}` +
          `&select=user_id,typ,dlzka,skore,created_at&order=created_at.asc&limit=${PAGE}&offset=${off}`) || [];
        vsetky = vsetky.concat(rows);
        if (rows.length < PAGE) break;
        off += PAGE;
      }
    }
    return vsetky;
  }

  // Koľko šprintov sa do zadania započítava (najviac target_value)
  function pocet(sprinty, a, userId) {
    const od = new Date(a.created_at).getTime();
    const t = typ(a), d = Number(a.viz_dlzka), y = Number(a.viz_min_skore);
    return (sprinty || []).filter(s =>
      s.user_id === userId && s.typ === t && Number(s.dlzka) === d &&
      Number(s.skore) >= y && new Date(s.created_at).getTime() >= od).length;
  }

  // Pokrok ako na ostatných zadaniach: { n, pct, done }
  function pokrok(sprinty, a, userId) {
    const n = pocet(sprinty, a, userId);
    const x = Math.max(1, Number(a.target_value) || 1);
    return { n, pct: Math.max(0, Math.min(1, n / x)), done: n >= x };
  }

  return { TYPY, NAZVY_ZRUCNOSTI, je, typ, popis, ciel, odkaz, nacitaj, pocet, pokrok };
})();
