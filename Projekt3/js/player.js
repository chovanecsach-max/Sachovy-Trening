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

// Zručnosti, ktoré majú v tabuľke players vlastný ELO stĺpec (elo_<typ>).
// Musí sedieť s hodnotami skill_type v tabuľke skill_puzzles.
const SKILL_ELO_TYPES = [
  'checks', 'captures', 'pawn_breakthrough', 'direct_attack',
  'underdefended', 'pin', 'relative_pin', 'fork', 'direct_threat'
];

// Názov ELO stĺpca pre konkrétnu zručnosť; neznáme typy (napr. staršie
// kombinované 'checks_captures') spadnú na spoločné elo_zrucnosti.
function getSkillEloField(skillType) {
  return SKILL_ELO_TYPES.includes(skillType) ? 'elo_' + skillType : 'elo_zrucnosti';
}

function getEloField(mode) {
  if (mode === "taktika")   return "elo_taktika";
  if (mode === "strategia") return "elo_strategia";
  if (mode === "koncovka")  return "elo_koncovka";
  if (mode === "zrucnosti") return "elo_zrucnosti";
  if (SKILL_ELO_TYPES.includes(mode)) return "elo_" + mode;
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
  if (SKILL_ELO_TYPES.includes(mode)) return mode;   // vlastná kategória zručnosti
  return "mix";
}

// ─── Hlásenie tichých zlyhaní zápisu ────────────────────────────────────────
// Niektoré zápisy (napr. ELO história) zámerne neblokujú tréning — keď zlyhajú,
// hráč nič nespozoruje. Bez záznamu sa taká chyba hľadá veľmi ťažko (presne to
// nastalo pri CHECK obmedzení na elo_history.category, ktoré ticho odmietalo
// nové kategórie zručností). Preto sa zlyhanie zapíše aj do error_log.
// Samotné hlásenie nesmie nikdy zhodiť tréning ani zahltiť tabuľku, preto je
// celé v try/catch a obmedzené na 3 hlásenia na jedno načítanie stránky.
let __plyReportCount = 0;

async function reportPlayerError(context, err) {
  try {
    if (__plyReportCount >= 3) return;
    __plyReportCount++;

    let token = SUPABASE_KEY;
    try {
      const { data } = await sbClient.auth.getSession();
      if (data?.session?.access_token) token = data.session.access_token;
    } catch (e) {}

    let userId = null;
    try { userId = sessionStorage.getItem('user_id') || null; } catch (e) {}

    await fetch(`${SUPABASE_URL}/rest/v1/error_log`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        user_id: userId,
        page: (location.pathname || '').slice(0, 200),
        message: ('[player] ' + context + ': ' + (err && err.message ? err.message : String(err || ''))).slice(0, 2000),
        stack: String((err && err.stack) || '').slice(0, 4000),
        user_agent: (navigator.userAgent || '').slice(0, 300)
      })
    });
  } catch (e) { /* hlásenie chyby nesmie samo zlyhať nahlas */ }
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
    // Neblokuje tréning, ale chybu už nenecháme zmiznúť — zapíše sa do error_log
    console.warn("ELO história sa neuložila:", e);
    reportPlayerError(`elo_history zápis zlyhal (kategória: ${getEloCategory(mode)})`, e);
  }
}

// ─── Pokrok zadaní ──────────────────────────────────────────────────────────
// Zadanie sa plní LEN úlohami vyriešenými na prvý pokus po jeho zadaní.
// Preto sa načítavajú aj neúspechy — bez nich sa nedá odlíšiť „vyriešil hneď"
// od „najprv pokazil a potom to dal na druhý raz". Rozhodujúci je prvý záznam
// o danej úlohe po dátume zadania; staršie neúspechy sa proti hráčovi nerátajú,
// takže úloha vrátená do výberu po RETRY_AFTER_DAYS má plnú hodnotu.

const BASIC_ASSIGNMENT_CATEGORY = {
  taktika:   'Taktika',
  strategia: 'Strategia',
  koncovka:  'Koncovka'
};

// Záznamy z training_log (výhry aj prehry) pre daných hráčov od zadaného času
async function loadAssignmentLog(playerIds, fromISO) {
  const ids = [...new Set(playerIds)].filter(Boolean).join(',');
  if (!ids) return [];
  const PAGE = 1000;
  let all = [], off = 0;
  while (true) {
    const batch = await sbFetch(
      `training_log?player_id=in.(${ids})&created_at=gte.${fromISO}` +
      `&select=player_id,puzzle_id,source,result,created_at` +
      `&order=created_at.asc,id.asc&limit=${PAGE}&offset=${off}`
    );
    if (!batch || !batch.length) break;
    all = all.concat(batch);
    if (batch.length < PAGE) break;
    off += PAGE;
  }
  return all;
}

// Kategórie úloh — doťahujú sa len pre id, ktoré sa v logu naozaj vyskytli.
// POZOR: puzzles.id a skill_puzzles.id sa prekrývajú, preto dve oddelené mapy.
async function loadAssignmentPuzzleMeta(logRows) {
  const meta = { puzzles: new Map(), skills: new Map() };
  const idsOf = src => [...new Set((logRows || [])
    .filter(r => r.source === src && r.puzzle_id != null)
    .map(r => r.puzzle_id))];

  async function fetchByIds(table, ids, select, onRow) {
    const BATCH = 300;   // krátke URL, aby dotaz neprekročil limit dĺžky
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      try {
        const rows = await sbFetch(`${table}?id=in.(${chunk.join(',')})&select=${select}`) || [];
        rows.forEach(onRow);
      } catch (e) {
        console.error(`Načítanie kategórií z ${table} zlyhalo:`, e);
      }
    }
  }

  await fetchByIds('puzzles', idsOf('puzzles'), 'id,category,endgame_type',
    p => meta.puzzles.set(p.id, p));
  await fetchByIds('skill_puzzles', idsOf('skill_puzzles'), 'id,skill_type',
    p => meta.skills.set(p.id, p.skill_type));

  return meta;
}

// Počet úloh vyriešených na prvý pokus po zadaní.
// logRows musia byť zoradené vzostupne podľa created_at (tak ich vracia
// loadAssignmentLog) — prvý nájdený záznam o úlohe je ten rozhodujúci.
function countFirstAttemptWins(logRows, assignment, meta) {
  const since        = new Date(assignment.created_at);
  const wantEndgame  = assignment.endgame_type || null;
  const wantCategory = BASIC_ASSIGNMENT_CATEGORY[assignment.skill] || null;

  const firstByPuzzle = new Map();

  for (const r of (logRows || [])) {
    // Ak zadanie nesie player_id (trénerský prehľad), filtruj podľa hráča
    if (assignment.player_id && r.player_id !== assignment.player_id) continue;
    if (new Date(r.created_at) < since) continue;

    if (wantEndgame) {
      if (r.source !== 'puzzles') continue;
      const p = meta.puzzles.get(r.puzzle_id);
      if (!p || (p.endgame_type || 'Neklasifikované') !== wantEndgame) continue;
    } else if (wantCategory) {
      if (r.source !== 'puzzles') continue;
      const p = meta.puzzles.get(r.puzzle_id);
      if (!p || p.category !== wantCategory) continue;
    } else {
      if (r.source !== 'skill_puzzles') continue;
      if (meta.skills.get(r.puzzle_id) !== assignment.skill) continue;
    }

    const key = r.source + ':' + r.puzzle_id;
    if (!firstByPuzzle.has(key)) firstByPuzzle.set(key, r);
  }

  let n = 0;
  firstByPuzzle.forEach(r => { if (r.result === 'win') n++; });
  return n;
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
    reportPlayerError(`aktualizácia ELO zlyhala (režim: ${mode})`, e);
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
    reportPlayerError("uloženie výsledku hráča zlyhalo", e);
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
