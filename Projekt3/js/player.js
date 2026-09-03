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
    if (data?.session?.access_token) {
      authToken = data.session.access_token;
      _poslednyToken = authToken;      // pre zápisy pri odchode zo stránky
    }
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

// ─── Dátumy v miestnom čase ─────────────────────────────────────────────────
// created_at je uložené v UTC. Keby sa deň bral ako prvých 10 znakov toho
// reťazca, tréning po polnoci bratislavského času (v lete UTC+2) by spadol do
// predchádzajúceho dňa. Tieto dve funkcie preto počítajú deň podľa časového
// pásma prehliadača — teda tak, ako ho vníma hráč aj tréner.
function localDay(ts) {
  const d = (ts instanceof Date) ? ts : new Date(ts ?? Date.now());
  if (isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString().substring(0, 10);
}

function todayLocal() {
  return localDay(new Date());
}

// ─── Ošetrenie textu pred vložením do HTML ──────────────────────────────────
// Mená, prezývky a poznámky pochádzajú od používateľov a vkladajú sa do stránok
// cez innerHTML. Bez ošetrenia by si hráč mohol nastaviť priezvisko na kód
// v HTML značke, ktorý by sa spustil v prehliadači trénera pri otvorení
// prehľadu — teda s jeho právami. Escapuje sa aj úvodzovka a apostrof, lebo
// tie isté hodnoty sa používajú aj v atribútoch (title, onclick).
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─── Zápis, ktorý prežije odchod zo stránky ─────────────────────────────────
// Pri zatvorení karty alebo obnovení stránky prehliadač bežné volania fetch
// zruší. Príznak keepalive ho necháva dobehnúť. Token sa nedá získať cez await
// (na to už nie je čas), preto sa používa ten posledný známy zo sbFetch.
let _poslednyToken = null;

function _sbOdchod(path, method, telo) {
  try {
    fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method: method,
      keepalive: true,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${_poslednyToken || SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(telo)
    });
  } catch (e) { /* pri odchode zo stránky sa už nedá nič robiť */ }
}

function sbZapisPriOdchode(path, telo)  { _sbOdchod(path, 'POST',  telo); }
function sbUpravPriOdchode(path, telo)  { _sbOdchod(path, 'PATCH', telo); }

// ─── Zápis výsledku tréningu ────────────────────────────────────────────────
// Jediná cesta, ktorou sa výsledok dostane do databázy. Nahrádza trojicu
// addTrainingResult + registerPlayerResult + updatePlayerElo.
//
// PREČO: tie tri volania boli tri samostatné zápisy z prehliadača, čo znamenalo
// dve veci. Po prvé, ELO si počítal prehliadač, takže sa dalo z konzoly zapísať
// čokoľvek (bod A1 auditu). Po druhé, šlo o čítaj-uprav-zapíš bez zámku: dve
// otvorené karty si výsledok navzájom prepísali a jeden tréning zmizol (bod B1).
//
// Serverová funkcia zapis_vysledok si silu úlohy načíta z databázy, spočíta nové
// ELO tým istým vzorcom ako eloZmena() nižšie a zapíše training_log, players aj
// elo_history v jednej transakcii so zamknutým riadkom hráča.
//
// VRACIA to, čo sa naozaj uložilo:
//   { zapisane, prvy_pokus, elo_pole, elo_stare, elo_nove, zmena,
//     elo_zrucnosti, kalib_pole, kalib_odohrane, kalib_zostava }
// Pri opakovanom riešení tej istej úlohy len { zapisane, prvy_pokus: false }.
// V prehliadači sa už ELO NEPREPOČÍTAVA — jediná pravda je táto odpoveď.
function _teloVysledku(d) {
  const cislo = (v, min) => (Number.isFinite(Number(v)) && Number(v) >= min)
                            ? Math.round(Number(v)) : null;
  return {
    p_puzzle_id:     Number(d.puzzleId),
    p_source:        d.source,                    // 'puzzles' | 'skill_puzzles'
    p_result:        d.result,                    // 'win' | 'loss'
    p_mode:          d.mode || null,              // taktika/strategia/koncovka/mix
    p_time_spent:    Math.max(0, Math.round(Number(d.timeSpent) || 0)),
    p_loss_reason:   d.result === 'loss' ? (d.lossReason || 'chyba') : null,
    p_wrong_move:    d.wrongMove || null,
    p_ply:           cislo(d.ply, 0),
    p_time_limit:    cislo(d.timeLimit, 1),
    p_first_move_ms: cislo(d.firstMoveMs, 0),
    p_proti_sebe:    !!d.protiSebe,               // komplexný tréning zručností
    // Ktoré riešenia hráč pri zručnostiach našiel sám, kým spravil chybu alebo
    // mu vypršal čas. Server zoznam ešte oreže (max 40 položiek po 5 znakov) —
    // ide o údaj z prehliadača. Klasický tréning ho neposiela, tam je null.
    p_found_list:    Array.isArray(d.foundList) ? d.foundList : null
  };
}

async function zapisVysledok(d) {
  try {
    return await sbFetch('rpc/zapis_vysledok', {
      method: 'POST',
      body: JSON.stringify(_teloVysledku(d))
    });
  } catch (e) {
    console.error('Zápis výsledku zlyhal:', e);
    reportPlayerError('zapis_vysledok zlyhal', e);
    return null;
  }
}

// Verzia pre odchod zo stránky (pagehide). Bežné volanie by prehliadač zrušil,
// preto ide cez keepalive. Odpoveď sa už nedá prečítať — a netreba, hráč
// stránku opúšťa.
function zapisVysledokPriOdchode(d) {
  _sbOdchod('rpc/zapis_vysledok', 'POST', _teloVysledku(d));
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

// Náhradná hodnota, keď hráč nemá ELO vyplnené (NULL alebo 0 v databáze).
// MUSÍ byť jedna pre celý projekt: predtým sa líšila podľa obrazovky —
// tréning bral 1500, rebríček na úvodnej stránke 1000 — a tá istá hodnota
// tak vyzerala na dvoch miestach inak. Od resetu 1. 9. 2026 je to 1000:
// rovnako ako predvolená hodnota všetkých ELO stĺpcov v databáze.
const ELO_DEFAULT = 1000;

function eloHodnota(v) {
  const n = Number(v);
  return (Number.isFinite(n) && n > 0) ? n : ELO_DEFAULT;
}

function getPlayerEloByMode(player, mode) {
  return eloHodnota(player[getEloField(mode)]);
}

// ─── Priemerné ELO zručností ────────────────────────────────────────────────
// elo_zrucnosti sa už nepočíta samostatne — je to odvodený priemer z deviatich
// zručností. Zapisuje sa doňho po každej zmene ktorejkoľvek zručnosti, takže
// rebríček, report, štatistika aj pohľad rebricek môžu čítať ten istý stĺpec
// ako doteraz. Prázdne hodnoty sa do priemeru nezapočítavajú.
// POZOR: ak niekedy pridáš novú zručnosť, pridaj ju do SKILL_ELO_TYPES vyššie
// a do pohľadu rebricek — inak sa do priemeru nedostane.
function priemerZrucnosti(playerRow) {
  const hodnoty = SKILL_ELO_TYPES
    .map(t => Number(playerRow['elo_' + t]))
    .filter(v => Number.isFinite(v) && v > 0);
  if (!hodnoty.length) return null;
  return Math.round(hodnoty.reduce((a, b) => a + b, 0) / hodnoty.length);
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

// ─── Zmena ELO po vyriešení úlohy ───────────────────────────────────────────
// Jediné miesto, kde je vzorec. Predtým bol na troch miestach v podobe
//     zmena = win ? 10 + rozdiel/50 : -(10 - rozdiel/50)
// ktorá sa pri veľkom rozdiele preklopila: prehra na úlohe o viac než 500
// bodov ťažšej hráčovi ELO PRIPÍSALA a výhra na úlohe o 600 bodov ľahšej ho
// ubrala. Tu je štandardný Elo vzorec, ktorý je monotónny už svojou povahou —
// výhra nikdy neuberie a prehra nikdy nepridá.
// K = 20 zachováva pôvodné správanie pri rovnakej sile: ±10 bodov.
const ELO_K = 20;

// ─── Kalibrácia ELO ─────────────────────────────────────────────────────────
// Nový hráč začína na 1000. Pri bežnom K=20 by sa hráč so silou 1600 dostával
// na svoju úroveň stovky úloh a celý ten čas by riešil neprimerane ľahké
// pozície. Prvých pár úloh sa preto počíta s vyšším K.
//
// Prečo vyššie K, a nie pevných ±100: vzorec zohľadní aj to, AKÚ ťažkú úlohu
// hráč vyriešil. Výhra nad úlohou 1000 dá menej než výhra nad úlohou 1400 —
// presne tá informácia, ktorú pri hľadaní úrovne potrebujeme.
//
// Týka sa LEN klasického tréningu vrátane mixu. Zručnosti majú vlastnú
// stupnicu a základ 1200, tie kalibráciou neprechádzajú.
// Stupne overené simuláciou (600 priebehov na variant). Hráč so skutočnou
// silou 1600 sa po 10 úlohách dostane na ~1434 namiesto 1092 bez kalibrácie;
// začiatočník na 1000 zostane na 1000, kalibrácia mu neublíži.
// Mierne stupne (5×100, 5×50) sa ukázali ako prislabé — po 10 úlohách len 1314.
const KALIB_STUPNE = [
  { do: 5,  k: 150 },   // prvých 5 úloh — najväčšie skoky
  { do: 10, k: 80  },   // ďalších 5
  { do: 15, k: 40  },   // dojazd, potom už bežné ELO_K = 20
];
const KALIB_MIN_ELO = 800;   // spodná hranica, pod ktorú kalibrácia nespadne

// Mix má vlastný stĺpec elo a vyberá úlohy podľa neho rovnako ako ostatné
// režimy — jediný rozdiel je, že sa hráčovi skryje kategória. Na kalibráciu to
// nemá vplyv, preto ju má tiež. Zručnosti majú vlastnú stupnicu a základ 1200,
// tie sem nepatria.
const KALIB_POLIA = {
  taktika:   'kalib_taktika',
  strategia: 'kalib_strategia',
  koncovka:  'kalib_koncovka',
  mix:       'kalib_mix',
};

function kalibPole(mode) { return KALIB_POLIA[mode] || null; }

// Aké K platí pri danom počte odohraných kalibračných úloh.
// null = kalibrácia skončila, platí bežný vzorec.
function kalibK(odohranych) {
  const n = Number(odohranych) || 0;
  for (const stupen of KALIB_STUPNE) if (n < stupen.do) return stupen.k;
  return null;
}

// Koľko kalibračných úloh ešte zostáva (na hlášku pre hráča)
function kalibZostava(odohranych) {
  const n = Number(odohranych) || 0;
  return Math.max(0, KALIB_STUPNE[KALIB_STUPNE.length - 1].do - n);
}

// kValue: nepovinné. Bez neho platí bežné ELO_K; kalibrácia posiela vyššie.
function eloZmena(hracElo, ulohaElo, result, kValue) {
  const h = Number(hracElo);
  const u = Number(ulohaElo);
  if (!Number.isFinite(h) || !Number.isFinite(u)) return 0;
  // očakávaný výsledok hráča proti úlohe danej sily (0 až 1)
  const ocakavane = 1 / (1 + Math.pow(10, (u - h) / 400));
  const skutocne  = result === 'win' ? 1 : 0;
  const K = (Number.isFinite(Number(kValue)) && Number(kValue) > 0)
            ? Number(kValue) : ELO_K;
  const zmena = K * (skutocne - ocakavane);
  // aby aj pri extrémnom rozdiele nebola zmena nulová a smer bol vždy jasný
  return result === 'win' ? Math.max(1, Math.round(zmena))
                          : Math.min(-1, Math.round(zmena));
}

// ─── Časový limit pri zručnostiach ──────────────────────────────────────────
// Čas nie je vlastnosťou úlohy, ale dôsledkom úrovne hráča:
//     limit = základ + počet_riešení × bonus
// Aby pozícia s ôsmimi šachmi nemala rovnaký čas ako pozícia s jedným.
// Úroveň sa určí podľa ELA hráča V DANEJ ZRUČNOSTI — hranica je horná, teda
// „do 1200" znamená 1200 a menej. Posledná úroveň platí pre všetko nad ňou.
// Riadok = [horná hranica ELA, základ v sekundách, bonus za jedno riešenie].
// Uvedené hranice zodpovedajú metodickej tabuľke piatich úrovní; posledná má
// hranicu Infinity, jej menovité ELO je v komentári.
const SKILL_TIME_TABLE = {
  checks:            [[1200, 15, 10], [1400, 15, 5], [1600, 10, 5], [1800, 10, 3], [Infinity,  6, 2]], // 5. úroveň 2000
  captures:          [[1250, 15, 10], [1450, 15, 5], [1650, 10, 5], [1850, 10, 3], [Infinity,  6, 2]], // 2000
  pawn_breakthrough: [[1200, 15, 10], [1400, 15, 5], [1600, 10, 5], [1800, 10, 3], [Infinity,  6, 2]], // 2000
  direct_attack:     [[1250, 15, 10], [1450, 15, 5], [1650, 10, 5], [1850, 10, 3], [Infinity,  6, 2]], // 2000
  underdefended:     [[1300, 20, 10], [1500, 20, 5], [1700, 10, 5], [1900, 10, 3], [Infinity,  6, 2]], // 2000
  pin:               [[1250, 15, 10], [1450, 15, 5], [1650, 15, 5], [1850, 10, 3], [Infinity,  6, 2]], // 2000
  relative_pin:      [[1400, 30, 10], [1600, 30, 5], [1800, 30, 5], [2000, 20, 3], [Infinity, 10, 3]], // 2100
  fork:              [[1500, 60, 10], [1700, 60, 5], [1900, 40, 5], [2100, 30, 3], [Infinity, 15, 3]], // 2200
  direct_threat:     [[1400, 60, 10], [1600, 60, 5], [1800, 40, 5], [2000, 30, 3], [Infinity, 15, 3]]  // 2200
};

// Vráti limit v sekundách, alebo null pri neznámej zručnosti (vtedy sa použije
// pôvodný čas uložený v úlohe).
function skillTimeLimit(skillType, playerElo, pocetRieseni) {
  const tabulka = SKILL_TIME_TABLE[skillType];
  if (!tabulka) return null;
  const elo = Number(playerElo);
  const n = Math.max(1, Number(pocetRieseni) || 1);
  const riadok = tabulka.find(r => (Number.isFinite(elo) ? elo : 1200) <= r[0])
              || tabulka[tabulka.length - 1];
  return Math.max(5, Math.round(riadok[1] + n * riadok[2]));
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

// ZASTARANÉ — riadok do elo_history pridáva zapis_vysledok. Politika
// insert_own_elo_history bola zrušená (krok 6), takže priamy POST skončí 403.
function logEloHistory() {
  throw new Error('logEloHistory je zrušená — elo_history zapisuje zapis_vysledok()');
}

// ─── Zadania a súťaže ───────────────────────────────────────────────────────

// Prevod režimu na kategóriu úlohy. Zadanie aj súťaž nesú režim malými
// písmenami ('taktika'), kým puzzles.category je uložená s veľkým začiatočným
// ('Taktika') — bez tohto prevodu by sa nespárovala ani jedna úloha.
//
// POZOR: musí byť TU, v player.js, nie na jednotlivých stránkach. Používajú ju
// tri funkcie nižšie (countFirstAttemptWins, countFirstWinsByPlayer,
// sutazRozpis) a keď ju stránka nedoniesla, spadla celá na
// „BASIC_ASSIGNMENT_CATEGORY is not defined" — presne to sa dialo na
// zadania-prehlad.html. Komentár v sutaze.html na ňu odkazoval ako na súčasť
// player.js, len sa sem nikdy nedopísala.
//
// Zručnosti sem nepatria: tie sa nepoznávajú podľa kategórie, ale podľa
// skill_type v skill_puzzles, a v tých funkciách sa vetví práve tým, že
// prevod pre daný kľúč neexistuje (vráti null).
const BASIC_ASSIGNMENT_CATEGORY = {
  taktika:   'Taktika',
  strategia: 'Strategia',
  koncovka:  'Koncovka'
};

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

// ─── Výsledky súťaží ────────────────────────────────────────────────────────
// Počet úloh vyriešených NA PRVÝ POKUS v danom období, po hráčoch.
// Rovnaké pravidlo ako pri zadaniach (countFirstAttemptWins) — bez neho by sa
// súťaž dala vyhrať opakovaním tej istej úlohy. Rozdiel je len v tom, že tu
// je obdobie ohraničené z oboch strán a počíta sa naraz pre celú skupinu.
//
// kategoria: 'taktika' | 'strategia' | 'koncovka' (klasický tréning)
//            alebo skill_type ('checks', 'fork', …) pre zručnosti
function countFirstWinsByPlayer(logRows, kategoria, odISO, doISO, meta) {
  const od = new Date(odISO).getTime();
  const doo = new Date(doISO).getTime();
  const wantCategory = BASIC_ASSIGNMENT_CATEGORY[kategoria] || null;

  const prvyPokus = new Map();     // 'player:source:puzzle' → riadok

  for (const r of (logRows || [])) {
    const t = new Date(r.created_at).getTime();
    if (isNaN(t) || t < od || t > doo) continue;

    if (wantCategory) {
      if (r.source !== 'puzzles') continue;
      const p = meta.puzzles.get(r.puzzle_id);
      if (!p || p.category !== wantCategory) continue;
    } else {
      if (r.source !== 'skill_puzzles') continue;
      if (meta.skills.get(r.puzzle_id) !== kategoria) continue;
    }

    const key = r.player_id + ':' + r.source + ':' + r.puzzle_id;
    if (!prvyPokus.has(key)) prvyPokus.set(key, r);
  }

  const podlaHraca = new Map();
  prvyPokus.forEach(r => {
    if (r.result !== 'win') return;
    podlaHraca.set(r.player_id, (podlaHraca.get(r.player_id) || 0) + 1);
  });
  return podlaHraca;
}

// Rozpis pokusov jedného hráča v období súťaže — pre každú úlohu, ktorej sa
// dotkol, hovorí, či sa započítala a prečo prípadne nie. Slúži na to, aby sa
// hráč nemusel pýtať „prečo mi to nepribudlo".
//
// Vracia pole { puzzle_id, source, cas, zapocitane, dovod } zoradené od
// najnovšieho pokusu.
function sutazRozpis(logRows, kategoria, odISO, doISO, meta, playerId) {
  const od  = new Date(odISO).getTime();
  const doo = new Date(doISO).getTime();
  const wantCategory = BASIC_ASSIGNMENT_CATEGORY[kategoria] || null;

  // Zoradiť od najstaršieho — o započítaní rozhoduje PRVÝ pokus o úlohu
  const riadky = (logRows || [])
    .filter(r => r.player_id === playerId)
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  const videne = new Map();      // 'source:puzzle' → poradie pokusu
  const vysledok = [];

  for (const r of riadky) {
    const t = new Date(r.created_at).getTime();
    if (isNaN(t) || t < od || t > doo) continue;

    // patrí úloha do súťažnej kategórie?
    let patri = false;
    if (wantCategory) {
      const p = r.source === 'puzzles' ? meta.puzzles.get(r.puzzle_id) : null;
      patri = !!(p && p.category === wantCategory);
    } else {
      patri = r.source === 'skill_puzzles' && meta.skills.get(r.puzzle_id) === kategoria;
    }
    if (!patri) continue;        // iná kategória sa v rozpise vôbec neukazuje

    const key = r.source + ':' + r.puzzle_id;
    const poradie = (videne.get(key) || 0) + 1;
    videne.set(key, poradie);

    let zapocitane = false, dovod = '';
    if (poradie > 1) {
      dovod = 'opakovanie tej istej úlohy';
    } else if (r.result !== 'win') {
      dovod = 'úloha nebola vyriešená';
    } else {
      zapocitane = true;
    }
    vysledok.push({
      puzzle_id: r.puzzle_id, source: r.source,
      cas: r.created_at, zapocitane, dovod
    });
  }

  return vysledok.reverse();     // najnovšie hore
}

// ELO stĺpec pre kategóriu súťaže
function sutazEloStlpec(kategoria) {
  if (kategoria === 'taktika')   return 'elo_taktika';
  if (kategoria === 'strategia') return 'elo_strategia';
  if (kategoria === 'koncovka')  return 'elo_koncovka';
  return 'elo_' + kategoria;
}

// ─── Tréneri ────────────────────────────────────────────────────────────────

// Číta z pohľadu trainers_public (len meno a prezývka trénerov), nie z tabuľky
// profiles — tá je od kroku 2b zavretá pre neprihlásených.
async function getTrainers() {
  try {
    const data = await sbFetch(
      "trainers_public?select=id,name,surname,nick_name&order=surname.asc"
    );
    return data || [];
  } catch (e) {
    console.error("Chyba pri načítaní trénerov:", e);
    return [];
  }
}

// ─── Režim údržby a prítomnosť ──────────────────────────────────────────────
// Pri nasadzovaní zmien treba hráčov na chvíľu odstaviť. Dôvod nie je len
// pohodlie: hráč, ktorý má stránku otvorenú spred nasadenia, beží na STAREJ
// verzii kódu a jeho zápis môže po zmene schémy zlyhať alebo uložiť nezmysel.
//
// Admin a hlavný tréner cez údržbu prejdú — musia si overiť, že všetko beží,
// skôr než ju vypnú.

let _udrzbaCache = null;

async function jeUdrzba() {
  try {
    const rows = await sbFetch("nastavenia?kluc=in.(udrzba,udrzba_text)&select=kluc,hodnota");
    const m = {};
    (rows || []).forEach(r => { m[r.kluc] = r.hodnota; });
    _udrzbaCache = { zapnuta: m.udrzba === 'on', text: m.udrzba_text || '' };
  } catch (e) {
    // Výpadok siete nie je dôvod odstaviť hráča
    _udrzbaCache = { zapnuta: false, text: '' };
  }
  return _udrzbaCache;
}

// Zastaví stránku, ak prebieha údržba. Vráti true, ak sa má pokračovať.
async function vyzadujBezUdrzby() {
  const rola = sessionStorage.getItem('user_role') || '';
  if (rola === 'admin' || rola === 'hlavny_trener') return true;

  const u = await jeUdrzba();
  if (!u.zapnuta) return true;

  document.body.innerHTML =
    '<div style="max-width:540px;margin:60px auto;padding:28px;background:#fff;'
    + 'border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.08);'
    + 'font-family:Arial,sans-serif;text-align:center;color:#111827;">'
    + '<div style="font-size:44px;margin-bottom:10px;">🔧</div>'
    + '<h2 style="margin:0 0 12px;color:#92400e;">Prebieha údržba</h2>'
    + '<p style="color:#475569;font-size:15px;line-height:1.55;">'
    + (u.text ? escapeHtml(u.text)
              : 'Pracujeme na vylepšeniach tréningového programu. '
              + 'Skús sa prihlásiť o chvíľu — zvyčajne to netrvá dlho.')
    + '</p>'
    + '<button onclick="location.reload()" style="margin-top:16px;padding:11px 22px;'
    + 'border:none;border-radius:10px;background:#1e3a5f;color:#fff;font-size:14px;'
    + 'font-weight:bold;cursor:pointer;">Skúsiť znova</button></div>';
  return false;
}

// Značka „som tu" — raz za minútu. Slúži adminovi na prehľad pred nasadením.
// Presné to byť nemôže: keď hráč zavrie kartu, server sa to nedozvie, preto sa
// za prítomného počíta ten, kto sa ozval za posledné 2 minúty.
let _pritomnostTimer = null;

function hlasPritomnost(stranka) {
  const userId = sessionStorage.getItem('user_id');
  if (!userId) return;
  const posli = () => {
    sbFetch('pritomnost', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates,return=minimal',
      body: JSON.stringify({
        user_id: userId,
        posledny: new Date().toISOString(),
        stranka: stranka || (location.pathname.split('/').pop() || 'index.html')
      })
    }).catch(() => {});   // prehľad nie je dôvod rušiť tréning
  };
  posli();
  if (_pritomnostTimer) clearInterval(_pritomnostTimer);
  _pritomnostTimer = setInterval(posli, 60000);
}

// ─── Platnosť prístupu ──────────────────────────────────────────────────────
// POZOR: doteraz sa platnosť len ZOBRAZOVALA v pruhu na úvodnej stránke a nikde
// sa nevynucovala. Hráč s vypršaným prístupom mohol pokojne trénovať ďalej —
// a na mobile, kde sa cez skratku v aplikácii ide rovno do tréningu, neuvidel
// ani ten oznam.
//
// Vracia { platny, valid_to, dni } — dni sú záporné, ak už vypršala.
// Admin a hlavný tréner majú prístup neobmedzený.
async function overPlatnost() {
  const rola = sessionStorage.getItem('user_role') || '';
  if (rola === 'admin' || rola === 'hlavny_trener') {
    return { platny: true, valid_to: null, dni: null };
  }
  const userId = sessionStorage.getItem('user_id');
  if (!userId) return { platny: false, valid_to: null, dni: null };

  try {
    const rows = await sbFetch(`profiles?id=eq.${userId}&select=valid_to&limit=1`);
    const validTo = rows && rows[0] && rows[0].valid_to;
    if (!validTo) return { platny: true, valid_to: null, dni: null };  // bez obmedzenia

    const dni = Math.ceil((new Date(validTo) - new Date()) / 86400000);
    return { platny: dni > 0, valid_to: validTo, dni };
  } catch (e) {
    // Pri výpadku siete hráča nevyhadzujeme — chyba spojenia nie je dôvod
    // odopierať prístup. Kontrola prebehne pri ďalšom načítaní stránky.
    console.warn('Platnosť sa nepodarilo overiť:', e);
    return { platny: true, valid_to: null, dni: null };
  }
}

// Zastaví stránku, ak prístup vypršal. Vráti true, ak sa má pokračovať.
async function vyzadujPlatnost() {
  const p = await overPlatnost();
  if (p.platny) return true;

  const datum = p.valid_to ? new Date(p.valid_to).toLocaleDateString('sk-SK') : '';
  document.body.innerHTML =
    '<div style="max-width:520px;margin:60px auto;padding:26px;background:#fff;'
    + 'border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.08);'
    + 'font-family:Arial,sans-serif;text-align:center;color:#111827;">'
    + '<div style="font-size:40px;margin-bottom:10px;">⏳</div>'
    + '<h2 style="margin:0 0 10px;color:#b91c1c;">Platnosť prístupu vypršala</h2>'
    + '<p style="color:#475569;font-size:15px;line-height:1.5;">'
    + (datum ? `Tvoj prístup skončil <strong>${datum}</strong>. ` : '')
    + 'Pre pokračovanie v tréningu kontaktuj svojho trénera.</p>'
    + '<button onclick="location.href=\'index.html\'" style="margin-top:14px;padding:11px 20px;'
    + 'border:none;border-radius:10px;background:#1e3a5f;color:#fff;font-size:14px;'
    + 'font-weight:bold;cursor:pointer;">Späť na úvod</button></div>';
  return false;
}

// ─── Prístup k skupinám ─────────────────────────────────────────────────────
// Skupina = tréner. Bežný tréner vidí svojich hráčov; skupinový tréner má
// v tabuľke trener_pristup pridelené aj skupiny iných trénerov. Admin a hlavný
// tréner vidia všetko.
//
// POZOR: je to obmedzenie ZOBRAZENIA, nie bezpečnostná hranica. RLS na players
// dovoľuje čítať všetkých hráčov každému z personálu (politika staff_read_players),
// takže tréner sa k cudzím dátam vie dostať aj tak. Na filtrovanie zoznamov to
// stačí; keby to malo byť skutočné obmedzenie, musí sa sprísniť RLS.

let _skupinyCache = null;

// Vráti pole UUID trénerov, ktorých hráčov smie prihlásený vidieť.
// null znamená BEZ OBMEDZENIA (admin, hlavný tréner).
async function viditelneSkupiny() {
  if (_skupinyCache !== null) return _skupinyCache;

  const rola = sessionStorage.getItem('user_role') || '';
  const ja   = sessionStorage.getItem('user_id') || '';

  if (rola === 'admin' || rola === 'hlavny_trener') {
    _skupinyCache = null;
    return null;
  }
  if (rola !== 'trener') {          // hráč sem nemá čo prísť
    _skupinyCache = [];
    return [];
  }

  const skupiny = [ja];             // vlastná skupina vždy
  try {
    const rows = await sbFetch(`trener_pristup?trener_id=eq.${ja}&select=skupina_id`) || [];
    rows.forEach(r => { if (r.skupina_id && !skupiny.includes(r.skupina_id)) skupiny.push(r.skupina_id); });
  } catch (e) {
    console.warn('Pridelené skupiny sa nenačítali:', e);
  }
  _skupinyCache = skupiny;
  return skupiny;
}

// Doplní do PostgREST dotazu obmedzenie na dané skupiny.
// skupiny = null → bez obmedzenia; jedna → eq; viac → in
function filterSkupiny(query, skupiny) {
  if (!skupiny) return query;
  if (skupiny.length === 1) return query + `&trener_id=eq.${skupiny[0]}`;
  return query + `&trener_id=in.(${skupiny.join(',')})`;
}

// Naplní rozbaľovací zoznam skupín podľa toho, čo smie prihlásený vidieť.
// Vráti true, ak sa má výber vôbec zobraziť (má zmysel pri dvoch a viac).
async function naplnVyberSkupin(selectEl, popisVsetky = 'Všetci moji hráči') {
  if (!selectEl) return false;
  const skupiny = await viditelneSkupiny();
  let treneri = [];
  try {
    treneri = await sbFetch('profiles?role=eq.trener&select=id,name,surname,nick_name&order=surname.asc') || [];
  } catch (e) {}

  const zoznam = (skupiny === null) ? treneri : treneri.filter(t => skupiny.includes(t.id));

  selectEl.innerHTML = '';
  const vsetko = document.createElement('option');
  vsetko.value = 'all';
  vsetko.textContent = (skupiny === null) ? 'Všetci hráči' : popisVsetky;
  selectEl.appendChild(vsetko);

  zoznam.forEach(t => {
    const o = document.createElement('option');
    o.value = t.id;
    o.textContent = t.nick_name || `${t.surname || ''} ${t.name || ''}`.trim();
    selectEl.appendChild(o);
  });

  // Pri jedinej skupine je výber zbytočný
  return (skupiny === null) || zoznam.length > 1;
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

// ZASTARANÉ — hráča zakladá edge funkcia admin-create-player (z admin.html)
// alebo verify.html pri overení e-mailu. Táto funkcia nastavovala len štyri
// staré ELO stĺpce, takže by hráčovi chýbalo deväť zručností.
function createPlayer() {
  throw new Error('createPlayer je zrušená — hráča zakladá admin-create-player alebo verify.html');
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
      // order=id.asc je dôležité: zapis_vysledok berie „order by id limit 1".
      // Bez rovnakého poradia by sa pri dvoch záznamoch na jedno konto
      // zapisovalo do jedného riadku a čítalo z druhého.
      const data = await sbFetch(`players?user_id=eq.${userId}&order=id.asc&limit=1`);
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
        const data = await sbFetch(`players?email=eq.${userEmail}&order=id.asc&limit=1`);
        if (data && data.length) {
          const player = data[0];
          localStorage.setItem(CURRENT_KEY, player.id);

          // Doplniť chýbajúci user_id sa z prehliadača už NEDÁ — politika
          // update_own_player bola zrušená (krok 6) a PATCH by ticho neurobil
          // nič. Taký hráč navyše nemôže trénovať: zapis_vysledok si ho hľadá
          // podľa user_id a nenájde ho. Preto sa to hlási, nech to niekto
          // opraví v databáze, a netvárime sa, že je to vybavené.
          reportPlayerError('hráč nemá naviazané user_id — treba doplniť v DB',
                            new Error('players.id=' + player.id + ' bez user_id'));

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

// ZASTARANÉ — ELO aj agregáty počíta a zapisuje serverová funkcia
// zapis_vysledok (viď zapisVysledok vyššie). Od kroku 6 už politika
// update_own_player neexistuje, takže PATCH na players z prehliadača NEVRÁTI
// CHYBU — len ticho neupraví ani jeden riadok. Presne na tomto sa 31. 8. 2026
// stratilo ELO zo zručností: stránka ukázala „+15", databáza nezaznamenala nič.
// Preto tu zostávajú len zátky, ktoré zakričia hneď.
function updatePlayerElo() {
  throw new Error('updatePlayerElo je zrušená — ELO počíta server, použi zapisVysledok()');
}

function registerPlayerResult() {
  throw new Error('registerPlayerResult je zrušená — agregáty zapisuje zapis_vysledok()');
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
