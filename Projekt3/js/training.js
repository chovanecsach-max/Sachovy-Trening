const TRAINING_KEY = "trainingLog";

// ZASTARANÉ — výsledok tréningu zapisuje serverová funkcia zapis_vysledok
// (zapisVysledok v js/player.js). Priamy POST do training_log tu bol do kroku 6;
// odvtedy politika insert_own_training_log neexistuje a taký zápis by skončil
// chybou 403. Funkcia zostáva len ako hlasná zátka: keby ju niekto omylom
// použil, dozvie sa to hneď, a nie o mesiac z prázdnej štatistiky.
function addTrainingResult() {
  throw new Error('addTrainingResult je zrušená — použi zapisVysledok() z js/player.js');
}

const RETRY_AFTER_DAYS = 14;   // po tomto počte dní sa nevyriešená (loss) úloha vráti do výberu

async function getExcludedPuzzleIds(playerId) {
  try {
    // Zoberieme celú históriu (puzzle_id, result, created_at) zoradenú od najnovšej,
    // aby sme pre každú úlohu vedeli určiť jej POSLEDNÝ výsledok a jeho dátum.
    // POZOR na source=eq.puzzles: puzzles.id aj skill_puzzles.id sú int4 od 1,
    // takže id sa medzi tabuľkami prekrývajú. Bez tohto filtra by vyriešená
    // zručnosť č. N vylúčila z klasického tréningu úlohu č. N.
    // Po dávkach 1000 — Supabase vráti v jednej odpovedi najviac 1000 riadkov.
    // Bez stránkovania by hráč s viac ako 1000 pokusmi dostával znova staršie,
    // už vyriešené úlohy (do výberu by sa započítalo len posledných 1000).
    const BATCH = 1000;
    let data = [];
    for (let offset = 0; ; offset += BATCH) {
      const d = await sbFetch(
        `training_log?player_id=eq.${playerId}&source=eq.puzzles&select=puzzle_id,result,created_at&order=created_at.desc&limit=${BATCH}&offset=${offset}`
      );
      if (!d || !d.length) break;
      data = data.concat(d);
      if (d.length < BATCH) break;
    }
    if (!data.length) return [];

    const lastByPuzzle = new Map();   // puzzle_id → { result, created_at } (len najnovší záznam)
    for (const row of data) {
      if (!lastByPuzzle.has(row.puzzle_id)) {
        lastByPuzzle.set(row.puzzle_id, row);
      }
    }

    const now = Date.now();
    const cutoffMs = RETRY_AFTER_DAYS * 24 * 60 * 60 * 1000;
    const excluded = [];

    lastByPuzzle.forEach((row, puzzleId) => {
      if (row.result === 'win') {
        excluded.push(puzzleId);   // vyriešené — ostáva vylúčené natrvalo
      } else {
        // neúspešné (loss) — vylúčené len kým neuplynie RETRY_AFTER_DAYS
        const age = now - new Date(row.created_at).getTime();
        if (age < cutoffMs) excluded.push(puzzleId);
      }
    });

    return excluded;
  } catch (e) {
    console.error("Chyba pri načítaní histórie úloh:", e);
    return [];
  }
}

// Zachovaný pôvodný názov pre spätnú kompatibilitu (ak sa používa inde)
async function getSolvedPuzzleIds(playerId) {
  return getExcludedPuzzleIds(playerId);
}

function getTrainingMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("mode");
}

// Prečo pickPuzzleForPlayer nič nevrátil. Volajúci podľa toho vie napísať
// hráčovi zmysluplnú správu namiesto všeobecného „nenašla sa úloha".
//   'ziadne-nove'      — v kategórii sú úlohy, ale všetky už vyriešil
//   'prazdna-kategoria'— v kategórii nie sú žiadne úlohy
//   'chyba'            — nepodarilo sa načítať
//   'platnost'         — hráčovi vypršal prístup (stránka to už oznámila)
let poslednyDovodVyberu = null;

// ─── Výber úlohy na serveri ─────────────────────────────────────────────────
// Od 17. 11. 2026 vyberá úlohu databázová funkcia vyber_ulohu
// (03-vyber-ulohy.sql) — rovnakými pravidlami ako pôvodný výber nižšie.
// Prehliadač dostane jedinú úlohu aj s riešením, namiesto sťahovania zoznamu
// všetkých úloh (po dávkach 1000) a celej histórie hráča pri každom štarte.
//
// Keď server zlyhá (výpadok siete, funkcia ešte nie je nasadená), použije sa
// pôvodný výber v prehliadači — tréning sa kvôli tomu nezastaví.
async function vyberUlohuNaServeri(mode, endgame, motiv) {
  return await sbFetch('rpc/vyber_ulohu', {
    method: 'POST',
    body: JSON.stringify({ p_mode: mode || null, p_endgame: endgame || null, p_motiv: motiv || null })
  });
}

// Taktický motív z adresy (?motiv=Vidlička) — platí len v režime taktika
function getTrainingMotiv() {
  return new URLSearchParams(window.location.search).get("motiv");
}

// Riadok z databázy (snake_case) → objekt, s ktorým pracuje training.html
function _objektUlohy(p) {
  return {
    id: p.id,
    title: p.title,
    fen: p.fen,
    turnText: p.turn_text,
    prompt: p.prompt,
    category: p.category,
    endgame_type: p.endgame_type,
    motivy: p.motivy,
    elo: p.elo,
    time: p.time,
    solutionTree: p.solution_tree
  };
}

async function pickPuzzleForPlayer(player, puzzles) {
  poslednyDovodVyberu = null;
  const mode = getTrainingMode();
  const endgame = new URLSearchParams(window.location.search).get("endgame");
  const motiv = getTrainingMotiv();

  let r;
  try {
    r = await vyberUlohuNaServeri(mode, endgame, motiv);
  } catch (e) {
    // Vypršaný prístup: záložný výber by úlohu síce ponúkol, ale výsledok by
    // server aj tak nezapísal. Povie sa to hneď a jasne.
    if (String(e && e.message).includes('Platnosť prístupu vypršala')) {
      poslednyDovodVyberu = 'platnost';
      if (typeof vyzadujPlatnost === 'function') await vyzadujPlatnost();
      return null;
    }
    console.error('Výber úlohy na serveri zlyhal, použijem záložný výber:', e);
    if (typeof reportPlayerError === 'function') reportPlayerError('vyber_ulohu zlyhal', e);
    return pickPuzzleVPrehliadaci(player, puzzles);
  }

  if (r && r.uloha) return _objektUlohy(r.uloha);
  if (r && (r.dovod === 'ziadne-nove' || r.dovod === 'prazdna-kategoria')) {
    poslednyDovodVyberu = r.dovod;
    return null;
  }
  // Neočakávaná odpoveď — radšej záložný výber než prázdna obrazovka
  console.error('Neočakávaná odpoveď vyber_ulohu:', r);
  return pickPuzzleVPrehliadaci(player, puzzles);
}

// ─── Záložný výber v prehliadači (pôvodný spôsob) ───────────────────────────
// Používa sa len keď zlyhá server. Zoznam úloh sa stiahne až vtedy, keď ho
// naozaj treba, a len raz za návštevu stránky.
let _zalohaUloh = null;

async function pickPuzzleVPrehliadaci(player, puzzles) {
  poslednyDovodVyberu = null;
  if (!Array.isArray(puzzles) || !puzzles.length) {
    if (!_zalohaUloh || !_zalohaUloh.length) _zalohaUloh = await loadPuzzlesFromSupabase();
    puzzles = _zalohaUloh;
  }
  if (!puzzles.length) { poslednyDovodVyberu = 'chyba'; return null; }

  const excluded = await getExcludedPuzzleIds(player.id);
  const mode = getTrainingMode();

  // Filtruj podľa kategórie
  let filtered = puzzles;
  if (mode === "taktika") {
    filtered = puzzles.filter(p => p.category === "Taktika");
    // Nepovinne len jeden motív (?motiv=Vidlička) — rovnako ako typ koncovky
    const motiv = getTrainingMotiv();
    if (motiv) {
      filtered = filtered.filter(p => Array.isArray(p.motivy) && p.motivy.includes(motiv));
    }
  } else if (mode === "strategia") {
    filtered = puzzles.filter(p => p.category === "Strategia");
  } else if (mode === "koncovka") {
    filtered = puzzles.filter(p => p.category === "Koncovka");
    // Nepovinné spresnenie: ?endgame=Vežové vyberie len daný typ koncovky.
    // Prázdny výsledok sa už zámerne NEOBCHÁDZA doplnením všetkých koncoviek —
    // hráč, ktorý si vybral konkrétny typ, má dostať jasnú správu, nie tichú
    // náhradu za niečo iné.
    const wanted = new URLSearchParams(window.location.search).get("endgame");
    if (wanted) {
      filtered = filtered.filter(p => p.endgame_type === wanted);
    }
  }

  // Použi správne ELO hráča podľa režimu
  const playerElo = getPlayerEloByMode(player, mode);

  const unsolved = filtered.filter(p => !excluded.includes(p.id));

  function filterByRange(pool, range) {
    return pool.filter(p => Math.abs(p.elo - playerElo) <= range);
  }

  if (!filtered.length) {
    poslednyDovodVyberu = 'prazdna-kategoria';
    return null;
  }
  if (!unsolved.length) {
    // Všetko v kategórii je vyriešené (alebo v ochrannej lehote po neúspechu).
    // Predtým sa tu siahlo po už vyriešených úlohách, takže hráč dookola
    // dostával tie isté pozície — a keďže ELO padá len za prvé riešenie,
    // nemalo to ani tréningový, ani bodový zmysel.
    poslednyDovodVyberu = 'ziadne-nove';
    return null;
  }

  let pool = filterByRange(unsolved, 100);
  if (!pool.length) pool = filterByRange(unsolved, 200);
  if (!pool.length) pool = filterByRange(unsolved, 300);
  if (!pool.length) pool = unsolved;

  const picked = pool[Math.floor(Math.random() * pool.length)];
  if (!picked) { poslednyDovodVyberu = 'ziadne-nove'; return null; }

  // Lenivé dotiahnutie plného záznamu — zoznam v pamäti obsahuje len
  // ľahké stĺpce (id, category, elo) potrebné na výber. Riešenie (solution_tree)
  // sa sťahuje len pre jedinú vybranú úlohu, nie pre celú databázu.
  try {
    const rows = await sbFetch(`puzzles?id=eq.${picked.id}&limit=1`);
    if (!rows || !rows.length) { poslednyDovodVyberu = 'chyba'; return null; }
    return _objektUlohy(rows[0]);
  } catch (e) {
    console.error("Chyba pri načítaní úlohy:", e);
    poslednyDovodVyberu = 'chyba';
    return null;
  }
}

async function loadPuzzlesFromSupabase() {
  try {
    // Len pre záložný výber (pickPuzzleVPrehliadaci) — bežne vyberá server.
    // Načítavaj po dávkach 1000 — Supabase Free má limit 1000 riadkov/request.
    // Sťahujú sa len ľahké stĺpce potrebné na výber úlohy (id, category, elo,
    // endgame_type, motivy) — plný záznam s riešením sa doťahuje len pre vybranú úlohu.
    const BATCH = 1000;
    let allData = [];
    let offset = 0;
    while (true) {
      const data = await sbFetch(
        `puzzles?select=id,category,elo,endgame_type,motivy&order=id.asc&limit=${BATCH}&offset=${offset}`
      );
      if (!data || !data.length) break;
      allData = allData.concat(data);
      if (data.length < BATCH) break; // posledná dávka
      offset += BATCH;
    }
    if (!allData.length) throw new Error("Žiadne puzzle v databáze");
    return allData;
  } catch (e) {
    console.error("Chyba pri načítaní puzzle:", e);
    return [];
  }
}
