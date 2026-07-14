// SUPABASE_URL a SUPABASE_KEY sú definované v auth.js

const CURRENT_KEY = "currentPlayer";

async function sbFetch(path, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  // Použi access token prihláseného používateľa ak je dostupný,
  // inak fall-back na anon kľúč (pre verejné dotazy)
  let authToken = SUPABASE_KEY;
  try {
    // POZOR: klient sa vola sbClient (definovany v auth.js), nie sb.
    // Povodne tu bolo sb.auth.getSession() - objekt sb ale na strankach
    // neexistuje, ReferenceError sa ticho odchytil a vsetky poziadavky
    // odchadzali s verejnym klucom namiesto tokenu prihlaseneho hraca.
    const { data } = await sbClient.auth.getSession();
    if (data?.session?.access_token) authToken = data.session.access_token;
  } catch(e) {}
  const res = await fetch(url, {
    ...options,
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": `Bearer ${authToken}`,
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
  if (mode === "taktika")   return "elo_taktika";
  if (mode === "strategia") return "elo_strategia";
  if (mode === "koncovka")  return "elo_koncovka";
  if (mode === "zrucnosti") return "elo_zrucnosti";
  return "elo";
}

function getPlayerEloByMode(player, mode) {
  return Number(player[getEloField(mode)] || 1500);
}

// Mapovanie mode → kategória pre elo_history
function getEloCategory(mode) {
  if (mode === "taktika")  return "taktika";
  if (mode === "strategia") return "strategia";
  if (mode === "koncovka") return "koncovka";
  if (mode === "zrucnosti") return "zrucnosti";
  return "mix";
}

// ─── ELO história ───────────────────────────────────────────────────────────

async function logEloHistory(playerId, mode, newElo) {
  try {
    await sbFetch("elo_history", {
      method: "POST",
      prefer: "return=minimal",
      body: JSON.stringify({
        player_id: playerId,
        category:  getEloCategory(mode),
        elo_value: newElo
      })
    });
  } catch (e) {
    // Neblokuje tréning — len tiché varovanie
    console.warn("ELO história sa neuložila:", e);
  }
}

// ─── Tréneri ────────────────────────────────────────────────────────────────

async function getTrainers() {
  try {
    const data = await sbFetch(
      "profiles?role=eq.trener&select=id,name,surname,nick_name&order=surname.asc"
    );
    return data || [];
  } catch (e) {
    console.error("Chyba pri načítaní trénerov:", e);
    return [];
  }
}

// ─── Hráči ──────────────────────────────────────────────────────────────────

// trenerFilter: UUID trénera — ak zadané, načíta len jeho hráčov
async function loadPlayers(trenerFilter = null) {
  try {
    let query = "players?order=surname.asc,name.asc";
    if (trenerFilter) {
      query += `&trener_id=eq.${trenerFilter}`;
    }
    const data = await sbFetch(query);
    return data || [];
  } catch (e) {
    console.error("Chyba pri načítaní hráčov:", e);
    return [];
  }
}

// trenerId: UUID trénera, ktorý hráča vytvára (alebo null)
async function createPlayer(name, surname = '', email = '', elo = 1500, trenerId = null) {
  const newPlayer = {
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
  if (trenerId) {
    newPlayer.trener_id = trenerId;
  }
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
  const userId = sessionStorage.getItem('user_id');
  const userEmail = sessionStorage.getItem('user_email');

  // 1. Hľadaj podľa user_id (správna cesta)
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

    // 2. Fallback: hľadaj podľa emailu (pre existujúcich používateľov bez user_id)
    if (userEmail) {
      try {
        const data = await sbFetch(`players?email=eq.${userEmail}&limit=1`);
        if (data && data.length) {
          const player = data[0];
          localStorage.setItem(CURRENT_KEY, player.id);

          // Automaticky oprav chýbajúci user_id v DB pre budúce prihlásenia
          try {
            await sbFetch(`players?id=eq.${player.id}`, {
              method: "PATCH",
              body: JSON.stringify({ user_id: userId })
            });
          } catch (e) {
            console.warn("Nepodarilo sa aktualizovať user_id:", e);
          }

          return player;
        }
      } catch (e) {
        console.error("Chyba pri načítaní hráča podľa emailu:", e);
      }
    }
  }

  // 3. Posledný fallback: localStorage (manuálne vybraný hráč)
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

    // Zaloguj novú ELO hodnotu do histórie pre grafy
    await logEloHistory(playerId, mode, newElo);
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
