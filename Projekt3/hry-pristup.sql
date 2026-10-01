-- ═══════════════════════════════════════════════════════════════════════════
--  HRY — kto ktorú hru vidí
--  sachovytrening.eu, 1. 10. 2026
--
--  Každá hra môže mať v tabuľke nastavenia vlastný riadok 'hry:<hra>'.
--  Hra bez vlastného riadku sa riadi spoločným riadkom 'hry' a keď chýba
--  aj ten, vidí ju len admin. Hodnoty:
--      'admin'    — len admin
--      'personal' — admin, hlavný tréner a tréneri
--      'vsetci'   — všetci vrátane hráčov
--  Vybraní testeri (hry-testeri.sql) vidia všetky hry vždy.
--
--  Tento skript otvorí Šachový trh všetkým hráčom. Ostatné hry ostávajú,
--  ako boli (len admin a testeri). Menu Hry sa hráčovi ukáže, keď vidí
--  aspoň jednu hru, a sú v ňom len hry, ktoré vidí.
--
--  Spusti celé naraz v SQL Editore. Skript je opakovateľný — dá sa spustiť
--  viackrát bez škody. Na konci je kontrola.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── Šachový trh pre všetkých ──────────────────────────────────────────────
insert into public.nastavenia (kluc, hodnota)
values ('hry:sachovy-trh', 'vsetci')
on conflict (kluc) do update set hodnota = excluded.hodnota, zmenene = now();


-- ─── Kontrola ──────────────────────────────────────────────────────────────
-- Očakávaný výsledok: Šachový trh = všetci (vlastný riadok),
-- ostatné hry = len admin (a testeri).
select h.nazov                                         as hra,
       case coalesce(nullif(n1.hodnota, ''), nullif(n0.hodnota, ''), 'admin')
         when 'vsetci'   then 'všetci vrátane hráčov'
         when 'personal' then 'admin a tréneri (a testeri)'
         else                 'len admin (a testeri)'
       end                                             as kto_ju_vidi,
       case when nullif(n1.hodnota, '') is not null then 'vlastný riadok ' || n1.kluc
            when nullif(n0.hodnota, '') is not null then 'spoločný riadok hry'
            else 'nič nenastavené'
       end                                             as podla
from (values (1, 'sachovy-trh',      'Šachový trh'),
             (2, 'straz-na-trhu',    'Stráž na trhu'),
             (3, 'vidlicka-na-trhu', 'Vidlička na trhu'),
             (4, 'hrozba-na-trhu',   'Hrozba na trhu')) as h(poradie, kluc, nazov)
left join public.nastavenia n1 on n1.kluc = 'hry:' || h.kluc
left join public.nastavenia n0 on n0.kluc = 'hry'
order by h.poradie;


-- ─── Na neskôr (nespúšťaj teraz) ───────────────────────────────────────────
-- Otvoriť ďalšiu hru všetkým, napr. Stráž na trhu:
--   insert into public.nastavenia (kluc, hodnota) values ('hry:straz-na-trhu', 'vsetci')
--   on conflict (kluc) do update set hodnota = excluded.hodnota, zmenene = now();
--
-- Ukázať hru najprv len trénerom (na vyskúšanie):
--   insert into public.nastavenia (kluc, hodnota) values ('hry:straz-na-trhu', 'personal')
--   on conflict (kluc) do update set hodnota = excluded.hodnota, zmenene = now();
--
-- Šachový trh hráčom znova zavrieť (bude sa riadiť spoločným riadkom 'hry'):
--   delete from public.nastavenia where kluc = 'hry:sachovy-trh';
