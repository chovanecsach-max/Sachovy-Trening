// SUPABASE_URL a SUPABASE_KEY sú definované v auth.js

const CURRENT_KEY = "currentPlayer";

async function sbFetch(path, options = {}) {
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

// ─── ELO podľa režimu ───────────────────────────────────────────────────────

function getEloField(mode) {
  if (mode === "taktika") return "elo_taktika";
  if (mode === "strategia") return "elo_strategia";
  if (mode === "koncovka") return "elo_koncovka";
  return "elo";
}

function getPlayerEloByMode(player, mode) {
  return Number(player[getEloField(mode)] || 1500);
}

// ─── Hráči ──────────────────────────────────────────────────────────────────

async function loadPlayers() {
  try {
    const data = await sbFetch("players?order=created_at.asc");
    return data || [];
  } catch (e) {
    console.error("Chyba pri načítaní hráčov:", e);
    return [];
  }
}

async function createPlayer(name, surname = '', email = '', elo = 1500) {
  const newPlayer = {
    id: Date.now(),
    name: name,
    surname: surname,
    email: email,
    elo: elo,
    elo_taktika: elo,
    elo_strategia: elo,
    elo_koncovka: elo,
    elo_zrucnosti: elo,
    played: 0,
    solved: 0,
    total_time: 0
  };
  try {
    await sbFetch("players", {
      method: "POST",
      prefer: "return=representation",
      body: JSON.stringify(newPlayer)
    });
    return newPlayer;
  } catch (e) {
    console.error("Chyba pri vytváraní hráča:", e);
    return null;
  }
}

function setCurrentPlayer(id) {
  localStorage.setItem(CURRENT_KEY, id);
}

async function getCurrentPlayer() {
  // Najprv skús načítať hráča podľa user_id z Auth session
  const userId = sessionStorage.getItem('user_id');
  if (userId) {
    try {
      const data = await sbFetch(`players?user_id=eq.${userId}&limit=1`);
      if (data && data.length) {
        localStorage.setItem(CURRENT_KEY, data[0].id);
        return data[0];
      }
    } catch (e) {
      console.error("Chyba pri načítaní hráča podľa user_id:", e);
    }
  }
  // Fallback - načítaj podľa localStorage
  const id = localStorage.getItem(CURRENT_KEY);
  if (!id) return null;
  try {
    const data = await sbFetch(`players?id=eq.${id}&limit=1`);
    return data && data.length ? data[0] : null;
  } catch (e) {
    console.error("Chyba pri načítaní aktuálneho hráča:", e);
    return null;
  }
}

async function updatePlayerElo(playerId, puzzleElo, result, mode) {
  try {
    const players = await sbFetch(`players?id=eq.${playerId}&limit=1`);
    if (!players || !players.length) return;
    const player = players[0];

    const eloField = getEloField(mode);
    const currentElo = Number(player[eloField] || 1500);
    const diff = Number(puzzleElo) - currentElo;
    let change = result === "win" ? 10 + diff / 50 : -(10 - diff / 50);
    const newElo = Math.max(100, Math.round(currentElo + change));

    await sbFetch(`players?id=eq.${playerId}`, {
      method: "PATCH",
      body: JSON.stringify({ [eloField]: newElo })
    });
  } catch (e) {
    console.error("Chyba pri aktualizácii ELO:", e);
  }
}

async function registerPlayerResult(playerId, result, timeSpent = 0) {
  try {
    const players = await sbFetch(`players?id=eq.${playerId}&limit=1`);
    if (!players || !players.length) return;
    const player = players[0];
    const updates = {
      played: Number(player.played || 0) + 1,
      total_time: Number(player.total_time || 0) + Number(timeSpent || 0)
    };
    if (result === "win") {
      updates.solved = Number(player.solved || 0) + 1;
    }
    await sbFetch(`players?id=eq.${playerId}`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    });
  } catch (e) {
    console.error("Chyba pri ukladaní výsledku hráča:", e);
  }
}

function getPlayerSuccessRate(player) {
  const played = Number(player?.played || 0);
  const solved = Number(player?.solved || 0);
  if (!played) return 0;
  return Math.round((solved / played) * 100);
}

async function deletePlayer(playerId) {
  try {
    await sbFetch(`training_log?player_id=eq.${playerId}`, { method: "DELETE" });
    await sbFetch(`players?id=eq.${playerId}`, { method: "DELETE" });
    const currentId = localStorage.getItem("currentPlayer");
    if (currentId == playerId) localStorage.removeItem("currentPlayer");
  } catch (e) {
    console.error("Chyba pri mazaní hráča:", e);
    alert("Chyba pri mazaní hráča: " + e.message);
  }
}
