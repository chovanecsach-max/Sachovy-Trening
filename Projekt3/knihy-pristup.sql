-- ═══════════════════════════════════════════════════════════════════════════
--  KNIHY — kto ktorú knihu vidí
--  sachovytrening.eu, 27. 10. 2026
--
--  Rovnako ako pri hrách: každá kniha môže mať v tabuľke nastavenia vlastný
--  riadok 'knihy:<kniha>' (napr. 'knihy:cesta-stratega-1'). Kniha bez vlastného
--  riadku sa riadi spoločným riadkom 'knihy' a keď chýba aj ten, vidí ju len
--  admin. Hodnoty:
--      'admin'    — len admin
--      'personal' — admin, hlavný tréner a tréneri
--      'vsetci'   — všetci vrátane hráčov
--  Vybraní testeri (admin panel → políčko „Testuje hry“, tabuľka hry_testeri)
--  vidia knihy vždy.
--
--  TERAZ NETREBA NIČ SPÚŠŤAŤ: bez riadku vidí knihu len admin a testeri.
--  Tento skript na začiatku len ukáže, ako je to nastavené. Nič nemení.
--  Menu Knihy na úvodnej stránke sa ukáže, keď používateľ vidí aspoň jednu
--  knihu, a sú v ňom len knihy, ktoré vidí.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── Kontrola ──────────────────────────────────────────────────────────────
select k.nazov                                         as kniha,
       case coalesce(nullif(n1.hodnota, ''), nullif(n0.hodnota, ''), 'admin')
         when 'vsetci'   then 'všetci vrátane hráčov'
         when 'personal' then 'admin a tréneri (a testeri)'
         else                 'len admin (a testeri)'
       end                                             as kto_ju_vidi,
       case when nullif(n1.hodnota, '') is not null then 'vlastný riadok ' || n1.kluc
            when nullif(n0.hodnota, '') is not null then 'spoločný riadok knihy'
            else 'nič nenastavené'
       end                                             as podla
from (values (1, 'cesta-stratega-1', 'Cesta stratéga, 1. diel')) as k(poradie, kluc, nazov)
left join public.nastavenia n1 on n1.kluc = 'knihy:' || k.kluc
left join public.nastavenia n0 on n0.kluc = 'knihy'
order by k.poradie;


-- ─── Na neskôr (nespúšťaj teraz) ───────────────────────────────────────────
-- Ukázať Cestu stratéga najprv trénerom (na vyskúšanie):
--   insert into public.nastavenia (kluc, hodnota) values ('knihy:cesta-stratega-1', 'personal')
--   on conflict (kluc) do update set hodnota = excluded.hodnota, zmenene = now();
--
-- Otvoriť Cestu stratéga všetkým hráčom:
--   insert into public.nastavenia (kluc, hodnota) values ('knihy:cesta-stratega-1', 'vsetci')
--   on conflict (kluc) do update set hodnota = excluded.hodnota, zmenene = now();
--
-- Knihu znova zavrieť (bude sa riadiť spoločným riadkom 'knihy', bez neho len admin):
--   delete from public.nastavenia where kluc = 'knihy:cesta-stratega-1';
