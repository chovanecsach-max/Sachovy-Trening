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
//  POUŽITIE (všetko je v objekte VisionCore):
//    const poz = VisionCore.parseFen(fen);
//    const vysledok = VisionCore.braniaSoZiskom(poz.board, poz.state);
//      → { riesenia: ['d1d5', ...], vysvetlenia: ['Berie ...', ...], dovod }
//    VisionCore.seeWithPins(board, zPola, naPole, strana)   → zisk (číslo)
//    VisionCore.vsetkyBrania(board, state)                  → všetky brania oboch strán
//    VisionCore.rebrikVymeny(board, 'f4d5')                 → priebeh výmeny krok po kroku
//    VisionCore.nazovTahu(board, zPola, naPola)             → 'Jf4×d5'
//
//  Šachovnica je pole 64 reťazcov: index 0 = a8, 7 = h8, 56 = a1, 63 = h1.
//  Prázdne pole = '', figúrky ako vo FEN (P N B R Q K biele, p n b r q k čierne).
// ============================================================================

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
      const cast = state.castling;
      if (piece === 'K' && fi === toIdx(7, 4)) {
        if (ti === toIdx(7, 6) && cast.includes('K') && !board[toIdx(7, 5)] && !board[toIdx(7, 6)]) return true;
        if (ti === toIdx(7, 2) && cast.includes('Q') && !board[toIdx(7, 1)] && !board[toIdx(7, 2)] && !board[toIdx(7, 3)]) return true;
      }
      if (piece === 'k' && fi === toIdx(0, 4)) {
        if (ti === toIdx(0, 6) && cast.includes('k') && !board[toIdx(0, 5)] && !board[toIdx(0, 6)]) return true;
        if (ti === toIdx(0, 2) && cast.includes('q') && !board[toIdx(0, 1)] && !board[toIdx(0, 2)] && !board[toIdx(0, 3)]) return true;
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

  // ── see_with_pins (vnútorná _see) ──────────────────────────────────────
  function seeInner(board, sq, side, forcedI) {
    if (!board[sq]) return 0;
    const bestI = (forcedI !== null && forcedI !== undefined) ? forcedI : najlacnejsiUtocnik(board, sq, side);
    if (bestI === null) return 0;
    const captured = HODNOTA[board[sq].toLowerCase()];
    const b = board.slice();
    b[sq] = b[bestI]; b[bestI] = '';
    return captured - Math.max(0, seeInner(b, sq, super_(side), null));
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
    return pismeno + sqName(fi) + (branie ? '×' : '–') + sqName(ti);
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
  //    kroky:  [{ tah:'Jf4×d5', strana:'w', figurka:'pešiaka', zmena:+1, ucet:+1 }, ...],
  //    koniec: { typ:'nikto' | 'neoplati_sa' | 'nie_je_branie', strana:'b', tah:'Vd8×d5' | null },
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
    const c1 = obet1 ? HODNOTA[obet1.toLowerCase()] : 0;
    ucet += c1;
    kroky.push({ tah: nazovTahu(b, fr, to), strana: side,
                 figurka: obet1 ? SK_FIGURY[obet1.toLowerCase()] : '', zmena: c1, ucet: ucet });
    b[to] = b[fr]; b[fr] = '';
    if (obetIdx !== to) b[obetIdx] = '';

    // 2. ďalšie kroky — strany sa striedajú, berú najlacnejšou figúrkou
    //    a len vtedy, keď im to prinesie zisk (presne ako _see).
    let turn = super_(side);
    let koniec = null;
    for (let bezpecnost = 0; bezpecnost < 40; bezpecnost++) {
      const u = najlacnejsiUtocnik(b, to, turn);
      if (u === null) { koniec = { typ: 'nikto', strana: turn, tah: null }; break; }
      if (seeInner(b, to, turn, null) <= 0) {
        koniec = { typ: 'neoplati_sa', strana: turn, tah: nazovTahu(b, u, to) };
        break;
      }
      const obet = b[to];
      const c = HODNOTA[obet.toLowerCase()];
      const zmena = turn === side ? c : -c;
      ucet += zmena;
      kroky.push({ tah: nazovTahu(b, u, to), strana: turn,
                   figurka: SK_FIGURY[obet.toLowerCase()], zmena: zmena, ucet: ucet });
      b = b.slice();
      b[to] = b[u]; b[u] = '';
      turn = super_(turn);
    }
    return { kroky: kroky, koniec: koniec, vysledok: ucet };
  }

  // ── Verejné rozhranie ──────────────────────────────────────────────────
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
    seeWithPins: seeWithPins,
    vysvetliBranie: vysvetliBranie,
    braniaSoZiskomStrany: braniaSoZiskomStrany,
    braniaSoZiskom: braniaSoZiskom,
    vsetkyBrania: vsetkyBrania,
    nazovTahu: nazovTahu,
    rebrikVymeny: rebrikVymeny
  };
})();

// Pre testy v Node.js (v prehliadači sa ignoruje)
if (typeof module !== 'undefined' && module.exports) module.exports = VisionCore;
