// ============================================================================
//  vizualizacia-pristup.js — kto vidí vizualizáciu
// ----------------------------------------------------------------------------
//  Rovnako ako pri hrách to určuje tabuľka nastavenia, riadok 'vizualizacia':
//      'admin'    — len admin
//      'personal' — admin, hlavný tréner a tréneri
//      'vsetci'   — všetci vrátane hráčov
//  Keď riadok chýba, vidí ju len admin. Okrem toho ju vždy vidia vybraní
//  testeri hier (tabuľka hry_testeri, admin panel → políčko „Testuje hry“).
//
//  Zmena v SQL editore (netreba nič nahrávať na GitHub), pozri vizualizacia.sql:
//      update nastavenia set hodnota = 'vsetci', zmenene = now() where kluc = 'vizualizacia';
//
//  Používa: index.html (tlačidlo v menu) a vizualizacia.html (stránka).
//  Potrebuje: js/player.js (sbFetch).
// ============================================================================

(window.VERZIE = window.VERZIE || {})['vizualizacia-pristup.js'] = '2026-10-05';

const VizPristup = (function () {
  'use strict';

  const PERSONAL = ['admin', 'hlavny_trener', 'trener'];
  let _uroven = null;

  // Komu je vizualizácia otvorená: 'admin' | 'personal' | 'vsetci'
  async function uroven() {
    if (_uroven === null) {
      try {
        const rows = await sbFetch('nastavenia?kluc=eq.vizualizacia&select=hodnota&limit=1') || [];
        _uroven = (rows[0] && rows[0].hodnota) || 'admin';
      } catch (e) {
        _uroven = 'admin';            // pri chybe radšej zatvorené
      }
    }
    return _uroven;
  }

  // Je prihlásený medzi vybranými testermi? Databáza mu povie len o ňom samom.
  async function jeTester() {
    const userId = sessionStorage.getItem('user_id') || '';
    if (!userId) return false;
    try {
      const rows = await sbFetch('hry_testeri?user_id=eq.' + encodeURIComponent(userId) + '&select=user_id&limit=1');
      return !!(rows && rows.length);
    } catch (e) {
      return false;
    }
  }

  // Smie prihlásený vizualizáciu vidieť?
  async function ma(rola) {
    rola = rola || sessionStorage.getItem('user_role') || '';
    if (rola === 'admin') return true;
    const u = await uroven();
    if (u === 'vsetci') return true;
    if (u === 'personal' && PERSONAL.includes(rola)) return true;
    return jeTester();
  }

  // Na stránke vizualizácie: ak ešte nie je sprístupnená, ukáže oznam a vráti false.
  async function vyzaduj() {
    if (await ma()) return true;
    document.body.innerHTML =
      '<div style="max-width:520px;margin:60px auto;padding:26px;background:#fff;' +
      'border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.08);' +
      'font-family:Arial,sans-serif;text-align:center;color:#111827;">' +
      '<div style="font-size:40px;margin-bottom:10px;">👁️</div>' +
      '<h2 style="margin:0 0 10px;color:#b45309;">Vizualizácia sa pripravuje</h2>' +
      '<p style="color:#475569;font-size:15px;line-height:1.5;">' +
      'Na tréningu vizualizácie ešte pracujeme. Čoskoro ho nájdeš v hlavnom menu.</p>' +
      '<button onclick="location.href=\'index.html\'" style="margin-top:14px;padding:11px 20px;' +
      'border:none;border-radius:10px;background:#1e3a5f;color:#fff;font-size:14px;' +
      'font-weight:bold;cursor:pointer;">Späť na úvod</button></div>';
    return false;
  }

  return { ma: ma, vyzaduj: vyzaduj };
})();
