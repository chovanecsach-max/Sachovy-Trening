const TRAINING_KEY = "trainingLog";

async function addTrainingResult(playerId, puzzleId, result) {
  try {
    await sbFetch("training_log", {
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
    const data = await sbFetch(
      `training_log?player_id=eq.${playerId}&select=puzzle_id`
    );
    return data ? data.map(x => x.puzzle_id) : [];
  } catch (e) {
    console.error("Chyba pri načítaní vyriešených úloh:", e);
    return [];
  }
}

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

async function loadPuzzlesFromSupabase() {
  try {
    const data = await sbFetch("puzzles?order=id.asc&limit=2000");
    if (!data || !data.length) throw new Error("Žiadne puzzle v databáze");
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
