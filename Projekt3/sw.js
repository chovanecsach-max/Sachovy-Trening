// ─────────────────────────────────────────────────────────────────────────────
//  sw.js — service worker pre Šachový tréning
//
//  ÚČEL: bez service workera prehliadač aplikáciu nenainštaluje ako ikonu.
//  Nič viac od neho nechceme.
//
//  STRATÉGIA JE ZÁMERNE „NAJPRV SIEŤ".  Bežné PWA odpovedajú z cache, aby boli
//  rýchle — tu by to ale spôsobilo, že po nahraní nových súborov na GitHub by
//  hráči ešte dni dostávali starú verziu a ty by si hľadal chybu, ktorá je už
//  dávno opravená. Preto sa vždy najprv skúša sieť a cache slúži len ako
//  záloha, keď je hráč offline.
//
//  Do cache sa ukladajú LEN vlastné súbory stránky (rovnaká adresa) a len
//  požiadavky typu GET. Dotazy do Supabase sa neukladajú nikdy — obsahujú
//  osobné údaje a musia byť vždy aktuálne.
// ─────────────────────────────────────────────────────────────────────────────

const CACHE = 'sachovytrening-v1';

self.addEventListener('install', event => {
  self.skipWaiting();          // nová verzia sa ujme hneď, nečaká na zatvorenie
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(nazvy => Promise.all(
        nazvy.filter(n => n !== CACHE).map(n => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;

  // Neriešime nič okrem obyčajného čítania vlastných súborov
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then(odpoved => {
        // Ulož kópiu pre prípad, že hráč bude offline
        if (odpoved && odpoved.ok) {
          const kopia = odpoved.clone();
          caches.open(CACHE).then(c => c.put(req, kopia)).catch(() => {});
        }
        return odpoved;
      })
      .catch(() => caches.match(req))   // sieť nejde → skús zálohu
  );
});
