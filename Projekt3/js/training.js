const TRAINING_KEY = "trainingLog";

function loadTrainingLog() {
  return JSON.parse(localStorage.getItem(TRAINING_KEY) || "[]");
}

function saveTrainingLog(log) {
  localStorage.setItem(TRAINING_KEY, JSON.stringify(log));
}

function addTrainingResult(playerId, puzzleId, result) {
  const log = loadTrainingLog();

  log.push({
    playerId: playerId,
    puzzleId: puzzleId,
    result: result,
    time: Date.now()
  });

  saveTrainingLog(log);
}

function getSolvedPuzzleIds(playerId) {
  const log = loadTrainingLog();
  return log
    .filter(x => x.playerId == playerId)
    .map(x => x.puzzleId);
}

// 🔽 NOVÉ – zistenie režimu
function getTrainingMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("mode");
}

// 🔽 UPRAVENÉ – filter podľa category + pôvodná ELO logika
function pickPuzzleForPlayer(player, puzzles) {
  const solved = getSolvedPuzzleIds(player.id);
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

  function filterByRange(range) {
    return unsolved.filter(p =>
      Math.abs(p.elo - player.elo) <= range
    );
  }

  let pool =
    filterByRange(100) ||
    filterByRange(200) ||
    filterByRange(300) ||
    unsolved;

  if (!pool.length) {
    pool = filtered.length ? filtered : puzzles;
  }

  return pool[Math.floor(Math.random() * pool.length)];
}