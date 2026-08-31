// Edge Function: admin-create-player
//
// Akcie (rozlíšené poľom "action" v tele požiadavky):
//   action: "create_player"   (predvolené) — vytvorí hráča s rovno POTVRDENÝM
//                              emailom, bez čakania na potvrdzovací mail.
//   action: "reset_password"  — nastaví existujúcemu hráčovi nové heslo.
//   action: "delete_user"     — zmaže hráča vrátane prihlasovacieho účtu.
//
// Beží na serveri (Deno), nie v prehliadači, takže tu (a len tu) je
// bezpečné použiť service_role kľúč, ktorý obchádza všetky RLS pravidlá.
//
// ─── OVERENIE VOLAJÚCEHO ────────────────────────────────────────────────────
// PÔVODNE bola jedinou ochranou znalosť zdieľaného hesla ADMIN_SECRET, lebo
// admin.html vraj nemal Supabase Auth session. To už neplatí: admin.html volá
// isLoggedIn() && isAdmin() a má k dispozícii access token. Znalosť jedného
// reťazca pritom stačila na čokoľvek — vrátane nastavenia nového hesla
// ktorémukoľvek účtu, teda aj administrátorskému.
//
// Teraz sa preto overuje TOKEN volajúceho a jeho rola v tabuľke profiles.
// ADMIN_SECRET zostáva ako nepovinný druhý faktor: kontroluje sa len vtedy,
// keď je nastavený v Function Secrets. Ak ho odtiaľ odstrániš, funkcia bude
// fungovať ďalej a bude sa spoliehať výhradne na prihlásenie.
//
// PORADIE NASADENIA: najprv nahraj upravený admin.html (začne posielať token,
// staršia funkcia ho ignoruje), až potom túto funkciu. Opačné poradie by admin
// panel na chvíľu odstavilo.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  Deno.env.get("SUPABASE_SECRET_KEY") ||
  "";
const ADMIN_SECRET = Deno.env.get("ADMIN_SECRET") || "";

// Role, ktoré smú túto funkciu volať.
const POVOLENE_ROLE = ["admin"];

// Východiskové ELO pre deväť zručností. Musí sedieť s tým, čo majú existujúci
// hráči — elo_zrucnosti je totiž ODVODENÝ PRIEMER týchto deviatich hodnôt,
// takže keby sa líšilo, nový hráč by mal v rebríčku iné číslo, než po prvej
// vyriešenej úlohe. Nastavuje sa explicitne, aby nezáviselo od nastavenia
// stĺpcov v databáze.
//
// Od resetu 1. 9. 2026 je to 1000, rovnako ako pri základných kategóriách.
// Predtým mali zručnosti vlastný základ 1200 — dva rôzne štarty sa ukázali
// ako zbytočná komplikácia a robili rebríčky neporovnateľnými podľa toho,
// ktorou cestou hráč vznikol.
const SKILL_BASE_ELO = 1000;

// Ako dlho platí novo vytvorený účet.
const PLATNOST_DNI = 14;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Porovnanie odolné voči meraniu času. Bežné !== skončí pri prvom odlišnom
// znaku, takže dĺžka odpovede prezrádza, koľko znakov sedelo.
function rovnakeTajomstvo(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let rozdiel = 0;
  for (let i = 0; i < x.length; i++) rozdiel |= x[i] ^ y[i];
  return rozdiel === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Len POST." }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Neplatné dáta požiadavky." }, 400);
  }

  if (!SERVICE_ROLE_KEY) {
    return json({
      error: "Serverová konfigurácia chýba (service_role / secret kľúč nie je nastavený v Edge Function secrets).",
    }, 500);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ─── 1. Kto volá? ─────────────────────────────────────────────────────────
  const hlavicka = req.headers.get("Authorization") || "";
  const token = hlavicka.startsWith("Bearer ") ? hlavicka.slice(7).trim() : "";
  if (!token) {
    return json({ error: "Chýba prihlásenie." }, 401);
  }

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const volajuci = userData?.user;
  if (userErr || !volajuci) {
    // Sem spadne aj volanie s verejným kľúčom namiesto tokenu prihláseného
    // používateľa — presne to bolo predtým dostatočné.
    return json({ error: "Neplatné prihlásenie. Prihlás sa znova." }, 401);
  }

  const { data: profil } = await admin
    .from("profiles").select("role, email").eq("id", volajuci.id).maybeSingle();

  if (!profil || !POVOLENE_ROLE.includes(String(profil.role))) {
    return json({ error: "Táto operácia je dostupná len administrátorovi." }, 403);
  }

  // ─── 2. Nepovinný druhý faktor ────────────────────────────────────────────
  if (ADMIN_SECRET) {
    const zadane = String(body.admin_secret || "");
    if (!rovnakeTajomstvo(zadane, ADMIN_SECRET)) {
      return json({ error: "Nesprávne admin heslo." }, 401);
    }
  }

  const action = String(body.action || "create_player");

  // ─── Akcia: kompletné zmazanie používateľa ───────────────────────────────
  // Zmaže záznamy o tréningu, ELO históriu, hráča, profil aj prihlasovací účet
  // (auth.users) — ten sa z prehliadača zmazať nedá.
  //
  // POZNÁMKA: cudzie kľúče z training_log, elo_history a assignments na players
  // majú ON DELETE CASCADE, takže by stačilo zmazať hráča. Mazanie po častiach
  // tu zostáva ako poistka pre prípad, že by sa schéma zmenila.
  if (action === "delete_user") {
    const userId = String(body.user_id || "").trim();
    if (!userId) return json({ error: "Chýba user_id." }, 400);

    // Admin nesmie zmazať sám seba — inak by sa systém dal nechtiac uzamknúť.
    if (userId === volajuci.id) {
      return json({ error: "Vlastný účet cez túto funkciu zmazať nemožno." }, 400);
    }

    const { data: playerRows } = await admin
      .from("players").select("id").eq("user_id", userId);

    if (playerRows && playerRows.length) {
      for (const p of playerRows) {
        await admin.from("training_log").delete().eq("player_id", p.id);
        await admin.from("elo_history").delete().eq("player_id", p.id);
      }
      const { error: delPlayersErr } = await admin
        .from("players").delete().eq("user_id", userId);
      if (delPlayersErr) {
        return json({ error: "Zlyhalo mazanie hráča: " + delPlayersErr.message }, 500);
      }
    }

    const { error: delProfileErr } = await admin
      .from("profiles").delete().eq("id", userId);
    if (delProfileErr) {
      return json({ error: "Zlyhalo mazanie profilu: " + delProfileErr.message }, 500);
    }

    const { error: delAuthErr } = await admin.auth.admin.deleteUser(userId);
    if (delAuthErr) {
      return json({
        error: "Hráč a profil sú zmazané, ale zlyhalo mazanie prihlasovacieho účtu: " + delAuthErr.message,
      }, 500);
    }

    return json({ success: true, deleted_user_id: userId, vykonal: profil.email });
  }

  // ─── Akcia: zmena hesla existujúcemu hráčovi ─────────────────────────────
  if (action === "reset_password") {
    const userId = String(body.user_id || "").trim();
    const newPassword = String(body.new_password || "");

    if (!userId) return json({ error: "Chýba user_id." }, 400);
    if (!newPassword || newPassword.length < 6) {
      return json({ error: "Nové heslo musí mať aspoň 6 znakov." }, 400);
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (updErr) {
      return json({ error: "Chyba pri zmene hesla: " + updErr.message }, 400);
    }

    return json({ success: true, user_id: userId, vykonal: profil.email });
  }

  // ─── Akcia: vytvorenie nového hráča (predvolené) ─────────────────────────
  const email     = String(body.email || "").trim().toLowerCase();
  const password  = String(body.password || "");
  const name      = String(body.name || "").trim();
  const surname   = String(body.surname || "").trim();
  const nickName  = String(body.nick_name || "").trim();
  const trenerId  = body.trener_id ? String(body.trener_id) : null;
  const baseEloIn = Number(body.base_elo);

  if (!email || !email.includes("@")) return json({ error: "Zadaj platný email." }, 400);
  if (!password || password.length < 6) return json({ error: "Heslo musí mať aspoň 6 znakov." }, 400);
  if (!nickName) return json({ error: "Prezývka je povinná." }, 400);

  const baseElo = (baseEloIn >= 1000 && baseEloIn <= 3000) ? baseEloIn : 1000;

  // Ak je zadaný tréner, musí naozaj existovať a mať trénerskú rolu — inak by
  // sa dalo hráča priradiť k ľubovoľnému UUID a v prehľadoch by potom nikde
  // nefiguroval.
  if (trenerId) {
    const { data: tr } = await admin
      .from("profiles").select("role").eq("id", trenerId).maybeSingle();
    if (!tr || !["trener", "hlavny_trener", "admin"].includes(String(tr.role))) {
      return json({ error: "Zadaný tréner neexistuje alebo nemá trénerskú rolu." }, 400);
    }
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name, surname, nick_name: nickName,
      base_elo: baseElo, trener_id: trenerId,
    },
  });

  if (createErr) {
    return json({ error: "Chyba pri vytváraní účtu: " + createErr.message }, 400);
  }
  const newUser = created.user;

  // Profily a hráčov vytvára primárne databázový trigger na auth.users.
  // Nasledujúce vkladanie je len záloha, keby trigger nebol nainštalovaný
  // alebo z akéhokoľvek dôvodu zlyhal.

  const { data: existingProfile } = await admin
    .from("profiles").select("id").eq("id", newUser.id).maybeSingle();

  if (!existingProfile) {
    const { error: profileErr } = await admin.from("profiles").insert({
      id: newUser.id,
      email,
      role: "hrac",
      nick_name: nickName,
      name,
      surname,
      valid_from: new Date().toISOString(),
      valid_to: new Date(Date.now() + PLATNOST_DNI * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (profileErr) {
      return json({ error: "Účet bol vytvorený, ale zlyhalo vytvorenie profilu: " + profileErr.message }, 500);
    }
  }

  const { data: existingPlayer } = await admin
    .from("players").select("id").eq("user_id", newUser.id).maybeSingle();

  if (!existingPlayer) {
    const playerBody: Record<string, unknown> = {
      name, surname, email,
      // Hracia sila — z registračného formulára
      elo: baseElo, elo_taktika: baseElo, elo_strategia: baseElo, elo_koncovka: baseElo,
      // Zručnosti sú iná schopnosť než hracia sila, preto majú vlastný základ
      // nezávislý od baseElo. elo_zrucnosti je priemer deviatich hodnôt nižšie,
      // takže pri rovnakom základe sa mu rovná.
      elo_zrucnosti:         SKILL_BASE_ELO,
      elo_checks:            SKILL_BASE_ELO,
      elo_captures:          SKILL_BASE_ELO,
      elo_pawn_breakthrough: SKILL_BASE_ELO,
      elo_direct_attack:     SKILL_BASE_ELO,
      elo_underdefended:     SKILL_BASE_ELO,
      elo_pin:               SKILL_BASE_ELO,
      elo_relative_pin:      SKILL_BASE_ELO,
      elo_fork:              SKILL_BASE_ELO,
      elo_direct_threat:     SKILL_BASE_ELO,
      played: 0, solved: 0, total_time: 0,
      user_id: newUser.id,
    };
    if (trenerId) playerBody.trener_id = trenerId;

    const { error: playerErr } = await admin.from("players").insert(playerBody);
    if (playerErr) {
      return json({ error: "Profil bol vytvorený, ale zlyhalo vytvorenie hráča: " + playerErr.message }, 500);
    }
  }

  return json({ success: true, user_id: newUser.id, email, vykonal: profil.email });
});
