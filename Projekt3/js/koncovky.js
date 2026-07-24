// ============================================================================
//  koncovky.js — klasifikácia koncoviek podľa materiálu
// ----------------------------------------------------------------------------
//  Jediné miesto, kde sú pravidlá. Používa ich analytická stránka aj filter
//  v tréningu, takže po zmene pravidiel stačí prepočítať klasifikáciu.
//
//  AKO PRIDAŤ NOVÝ TYP KONCOVKY:
//    1. Pridaj riadok do poľa ENDGAME_RULES nižšie (pozor na PORADIE —
//       platí prvé pravidlo, ktoré sadne, takže špecifickejšie dávaj vyššie).
//    2. Otvor Tréner → Analýza koncoviek a klikni Uložiť klasifikáciu.
//       Prepíšu sa len úlohy, ktorým sa typ zmenil.
//
//  POJMY (podľa metodiky):
//    „pešiak"  = práve jeden pešiak
//    „pešiaci" = nula a viac pešiakov, pričom ASPOŇ JEDNA strana musí mať
//                aspoň jedného — preto sa podmienka testuje na súčet (anyP).
//    Strany sú zameniteľné: každé pravidlo sa skúša v oboch smeroch, takže
//    nezáleží na tom, či má vežu biely alebo čierny.
// ============================================================================

// Materiál z FEN-u (kráľ sa nepočíta — je vždy na oboch stranách)
function egMaterial(fen) {
  const board = String(fen || '').split(' ')[0];
  const c = { w: {Q:0,R:0,B:0,N:0,P:0}, b: {Q:0,R:0,B:0,N:0,P:0} };
  for (const ch of board) {
    if (ch === 'K' || ch === 'k') continue;
    const u = ch.toUpperCase();
    if ('QRBNP'.includes(u)) c[ch === u ? 'w' : 'b'][u]++;
  }
  return c;
}

const egPieces = s => s.Q + s.R + s.B + s.N;   // figúry bez kráľa a pešiakov
const egMinors = s => s.B + s.N;               // ľahké figúry
const egOne    = (s, k) => s[k] === 1 && egPieces(s) === 1;   // práve jedna figúra daného druhu
const egAnyP   = (a, b) => (a.P + b.P) >= 1;   // aspoň jedna strana má pešiaka

const ENDGAME_RULES = [
  // Jedna strana má len figúru bez vlastných pešiakov proti pešiakom súpera
  ['Veža proti pešiakom',           (a,b)=> egOne(a,'R') && a.P === 0 && egPieces(b) === 0 && b.P >= 1],
  ['Dáma proti pešiakom',           (a,b)=> egOne(a,'Q') && a.P === 0 && egPieces(b) === 0 && b.P >= 1],

  // Rovnaká figúra na oboch stranách
  ['Dámske',                        (a,b)=> egOne(a,'Q') && egOne(b,'Q') && egAnyP(a,b)],
  ['Vežové',                        (a,b)=> egOne(a,'R') && egOne(b,'R') && egAnyP(a,b)],
  ['Strelcové',                     (a,b)=> egOne(a,'B') && egOne(b,'B') && egAnyP(a,b)],
  ['Jazdcové',                      (a,b)=> egOne(a,'N') && egOne(b,'N') && egAnyP(a,b)],

  // Figúra s vlastnými pešiakmi proti samotným pešiakom
  ['Veža a pešiaci proti pešiakom', (a,b)=> egOne(a,'R') && a.P >= 1 && egPieces(b) === 0],
  ['Jazdec proti pešiakom',         (a,b)=> egOne(a,'N') && a.P >= 1 && egPieces(b) === 0],

  // Bez figúr
  ['Pešiakové',                     (a,b)=> egPieces(a) === 0 && egPieces(b) === 0 && egAnyP(a,b)],

  // Obe strany majú len ľahké figúry (aj rôzne)
  ['Ľahké figúry',                  (a,b)=> egMinors(a) === egPieces(a) && egMinors(b) === egPieces(b) &&
                                            egMinors(a) >= 1 && egMinors(b) >= 1 && egAnyP(a,b)],

  // Po jednej rôznej figúre na každej strane
  ['Zmiešané',                      (a,b)=> egPieces(a) === 1 && egPieces(b) === 1 && egAnyP(a,b) &&
                                            !['Q','R','B','N'].every(k => a[k] === b[k])],
];

// Zoznam typov vrátane zberného koša — použiteľný na naplnenie filtrov
const ENDGAME_TYPES = ENDGAME_RULES.map(r => r[0]).concat('Ostatné');

// Typ koncovky pre daný FEN
function classifyEndgame(fen) {
  const m = egMaterial(fen);
  for (const [name, fn] of ENDGAME_RULES) {
    if (fn(m.w, m.b) || fn(m.b, m.w)) return name;
  }
  return 'Ostatné';
}

// Materiálový podpis, napr. "KRPPP–KPPP". Strany sa zoradia tak, aby bol
// podpis rovnaký bez ohľadu na to, ktorá farba má silnejší materiál.
function endgameSignature(fen) {
  const m = egMaterial(fen);
  const s = x => 'K' + 'Q'.repeat(x.Q) + 'R'.repeat(x.R) + 'B'.repeat(x.B) + 'N'.repeat(x.N) + 'P'.repeat(x.P);
  const a = s(m.w), b = s(m.b);
  return (a >= b ? a + '–' + b : b + '–' + a);
}
