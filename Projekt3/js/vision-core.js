// ============================================================================
//  vision-core.js — šachové jadro pre hry a knihy zručností (board vision)
// ----------------------------------------------------------------------------
//  Verný prepis výpočtov z generate_vision.py do JavaScriptu. Hra Šachový trh
//  (a neskôr ďalšie hry) MUSÍ hodnotiť presne tak ako generátor úloh — inak by
//  hráč v hre dostal „áno" a v tréningu „nie". Preto:
//
//    • Každá funkcia tu zodpovedá jednej funkcii v generate_vision.py
//      (názov Python funkcie je uvedený v komentári).
//    • Pri zmene v generate_vision.py treba rovnakú zmenu urobiť aj tu
//      a znova spustiť testy/test-jadro.html (porovnanie s Pythonom).
//
//  Jediný zámerný rozdiel: brania s premenou pešiaka sa v zozname riešení
//  uvádzajú raz (Python ich vracia 4× — raz za každú premenu).
//
//  Branie mimochodom je vylúčené (rovnako ako v generate_vision.py):
//  parseFen pole mimochodom z FEN-u ignoruje.
//
//  Premena pešiaka pri braní na poslednom rade sa počíta (+8, ďalej sa berie
//  dáma) — oprava 23. 9. 2026, rovnaká ako v see_with_pins v generátore.
//
//  POUŽITIE (všetko je v objekte VisionCore):
//    const poz = VisionCore.parseFen(fen);
//    const vysledok = VisionCore.braniaSoZiskom(poz.board, poz.state);
//      → { riesenia: ['d1d5', ...], vysvetlenia: ['Berie ...', ...], dovod }
//    VisionCore.seeWithPins(board, zPola, naPole, strana)   → zisk (číslo)
//    VisionCore.vsetkyBrania(board, state)                  → všetky brania oboch strán
//    VisionCore.rebrikVymeny(board, 'f4d5')                 → priebeh výmeny krok po kroku
//    VisionCore.nazovTahu(board, zPola, naPola)             → 'Jf4×d5'
//
//  Slabo pokryté figúrky (hra Stráž na trhu, úloha underdefended):
//    VisionCore.slaboPokryte(board, state)   → { riesenia: ['e4', ...], vysvetlenia, dovod }
//    VisionCore.strazFigurky(board, pole)    → { utocnici: [...], obrancovia: [...], slaba }
//    VisionCore.strazPola(board, pole, farba) → kto z farby útočí / bráni (aj batérie)
//
//  Vidličky (hra Vidlička na trhu, úloha fork) — stav generátora 27. 9. 2026:
//    VisionCore.vidlicky(board, state)       → { riesenia: ['c5e4', ...], vysvetlenia, rozbory, dovod }
//    VisionCore.rozoberVidlicku(board, 'c5e4') → je to vidlička a prečo (nie): terče,
//        bezpečné pole, kráľ, mat, odkrytý útok (popis polí je pri funkcii)
//    VisionCore.rebrikVidlicky(rozbor.poTahu, rozbor.na, farbaSupera) → výmena na poli vidličkára
//  Poradie riešení sa môže od generátora líšiť (generátor prechádza polia
//  v neurčenom poradí); zoznam ťahov aj vysvetlenia k nim sú rovnaké.
//
//  Priame hrozby (hra Hrozba na trhu, úloha direct_threat) — stav generátora 29. 9. 2026:
//    VisionCore.hrozby(board, state)            → { riesenia, vysvetlenia, rozbory, dovod }
//    VisionCore.rozoberHrozbu(board, 'c3d5', state) → je to hrozba a prečo (nie):
//        tichý ťah, čo hrozí (terče, mat), čo by získal súper (popis polí je pri funkcii)
//
//  Rošáda (oprava 29. 9. 2026, rovnako v generátore): s kráľom sa pohne aj
//  veža, kráľ nesmie byť v šachu ani prejsť cez napadnuté pole.
//
//  Šachovnica je pole 64 reťazcov: index 0 = a8, 7 = h8, 56 = a1, 63 = h1.
//  Prázdne pole = '', figúrky ako vo FEN (P N B R Q K biele, p n b r q k čierne).
// ============================================================================

if (typeof window !== 'undefined') (window.VERZIE = window.VERZIE || {})['vision-core.js'] = '2026-09-29';

const VisionCore = (function () {
  'use strict';

  const FILES = 'abcdefgh';
  const HODNOTA = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 1000 };   // PIECE_VALUE
  const MAX_BRANI_SO_ZISKOM = 8;                               // MAX_DIRECT_ATTACKS

  const SMERY_JAZDCA = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
  const SMERY_DIAG   = [[-1,-1],[-1,1],[1,-1],[1,1]];
  const SMERY_ROVNE  = [[-1,0],[1,0],[0,-1],[0,1]];
  const SMERY_DAMA   = SMERY_DIAG.concat(SMERY_ROVNE);

  // ── Pomocné funkcie pre polia ───────────────────────────────────────────
  const sqName  = i => FILES[i % 8] + String(8 - Math.floor(i / 8));      // sq_name
  const rowOf   = i => Math.floor(i / 8);                                  // row_of
  const colOf   = i => i % 8;                                              // col_of
  const toIdx   = (r, c) => r * 8 + c;                                     // to_idx
  const inside  = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;            // inside
  const sqIndex = name => FILES.indexOf(name[0]) + 8 * (8 - parseInt(name[1], 10));  // sq_index
  const pieceColor = p => (!p ? '' : (p === p.toUpperCase() ? 'w' : 'b'));  // piece_color
  const super_ = c => (c === 'w' ? 'b' : 'w');
  const znamienko = x => (x > 0) - (x < 0);

  // ── parse_fen ──────────────────────────────────────────────────────────
  function parseFen(fen) {
    const parts = String(fen || '').trim().split(/\s+/);
    const board = [];
    for (const rad of parts[0].split('/')) {
      for (const ch of rad) {
        if (ch >= '0' && ch <= '9') {
          for (let k = 0; k < Number(ch); k++) board.push('');
        } else {
          board.push(ch);
        }
      }
    }
    return {
      board: board,
      state: {
        active:   parts.length > 1 ? parts[1] : 'w',
        castling: parts.length > 2 ? parts[2] : 'KQkq',
        // Pole mimochodom sa zámerne ignoruje — branie mimochodom je z hier
        // aj z tréningu vylúčené (hráč z diagramu nevidí posledný ťah).
        // Rovnako to robí generate_vision.py (bez_mimochodom, parse_fen).
        ep:       '-'
      }
    };
  }

  // ── is_path_clear ──────────────────────────────────────────────────────
  function isPathClear(board, fr, fc, tr, tc) {
    const rs = fr === tr ? 0 : (tr > fr ? 1 : -1);
    const cs = fc === tc ? 0 : (tc > fc ? 1 : -1);
    let r = fr + rs, c = fc + cs;
    while (r !== tr || c !== tc) {
      if (board[toIdx(r, c)]) return false;
      r += rs; c += cs;
    }
    return true;
  }

  // ── is_square_attacked ─────────────────────────────────────────────────
  function isSquareAttacked(board, sq, byColor) {
    const row = rowOf(sq), col = colOf(sq);
    const pawn = byColor === 'w' ? 'P' : 'p';
    const pdirs = byColor === 'w' ? [[1,-1],[1,1]] : [[-1,-1],[-1,1]];
    for (const [dr, dc] of pdirs) {
      const r = row + dr, c = col + dc;
      if (inside(r, c) && board[toIdx(r, c)] === pawn) return true;
    }
    const knight = byColor === 'w' ? 'N' : 'n';
    for (const [dr, dc] of SMERY_JAZDCA) {
      const r = row + dr, c = col + dc;
      if (inside(r, c) && board[toIdx(r, c)] === knight) return true;
    }
    const king = byColor === 'w' ? 'K' : 'k';
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr, c = col + dc;
        if (inside(r, c) && board[toIdx(r, c)] === king) return true;
      }
    }
    const ba = byColor === 'w' ? ['B', 'Q'] : ['b', 'q'];
    for (const [dr, dc] of SMERY_DIAG) {
      let r = row + dr, c = col + dc;
      while (inside(r, c)) {
        const p = board[toIdx(r, c)];
        if (p) { if (ba.includes(p)) return true; break; }
        r += dr; c += dc;
      }
    }
    const ra = byColor === 'w' ? ['R', 'Q'] : ['r', 'q'];
    for (const [dr, dc] of SMERY_ROVNE) {
      let r = row + dr, c = col + dc;
      while (inside(r, c)) {
        const p = board[toIdx(r, c)];
        if (p) { if (ra.includes(p)) return true; break; }
        r += dr; c += dc;
      }
    }
    return false;
  }

  // ── find_king, is_king_in_check ────────────────────────────────────────
  function findKing(board, color) {
    const k = color === 'w' ? 'K' : 'k';
    for (let i = 0; i < 64; i++) if (board[i] === k) return i;
    return -1;
  }

  function isKingInCheck(board, color) {
    const ki = findKing(board, color);
    if (ki === -1) return false;
    return isSquareAttacked(board, ki, super_(color));
  }

  // ── apply_move_ep ──────────────────────────────────────────────────────
  function applyMoveEp(board, state, fi, ti, promo) {
    promo = promo || '';
    const b = board.slice();
    const piece = b[fi];
    const fr = rowOf(fi), fc = colOf(fi);
    const tr = rowOf(ti), tc = colOf(ti);
    b[ti] = piece; b[fi] = '';
    if (piece.toLowerCase() === 'p' && state.ep !== '-') {
      const ep = sqIndex(state.ep);
      if (ti === ep && fc !== tc) {
        b[toIdx(tr + (piece === 'P' ? 1 : -1), tc)] = '';
      }
    }
    if (piece === 'P' && tr === 0) b[ti] = (promo || 'q').toUpperCase();
    if (piece === 'p' && tr === 7) b[ti] = (promo || 'q').toLowerCase();
    // Rošáda: s kráľom sa pohne aj veža (oprava 29. 9. 2026, ako v generátore)
    if (piece.toLowerCase() === 'k' && Math.abs(tc - fc) === 2) {
      if (tc === 6) { b[toIdx(tr, 5)] = b[toIdx(tr, 7)]; b[toIdx(tr, 7)] = ''; }
      else if (tc === 2) { b[toIdx(tr, 3)] = b[toIdx(tr, 0)]; b[toIdx(tr, 0)] = ''; }
    }
    let cast = state.castling;
    if (piece === 'K') cast = cast.replace('K', '').replace('Q', '');
    if (piece === 'k') cast = cast.replace('k', '').replace('q', '');
    let epNew = '-';
    if (piece.toLowerCase() === 'p' && Math.abs(tr - fr) === 2) {
      epNew = FILES[fc] + String(8 - Math.floor((fr + tr) / 2));
    }
    return {
      board: b,
      state: { active: super_(state.active), castling: cast || '-', ep: epNew }
    };
  }

  // ── is_pseudo_legal ────────────────────────────────────────────────────
  function isPseudoLegal(board, state, fi, ti) {
    if (fi === ti) return false;
    const piece = board[fi], target = board[ti];
    if (!piece) return false;
    const mc = pieceColor(piece);
    if (mc !== state.active) return false;
    if (target && pieceColor(target) === mc) return false;
    const fr = rowOf(fi), fc = colOf(fi);
    const tr = rowOf(ti), tc = colOf(ti);
    const rd = tr - fr, cd = tc - fc;
    const ar = Math.abs(rd), ac = Math.abs(cd);
    const low = piece.toLowerCase();
    if (low === 'p') {
      const d = piece === 'P' ? -1 : 1;
      const sr = piece === 'P' ? 6 : 1;
      const ep = state.ep !== '-' ? sqIndex(state.ep) : -1;
      if (cd === 0 && rd === d && !target) return true;
      if (cd === 0 && rd === 2 * d && fr === sr && !target && !board[toIdx(fr + d, fc)]) return true;
      if (ac === 1 && rd === d) {
        if (target && pieceColor(target) !== mc) return true;
        if (!target && ti === ep) return true;
      }
      return false;
    }
    if (low === 'n') return (ar === 2 && ac === 1) || (ar === 1 && ac === 2);
    if (low === 'b') return ar === ac && isPathClear(board, fr, fc, tr, tc);
    if (low === 'r') return (fr === tr || fc === tc) && isPathClear(board, fr, fc, tr, tc);
    if (low === 'q') return ((ar === ac) || (fr === tr || fc === tc)) && isPathClear(board, fr, fc, tr, tc);
    if (low === 'k') {
      if (ar <= 1 && ac <= 1) return true;
      // Rošáda (oprava 29. 9. 2026, ako v generátore): veža musí stáť v rohu,
      // kráľ nesmie byť v šachu ani prejsť cez napadnuté pole. Cieľové pole stráži isLegal.
      const cast = state.castling;
      const opp = piece === 'K' ? 'b' : 'w';
      const smie = (rad, cez, veza, prazdne) =>
        board[toIdx(rad, veza)] === (piece === 'K' ? 'R' : 'r') &&
        prazdne.every(c => !board[toIdx(rad, c)]) &&
        !isSquareAttacked(board, fi, opp) &&
        !isSquareAttacked(board, toIdx(rad, cez), opp);
      if (piece === 'K' && fi === toIdx(7, 4)) {
        if (ti === toIdx(7, 6) && cast.includes('K') && smie(7, 5, 7, [5, 6])) return true;
        if (ti === toIdx(7, 2) && cast.includes('Q') && smie(7, 3, 0, [1, 2, 3])) return true;
      }
      if (piece === 'k' && fi === toIdx(0, 4)) {
        if (ti === toIdx(0, 6) && cast.includes('k') && smie(0, 5, 7, [5, 6])) return true;
        if (ti === toIdx(0, 2) && cast.includes('q') && smie(0, 3, 0, [1, 2, 3])) return true;
      }
    }
    return false;
  }

  // ── is_legal ───────────────────────────────────────────────────────────
  function isLegal(board, state, fi, ti, promo) {
    if (!isPseudoLegal(board, state, fi, ti)) return false;
    const nb = applyMoveEp(board, state, fi, ti, promo).board;
    return !isKingInCheck(nb, pieceColor(board[fi]));
  }

  // ── get_all_legal_moves ────────────────────────────────────────────────
  //  Vracia [zPola, naPole, premena] v rovnakom poradí ako Python
  //  (podľa zPola vzostupne, v rámci figúrky podľa naPole vzostupne).
  function legalMoves(board, state) {
    const moves = [];
    const active = state.active;
    for (let fi = 0; fi < 64; fi++) {
      const p = board[fi];
      if (!p || pieceColor(p) !== active) continue;
      const fr = rowOf(fi), fc = colOf(fi);
      const low = p.toLowerCase();
      const cand = new Set();
      if (low === 'n') {
        for (const [dr, dc] of SMERY_JAZDCA) {
          const rr = fr + dr, cc = fc + dc;
          if (inside(rr, cc)) cand.add(rr * 8 + cc);
        }
      } else if (low === 'k') {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const rr = fr + dr, cc = fc + dc;
            if (inside(rr, cc)) cand.add(rr * 8 + cc);
          }
        }
        if (p === 'K' && fi === 60) { cand.add(62); cand.add(58); }
        else if (p === 'k' && fi === 4) { cand.add(6); cand.add(2); }
      } else if (low === 'p') {
        const d = p === 'P' ? -1 : 1;
        const rr = fr + d;
        if (rr >= 0 && rr < 8) {
          cand.add(rr * 8 + fc);
          if (fc - 1 >= 0) cand.add(rr * 8 + fc - 1);
          if (fc + 1 < 8)  cand.add(rr * 8 + fc + 1);
        }
        const rr2 = fr + 2 * d;
        if (rr2 >= 0 && rr2 < 8) cand.add(rr2 * 8 + fc);
      } else {
        const dirs = low === 'b' ? SMERY_DIAG : (low === 'r' ? SMERY_ROVNE : SMERY_DAMA);
        for (const [dr, dc] of dirs) {
          let rr = fr + dr, cc = fc + dc;
          while (inside(rr, cc)) {
            const ti = rr * 8 + cc;
            cand.add(ti);
            if (board[ti]) break;
            rr += dr; cc += dc;
          }
        }
      }
      const ciele = Array.from(cand).sort((a, b) => a - b);
      for (const ti of ciele) {
        if (low === 'p' && (rowOf(ti) === 0 || rowOf(ti) === 7)) {
          for (const promo of ['q', 'r', 'b', 'n']) {
            if (isLegal(board, state, fi, ti, promo)) moves.push([fi, ti, promo]);
          }
        } else if (isLegal(board, state, fi, ti, '')) {
          moves.push([fi, ti, '']);
        }
      }
    }
    return moves;
  }

  // ── is_capture ─────────────────────────────────────────────────────────
  function isCapture(board, state, fi, ti) {
    const target = board[ti], piece = board[fi];
    if (piece.toLowerCase() === 'p' && state.ep !== '-') {
      if (ti === sqIndex(state.ep) && colOf(fi) !== colOf(ti)) return true;
    }
    return !!target && pieceColor(target) !== state.active;
  }

  // ── pin_axis ───────────────────────────────────────────────────────────
  //  Ak je figúrka v ABSOLÚTNEJ väzbe k vlastnému kráľovi, vráti os väzby
  //  [sr, sc]; inak null.
  function pinAxis(board, pi) {
    const piece = board[pi];
    if (!piece || piece.toLowerCase() === 'k') return null;
    const color = pieceColor(piece);
    const ki = findKing(board, color);
    if (ki === -1) return null;
    const kr = rowOf(ki), kc = colOf(ki);
    const pr = rowOf(pi), pc = colOf(pi);
    const dr = pr - kr, dc = pc - kc;
    if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
    const sr = znamienko(dr), sc = znamienko(dc);
    let r = kr + sr, c = kc + sc;
    while (r !== pr || c !== pc) {
      if (board[toIdx(r, c)]) return null;
      r += sr; c += sc;
    }
    const enemy = super_(color);
    const isDiag = Math.abs(sr) === 1 && Math.abs(sc) === 1;
    r = pr + sr; c = pc + sc;
    while (inside(r, c)) {
      const q = board[toIdx(r, c)];
      if (q) {
        if (pieceColor(q) === enemy) {
          const ql = q.toLowerCase();
          if (isDiag && (ql === 'b' || ql === 'q')) return [sr, sc];
          if (!isDiag && (ql === 'r' || ql === 'q')) return [sr, sc];
        }
        return null;
      }
      r += sr; c += sc;
    }
    return null;
  }

  // ── count_attackers ────────────────────────────────────────────────────
  //  Počet figúrok farby color, ktoré môžu LEGÁLNE brať/brániť pole sq
  //  (s batériami a so zohľadnením absolútnych väzieb).
  function countAttackers(board, sq, color) {
    let count = 0;
    const row = rowOf(sq), col = colOf(sq);

    function canReach(ai, needR, needC) {
      const ax = pinAxis(board, ai);
      if (ax === null) return true;
      return (needR === ax[0] && needC === ax[1]) || (needR === -ax[0] && needC === -ax[1]);
    }

    // Pešiaky
    const pawn = color === 'w' ? 'P' : 'p';
    const pdirs = color === 'w' ? [[1,-1],[1,1]] : [[-1,-1],[-1,1]];
    for (const [dr, dc] of pdirs) {
      const r = row + dr, c = col + dc;
      if (inside(r, c) && board[toIdx(r, c)] === pawn) {
        if (canReach(toIdx(r, c), -dr, -dc)) count++;
      }
    }
    // Jazdce (viazaný jazdec sa nemôže pohnúť vôbec)
    const knight = color === 'w' ? 'N' : 'n';
    for (const [dr, dc] of SMERY_JAZDCA) {
      const r = row + dr, c = col + dc;
      if (inside(r, c) && board[toIdx(r, c)] === knight) {
        if (pinAxis(board, toIdx(r, c)) === null) count++;
      }
    }
    // Kráľ
    const king = color === 'w' ? 'K' : 'k';
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr, c = col + dc;
        if (inside(r, c) && board[toIdx(r, c)] === king) count++;
      }
    }
    // Diagonálne strely + batérie + výmenný röntgen
    const bishop = color === 'w' ? 'B' : 'b';
    const queen  = color === 'w' ? 'Q' : 'q';
    const oppBishop = color === 'w' ? 'b' : 'B';
    const oppQueen  = color === 'w' ? 'q' : 'Q';
    const pawnAtt = color === 'w' ? 'P' : 'p';
    const pawnFrom = color === 'w' ? [[1,-1],[1,1]] : [[-1,-1],[-1,1]];
    for (const [dr, dc] of SMERY_DIAG) {
      let r = row + dr, c = col + dc;
      let passedEnemy = false;
      let first = true;
      while (inside(r, c)) {
        const p = board[toIdx(r, c)];
        if (p) {
          if (p === bishop || p === queen) {
            if (canReach(toIdx(r, c), -dr, -dc)) count++;
            r += dr; c += dc;
            first = false;
            continue;
          }
          if (first && p === pawnAtt && pawnFrom.some(([a, b]) => a === dr && b === dc)) {
            first = false;
            r += dr; c += dc;
            continue;
          }
          if (!passedEnemy && (p === oppBishop || p === oppQueen)) {
            passedEnemy = true;
            first = false;
            r += dr; c += dc;
            continue;
          }
          break;
        }
        r += dr; c += dc; first = false;
      }
    }
    // Ortogonálne strely + batérie + výmenný röntgen
    const rook = color === 'w' ? 'R' : 'r';
    const oppRook = color === 'w' ? 'r' : 'R';
    for (const [dr, dc] of SMERY_ROVNE) {
      let r = row + dr, c = col + dc;
      let passedEnemy = false;
      while (inside(r, c)) {
        const p = board[toIdx(r, c)];
        if (p) {
          if (p === rook || p === queen) {
            if (canReach(toIdx(r, c), -dr, -dc)) count++;
            r += dr; c += dc;
            continue;
          }
          if (!passedEnemy && (p === oppRook || p === oppQueen)) {
            passedEnemy = true;
            r += dr; c += dc;
            continue;
          }
          break;
        }
        r += dr; c += dc;
      }
    }
    return count;
  }

  // ── _hypothetical_attacks, _attacks_sq ─────────────────────────────────
  function hypotheticalAttacks(board, sq, ptype, ecolor) {
    const r = rowOf(sq), c = colOf(sq);
    const out = [];
    if (ptype === 'p') {
      const ddr = ecolor === 'w' ? -1 : 1;
      for (const dc of [-1, 1]) {
        const rr = r + ddr, cc = c + dc;
        if (inside(rr, cc) && board[toIdx(rr, cc)]) out.push(toIdx(rr, cc));
      }
    } else if (ptype === 'n') {
      for (const [dr, dc] of SMERY_JAZDCA) {
        const rr = r + dr, cc = c + dc;
        if (inside(rr, cc) && board[toIdx(rr, cc)]) out.push(toIdx(rr, cc));
      }
    } else if (ptype === 'k') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = r + dr, cc = c + dc;
          if (inside(rr, cc) && board[toIdx(rr, cc)]) out.push(toIdx(rr, cc));
        }
      }
    } else {
      const dirs = ptype === 'b' ? SMERY_DIAG : (ptype === 'r' ? SMERY_ROVNE : SMERY_DAMA);
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (inside(rr, cc)) {
          if (board[toIdx(rr, cc)]) { out.push(toIdx(rr, cc)); break; }
          rr += dr; cc += dc;
        }
      }
    }
    return out;
  }

  function attacksSq(board, fromSq, targetSq) {
    const p = board[fromSq];
    return hypotheticalAttacks(board, fromSq, p.toLowerCase(), pieceColor(p)).includes(targetSq);
  }

  // Najlacnejšia figúrka strany side, ktorá smie legálne brať na poli sq.
  // Presne výber z vnútra see_with_pins → _see: prechod polí 0..63, pri rovnakej
  // hodnote vyhráva skoršie pole, vynechá sa branie, po ktorom by vlastný kráľ
  // zostal v šachu. Rebrík výmeny používa ten istý výber, preto sedí so ziskom.
  function najlacnejsiUtocnik(board, sq, side) {
    const o = super_(side);
    let bestI = null, bestV = null;
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (!p || pieceColor(p) !== side) continue;
      if (!attacksSq(board, i, sq)) continue;
      const tmp = board.slice();
      tmp[sq] = tmp[i]; tmp[i] = '';
      const kingSq = findKing(tmp, side);
      if (kingSq !== -1 && isSquareAttacked(tmp, kingSq, o)) continue;
      const v = HODNOTA[p.toLowerCase()];
      if (bestI === null || v < bestV) { bestI = i; bestV = v; }
    }
    return bestI;
  }

  // Premena: pešiak, ktorý prišiel na posledný rad, sa mení na dámu.
  // Vráti novú figúrku ('Q' / 'q') alebo null.
  function premena(figurka, naPole) {
    if (figurka === 'P' && rowOf(naPole) === 0) return 'Q';
    if (figurka === 'p' && rowOf(naPole) === 7) return 'q';
    return null;
  }
  const BONUS_PREMENY = HODNOTA.q - HODNOTA.p;   // +8

  // ── see_with_pins (vnútorná _see) ──────────────────────────────────────
  function seeInner(board, sq, side, forcedI) {
    if (!board[sq]) return 0;
    const bestI = (forcedI !== null && forcedI !== undefined) ? forcedI : najlacnejsiUtocnik(board, sq, side);
    if (bestI === null) return 0;
    const captured = HODNOTA[board[sq].toLowerCase()];
    const b = board.slice();
    b[sq] = b[bestI]; b[bestI] = '';
    // PREMENA (ako v generate_vision.py): pešiak, ktorý berie na poslednom rade,
    // sa zmení na dámu — strana získa aj +8 a súper ďalej berie dámu.
    const nova = premena(board[bestI], sq);
    let bonus = 0;
    if (nova) { b[sq] = nova; bonus = BONUS_PREMENY; }
    return captured + bonus - Math.max(0, seeInner(b, sq, super_(side), null));
  }

  // ── see_with_pins ──────────────────────────────────────────────────────
  //  Materiálový zisk strany side pri braní figúrkou z fromSq na toSq.
  function seeWithPins(board, fromSq, toSq, side) {
    // Branie MIMOCHODOM: cieľ je prázdny, braný pešiak stojí vedľa
    if (board[fromSq] && board[fromSq].toLowerCase() === 'p'
        && !board[toSq] && colOf(fromSq) !== colOf(toSq)) {
      const obet = toIdx(rowOf(fromSq), colOf(toSq));
      if (board[obet] && board[obet].toLowerCase() === 'p' && pieceColor(board[obet]) !== side) {
        const b = board.slice();
        b[toSq] = b[fromSq];
        b[fromSq] = '';
        b[obet] = '';
        return HODNOTA.p - Math.max(0, seeInner(b, toSq, super_(side), null));
      }
    }
    return seeInner(board, toSq, side, fromSq);
  }

  // ── Slovenské texty (SK_FIGURY, SK_ROD) ────────────────────────────────
  const SK_FIGURY   = { p: 'pešiaka', n: 'jazdca', b: 'strelca', r: 'vežu', q: 'dámu', k: 'kráľa' };
  const SK_ROD      = { p: 'ho', n: 'ho', b: 'ho', r: 'ju', q: 'ju', k: 'ho' };
  const SK_PISMENO  = { p: '', n: 'J', b: 'S', r: 'V', q: 'D', k: 'K' };
  const SK_FIGURKA  = { p: 'pešiak', n: 'jazdec', b: 'strelec', r: 'veža', q: 'dáma', k: 'kráľ' };

  // ── vysvetli_branie ────────────────────────────────────────────────────
  function vysvetliBranie(board, state, uci, side) {
    const fr = sqIndex(uci.slice(0, 2)), to = sqIndex(uci.slice(2, 4));
    let obet = board[to];
    let mimochodom = false;
    if (!obet && board[fr] && board[fr].toLowerCase() === 'p' && colOf(fr) !== colOf(to)) {
      obet = board[toIdx(rowOf(fr), colOf(to))] || 'p';
      mimochodom = true;
    }
    const zisk = seeWithPins(board, fr, to, side);
    const o = super_(side);
    const kluc = obet.toLowerCase();
    let veta = 'Berie ' + (SK_FIGURY[kluc] || 'figúrku') + ' na ' + uci.slice(2, 4) + ' (zisk +' + zisk + ').';
    if (mimochodom) veta = veta.slice(0, -1) + ' — branie mimochodom.';
    const zameno = SK_ROD[kluc] || 'ju';
    const obrancov = countAttackers(board, to, o);
    if (obrancov === 0) veta += ' Nikto ' + zameno + ' nebráni.';
    return veta;
  }

  // ── direct_attacks_for_side ────────────────────────────────────────────
  //  Brania so ziskom jednej strany: [{uci, zisk, vysvetlenie}]
  function braniaSoZiskomStrany(board, state, side) {
    const st = { active: side, castling: state.castling, ep: state.ep };
    const vysledok = [];
    const videne = new Set();
    for (const [fr, to] of legalMoves(board, st)) {
      if (!isCapture(board, st, fr, to)) continue;
      const uci = sqName(fr) + sqName(to);
      if (videne.has(uci)) continue;          // premena: rovnaký ťah 4×
      videne.add(uci);
      const zisk = seeWithPins(board, fr, to, side);
      if (zisk > 0) {
        vysledok.push({ uci: uci, zisk: zisk, vysvetlenie: vysvetliBranie(board, state, uci, side) });
      }
    }
    return vysledok;
  }

  // ── find_direct_attacks_both_sides ─────────────────────────────────────
  //  Úloha „Nájdi všetky brania so ziskom" za oboch.
  //  dovod: null | 'sach' (niektorý kráľ je v šachu) | 'prilis_vela' (viac ako 8)
  function braniaSoZiskom(board, state) {
    if (isKingInCheck(board, 'w') || isKingInCheck(board, 'b')) {
      return { riesenia: [], vysvetlenia: [], zisky: [], dovod: 'sach' };
    }
    const vsetky = braniaSoZiskomStrany(board, state, 'w').concat(braniaSoZiskomStrany(board, state, 'b'));
    if (vsetky.length > MAX_BRANI_SO_ZISKOM) {
      return { riesenia: [], vysvetlenia: [], zisky: [], dovod: 'prilis_vela' };
    }
    return {
      riesenia:    vsetky.map(x => x.uci),
      vysvetlenia: vsetky.map(x => x.vysvetlenie),
      zisky:       vsetky.map(x => x.zisk),
      dovod:       null
    };
  }

  // ── Názov ťahu po slovensky: 'Jf4×d5', 'c6×d5' ─────────────────────────
  function nazovTahu(board, fi, ti) {
    const p = board[fi];
    const pismeno = p ? SK_PISMENO[p.toLowerCase()] : '';
    const branie = board[ti] || (p && p.toLowerCase() === 'p' && colOf(fi) !== colOf(ti));
    return pismeno + sqName(fi) + (branie ? '×' : '–') + sqName(ti) + (p && premena(p, ti) ? 'D' : '');
  }

  // ── Všetky legálne brania oboch strán so ziskom (aj nulovým a záporným) ─
  //  Pre úlohy Koľko?, Pasca a pre vysvetlenie nesprávnej odpovede.
  function vsetkyBrania(board, state) {
    const out = [];
    for (const side of ['w', 'b']) {
      const st = { active: side, castling: state.castling, ep: state.ep };
      const videne = new Set();
      for (const [fr, to] of legalMoves(board, st)) {
        if (!isCapture(board, st, fr, to)) continue;
        const uci = sqName(fr) + sqName(to);
        if (videne.has(uci)) continue;
        videne.add(uci);
        out.push({ uci: uci, strana: side, nazov: nazovTahu(board, fr, to), zisk: seeWithPins(board, fr, to, side) });
      }
    }
    return out;
  }

  // ── Rebrík výmeny ──────────────────────────────────────────────────────
  //  Priebeh výmeny po braní uci, ako ho počíta see_with_pins.
  //  Výsledok: {
  //    kroky:  [{ tah:'Jf4×d5', strana:'w', z:37, na:27, premena:false, figurka:'pešiaka', zmena:+1, ucet:+1 }, ...],
  //    koniec: { typ:'nikto' | 'neoplati_sa' | 'nie_je_branie', strana:'b', tah:'Vd8×d5' | null,
  //              z, na  (len pri 'neoplati_sa': ťah, ktorý by sa neoplatil) },
  //  z / na sú indexy polí (0 = a8 … 63 = h1) — podľa nich šachovnica krok prehrá.
  //    vysledok: číslo (vždy rovné seeWithPins)
  //  }
  //  „zmena" a „ucet" sú z pohľadu strany, ktorá začala brať.
  function rebrikVymeny(board, uci) {
    const fr = sqIndex(uci.slice(0, 2)), to = sqIndex(uci.slice(2, 4));
    const side = pieceColor(board[fr]);
    const kroky = [];
    let b = board.slice();
    let ucet = 0;

    // 1. krok — vynútený ťahom hráča (aj branie mimochodom)
    let obetIdx = to;
    if (!b[to] && b[fr] && b[fr].toLowerCase() === 'p' && colOf(fr) !== colOf(to)) {
      obetIdx = toIdx(rowOf(fr), colOf(to));
    }
    // Na cieli ani vedľa nie je súperov pešiak: nie je čo brať, zisk 0 (ako see_with_pins).
    // Stane sa to len pri FEN-e, ktorého pole mimochodom patrí druhej strane —
    // generate_vision.py taký ťah pripustí, ale zisk mu dá 0.
    const obetPrva = b[obetIdx];
    if (!obetPrva || pieceColor(obetPrva) === side ||
        (obetIdx !== to && obetPrva.toLowerCase() !== 'p')) {
      return { kroky: [], koniec: { typ: 'nie_je_branie', strana: side, tah: nazovTahu(board, fr, to) }, vysledok: 0 };
    }
    const obet1 = b[obetIdx];
    const nova1 = premena(b[fr], to);
    const c1 = (obet1 ? HODNOTA[obet1.toLowerCase()] : 0) + (nova1 ? BONUS_PREMENY : 0);
    ucet += c1;
    kroky.push({ tah: nazovTahu(b, fr, to), strana: side, z: fr, na: to, premena: !!nova1,
                 figurka: obet1 ? SK_FIGURY[obet1.toLowerCase()] : '', zmena: c1, ucet: ucet });
    b[to] = nova1 || b[fr]; b[fr] = '';
    if (obetIdx !== to) b[obetIdx] = '';

    // 2. ďalšie kroky — strany sa striedajú, berú najlacnejšou figúrkou
    //    a len vtedy, keď im to prinesie zisk (presne ako _see).
    let turn = super_(side);
    let koniec = null;
    for (let bezpecnost = 0; bezpecnost < 40; bezpecnost++) {
      const u = najlacnejsiUtocnik(b, to, turn);
      if (u === null) { koniec = { typ: 'nikto', strana: turn, tah: null }; break; }
      if (seeInner(b, to, turn, null) <= 0) {
        koniec = { typ: 'neoplati_sa', strana: turn, tah: nazovTahu(b, u, to), z: u, na: to };
        break;
      }
      const obet = b[to];
      const nova = premena(b[u], to);
      const c = HODNOTA[obet.toLowerCase()] + (nova ? BONUS_PREMENY : 0);
      const zmena = turn === side ? c : -c;
      ucet += zmena;
      kroky.push({ tah: nazovTahu(b, u, to), strana: turn, z: u, na: to, premena: !!nova,
                   figurka: SK_FIGURY[obet.toLowerCase()], zmena: zmena, ucet: ucet });
      b = b.slice();
      b[to] = nova || b[u]; b[u] = '';
      turn = super_(turn);
    }
    return { kroky: kroky, koniec: koniec, vysledok: ucet };
  }

  // ── Verejné rozhranie ──────────────────────────────────────────────────

  // ════════════════════════════════════════════════════════════════════
  //  SLABO POKRYTÉ FIGÚRKY (hra Stráž na trhu, úloha underdefended)
  // ════════════════════════════════════════════════════════════════════
  const MAX_SLABO_POKRYTYCH = 10;                              // MAX_UNDERDEFENDED
  const SK_KRYTY = { p: ['krytý', 'napadnutý'], n: ['krytý', 'napadnutý'], b: ['krytý', 'napadnutý'],
                     r: ['krytá', 'napadnutá'], q: ['krytá', 'napadnutá'], k: ['krytý', 'napadnutý'] };

  // ── Kto útočí na pole / kto ho bráni — ZOZNAM figúrok ─────────────────
  //  Presne tá istá logika ako countAttackers (count_attackers v generátore),
  //  len namiesto počtu vracia figúrky: [{ i, pole, figurka, cez }]
  //    cez = null          — figúrka mieri na pole priamo
  //          'bateria'     — stojí v línii za vlastnou figúrkou (batéria)
  //          'za_superom'  — stojí za súperovou strelou, ktorá na pole mieri
  //  Počet prvkov sa MUSÍ rovnať countAttackers — overuje testy/test-jadro.html.
  function strazPola(board, sq, color) {
    const zoznam = [];
    const row = rowOf(sq), col = colOf(sq);
    const pridaj = (i, cez) => zoznam.push({ i: i, pole: sqName(i), figurka: board[i], cez: cez });

    function canReach(ai, needR, needC) {
      const ax = pinAxis(board, ai);
      if (ax === null) return true;
      return (needR === ax[0] && needC === ax[1]) || (needR === -ax[0] && needC === -ax[1]);
    }

    const pawn = color === 'w' ? 'P' : 'p';
    const pdirs = color === 'w' ? [[1,-1],[1,1]] : [[-1,-1],[-1,1]];
    for (const [dr, dc] of pdirs) {
      const r = row + dr, c = col + dc;
      if (inside(r, c) && board[toIdx(r, c)] === pawn && canReach(toIdx(r, c), -dr, -dc)) pridaj(toIdx(r, c), null);
    }
    const knight = color === 'w' ? 'N' : 'n';
    for (const [dr, dc] of SMERY_JAZDCA) {
      const r = row + dr, c = col + dc;
      if (inside(r, c) && board[toIdx(r, c)] === knight && pinAxis(board, toIdx(r, c)) === null) pridaj(toIdx(r, c), null);
    }
    const king = color === 'w' ? 'K' : 'k';
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr, c = col + dc;
        if (inside(r, c) && board[toIdx(r, c)] === king) pridaj(toIdx(r, c), null);
      }
    }
    const bishop = color === 'w' ? 'B' : 'b';
    const queen  = color === 'w' ? 'Q' : 'q';
    const oppBishop = color === 'w' ? 'b' : 'B';
    const oppQueen  = color === 'w' ? 'q' : 'Q';
    const pawnFrom = color === 'w' ? [[1,-1],[1,1]] : [[-1,-1],[-1,1]];
    for (const [dr, dc] of SMERY_DIAG) {
      let r = row + dr, c = col + dc;
      let passedEnemy = false, first = true, cez = null;
      while (inside(r, c)) {
        const p = board[toIdx(r, c)];
        if (p) {
          if (p === bishop || p === queen) {
            if (canReach(toIdx(r, c), -dr, -dc)) pridaj(toIdx(r, c), cez);
            if (!cez) cez = 'bateria';
            r += dr; c += dc; first = false;
            continue;
          }
          if (first && p === pawn && pawnFrom.some(([a, b]) => a === dr && b === dc)) {
            first = false; cez = 'bateria';
            r += dr; c += dc;
            continue;
          }
          if (!passedEnemy && (p === oppBishop || p === oppQueen)) {
            passedEnemy = true; first = false; cez = 'za_superom';
            r += dr; c += dc;
            continue;
          }
          break;
        }
        r += dr; c += dc; first = false;
      }
    }
    const rook = color === 'w' ? 'R' : 'r';
    const oppRook = color === 'w' ? 'r' : 'R';
    for (const [dr, dc] of SMERY_ROVNE) {
      let r = row + dr, c = col + dc;
      let passedEnemy = false, cez = null;
      while (inside(r, c)) {
        const p = board[toIdx(r, c)];
        if (p) {
          if (p === rook || p === queen) {
            if (canReach(toIdx(r, c), -dr, -dc)) pridaj(toIdx(r, c), cez);
            if (!cez) cez = 'bateria';
            r += dr; c += dc;
            continue;
          }
          if (!passedEnemy && (p === oppRook || p === oppQueen)) {
            passedEnemy = true; cez = 'za_superom';
            r += dr; c += dc;
            continue;
          }
          break;
        }
        r += dr; c += dc;
      }
    }
    return zoznam;
  }

  // ── Stráž jednej figúrky: útočníci, obrancovia, je slabo pokrytá? ────
  function strazFigurky(board, sq) {
    const p = board[sq];
    if (!p) return null;
    const farba = pieceColor(p);
    const utocnici = strazPola(board, sq, super_(farba));
    const obrancovia = strazPola(board, sq, farba);
    return {
      pole: sqName(sq), figurka: p, farba: farba,
      utocnici: utocnici, obrancovia: obrancovia,
      // kráľ sa medzi slabo pokryté nepočíta nikdy
      slaba: p.toLowerCase() !== 'k' && obrancovia.length <= utocnici.length
    };
  }

  // ── underdefended_for_color ────────────────────────────────────────────
  //  Polia slabo pokrytých figúrok jednej farby, v poradí a8 … h1.
  //  Slabo pokrytá = obrancov ≤ útočníkov (aj 0 : 0), kráľ sa vynecháva.
  function slaboPokryteFarby(board, color) {
    const e = super_(color);
    const out = [];
    for (let sq = 0; sq < 64; sq++) {
      const p = board[sq];
      if (!p || pieceColor(p) !== color || p.toLowerCase() === 'k') continue;
      if (countAttackers(board, sq, color) <= countAttackers(board, sq, e)) out.push(sqName(sq));
    }
    return out;
  }

  // ── vysvetli_slabo_pokrytu ─────────────────────────────────────────────
  function vysvetliSlaboPokrytu(board, sqStr) {
    const sq = sqIndex(sqStr);
    const fig = board[sq];
    const color = pieceColor(fig);
    const enemy = super_(color);
    const ut = countAttackers(board, sq, enemy);
    const ob = countAttackers(board, sq, color);
    const kluc = fig.toLowerCase();
    const nazov = SK_FIGURKA[kluc] || 'figúrka';
    const zaklad = nazov[0].toUpperCase() + nazov.slice(1) + ' na ' + sqStr;
    if (ut === 0 && ob === 0) {
      const [kryty, napadnuty] = SK_KRYTY[kluc] || ['krytá', 'napadnutá'];
      const zam = SK_ROD[kluc] || 'ju';
      return zaklad + ' nie je ' + kryty + ' ani ' + napadnuty + ' — nikto ' + zam + ' nebráni.';
    }
    // Odkiaľ útok prichádza (ťahy s premenou sú v zozname 4×, rovnako ako v generátore)
    const st = { active: enemy, castling: '-', ep: '-' };
    const odkial = [];
    for (const [fi, ti] of legalMoves(board, st)) {
      if (ti === sq && isCapture(board, st, fi, ti)) odkial.push(sqName(fi));
    }
    let veta = zaklad + ': útočníkov ' + ut + ', obrancov ' + ob;
    if (odkial.length) {
      veta += ' (útok z ' + odkial.slice().sort().slice(0, 3).join(', ');
      if (odkial.length < ut) veta += ', ďalší v línii za ním';
      veta += ')';
    }
    return veta + '.';
  }

  // ── find_underdefended_both_sides ──────────────────────────────────────
  //  Úloha „Nájdi všetky slabo pokryté figúrky" za oboch (biele, potom čierne).
  //  dovod: null | 'sach' (niektorý kráľ je v šachu) | 'prilis_vela' (viac ako 10)
  function slaboPokryte(board, state) {
    if (isKingInCheck(board, 'w') || isKingInCheck(board, 'b')) {
      return { riesenia: [], vysvetlenia: [], dovod: 'sach' };
    }
    const riesenia = slaboPokryteFarby(board, 'w').concat(slaboPokryteFarby(board, 'b'));
    if (riesenia.length > MAX_SLABO_POKRYTYCH) {
      return { riesenia: [], vysvetlenia: [], dovod: 'prilis_vela' };
    }
    return { riesenia: riesenia, vysvetlenia: riesenia.map(x => vysvetliSlaboPokrytu(board, x)), dovod: null };
  }

  // ════════════════════════════════════════════════════════════════════
  //  VIDLIČKY (hra Vidlička na trhu, úloha fork)
  //  Verný prepis fork_moves_for_side a jej pomocných funkcií, stav 27. 9. 2026:
  //  hrozbe matu stačí jeden terč, mat musí byť nový, pešiak na poslednom rade
  //  sa skúša ako jazdec aj dáma, jazdec viazaný na kráľa vo výmene nebráni ani neberie.
  // ════════════════════════════════════════════════════════════════════
  const MAX_VIDLICIEK = 12;                                    // MAX_FORKS

  // ── _quiet_targets ─────────────────────────────────────────────────────
  //  Prázdne polia, kam sa figúrka zo sq vie posunúť bez brania.
  function tichePolia(board, sq) {
    const p = board[sq], pl = p.toLowerCase(), color = pieceColor(p);
    const r = rowOf(sq), c = colOf(sq);
    const out = [];
    if (pl === 'n') {
      for (const [dr, dc] of SMERY_JAZDCA) {
        const rr = r + dr, cc = c + dc;
        if (inside(rr, cc) && !board[toIdx(rr, cc)]) out.push(toIdx(rr, cc));
      }
    } else if (pl === 'k') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = r + dr, cc = c + dc;
          if (inside(rr, cc) && !board[toIdx(rr, cc)]) out.push(toIdx(rr, cc));
        }
      }
    } else if (pl === 'p') {
      const step = color === 'w' ? -1 : 1;
      const start = color === 'w' ? 6 : 1;
      const rr = r + step;
      if (inside(rr, c) && !board[toIdx(rr, c)]) {
        out.push(toIdx(rr, c));
        const rr2 = r + 2 * step;
        if (r === start && inside(rr2, c) && !board[toIdx(rr2, c)]) out.push(toIdx(rr2, c));
      }
    } else {
      const dirs = pl === 'b' ? SMERY_DIAG : (pl === 'r' ? SMERY_ROVNE : SMERY_DAMA);
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (inside(rr, cc) && !board[toIdx(rr, cc)]) {
          out.push(toIdx(rr, cc));
          rr += dr; cc += dc;
        }
      }
    }
    return out;
  }

  // ── _capture_targets ───────────────────────────────────────────────────
  //  Polia súpera (victim), kam vie figúrka zo sq brať. Kráľa nebrať.
  function braniePolia(board, sq, victim) {
    const p = board[sq], pl = p.toLowerCase(), color = pieceColor(p);
    const r = rowOf(sq), c = colOf(sq);
    const out = [];
    const jeObet = i => { const t = board[i]; return !!t && pieceColor(t) === victim && t.toLowerCase() !== 'k'; };
    if (pl === 'n') {
      for (const [dr, dc] of SMERY_JAZDCA) {
        const rr = r + dr, cc = c + dc;
        if (inside(rr, cc) && jeObet(toIdx(rr, cc))) out.push(toIdx(rr, cc));
      }
    } else if (pl === 'k') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = r + dr, cc = c + dc;
          if (inside(rr, cc) && jeObet(toIdx(rr, cc))) out.push(toIdx(rr, cc));
        }
      }
    } else if (pl === 'p') {
      const step = color === 'w' ? -1 : 1;
      for (const dc of [-1, 1]) {
        const rr = r + step, cc = c + dc;
        if (inside(rr, cc) && jeObet(toIdx(rr, cc))) out.push(toIdx(rr, cc));
      }
    } else {
      const dirs = pl === 'b' ? SMERY_DIAG : (pl === 'r' ? SMERY_ROVNE : SMERY_DAMA);
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (inside(rr, cc)) {
          const idx = toIdx(rr, cc);
          if (board[idx]) { if (jeObet(idx)) out.push(idx); break; }
          rr += dr; cc += dc;
        }
      }
    }
    return out;
  }

  // ── _reachable_squares ─────────────────────────────────────────────────
  //  Polia, kam figúrka zo sq smie legálne ísť jedným ťahom (tichým alebo braním).
  //  Bez rošády a brania mimochodom. Vracia vzostupne zoradené indexy.
  function dosiahnutelnePolia(board, fromSq, victim) {
    const attacker = pieceColor(board[fromSq]);
    const legalny = ti => {
      const tmp = board.slice();
      tmp[ti] = tmp[fromSq]; tmp[fromSq] = '';
      const k = findKing(tmp, attacker);
      return k === -1 || !isSquareAttacked(tmp, k, victim);
    };
    const reach = new Set();
    for (const t of tichePolia(board, fromSq)) if (legalny(t)) reach.add(t);
    for (const t of braniePolia(board, fromSq, victim)) if (legalny(t)) reach.add(t);
    return Array.from(reach).sort((a, b) => a - b);
  }

  // ── _least_valuable_attacker ───────────────────────────────────────────
  //  Najlacnejšia figúrka farby color, ktorá napáda pole sq (pri rovnakej cene
  //  skoršie pole). Viazaná figúrka berie len po osi väzby, viazaný jazdec
  //  nikdy (oprava 27. 9. 2026 v generátore aj tu).
  function najlacnejsiVidlicka(board, sq, color) {
    let bestI = null, bestV = null;
    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (!p || pieceColor(p) !== color) continue;
      if (!attacksSq(board, i, sq)) continue;
      const ax = pinAxis(board, i);
      if (ax !== null && p.toLowerCase() === 'n') continue;
      if (ax !== null) {
        const dr = rowOf(sq) - rowOf(i), dc = colOf(sq) - colOf(i);
        const adiv = Math.max(Math.abs(dr), Math.abs(dc));
        if (adiv === 0) continue;
        const a0 = Math.floor(dr / adiv), a1 = Math.floor(dc / adiv);
        if (!((a0 === ax[0] && a1 === ax[1]) || (-a0 === ax[0] && -a1 === ax[1]))) continue;
      }
      const v = HODNOTA[p.toLowerCase()];
      if (bestI === null || v < bestV) { bestI = i; bestV = v; }
    }
    return bestI;
  }

  // ── _capture_value ─────────────────────────────────────────────────────
  //  Čistý zisk strany side, keď začne brať na poli sq najlacnejšou figúrkou
  //  a súper berie späť, len keď sa mu to oplatí. null = strana nemá čím brať.
  function hodnotaBrania(board, sq, side) {
    const ai = najlacnejsiVidlicka(board, sq, side);
    if (ai === null) return null;
    const captured = HODNOTA[board[sq].toLowerCase()];
    const b = board.slice();
    b[sq] = b[ai]; b[ai] = '';
    let bonus = 0;
    const nova = premena(board[ai], sq);
    if (nova) { b[sq] = nova; bonus = BONUS_PREMENY; }
    const resp = hodnotaBrania(b, sq, super_(side));
    if (resp === null) return captured + bonus;
    return captured + bonus - Math.max(0, resp);
  }

  // ── _king_retreats ─────────────────────────────────────────────────────
  //  Ústupy kráľa zo šachu (aj branie): [[pole, šachovnica po ústupe], ...]
  function ustupyKrala(board, kingSq, victim, attackerSide) {
    const kr = rowOf(kingSq), kc = colOf(kingSq), king = board[kingSq];
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = kr + dr, c = kc + dc;
        if (!inside(r, c)) continue;
        const s = toIdx(r, c);
        if (board[s] && pieceColor(board[s]) === victim) continue;
        const b2 = board.slice();
        b2[kingSq] = ''; b2[s] = king;
        if (countAttackers(b2, s, attackerSide) === 0) out.push([s, b2]);
      }
    }
    return out;
  }

  // ── _mate_in_one_squares ───────────────────────────────────────────────
  //  Cieľové polia ťahov, ktorými strana side dáva mat (bez mimochodom).
  //  castling: práva na rošádu (predvolene žiadne — tak to volajú vidličky;
  //  priame hrozby odovzdávajú práva z FEN-u presne ako generátor).
  function matovePolia(board, side, castling) {
    const st = { active: side, castling: castling || '', ep: '-' };
    const opp = super_(side);
    const polia = new Set();
    for (const [fi, ti, promo] of legalMoves(board, st)) {
      const po = applyMoveEp(board, st, fi, ti, promo);
      if (!isKingInCheck(po.board, opp)) continue;
      if (!legalMoves(po.board, { active: opp, castling: po.state.castling, ep: po.state.ep }).length) polia.add(ti);
    }
    return polia;
  }

  // ── _maty_pred: maty, ktoré strana vie dať už pred ťahom (raz na pozíciu) ─
  function matyPred(board, kontext) {
    if (kontext.matPred === null) kontext.matPred = matovePolia(board, kontext.side);
    return kontext.matPred;
  }

  // ── vysvetli_vidlicku ──────────────────────────────────────────────────
  function vysvetliVidlicku(tmp, counted, matPolia) {
    const popis = counted.map(t => (SK_FIGURY[String(tmp[t]).toLowerCase()] || 'figúrku') + ' na ' + sqName(t));
    const matova = (matPolia && matPolia.length) ? 'hrozí matom na ' + sqName(Math.min.apply(null, matPolia)) : '';
    if (popis.length >= 2) {
      const vyber = popis.slice(0, 3);
      const spojene = vyber.length === 2 ? vyber[0] + ' a ' + vyber[1]
                    : vyber.slice(0, -1).join(', ') + ' a ' + vyber[vyber.length - 1];
      let ciele = 'Napáda naraz ' + spojene;
      if (popis.length > 3) ciele += ' a ďalšie ' + (popis.length - 3);
      return matova ? ciele + ', a navyše ' + matova + '.' : ciele + '.';
    }
    if (popis.length && matova) return 'Napáda ' + popis[0] + ' a zároveň ' + matova + '.';
    if (matova) return matova[0].toUpperCase() + matova.slice(1) + '.';
    return 'Vytvára dvojitý útok.';
  }

  // Názov ťahu pre hru: 'Jc5–e4', 'Dd1×d5', pri premene 'd7–d8J'
  function nazovVidlicky(board, z, na, kus) {
    const p = board[z];
    const zaklad = SK_PISMENO[p.toLowerCase()] + sqName(z) + (board[na] ? '×' : '–') + sqName(na);
    return kus !== p ? zaklad + SK_PISMENO[kus.toLowerCase()] : zaklad;
  }

  // ── _vidlicka_kusom + úplný rozbor pre hru ─────────────────────────────
  //  Rozhodnutie (vidlicka) je presne podľa generátora. Popri ňom sa zbiera
  //  všetko, čo hra ukazuje: šípky k terčom, bezpečné pole, kráľ, mat, odkrytý útok.
  function rozborKusom(board, z, na, kus, kontext, uz) {
    const side = kontext.side, victim = kontext.victim;
    const p = board[z];
    const ptype = kus.toLowerCase();
    const tval = HODNOTA[ptype];

    // pozícia po presune figúrky na vidličkové pole
    const tmp = board.slice();
    tmp[z] = ''; tmp[na] = kus;

    // _fork_square_safe: súper nesmie vidličkára zobrať bez straty
    const ziskSupera = hodnotaBrania(tmp, na, victim);
    const bezpecne = ziskSupera === null || ziskSupera < 0;

    // Všetky súperove figúrky, ktoré figúrka po ťahu napáda (šípky).
    // Nové terče = tie, ktoré z pôvodného poľa nenapádala.
    const napadnute = [], terce = [];
    for (const t of hypotheticalAttacks(tmp, na, ptype, side)) {
      if (pieceColor(tmp[t]) !== victim) continue;
      const x = { i: t, pole: sqName(t), figurka: tmp[t], novy: !uz.has(t),
                  pocita: false, dovod: null, cennejsi: false, zisk: null };
      if (!x.novy) x.dovod = 'stary';
      napadnute.push(x);
      if (x.novy) terce.push(x);
    }

    // Cena terča: cennejší ako vidličkár, alebo sa dá zobrať so ziskom
    const nonking = [];
    let hasStrong = false, kralT = null;
    for (const x of terce) {
      const tp = x.figurka.toLowerCase();
      if (tp === 'k') { kralT = x; x.dovod = 'kral'; continue; }
      const strong = HODNOTA[tp] > tval;
      const cv = hodnotaBrania(tmp, x.i, side);
      x.cennejsi = strong; x.zisk = cv;
      if (strong || (cv !== null && cv > 0)) {
        nonking.push(x.i); x.pocita = true; x.dovod = strong ? 'cennejsi' : 'zisk';
        if (strong) hasStrong = true;
      } else {
        x.dovod = 'nestoji';
      }
    }

    // Kráľ ako terč (šach)
    const counted = nonking.slice();
    let kral = null;
    if (kralT) {
      const ustupy = ustupyKrala(tmp, kralT.i, victim, side);
      kral = { i: kralT.i, pole: kralT.pole, pocita: false, dovod: null,
               ustupy: ustupy.map(u => sqName(u[0])), zachrani: null };
      if (hasStrong) {
        kral.pocita = true; kral.dovod = 'cennejsi_terc';
      } else if (nonking.length) {
        // Po KAŽDOM ústupe kráľa musí zostať aspoň jeden terč vyhrateľný
        let ok = true;
        for (const [s, b2] of ustupy) {
          let vyhra = false;
          for (const t of nonking) {
            if (!b2[t] || pieceColor(b2[t]) !== victim) continue;
            const cv = hodnotaBrania(b2, t, side);
            if (cv !== null && cv > 0) { vyhra = true; break; }
          }
          if (!vyhra) { ok = false; kral.zachrani = sqName(s); break; }
        }
        kral.pocita = ok;
        kral.dovod = ok ? 'ustupy_nezachrania' : 'ustup_zachrani';
      } else {
        kral.dovod = 'bez_terca';
      }
      if (kral.pocita) counted.push(kralT.i);
      kralT.pocita = kral.pocita;
    }

    // Hrozba matu — generátor ju hľadá len pri bezpečnom poli, bez šachu
    // a keď už je aspoň jeden započítaný terč. Mat musí byť nový a smerovať
    // inam než na započítaný terč.
    let mat = null, matStary = null;
    if (bezpecne && !kralT && counted.length >= 1) {
      const pred = matyPred(board, kontext);
      mat = []; matStary = [];
      for (const s of Array.from(matovePolia(tmp, side)).sort((a, b) => a - b)) {
        if (counted.includes(s)) continue;
        if (pred.has(s)) matStary.push(s); else mat.push(s);
      }
    }

    // Rozhodnutie v poradí generátora
    let vidlicka = false, druh = null;
    if (bezpecne && terce.length) {
      if (counted.length >= 2) {
        vidlicka = true;
        druh = (kral && kral.pocita) ? (kral.dovod === 'cennejsi_terc' ? 'sach_cennejsi_terc' : 'sach_kral_neubrani')
                                     : 'dva_terce';
      } else if (counted.length === 1 && !kralT && mat.length) {
        vidlicka = true; druh = 'mat_a_terc';
      }
    }
    let dovod = null;
    if (!vidlicka) {
      if (!bezpecne) dovod = 'vidlickara_zoberu';
      else if (!terce.length) dovod = 'ziadny_novy_terc';
      else if (kral && kral.dovod === 'ustup_zachrani') dovod = 'kral_ubrani';
      else if (terce.length === 1) dovod = 'jeden_novy_terc';
      else dovod = 'terc_nestoji_za_to';
    }

    // Odkrytý útok: iná vlastná figúrka, ktorej ťah otvoril líniu na súperovu figúrku
    const odkryte = [];
    for (let i = 0; i < 64; i++) {
      const q = tmp[i];
      if (!q || i === na || pieceColor(q) !== side) continue;
      const lq = q.toLowerCase();
      if (lq !== 'b' && lq !== 'r' && lq !== 'q') continue;
      const predtym = new Set(hypotheticalAttacks(board, i, lq, side));
      for (const t of hypotheticalAttacks(tmp, i, lq, side)) {
        if (pieceColor(tmp[t]) === victim && !predtym.has(t)) {
          odkryte.push({ z: i, pole: sqName(i), figurka: q, i: t, terc: sqName(t), tercFigurka: tmp[t] });
        }
      }
    }

    const jePremena = kus !== p;
    let vysvetlenie = null;
    if (vidlicka) {
      vysvetlenie = vysvetliVidlicku(tmp, counted, mat);
      if (jePremena) {
        vysvetlenie = 'Po premene na ' + (SK_FIGURY[ptype] || 'figúrku') + ' ' +
                      vysvetlenie[0].toLowerCase() + vysvetlenie.slice(1);
      }
    }

    return {
      tah: sqName(z) + sqName(na), z: z, na: na, strana: side,
      figurka: p, kus: kus, premena: jePremena, nazov: nazovVidlicky(board, z, na, kus),
      dosiahne: true, viazany: pinAxis(board, z) !== null,
      vidlicka: vidlicka, druh: druh, dovod: dovod, vysvetlenie: vysvetlenie,
      bezpecne: bezpecne, ziskSupera: ziskSupera,
      napadnute: napadnute, noveTerce: terce.length,
      zapocitane: counted.map(sqName),
      sach: !!kralT, kral: kral,
      mat: mat ? mat.map(sqName) : null, matStary: matStary ? matStary.map(sqName) : null,
      odkryte: odkryte,
      poTahu: tmp
    };
  }

  // ── Rozbor jedného ťahu: je to vidlička a prečo (nie) ──────────────────
  //  uci 'c5e4' (pri premene voliteľne s písmenom: 'd7d8n').
  //  kus: voliteľne figúrka po premene ('n' / 'q'); bez nej sa skúša jazdec
  //  a potom dáma presne ako v generátore.
  //  Ťah hodnotí za figúrku, ktorá na poli stojí — nezáleží na tom, kto je na ťahu.
  //  dovod (keď nie je vidlička):
  //    'nelegalny'          figúrka tam nemôže ísť (napr. je viazaná)
  //    'vidlickara_zoberu'  súper vidličkára zoberie bez straty
  //    'ziadny_novy_terc'   nenapadne nič nové
  //    'jeden_novy_terc'    napadne len jeden nový terč (a nehrozí nový mat)
  //    'kral_ubrani'        šach + nekrytý terč, ale kráľ ho ústupom ubráni
  //    'terc_nestoji_za_to' terčov je viac, ale nestoja za to
  function rozoberVidlicku(board, uci, kus, kontext) {
    const z = sqIndex(uci.slice(0, 2)), na = sqIndex(uci.slice(2, 4));
    const p = board[z];
    if (!p) return null;
    const side = pieceColor(p);
    if (!kontext || kontext.side !== side) kontext = { side: side, victim: super_(side), matPred: null };
    if (!dosiahnutelnePolia(board, z, kontext.victim).includes(na)) {
      return { tah: sqName(z) + sqName(na), z: z, na: na, strana: side, figurka: p, kus: p, premena: false,
               nazov: nazovVidlicky(board, z, na, p), dosiahne: false, viazany: pinAxis(board, z) !== null,
               vidlicka: false, druh: null, dovod: 'nelegalny', vysvetlenie: null,
               bezpecne: null, ziskSupera: null, napadnute: [], noveTerce: 0, zapocitane: [],
               sach: false, kral: null, mat: null, matStary: null, odkryte: [], poTahu: null };
    }
    const uz = new Set(hypotheticalAttacks(board, z, p.toLowerCase(), side));
    let kusy = [p];
    if (p.toLowerCase() === 'p' && rowOf(na) === (side === 'w' ? 0 : 7)) {
      const pis = kus || uci.charAt(4);
      if (pis) kusy = [side === 'w' ? pis.toUpperCase() : pis.toLowerCase()];
      else kusy = side === 'w' ? ['N', 'Q'] : ['n', 'q'];
    }
    let prvy = null;
    for (const k of kusy) {
      const r = rozborKusom(board, z, na, k, kontext, uz);
      if (r.vidlicka) return r;
      if (!prvy) prvy = r;
    }
    return prvy;
  }

  // ── fork_moves_for_side ────────────────────────────────────────────────
  //  Všetky vidličky jednej strany ako zoznam rozborov (poradie: podľa poľa
  //  figúrky a cieľa; generátor ich má niekedy v inom poradí — na poradí nezáleží).
  function vidlickyStrany(board, side) {
    const kontext = { side: side, victim: super_(side), matPred: null };
    const out = [];
    for (let z = 0; z < 64; z++) {
      const p = board[z];
      if (!p || pieceColor(p) !== side) continue;
      for (const na of dosiahnutelnePolia(board, z, kontext.victim)) {
        const r = rozoberVidlicku(board, sqName(z) + sqName(na), null, kontext);
        if (r.vidlicka) out.push(r);
      }
    }
    return out;
  }

  // ── find_forks_both_sides ──────────────────────────────────────────────
  //  Úloha „Nájdi všetky vidličky" za oboch (biele, potom čierne).
  //  dovod: null | 'sach' (niektorý kráľ je v šachu) | 'prilis_vela' (viac ako 12)
  function vidlicky(board, state) {
    if (isKingInCheck(board, 'w') || isKingInCheck(board, 'b')) {
      return { riesenia: [], vysvetlenia: [], rozbory: [], dovod: 'sach' };
    }
    const vsetky = vidlickyStrany(board, 'w').concat(vidlickyStrany(board, 'b'));
    if (vsetky.length > MAX_VIDLICIEK) {
      return { riesenia: [], vysvetlenia: [], rozbory: [], dovod: 'prilis_vela' };
    }
    return { riesenia: vsetky.map(r => r.tah), vysvetlenia: vsetky.map(r => r.vysvetlenie),
             rozbory: vsetky, dovod: null };
  }

  // ── Rebrík výmeny na poli vidličkára ───────────────────────────────────
  //  Priebeh výmeny, keď strana side začne brať na poli sq, presne ako
  //  _capture_value (najlacnejšou figúrkou, späť len keď sa oplatí).
  //  Tvar ako rebrikVymeny; vysledok === hodnotaBrania(board, sq, side),
  //  null keď strana nemá čím brať.
  //  Pre vidličku: VisionCore.rebrikVidlicky(rozbor.poTahu, rozbor.na, super strany)
  function rebrikVidlicky(board, sq, side) {
    const kroky = [];
    let b = board.slice(), ucet = 0, turn = side, koniec = null;
    for (let n = 0; n < 40; n++) {
      const u = najlacnejsiVidlicka(b, sq, turn);
      if (u === null) { koniec = { typ: 'nikto', strana: turn, tah: null }; break; }
      if (n > 0 && hodnotaBrania(b, sq, turn) <= 0) {
        koniec = { typ: 'neoplati_sa', strana: turn, tah: nazovTahu(b, u, sq), z: u, na: sq };
        break;
      }
      const obet = b[sq];
      const nova = premena(b[u], sq);
      const c = HODNOTA[obet.toLowerCase()] + (nova ? BONUS_PREMENY : 0);
      const zmena = turn === side ? c : -c;
      ucet += zmena;
      kroky.push({ tah: nazovTahu(b, u, sq), strana: turn, z: u, na: sq, premena: !!nova,
                   figurka: SK_FIGURY[obet.toLowerCase()], zmena: zmena, ucet: ucet });
      b = b.slice();
      b[sq] = nova || b[u]; b[u] = '';
      turn = super_(turn);
    }
    return { kroky: kroky, koniec: koniec, vysledok: kroky.length ? ucet : null };
  }

  // ══════════════════════════════════════════════════════════════════════
  //  PRIAME HROZBY (úloha direct_threat, hra Hrozba na trhu)
  //  Prepis direct_threats_for_side a find_direct_threats_both_sides
  //  z generate_vision.py (stav 29. 9. 2026). Popri rozhodnutí sa zbiera
  //  všetko, čo hra ukazuje: čo hrozí, kto berie, čo by získal súper.
  // ══════════════════════════════════════════════════════════════════════
  const MAX_PRIAMYCH_HROZIEB = 6;                              // MAX_DIRECT_THREATS

  // ── _pmn_targets ───────────────────────────────────────────────────────
  //  Polia, na ktorých má strana side branie so ziskom (SEE > 0).
  //  Práva na rošádu ani mimochodom tu nehrajú rolu (rátajú sa len brania).
  function cieleZisku(board, side) {
    const st = { active: side, castling: '-', ep: '-' };
    const out = new Set();
    for (const [fi, ti] of legalMoves(board, st)) {
      if (out.has(ti) || !isCapture(board, st, fi, ti)) continue;
      if (seeWithPins(board, fi, ti, side) > 0) out.add(ti);
    }
    return out;
  }

  // Všetky legálne brania strany side na poli sq so ziskom > 0, v poradí
  // ťahov generátora: [{ z, zisk }]. Prvé s najväčším ziskom je to, ktoré
  // uvádza vysvetlenie (vysvetli_hrozbu berie prvé pri rovnosti).
  function braniaNaPoli(board, side, sq) {
    const st = { active: side, castling: '-', ep: '-' };
    const out = [], videne = new Set();
    for (const [fi, ti] of legalMoves(board, st)) {
      if (ti !== sq || videne.has(fi) || !isCapture(board, st, fi, ti)) continue;
      videne.add(fi);
      const g = seeWithPins(board, fi, ti, side);
      if (g > 0) out.push({ z: fi, zisk: g });
    }
    return out;
  }
  function najlepsieBranie(brania) {
    let best = null;
    for (const b of brania) if (!best || b.zisk > best.zisk) best = b;
    return best;
  }

  // ── vysvetli_hrozbu ────────────────────────────────────────────────────
  //  terce: zoradené polia nových cieľov (ako sorted() v Pythone), matPolia: polia matu
  function vysvetliHrozbu(nb, side, terce, matPolia) {
    if (!terce.length && !matPolia.length) return 'Vytvára novú hrozbu.';
    const opp = super_(side);
    const popis = [];
    for (const sq of terce) {
      const best = najlepsieBranie(braniaNaPoli(nb, side, sq));
      if (!best) continue;
      const obet = String(nb[sq]).toLowerCase();
      const kto = SK_FIGURKA[nb[best.z].toLowerCase()] || 'figúrka';
      const co = SK_FIGURY[obet] || 'figúrku';
      const prem = nb[best.z].toLowerCase() === 'p' && (rowOf(sq) === 0 || rowOf(sq) === 7);
      let text = kto + ' z ' + sqName(best.z) + ' berie ' + co + ' na ' + sqName(sq) +
                 (prem ? ' s premenou na dámu' : '') + ' (zisk +' + best.zisk + ')';
      if (countAttackers(nb, sq, opp) === 0) text += ' a nikto ' + (SK_ROD[obet] || 'ju') + ' nebráni';
      popis.push(text);
    }
    const matova = matPolia.length ? 'MAT na ' + sqName(Math.min.apply(null, matPolia)) : '';
    if (!popis.length) return matova ? 'Hrozí ' + matova + '.' : 'Vytvára novú hrozbu.';
    const zaklad = popis.length === 1 ? popis[0] : popis[0] + ', a tiež ' + popis[1];
    if (matova) return 'Hrozí ' + matova + '! A tiež: ' + zaklad + '.';
    return 'Hrozí: ' + zaklad + '.';
  }

  // Názov ťahu pre hru: 'Jc3–d5', 'd2–d1D' (premena), 'O-O' (rošáda)
  function nazovHrozby(board, z, na) {
    const p = board[z];
    if (p && p.toLowerCase() === 'k' && Math.abs(colOf(na) - colOf(z)) === 2) return colOf(na) === 6 ? 'O-O' : 'O-O-O';
    return nazovTahu(board, z, na);
  }

  // Polia medzi a a b na priamke (bez nich), alebo null, keď nie sú na priamke
  function poliaMedzi(a, b) {
    const dr = rowOf(b) - rowOf(a), dc = colOf(b) - colOf(a);
    if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
    const sr = znamienko(dr), sc = znamienko(dc);
    const out = [];
    let r = rowOf(a) + sr, c = colOf(a) + sc;
    while (r !== rowOf(b) || c !== colOf(b)) { out.push(toIdx(r, c)); r += sr; c += sc; }
    return out;
  }
  function utocnici(board, sq, color) {
    const out = [];
    for (let i = 0; i < 64; i++) if (board[i] && pieceColor(board[i]) === color && attacksSq(board, i, sq)) out.push(i);
    return out;
  }

  // Ako hrozba na poli t vznikla (len pre vysvetlenie v hre, rozhodnutie od toho nezávisí):
  //   'priamy'     berie figúrka, ktorá ťahala
  //   'odkryty'    ťah uvoľnil líniu inej vlastnej figúrke (odkrytý útok)
  //   'uvolnenie'  iná figúrka predtým brať nemohla, lebo bola viazaná na kráľa
  //   'prerusenie' ťah sa postavil medzi súperovho obrancu a terč
  //   'vazba'      ťah viaže súperovho obrancu na kráľa
  //   'podpora'    pribudol ďalší útočník (aj batéria alebo odkrytá podpora)
  //   'ine'        zložitejšia výmena
  function mechanizmus(board, nb, side, z, na, t, brania) {
    if (brania.some(b => b.z === na)) return 'priamy';
    const opp = super_(side);
    const f = najlepsieBranie(brania).z;
    const st = { active: side, castling: '-', ep: '-' };
    const predtym = isLegal(board, st, f, t, board[f].toLowerCase() === 'p' && (rowOf(t) === 0 || rowOf(t) === 7) ? 'q' : '') &&
                    isCapture(board, st, f, t);
    if (!predtym) {
      const medzi = poliaMedzi(f, t);
      return medzi && medzi.includes(z) ? 'odkryty' : 'uvolnenie';
    }
    const obrPred = utocnici(board, t, opp), obrPo = utocnici(nb, t, opp);
    if (obrPred.some(o => { const m = poliaMedzi(o, t); return m && m.includes(na); })) return 'prerusenie';
    if (obrPo.some(o => pinAxis(nb, o) !== null && pinAxis(board, o) === null)) return 'vazba';
    if (attacksSq(nb, na, t)) return 'podpora';
    const utocPo = utocnici(nb, t, side);
    for (const a of utocPo) {                 // batéria: pohnutá figúrka za vlastným útočníkom
      const m = poliaMedzi(na, t);
      if (m && m.includes(a) && m.every(x => !nb[x] || x === a || pieceColor(nb[x]) === side)) return 'podpora';
    }
    for (const a of utocPo) {                 // odkrytá podpora: ťah uvoľnil líniu inému útočníkovi
      const m = poliaMedzi(a, t);
      if (m && m.includes(z)) return 'podpora';
    }
    return 'ine';
  }

  // Kontext jednej strany v pozícii (počíta sa raz, platí pre všetky jej ťahy)
  function kontextHrozieb(board, state, side) {
    const opp = super_(side);
    const cast = (state && state.castling) || '-';
    return {
      side: side, castling: cast,
      stareCiele: cieleZisku(board, side),               // old_targets
      matPred: matovePolia(board, side, cast),            // mat_pred
      stareCieleSupera: cieleZisku(board, opp),           // opp_old_targets
      matSuperaPred: matovePolia(board, opp, cast)        // mat_supera_pred
    };
  }

  // ── Rozbor jedného ťahu: je to priama hrozba a prečo (nie) ─────────────
  //  uci 'c3d5' (piaty znak premeny sa ignoruje — generátor skúša len dámu).
  //  Ťah hodnotí za figúrku, ktorá na poli stojí — nezáleží na tom, kto je na ťahu.
  //  state: pozícia z parseFen (kvôli právam na rošádu); dá sa vynechať.
  //  dovod (keď nie je hrozba), v poradí ako generátor:
  //    'nelegalny'   figúrka tam nemôže ísť (napr. je viazaná)
  //    'branie'      je to branie — nie tichý ťah
  //    'sach'        dáva šach (aj odkrytý) — nie tichý ťah
  //    'super_ziska' súper po ťahu získa branie so ziskom (polia v superCiele)
  //    'super_mat'   súper po ťahu dá mat jedným ťahom (polia v superMat)
  //    'nic_nehrozi' po ťahu nehrozí žiadne nové branie so ziskom ani mat
  //  Ostatné polia sa vyplnia pre každý legálny ťah, aj keď rozhodol skorší dôvod
  //  (hra vie ukázať všetky nesplnené podmienky naraz).
  function rozoberHrozbu(board, uci, state, kontext) {
    const z = sqIndex(uci.slice(0, 2)), na = sqIndex(uci.slice(2, 4));
    const p = board[z];
    if (!p) return null;
    const side = pieceColor(p), opp = super_(side);
    const cast = (state && state.castling) || '-';
    if (!kontext || kontext.side !== side) kontext = kontextHrozieb(board, { castling: cast }, side);
    const st = { active: side, castling: kontext.castling, ep: '-' };
    const r = { tah: sqName(z) + sqName(na), z: z, na: na, strana: side, figurka: p,
                nazov: nazovHrozby(board, z, na), legalny: false, viazany: pinAxis(board, z) !== null,
                branie: false, sach: false, poTahu: null, terce: [], mat: [], matStary: [],
                superCiele: [], superMat: [], hrozba: false, dovod: 'nelegalny', vysvetlenie: null };
    if (!isLegal(board, st, z, na, '')) return r;
    r.legalny = true;
    r.branie = isCapture(board, st, z, na);
    const nb = applyMoveEp(board, st, z, na, '').board;
    r.poTahu = nb;
    r.sach = isKingInCheck(nb, opp);
    // Čo by získal súper (poistka generátora: nesmie dostať nič nové)
    const cS = cieleZisku(nb, opp);
    for (const t of cS) {
      if (kontext.stareCieleSupera.has(t)) continue;
      const br = braniaNaPoli(nb, opp, t);
      r.superCiele.push({ pole: t, figurka: nb[t], zisk: najlepsieBranie(br).zisk, kto: br });
    }
    r.superCiele.sort((a, b) => a.pole - b.pole);
    const mS = matovePolia(nb, opp, kontext.castling);
    r.superMat = Array.from(mS).filter(t => !kontext.matSuperaPred.has(t)).sort((a, b) => a - b);
    // Čo hrozí (akoby súper vynechal ťah)
    const cN = cieleZisku(nb, side);
    for (const t of Array.from(cN).sort((a, b) => a - b)) {
      if (kontext.stareCiele.has(t)) continue;
      const br = braniaNaPoli(nb, side, t);
      r.terce.push({ pole: t, figurka: nb[t], zisk: najlepsieBranie(br).zisk, kto: br,
                     mech: mechanizmus(board, nb, side, z, na, t, br) });
    }
    const mN = matovePolia(nb, side, '');
    r.mat = Array.from(mN).filter(t => !kontext.matPred.has(t)).sort((a, b) => a - b);
    r.matStary = Array.from(mN).filter(t => kontext.matPred.has(t)).sort((a, b) => a - b);
    // Rozhodnutie v poradí generátora
    if (r.branie) r.dovod = 'branie';
    else if (r.sach) r.dovod = 'sach';
    else if (r.superCiele.length) r.dovod = 'super_ziska';
    else if (r.superMat.length) r.dovod = 'super_mat';
    else if (r.terce.length || r.mat.length) {
      r.hrozba = true; r.dovod = null;
      r.vysvetlenie = vysvetliHrozbu(nb, side, r.terce.map(t => t.pole), r.mat);
    } else r.dovod = 'nic_nehrozi';
    return r;
  }

  // ── direct_threats_for_side ────────────────────────────────────────────
  //  Všetky priame hrozby jednej strany ako zoznam rozborov (v poradí generátora).
  //  Rýchla cesta: brania a šachy sa vyradia hneď, bez ďalšieho počítania.
  function hrozbyStrany(board, state, side) {
    const kontext = kontextHrozieb(board, state, side);
    const st = { active: side, castling: kontext.castling, ep: '-' };
    const out = [], videne = new Set();
    for (const [fi, ti] of legalMoves(board, st)) {
      const kluc = fi * 64 + ti;
      if (videne.has(kluc)) continue;          // premena: rovnaký ťah 4×
      videne.add(kluc);
      if (isCapture(board, st, fi, ti)) continue;
      const nb = applyMoveEp(board, st, fi, ti, '').board;
      if (isKingInCheck(nb, super_(side))) continue;
      const r = rozoberHrozbu(board, sqName(fi) + sqName(ti), state, kontext);
      if (r.hrozba) out.push(r);
    }
    return out;
  }

  // ── find_direct_threats_both_sides ─────────────────────────────────────
  //  Úloha „Nájdi všetky priame hrozby" za oboch (biele, potom čierne).
  //  dovod: null | 'sach' (niektorý kráľ je v šachu) | 'visi' (niekto už má
  //         branie so ziskom) | 'prilis_vela' (viac ako 6)
  function hrozby(board, state) {
    const prazdne = d => ({ riesenia: [], vysvetlenia: [], rozbory: [], dovod: d });
    if (isKingInCheck(board, 'w') || isKingInCheck(board, 'b')) return prazdne('sach');
    if (cieleZisku(board, 'w').size || cieleZisku(board, 'b').size) return prazdne('visi');
    const vsetky = hrozbyStrany(board, state, 'w').concat(hrozbyStrany(board, state, 'b'));
    if (vsetky.length > MAX_PRIAMYCH_HROZIEB) return prazdne('prilis_vela');
    return { riesenia: vsetky.map(r => r.tah), vysvetlenia: vsetky.map(r => r.vysvetlenie),
             rozbory: vsetky, dovod: null };
  }

  return {
    HODNOTA: HODNOTA,
    MAX_BRANI_SO_ZISKOM: MAX_BRANI_SO_ZISKOM,
    SK_FIGURY: SK_FIGURY,
    SK_FIGURKA: SK_FIGURKA,
    sqName: sqName,
    sqIndex: sqIndex,
    pieceColor: pieceColor,
    parseFen: parseFen,
    isSquareAttacked: isSquareAttacked,
    isKingInCheck: isKingInCheck,
    findKing: findKing,
    legalMoves: legalMoves,
    isLegal: isLegal,
    isCapture: isCapture,
    pinAxis: pinAxis,
    countAttackers: countAttackers,
    attacksSq: attacksSq,
    seeWithPins: seeWithPins,
    vysvetliBranie: vysvetliBranie,
    braniaSoZiskomStrany: braniaSoZiskomStrany,
    braniaSoZiskom: braniaSoZiskom,
    vsetkyBrania: vsetkyBrania,
    nazovTahu: nazovTahu,
    rebrikVymeny: rebrikVymeny,
    // slabo pokryté figúrky
    MAX_SLABO_POKRYTYCH: MAX_SLABO_POKRYTYCH,
    strazPola: strazPola,
    strazFigurky: strazFigurky,
    slaboPokryteFarby: slaboPokryteFarby,
    slaboPokryte: slaboPokryte,
    vysvetliSlaboPokrytu: vysvetliSlaboPokrytu,
    // vidličky
    MAX_VIDLICIEK: MAX_VIDLICIEK,
    vidlicky: vidlicky,
    vidlickyStrany: vidlickyStrany,
    rozoberVidlicku: rozoberVidlicku,
    rebrikVidlicky: rebrikVidlicky,
    hodnotaBrania: hodnotaBrania,
    dosiahnutelnePolia: dosiahnutelnePolia,
    matovePolia: matovePolia,
    // priame hrozby
    MAX_PRIAMYCH_HROZIEB: MAX_PRIAMYCH_HROZIEB,
    hrozby: hrozby,
    hrozbyStrany: hrozbyStrany,
    rozoberHrozbu: rozoberHrozbu,
    cieleZisku: cieleZisku
  };
})();

// Pre testy v Node.js (v prehliadači sa ignoruje)
if (typeof module !== 'undefined' && module.exports) module.exports = VisionCore;
