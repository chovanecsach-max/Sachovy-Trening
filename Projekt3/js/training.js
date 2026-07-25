const TRAINING_KEY = "trainingLog";

async function addTrainingResult(playerId, puzzleId, result, timeSpent = 0) {
  try {
    await sbFetch("training_log", {
      method: "POST",
      prefer: "return=minimal",
      body: JSON.stringify({
        player_id: playerId,
        puzzle_id: puzzleId,
        result: result,
        time_spent: Math.max(0, Math.round(timeSpent)),
        source: "puzzles"        // úloha z tabuľky puzzles (klasický tréning)
      })
    });
  } catch (e) {
    console.error("Chyba pri ukladaní tréningového logu:", e);
  }
}

const RETRY_AFTER_DAYS = 14;   // po tomto počte dní sa nevyriešená (loss) úloha vráti do výberu

async function getExcludedPuzzleIds(playerId) {
  try {
    // Zoberieme celú históriu (puzzle_id, result, created_at) zoradenú od najnovšej,
    // aby sme pre každú úlohu vedeli určiť jej POSLEDNÝ výsledok a jeho dátum.
    // POZOR na source=eq.puzzles: puzzles.id aj skill_puzzles.id sú int4 od 1,
    // takže id sa medzi tabuľkami prekrývajú. Bez tohto filtra by vyriešená
    // zručnosť č. N vylúčila z klasického tréningu úlohu č. N.
    const data = await sbFetch(
      `training_log?player_id=eq.${playerId}&source=eq.puzzles&select=puzzle_id,result,created_at&order=created_at.desc`
    );
    if (!data) return [];

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

async function pickPuzzleForPlayer(player, puzzles) {
  const excluded = await getExcludedPuzzleIds(player.id);
  const mode = getTrainingMode();

  // Filtruj podľa kategórie
  let filtered = puzzles;
  if (mode === "taktika") {
    filtered = puzzles.filter(p => p.category === "Taktika");
  } else if (mode === "strategia") {
    filtered = puzzles.filter(p => p.category === "Strategia");
  } else if (mode === "koncovka") {
    filtered = puzzles.filter(p => p.category === "Koncovka");
    // Nepovinné spresnenie: ?endgame=Vežové vyberie len daný typ koncovky.
    // Ak by pre daný typ nezostala žiadna úloha, ponecháme všetky koncovky,
    // nech tréning nikdy neskončí hláškou "nenašla sa úloha".
    const wanted = new URLSearchParams(window.location.search).get("endgame");
    if (wanted) {
      const narrowed = filtered.filter(p => p.endgame_type === wanted);
      if (narrowed.length) filtered = narrowed;
    }
  }

  // Použi správne ELO hráča podľa režimu
  const playerElo = getPlayerEloByMode(player, mode);

  const unsolved = filtered.filter(p => !excluded.includes(p.id));

  function filterByRange(pool, range) {
    return pool.filter(p => Math.abs(p.elo - playerElo) <= range);
  }

  let pool = filterByRange(unsolved, 100);
  if (!pool.length) pool = filterByRange(unsolved, 200);
  if (!pool.length) pool = filterByRange(unsolved, 300);
  if (!pool.length) pool = unsolved;
  if (!pool.length) pool = filtered.length ? filtered : puzzles;

  const picked = pool[Math.floor(Math.random() * pool.length)];
  if (!picked) return null;

  // Lenivé dotiahnutie plného záznamu — zoznam v pamäti obsahuje len
  // ľahké stĺpce (id, category, elo) potrebné na výber. Riešenie (solution_tree)
  // sa sťahuje len pre jedinú vybranú úlohu, nie pre celú databázu.
  try {
    const rows = await sbFetch(`puzzles?id=eq.${picked.id}&limit=1`);
    if (!rows || !rows.length) return null;
    const p = rows[0];
    return {
      id: p.id,
      title: p.title,
      fen: p.fen,
      turnText: p.turn_text,
      prompt: p.prompt,
      category: p.category,
      endgame_type: p.endgame_type,
      elo: p.elo,
      time: p.time,
      solutionTree: p.solution_tree
    };
  } catch (e) {
    console.error("Chyba pri načítaní úlohy:", e);
    return null;
  }
}

async function loadPuzzlesFromSupabase() {
  try {
    // Načítavaj po dávkach 1000 — Supabase Free má limit 1000 riadkov/request.
    // OPTIMALIZÁCIA: sťahujú sa len ľahké stĺpce potrebné na výber úlohy
    // (id, category, elo) — plný záznam s riešením sa doťahuje lenivo
    // v pickPuzzleForPlayer. Šetrí ~95 % objemu dát pri štarte tréningu.
    const BATCH = 1000;
    let allData = [];
    let offset = 0;
    while (true) {
      const data = await sbFetch(
        `puzzles?select=id,category,elo,endgame_type&order=id.asc&limit=${BATCH}&offset=${offset}`
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
