// ============================================================================
//  rebrik-vymeny.js — šachovnica a prehrávanie rebríka výmeny
// ----------------------------------------------------------------------------
//  Spoločná súčasť pre Laboratórium výmeny a hru Šachový trh. Všetko šachové
//  (zisk, poradie brania, kto kedy prestane) počíta VisionCore — tento súbor
//  výsledok len ukáže na šachovnici a v tabuľke. Musí sa načítať až po
//  js/vision-core.js.
//
//  POUŽITIE:
//    const s = new RebrikVymeny.Sachovnica(document.getElementById('board'));
//    s.nastav(board);                       // pole 64 figúrok (ako VisionCore)
//    s.naKlik = index => { ... };           // klik na pole (0 = a8 … 63 = h1)
//    s.oznac({ 27: 'ciel', 37: 'selected' });
//
//    const p = new RebrikVymeny.Prehravac(s, { onZmena: p => ... });
//    p.nacitaj(board, 'f4d5');  p.prehraj();   // alebo p.dalej() / p.spat()
//    RebrikVymeny.htmlRebrika(p)             // tabuľka krokov do panela
//
//  Šachovnica používa rovnaké CSS triedy ako training.html (.square, .light,
//  .dark, .piece-img, .last-from, .last-to, .selected) — vzhľad je jednotný.
//  Nová trieda: .ciel (figúrka, ktorú možno zobrať).
// ============================================================================

const RebrikVymeny = (function () {
  'use strict';

  const VC = VisionCore;
  const STLPCE = 'abcdefgh';

  const esc = s => String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Číslo so znamienkom: +3, 0, −2 (typografické mínus)
  function znak(x) {
    if (x > 0) return '+' + x;
    if (x < 0) return '−' + Math.abs(x);
    return '0';
  }

  function triedaZnamienka(x) {
    return x > 0 ? 'plus' : (x < 0 ? 'minus' : 'nula');
  }

  // ── Šachovnica ─────────────────────────────────────────────────────────
  function Sachovnica(el, moznosti) {
    moznosti = moznosti || {};
    this.el = el;
    this.cesta = moznosti.cestaObrazkov || 'img/Pieces/';
    this.otocena = false;
    this.board = new Array(64).fill('');
    this.znacky = {};          // index poľa → 'trieda1 trieda2'
    this.naKlik = null;
    this._postav();
  }

  Sachovnica.prototype._postav = function () {
    const self = this;
    this.el.innerHTML = '';
    this.polia = [];
    this.obrazky = new Array(64).fill(null);
    this.popisStlpec = [];
    this.popisRad = [];
    for (let i = 0; i < 64; i++) {
      const r = Math.floor(i / 8), c = i % 8;
      const d = document.createElement('div');
      d.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      if (r === 7) {
        const f = document.createElement('span');
        f.className = 'coord-file';
        d.appendChild(f);
        this.popisStlpec[c] = f;
      }
      if (c === 0) {
        const rk = document.createElement('span');
        rk.className = 'coord-rank';
        d.appendChild(rk);
        this.popisRad[r] = rk;
      }
      d.addEventListener('click', function () {
        if (self.naKlik) self.naKlik(Number(d.dataset.pole));
      });
      this.polia.push(d);
      this.el.appendChild(d);
    }
    this.kresli();
  };

  Sachovnica.prototype.nastav = function (board) {
    this.board = board.slice();
    this.kresli();
  };

  Sachovnica.prototype.oznac = function (znacky) {
    this.znacky = znacky || {};
    this.kresli();
  };

  Sachovnica.prototype.otoc = function () {
    this.otocena = !this.otocena;
    this.kresli();
  };

  Sachovnica.prototype.kresli = function () {
    for (let i = 0; i < 64; i++) {
      const pole = this.otocena ? 63 - i : i;
      const r = Math.floor(i / 8), c = i % 8;
      const d = this.polia[i];
      d.dataset.pole = pole;
      d.className = 'square ' + ((r + c) % 2 === 0 ? 'light' : 'dark') +
                    (this.znacky[pole] ? ' ' + this.znacky[pole] : '');
      d.title = STLPCE[pole % 8] + (8 - Math.floor(pole / 8));

      const figurka = this.board[pole];
      let img = this.obrazky[i];
      if (figurka) {
        if (!img) {
          img = document.createElement('img');
          img.className = 'piece-img';
          img.draggable = false;
          d.appendChild(img);
          this.obrazky[i] = img;
        }
        if (img.alt !== figurka) {
          const farba = figurka === figurka.toUpperCase() ? 'w' : 'b';
          img.src = this.cesta + farba + figurka.toUpperCase() + '.svg';
          img.alt = figurka;
        }
      } else if (img) {
        img.remove();
        this.obrazky[i] = null;
      }
      if (r === 7) this.popisStlpec[c].textContent = STLPCE[this.otocena ? 7 - c : c];
      if (c === 0) this.popisRad[r].textContent = String(this.otocena ? r + 1 : 8 - r);
    }
  };

  // ── Prehrávač rebríka výmeny ───────────────────────────────────────────
  //  Stav k = koľko krokov výmeny už prebehlo (0 = pôvodná pozícia,
  //  šípka ukazuje branie, ktoré sa ide skúmať).
  function Prehravac(sachovnica, moznosti) {
    moznosti = moznosti || {};
    this.s = sachovnica;
    this.onZmena = moznosti.onZmena || null;
    this.rychlost = moznosti.rychlost || 1100;   // ms medzi krokmi pri prehrávaní
    this.rebrik = null;
    this.k = 0;
    this._casovac = null;
  }

  Prehravac.prototype.nacitaj = function (board, uci) {
    this.zastav();
    this.zaciatok = board.slice();
    this.uci = uci;
    this.strana = VC.pieceColor(board[VC.sqIndex(uci.slice(0, 2))]);
    this.rebrik = VC.rebrikVymeny(board, uci);
    // Pozícia po každom kroku — na prechádzanie dopredu aj dozadu
    this.pozicie = [board.slice()];
    let b = board.slice();
    for (const krok of this.rebrik.kroky) {
      b = b.slice();
      const f = b[krok.z];
      // pešiak, ktorý berie na poslednom rade, sa mení na dámu
      b[krok.na] = krok.premena ? (f === f.toUpperCase() ? 'Q' : 'q') : f;
      b[krok.z] = '';
      this.pozicie.push(b);
    }
    this.k = 0;
    this._ukaz();
  };

  Prehravac.prototype.pocetKrokov = function () {
    return this.rebrik ? this.rebrik.kroky.length : 0;
  };

  Prehravac.prototype.jeNaKonci = function () {
    return !!this.rebrik && this.k >= this.pocetKrokov();
  };

  Prehravac.prototype.ucet = function () {
    if (!this.rebrik || this.k === 0) return 0;
    return this.rebrik.kroky[this.k - 1].ucet;
  };

  Prehravac.prototype.bezi = function () {
    return this._casovac !== null;
  };

  Prehravac.prototype.dalej = function () {
    if (!this.rebrik || this.jeNaKonci()) return;
    this.k++;
    this._ukaz();
  };

  Prehravac.prototype.spat = function () {
    this.zastav();
    if (!this.rebrik || this.k === 0) return;
    this.k--;
    this._ukaz();
  };

  Prehravac.prototype.naZaciatok = function () {
    this.zastav();
    if (!this.rebrik) return;
    this.k = 0;
    this._ukaz();
  };

  Prehravac.prototype.naKoniec = function () {
    this.zastav();
    if (!this.rebrik) return;
    this.k = this.pocetKrokov();
    this._ukaz();
  };

  Prehravac.prototype.prehraj = function () {
    if (!this.rebrik) return;
    this.zastav();
    if (this.jeNaKonci()) { this.k = 0; this._ukaz(); }
    const self = this;
    this._casovac = setInterval(function () {
      if (self.jeNaKonci()) { self.zastav(); return; }
      self.dalej();
      if (self.jeNaKonci()) self.zastav();
    }, this.rychlost);
    this._oznam();
  };

  Prehravac.prototype.zastav = function () {
    const hral = this._casovac !== null;
    if (hral) { clearInterval(this._casovac); this._casovac = null; }
    if (hral) this._oznam();
  };

  Prehravac.prototype.zrus = function () {
    this.zastav();
    this.rebrik = null;
    this.k = 0;
    this._oznam();
  };

  Prehravac.prototype._ukaz = function () {
    this.s.nastav(this.pozicie[this.k]);
    const z = {};
    if (this.k === 0) {
      const prvy = this.rebrik.kroky[0];
      if (prvy) { z[prvy.z] = 'selected'; z[prvy.na] = 'ciel'; }
    } else {
      const krok = this.rebrik.kroky[this.k - 1];
      z[krok.z] = 'last-from';
      z[krok.na] = 'last-to';
    }
    this.s.oznac(z);
    this._oznam();
  };

  Prehravac.prototype._oznam = function () {
    if (this.onZmena) this.onZmena(this);
  };

  // ── Texty ──────────────────────────────────────────────────────────────
  const KTO = { w: 'Biely', b: 'Čierny' };

  function textKonca(koniec) {
    if (!koniec) return '';
    if (koniec.typ === 'nie_je_branie') return 'Na poli nie je čo brať.';
    if (koniec.typ === 'nikto') return KTO[koniec.strana] + ' už nemá čím brať.';
    return KTO[koniec.strana] + ' ďalej neberie — ' + koniec.tah + ' by sa mu neoplatilo.';
  }

  function textVerdiktu(vysledok) {
    if (vysledok > 0) return 'Branie so ziskom ' + znak(vysledok);
    if (vysledok < 0) return 'Strata ' + znak(vysledok);
    return 'Výmena — zisk 0';
  }

  // Tabuľka rebríka pre panel. Riadky pribúdajú podľa toho, koľko krokov
  // už prebehlo; koniec a verdikt sa ukážu až po poslednom kroku.
  function htmlRebrika(p) {
    if (!p.rebrik) return '';
    const r = p.rebrik;
    let h = '<table class="rebrik"><thead><tr><th>Krok</th><th>Ťah</th>' +
            '<th class="cislo">Zmena</th><th class="cislo">Účet</th></tr></thead><tbody>';
    r.kroky.forEach(function (k, i) {
      const skryty = i >= p.k;
      const aktualny = i === p.k - 1;
      h += '<tr class="' + (skryty ? 'skryty' : '') + (aktualny ? ' aktualny' : '') + '">' +
           '<td>' + (i + 1) + '</td>' +
           (skryty
             ? '<td class="slabo">…</td>'
             : '<td><span class="bodka ' + k.strana + '"></span>' + esc(k.tah) +
               ' <span class="slabo">— ' + (k.strana === p.strana ? 'beriem' : 'súper berie') +
               ' ' + esc(k.figurka) + (k.premena ? ' a mení sa na dámu (+8)' : '') + '</span></td>') +
           '<td class="cislo ' + triedaZnamienka(k.zmena) + '">' + (skryty ? '' : znak(k.zmena)) + '</td>' +
           '<td class="cislo ' + triedaZnamienka(k.ucet) + '">' + (skryty ? '' : znak(k.ucet)) + '</td></tr>';
    });
    if (p.jeNaKonci()) {
      h += '<tr class="koniec"><td>—</td><td colspan="2">' + esc(textKonca(r.koniec)) + '</td>' +
           '<td class="cislo ' + triedaZnamienka(r.vysledok) + '"><b>' + znak(r.vysledok) + '</b></td></tr>';
    }
    return h + '</tbody></table>';
  }

  // ── FEN ────────────────────────────────────────────────────────────────
  function fenZoSachovnice(board, naTahu) {
    const rady = [];
    for (let r = 0; r < 8; r++) {
      let s = '', prazdne = 0;
      for (let c = 0; c < 8; c++) {
        const x = board[r * 8 + c];
        if (x) { if (prazdne) { s += prazdne; prazdne = 0; } s += x; }
        else prazdne++;
      }
      if (prazdne) s += prazdne;
      rady.push(s);
    }
    return rady.join('/') + ' ' + (naTahu || 'w') + ' - - 0 1';
  }

  // Vráti null, ak je FEN použiteľný, inak vetu s dôvodom.
  function chybaFen(fen) {
    const casti = String(fen || '').trim().split(/\s+/);
    if (!casti[0]) return 'Zadaj FEN.';
    const rady = casti[0].split('/');
    if (rady.length !== 8) return 'Rozostavenie musí mať 8 radov oddelených lomkou.';
    for (let i = 0; i < 8; i++) {
      let n = 0;
      for (const ch of rady[i]) {
        if (ch >= '1' && ch <= '8') n += Number(ch);
        else if ('pnbrqkPNBRQK'.includes(ch)) n++;
        else return 'Neznámy znak „' + ch + '" v ' + (8 - i) + '. rade.';
      }
      if (n !== 8) return (8 - i) + '. rad nemá 8 polí.';
    }
    if (/[pP]/.test(rady[0])) return 'Pešiak nemôže stáť na 8. rade.';
    if (/[pP]/.test(rady[7])) return 'Pešiak nemôže stáť na 1. rade.';
    if (casti[1] && casti[1] !== 'w' && casti[1] !== 'b') return 'Druhá časť FEN-u musí byť w alebo b.';
    return null;
  }

  // Upozornenia k pozícii (nebránia práci, len vysvetlia, čo by na to povedal generátor)
  function upozornenia(board) {
    const out = [];
    const pocet = f => board.filter(x => x === f).length;
    if (pocet('K') === 0) out.push('Chýba biely kráľ.');
    if (pocet('k') === 0) out.push('Chýba čierny kráľ.');
    if (pocet('K') > 1) out.push('Biely má viac kráľov.');
    if (pocet('k') > 1) out.push('Čierny má viac kráľov.');
    if (VC.isKingInCheck(board, 'w') || VC.isKingInCheck(board, 'b')) {
      out.push('Niektorý kráľ je v šachu — v tréningu by sa táto pozícia nepoužila.');
    }
    return out;
  }

  return {
    Sachovnica: Sachovnica,
    Prehravac: Prehravac,
    htmlRebrika: htmlRebrika,
    textKonca: textKonca,
    textVerdiktu: textVerdiktu,
    triedaZnamienka: triedaZnamienka,
    znak: znak,
    esc: esc,
    fenZoSachovnice: fenZoSachovnice,
    chybaFen: chybaFen,
    upozornenia: upozornenia
  };
})();
