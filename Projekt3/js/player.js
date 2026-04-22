const PLAYER_KEY = "players";
const CURRENT_KEY = "currentPlayer";

function loadPlayers() {
  return JSON.parse(localStorage.getItem(PLAYER_KEY) || "[]");
}

function savePlayers(players) {
  localStorage.setItem(PLAYER_KEY, JSON.stringify(players));
}

function createPlayer(name) {
  const players = loadPlayers();

  const newPlayer = {
    id: Date.now(),
    name: name,
    elo: 1500,
    played: 0,
    solved: 0,
    totalTime: 0
  };

  players.push(newPlayer);
  savePlayers(players);
}

function setCurrentPlayer(id) {
  localStorage.setItem(CURRENT_KEY, id);
}

function getCurrentPlayer() {
  const id = localStorage.getItem(CURRENT_KEY);
  if (!id) return null;

  const players = loadPlayers();
  return players.find(p => p.id == id) || null;
}

function updatePlayer(playerId, updater) {
  const players = loadPlayers();
  const index = players.findIndex(p => p.id == playerId);

  if (index === -1) return null;

  updater(players[index]);
  savePlayers(players);
  return players[index];
}

function updatePlayerElo(playerId, puzzleElo, result) {
  return updatePlayer(playerId, (player) => {
    const diff = Number(puzzleElo) - Number(player.elo);
    let change = 0;

    if (result === "win") {
      change = 10 + diff / 50;
    } else {
      change = -(10 - diff / 50);
    }

    player.elo = Math.max(100, Math.round(player.elo + change));
  });
}

function addPlayerPlayed(playerId, timeSpent = 0) {
  return updatePlayer(playerId, (player) => {
    player.played = Number(player.played || 0) + 1;
    player.totalTime = Number(player.totalTime || 0) + Number(timeSpent || 0);
  });
}

function addPlayerSolved(playerId) {
  return updatePlayer(playerId, (player) => {
    player.solved = Number(player.solved || 0) + 1;
  });
}

function registerPlayerResult(playerId, result, timeSpent = 0) {
  return updatePlayer(playerId, (player) => {
    player.played = Number(player.played || 0) + 1;
    player.totalTime = Number(player.totalTime || 0) + Number(timeSpent || 0);

    if (result === "win") {
      player.solved = Number(player.solved || 0) + 1;
    }
  });
}

function getPlayerSuccessRate(player) {
  const played = Number(player?.played || 0);
  const solved = Number(player?.solved || 0);

  if (!played) return 0;
  return Math.round((solved / played) * 100);
}