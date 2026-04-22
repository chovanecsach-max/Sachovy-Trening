const SUPABASE_URL = "https://wdjsilryllqksdtmaehy.supabase.co";
const SUPABASE_KEY = "sb_publishable_45gFQhgPScrDjDCVC0B4Iw_q6uZKf9m";

// ─── Pomocná funkcia pre volanie Supabase REST API ───────────────────────────

async function sbFetchTraining(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Prefer": options.prefer || "",
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase chyba: ${err}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ─── Tréningový log ──────────────────────────────────────────────────────────

async function addTrainingResult(playerId, puzzleId, result) {
  try {
    await sbFetchTraining("training_log", {
      method: "POST",
      prefer: "return=minimal",
      body: JSON.stringify({
        player_id: playerId,
        puzzle_id: puzzleId,
        result: result
      })
    });
  } catch (e) {
    console.error("Chyba pri ukladaní tréningového logu:", e);
  }
}

async function getSolvedPuzzleIds(playerId) {
  try {
    const data = await sbFetchTraining(
      `training_log?player_id=eq.${playerId}&select=puzzle_id`
    );
    return data ? data.map(x => x.puzzle_id) : [];
  } catch (e) {
    console.error("Chyba pri načítaní vyriešených úloh:", e);
    return [];
  }
}

// ─── Výber úlohy pre hráča ───────────────────────────────────────────────────

function getTrainingMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("mode");
}

async function pickPuzzleForPlayer(player, puzzles) {
  const solved = await getSolvedPuzzleIds(player.id);
  const mode = getTrainingMode();

  let filtered = puzzles;

  if (mode === "taktika") {
    filtered = puzzles.filter(p => p.category === "Taktika");
  } else if (mode === "strategia") {
    filtered = puzzles.filter(p => p.category === "Strategia");
  } else if (mode === "koncovka") {
    filtered = puzzles.filter(p => p.category === "Koncovka");
  }

  const unsolved = filtered.filter(p => !solved.includes(p.id));

  function filterByRange(pool, range) {
    return pool.filter(p => Math.abs(p.elo - player.elo) <= range);
  }

  let pool = filterByRange(unsolved, 100);
  if (!pool.length) pool = filterByRange(unsolved, 200);
  if (!pool.length) pool = filterByRange(unsolved, 300);
  if (!pool.length) pool = unsolved;
  if (!pool.length) pool = filtered.length ? filtered : puzzles;

  return pool[Math.floor(Math.random() * pool.length)];
}

// ─── Načítanie puzzle zo Supabase ────────────────────────────────────────────

async function loadPuzzlesFromSupabase() {
  try {
    const data = await sbFetchTraining("puzzles?order=id.asc&limit=1000");
    if (!data || !data.length) throw new Error("Žiadne puzzle v databáze");

    // Prevedieme snake_case na camelCase pre kompatibilitu s existujúcim kódom
    return data.map(p => ({
      id: p.id,
      title: p.title,
      fen: p.fen,
      turnText: p.turn_text,
      prompt: p.prompt,
      category: p.category,
      elo: p.elo,
      time: p.time,
      solutionTree: p.solution_tree
    }));
  } catch (e) {
    console.error("Chyba pri načítaní puzzle:", e);
    return [];
  }
}
