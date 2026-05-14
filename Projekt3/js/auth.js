// auth.js — centrálna autentifikačná knižnica
// Načítava sa na každej stránke PRED player.js

const SUPABASE_URL = "https://wdjsilryllqksdtmaehy.supabase.co";
const SUPABASE_KEY = "sb_publishable_45gFQhgPScrDjDCVC0B4Iw_q6uZKf9m";

// Inicializácia Supabase klienta pre Auth
const { createClient } = supabase;
const sbClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Pomocné funkcie ──────────────────────────────────────────────────────────

function getCurrentUser() {
  return {
    id: sessionStorage.getItem('user_id'),
    email: sessionStorage.getItem('user_email'),
    role: sessionStorage.getItem('user_role'),
    nick: sessionStorage.getItem('user_nick'),
    name: sessionStorage.getItem('user_name'),
    surname: sessionStorage.getItem('user_surname')
  };
}

function isLoggedIn() {
  return !!sessionStorage.getItem('user_id');
}

function getUserRole() {
  return sessionStorage.getItem('user_role') || 'hrac';
}

function isAdmin() { return getUserRole() === 'admin'; }
function isTrener() { return getUserRole() === 'trener'; }
function isHlavnyTrener() { return getUserRole() === 'hlavny_trener'; }
function isHrac() { return getUserRole() === 'hrac'; }
function isAdminOrTrener() { return isAdmin() || isTrener() || isHlavnyTrener(); }

async function logout() {
  await sbClient.auth.signOut();
  sessionStorage.clear();
  location.href = 'login.html';
}

// ─── Ochrana stránky ──────────────────────────────────────────────────────────

function requireLogin() {
  if (!isLoggedIn()) {
    location.href = 'login.html';
    return false;
  }
  return true;
}

function requireRole(role) {
  if (!requireLogin()) return false;
  const userRole = getUserRole();
  if (role === 'admin' && !isAdmin()) {
    alert('Prístup len pre administrátora.');
    location.href = 'index.html';
    return false;
  }
  if (role === 'trener' && !isAdminOrTrener()) {
    alert('Prístup len pre trénera alebo administrátora.');
    location.href = 'index.html';
    return false;
  }
  return true;
}

// ─── Obnoviť session zo Supabase (pri F5) ────────────────────────────────────

async function refreshSession() {
  if (isLoggedIn()) return true;

  try {
    const { data } = await sbClient.auth.getSession();
    if (!data.session) return false;

    const userId = data.session.user.id;

    // Načítaj profil cez REST API
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&limit=1`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${data.session.access_token}`
        }
      }
    );
    const profiles = await res.json();
    if (!profiles || !profiles.length) return false;
    const profile = profiles[0];

    sessionStorage.setItem('user_id', userId);
    sessionStorage.setItem('user_email', data.session.user.email);
    sessionStorage.setItem('user_role', profile.role);
    sessionStorage.setItem('user_nick', profile.nick_name || '');
    sessionStorage.setItem('user_name', profile.name || '');
    sessionStorage.setItem('user_surname', profile.surname || '');

    return true;
  } catch(e) {
    console.error('refreshSession error:', e);
    return false;
  }
}
