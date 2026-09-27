// ============================================================================
//  straz-obsah.js — obsah hry Stráž na trhu (kapitoly, texty, úlohy)
// ----------------------------------------------------------------------------
//  Hra vysvetľuje zručnosť Slabo pokryté figúrky. Je to pokračovanie Šachového
//  trhu: figúrky sú tovar na stánkoch, obrancovia sú strážnici, útočníci sú
//  zlodeji. Stánok je v bezpečí, len keď má viac strážnikov ako zlodejov.
//
//  Jediné miesto, kde sú texty a pozície hry. Herný rámec (hra-engine.js) ich
//  len zobrazuje. Správne odpovede sa NEPÍŠU ručne — vždy ich vypočíta
//  VisionCore rovnako ako tréning Slabo pokryté figúrky. Pole „ocakavane"
//  slúži len na kontrolu: keby sa výpočet a scenár rozišli, hra to vypíše
//  do konzoly.
//
//  TYPY ÚLOH:
//    pocet       — koľko útočníkov (co: 'utocnici') alebo obrancov
//                  (co: 'obrancovia') má figúrka na poli `pole`? (fen, pole, co)
//    slaba       — je figúrka na poli `pole` slabo pokrytá? Áno / Nie (fen, pole)
//    ktora       — ktorá z figúrok `moznosti` je slabo pokrytá? (fen, moznosti)
//    najdiSlabe  — nájdi všetky slabo pokryté figúrky za oboch (fen, pomocka)
//
//  KAPITOLA môže mať aj:
//    bezVerdiktu — po odpovedi sa ukážu len počty, bez slov „slabo/dobre
//                  pokrytá" (kapitola 1, pojem ešte nepoznáme)
//    otazka      — vlastné znenie otázky ({figurka} = napr. „jazdec d5",
//                  {pokryty} = pokrytý / pokrytá)
//
//  Figúrky v textoch: K D V S J (slovensky), vo FEN anglicky (K Q R B N P).
// ============================================================================

(window.VERZIE = window.VERZIE || {})['straz-obsah.js'] = '2026-09-27';

const OBSAH_STRAZ = {
  kluc: 'straz-na-trhu',
  // Verzia číslovania kapitol (pozri trh-obsah.js). Pri zmene poradia kapitol sa zvýši.
  verzia: 1,
  nazov: 'Stráž na trhu',
  podtitul: 'Hra, ktorá vysvetľuje zručnosť Slabo pokryté figúrky',
  sprievodca: 'Grošík',
  pozdrav: 'Ahoj, to som zase ja, Grošík! Na trhu sa začalo kradnúť, a tak som si najal stráž. ' +
           'Naučím ťa rozoznať, ktoré stánky sú v nebezpečenstve. Vyber si kapitolu.',

  // Texty, ktoré sa líšia od Šachového trhu
  texty: {
    pochvaly: ['Výborne!', 'Presne tak!', 'Máš oko strážnika.', 'Správne!', 'Dobre spočítané!'],
    odznak: 'Strážca trhu',
    zosit: 'Toto sú pravidlá, ktoré si už získal. Dobrý strážnik ich má vždy po ruke.',
    bublinaUlohy: 'Spočítaj zlodejov a strážnikov.',
    odkazy: [{ text: 'Šachový trh', href: 'sachovy-trh.html' }],
    koniec3: 'Skvelá stráž! Tri hviezdičky.',
    koniec2: 'Dobrá práca! Na tri hviezdičky ti chýba len kúsok.',
    koniec1: 'Kapitola je za tebou. Skús ju ešte raz — pôjde to lepšie.'
  },

  kapitoly: [
    // ── Kapitola 1 ─────────────────────────────────────────────────────────
    {
      cislo: 1,
      nazov: 'Útočníci a obrancovia',
      bezVerdiktu: true,
      uvod: [
        'Na trhu sa začalo kradnúť! Každý stánok má svoj tovar — figúrku. <b>Zlodeji</b> sú súperove figúrky, ' +
        'ktoré by ju mohli zobrať. <b>Strážnici</b> sú tvoje figúrky, ktoré by zlodeja hneď potrestali: mohli by ' +
        'brať späť na to isté pole.',
        'Pešiak kradne aj stráži len šikmo dopredu. Jazdec skáče. Strelec, veža a dáma potrebujú voľnú cestu — ' +
        'keď im niekto stojí v ceste, nedosiahnu. Aj kráľ sa počíta, keď stojí hneď vedľa.'
      ],
      zapamataj: 'Útočník môže figúrku zobrať. Obranca môže brať späť na to isté pole.',
      prePokrocilych: 'Obranca je figúrka, ktorá by mohla brať na pole, keby tam stála súperova figúrka. ' +
                      'Preto sa počíta aj vtedy, keď tam práve stojí vlastná figúrka.',
      preTrenerov: 'Počíta sa každý kus zvlášť, bez ohľadu na hodnotu. Kráľ na susednom poli sa ráta ako útočník ' +
                   'aj obranca vždy, aj keď by sám brať nesmel. Keď pribudne ďalší útočník, kráľ sa do výmeny ' +
                   'zapojí (kapitola 8). Tak počíta aj tréning v Zručnostiach.',
      ulohy: [
        { id: '1.1', typ: 'pocet', fen: '3r2k1/8/4p3/3N4/4P3/8/8/3R2K1 w - - 0 1', pole: 'd5', co: 'utocnici',
          ocakavane: 2, vysvetlenie: 'Zlodeji sú pešiak e6 a veža d8.' },
        { id: '1.2', typ: 'pocet', fen: '3r2k1/8/4p3/3N4/4P3/8/8/3R2K1 w - - 0 1', pole: 'd5', co: 'obrancovia',
          ocakavane: 2, vysvetlenie: 'Strážnici sú pešiak e4 a veža d1.' },
        { id: '1.3', typ: 'pocet', fen: '6k1/8/8/2b5/8/8/5P2/6K1 w - - 0 1', pole: 'f2', co: 'obrancovia',
          ocakavane: 1, vysvetlenie: 'Pešiaka stráži kráľ g1 — stojí hneď vedľa.' },
        { id: '1.4', typ: 'pocet', fen: '6k1/8/8/4p3/2N5/5N2/8/6K1 w - - 0 1', pole: 'e5', co: 'utocnici',
          ocakavane: 2, vysvetlenie: 'Pešiaka môžu zobrať oba jazdce.' },
        { id: '1.5', typ: 'pocet', fen: '6k1/8/8/3P4/8/3N4/8/3R2K1 w - - 0 1', pole: 'd5', co: 'obrancovia',
          ocakavane: 0, vysvetlenie: 'Veža d1 by pešiaka strážila, ale cestu jej zatarasil vlastný jazdec d3.' }
      ]
    },

    // ── Kapitola 2 ─────────────────────────────────────────────────────────
    {
      cislo: 2,
      nazov: 'Nikto ju nestráži',
      uvod: [
        'Už vieš počítať zlodejov aj strážnikov. Grošíkovo pravidlo znie: <b>stánok je v bezpečí, len keď má ' +
        'viac strážnikov ako zlodejov.</b> Taká figúrka je dobre pokrytá. Všetky ostatné sú <b>slabo pokryté</b>.',
        'Pozor: figúrka, ktorú nikto nestráži, je slabo pokrytá, <b>aj keď ju práve nikto nenapáda</b>. Nula ' +
        'strážnikov nie je viac ako nula zlodejov. Stačí, aby prišiel jeden zlodej, a tovar je preč.'
      ],
      zapamataj: 'Bez strážnika je každá figúrka slabo pokrytá — aj keď ju nikto nenapáda.',
      prePokrocilych: 'Slabo pokrytá figúrka nemusí byť v nebezpečenstve hneď. Je to slabé miesto, na ktoré sa ' +
                      'oplatí zaútočiť.',
      preTrenerov: 'Figúrka bez útočníka aj bez obrancu (0 : 0) sa ráta. V úlohách tréningu je to takmer polovica ' +
                   'riešení, preto je to prvé pravidlo hry. Tréning hľadá nechránené figúrky, nie len napadnuté.',
      ulohy: [
        { id: '2.1', typ: 'slaba', fen: '6k1/8/8/8/8/8/8/R5K1 w - - 0 1', pole: 'a1',
          ocakavane: true, vysvetlenie: 'Nikto ju nenapáda, ale ani nestráži. Nula strážnikov nie je viac ako nula zlodejov.' },
        { id: '2.2', typ: 'slaba', fen: '6k1/8/8/8/3N4/2P5/8/6K1 w - - 0 1', pole: 'd4',
          ocakavane: false, vysvetlenie: 'Stráži ho pešiak c3. Jeden strážnik je viac ako nula zlodejov.' },
        { id: '2.3', typ: 'slaba', fen: '6k1/8/8/8/1r2B3/8/8/6K1 w - - 0 1', pole: 'e4',
          ocakavane: true, vysvetlenie: 'Napáda ho veža b4 a nikto ho nestráži.' },
        { id: '2.4', typ: 'ktora', fen: '6k1/8/8/8/3N4/2P5/1P6/R5K1 w - - 0 1', moznosti: ['a1', 'c3', 'd4'],
          ocakavane: 'a1', vysvetlenie: 'Jazdca d4 stráži pešiak c3, pešiaka c3 stráži pešiak b2. Vežu a1 nestráži nikto.' },
        { id: '2.5', typ: 'najdiSlabe', fen: 'r5k1/5ppp/4b3/8/8/2N5/5PPP/6K1 w - - 0 1',
          ocakavane: ['c3', 'a8'],
          vysvetlenie: 'Jazdec c3 a veža a8 nemajú ani jedného strážnika. Pešiaky strážia králi, strelca e6 pešiak f7.' }
      ]
    },

    // ── Kapitola 3 ─────────────────────────────────────────────────────────
    {
      cislo: 3,
      nazov: 'Rovnako nestačí',
      uvod: [
        'Jeden zlodej a jeden strážnik — to vyzerá spravodlivo. Lenže Grošík chce <b>prevahu</b>: strážnikov ' +
        'musí byť viac. Keď je ich rovnako (1 : 1, 2 : 2), stánok je slabo pokrytý.',
        'Stačí, aby prišiel ďalší zlodej, a strážnikov je menej. Preto rovnako nestačí.'
      ],
      zapamataj: 'Strážnikov musí byť viac ako zlodejov. Pri rovnakom počte je figúrka slabo pokrytá.',
      prePokrocilych: 'Pri rovnakom počte rozhoduje, kto berie prvý a čím. To už je otázka Brania so ziskom; ' +
                      'táto zručnosť sa pýta len na počet.',
      preTrenerov: 'Pri 1 : 1 aj 2 : 2 je figúrka slabo pokrytá bez ohľadu na to, či by sa výmena útočníkovi oplatila.',
      ulohy: [
        { id: '3.1', typ: 'slaba', fen: '6k1/8/4p3/3p4/8/2N5/8/6K1 w - - 0 1', pole: 'd5',
          ocakavane: true, vysvetlenie: 'Útočí jazdec c3, stráži pešiak e6. Jeden na jedného — rovnako nestačí.' },
        { id: '3.2', typ: 'slaba', fen: '6k1/8/8/4p3/3N4/2P1P3/8/6K1 w - - 0 1', pole: 'd4',
          ocakavane: false, vysvetlenie: 'Útočí pešiak e5, strážia pešiaky c3 a e3. Dvaja strážnici proti jednému zlodejovi.' },
        { id: '3.3', typ: 'slaba', fen: '3r2k1/8/4p3/3N4/4P3/8/8/3R2K1 w - - 0 1', pole: 'd5',
          otazka: 'V kapitole 1 si pri jazdcovi d5 spočítal dvoch zlodejov a dvoch strážnikov. Je {figurka} <b>slabo {pokryty}</b>?',
          ocakavane: true, vysvetlenie: 'Dvaja na dvoch — rovnako nestačí.' },
        { id: '3.4', typ: 'ktora', fen: '6k1/8/4p3/3p4/3N4/2N1P3/1P6/6K1 w - - 0 1', moznosti: ['d5', 'c3', 'd4'],
          ocakavane: 'd5', vysvetlenie: 'Pešiak d5 má jedného zlodeja a jedného strážnika. Jazdcov strážia pešiaky b2 a e3 ' +
                                       'a nikto ich nenapáda.' },
        { id: '3.5', typ: 'najdiSlabe', fen: '6k1/5ppp/8/3p4/4P3/2N5/5PPP/6K1 w - - 0 1',
          ocakavane: ['e4', 'c3', 'd5'],
          vysvetlenie: 'Pešiak e4 má 1 : 1, jazdec c3 nemá strážnika a pešiaka d5 napádajú dvaja bez jediného strážnika.' }
      ]
    },

    // ── Kapitola 4 ─────────────────────────────────────────────────────────
    {
      cislo: 4,
      nazov: 'Počítajú sa kusy, nie ceny',
      uvod: [
        'Na Šachovom trhu si počítal mince. Tu je to inak: strážnik je strážnik a zlodej je zlodej. ' +
        '<b>Pešiak aj dáma sú po jednom kuse.</b> Počítaš hlavy, nie mince.',
        'Preto môže byť veža, na ktorú mierí pešiak, dobre pokrytá — ak ju strážia dvaja. A pešiak, na ktorého ' +
        'mierí dáma, môže byť slabo pokrytý — ak ho stráži len jeden.'
      ],
      zapamataj: 'Počítam kusy, nie ceny. Pešiak aj dáma sú jeden strážnik alebo jeden zlodej.',
      prePokrocilych: 'Dobre pokrytá figúrka ešte nemusí byť v bezpečí: pešiak, ktorý napadne vežu, ju zoberie so ' +
                      'ziskom aj proti dvom strážnikom. Na to je zručnosť Branie so ziskom.',
      preTrenerov: 'Slabo pokrytá figúrka a branie so ziskom sú dve rôzne otázky. Veža napadnutá pešiakom a krytá ' +
                   'dvakrát nie je slabo pokrytá, hoci ju pešiak zoberie so ziskom (4.1). Pešiak krytý raz a ' +
                   'napadnutý dámou slabo pokrytý je, hoci jeho zobratie zisk neprinesie (4.2).',
      ulohy: [
        { id: '4.1', typ: 'slaba', fen: '6k1/8/8/3p4/4R3/5P2/8/4R1K1 w - - 0 1', pole: 'e4',
          ocakavane: false, vysvetlenie: 'Útočí pešiak d5, strážia veža e1 a pešiak f3. Že ju pešiak zoberie so ziskom, ' +
                                        'tu nerozhoduje — počítame kusy.' },
        { id: '4.2', typ: 'slaba', fen: '6k1/1p6/p7/8/8/8/8/Q5K1 w - - 0 1', pole: 'a6',
          ocakavane: true, vysvetlenie: 'Útočí dáma a1, stráži pešiak b7. Jeden na jedného — aj keď je zlodej dáma.' },
        { id: '4.3', typ: 'ktora', fen: '6k1/1p6/p7/3p4/4R3/5P2/8/Q3R1K1 w - - 0 1', moznosti: ['e4', 'a6', 'a1'],
          ocakavane: 'a6', vysvetlenie: 'Pešiak a6 má 1 : 1. Veža e4 má jedného zlodeja a dvoch strážnikov a dámu a1 ' +
                                       'stráži veža e1.' },
        { id: '4.4', typ: 'najdiSlabe', fen: '6k1/1p6/p7/3p4/4R3/5P2/8/Q3R1K1 w - - 0 1',
          ocakavane: ['f3', 'b7', 'a6', 'd5'],
          vysvetlenie: 'Pešiak a6 má 1 : 1 a pešiaky b7, d5 a f3 nikto nestráži. Veža e4, dáma a1 ani veža e1 ' +
                       'slabo pokryté nie sú.' }
      ]
    },

    // ── Kapitola 5 ─────────────────────────────────────────────────────────
    {
      cislo: 5,
      nazov: 'Za oboch, aj pešiaky',
      uvod: [
        'Grošík stráži celý trh — biele aj čierne stánky. Hľadaj slabo pokryté figúrky <b>za oboch hráčov</b>, ' +
        'bez ohľadu na to, kto je na ťahu.',
        'Nezabudni na <b>pešiakov</b>. Často je slabý ten, ktorý stojí na konci reťaze: toho pred ním stráži, ' +
        'ale jeho už nikto.',
        '<b>Kráľa nehľadáme.</b> Nikto ho nesmie zobrať, takže strážnikov nepotrebuje.'
      ],
      zapamataj: 'Hľadám za oboch, aj pešiakov. Kráľa nie.',
      prePokrocilych: 'V reťazi pešiakov stráži každý pešiak toho pred sebou. Slabý je koreň reťaze — pešiak vzadu, ' +
                      'ktorého nikto nestráži.',
      preTrenerov: 'Polovica riešení v tréningu sú pešiaky. Úloha je vždy za oboch, preto v nej nikdy nie je kráľ v šachu.',
      ulohy: [
        { id: '5.1', typ: 'ktora', fen: '6k1/8/8/8/3P4/2P5/1P6/6K1 w - - 0 1', moznosti: ['b2', 'c3', 'd4'],
          otazka: 'Ktorý z označených pešiakov je <b>slabo pokrytý</b>?',
          ocakavane: 'b2', vysvetlenie: 'Pešiak b2 je koreň reťaze: stráži pešiaka c3, ale jeho nestráži nikto.' },
        { id: '5.2', typ: 'najdiSlabe', fen: '6k1/p4ppp/1p6/2p5/3P4/2P5/1P3PPP/6K1 w - - 0 1', pomocka: 'strany',
          ocakavane: ['d4', 'b2', 'a7', 'c5'],
          vysvetlenie: 'Pešiaky d4 a c5 sa napádajú a každý má jedného strážnika (1 : 1). Korene reťazí b2 a a7 ' +
                       'nestráži nikto.' },
        { id: '5.3', typ: 'najdiSlabe', fen: '8/8/4k3/7p/3K2P1/8/2P5/8 w - - 0 1',
          ocakavane: ['g4', 'c2', 'h5'],
          vysvetlenie: 'Pešiaky g4 a h5 sa napádajú a nikto ich nestráži, pešiak c2 stojí sám. Kráľov neklikaj — tých nehľadáme.' },
        { id: '5.4', typ: 'najdiSlabe', fen: '6k1/pp2rp2/6pp/3R1n2/8/3Q4/Pq4PP/5R1K w - - 0 1',
          ocakavane: ['a2', 'g2', 'a7', 'f5', 'b2'],
          vysvetlenie: 'Pozícia zo skutočnej partie. Pešiak a2 má 1 : 0, pešiak g2 1 : 1 a jazdec f5 troch zlodejov ' +
                       'proti jednému strážnikovi. Pešiak a7 a dáma b2 nemajú strážnika.' }
      ]
    },

    // ── Kapitola 6 ─────────────────────────────────────────────────────────
    {
      cislo: 6,
      nazov: 'Batéria',
      uvod: [
        'Niekedy stoja strážnici v rade za sebou: dve veže na jednom stĺpci alebo dáma za strelcom na uhlopriečke. ' +
        'Ten vzadu teraz nedosiahne, ale keď ten vpredu zoberie, cesta sa mu otvorí. <b>Preto sa počíta aj ten ' +
        'vzadu.</b> Taký rad voláme <b>batéria</b>.',
        'Batéria funguje aj za pešiakom: strelec za pešiakom, ktorý stráži šikmo dopredu, stráži tiež.'
      ],
      uvodKoniec: 'Na šachovnici poznáš figúrku v batérii podľa prerušovaného rámika.',
      zapamataj: 'Strážnik v rade za strážnikom sa počíta tiež.',
      prePokrocilych: 'Počíta sa aj naša veža za súperovou vežou, ktorá mierí na to isté pole: keď súperova veža ' +
                      'zoberie, naša sa k poľu dostane (6.5).',
      preTrenerov: 'Batéria sa ráta na stĺpci a rade (veža, dáma) aj na uhlopriečke (strelec, dáma), vrátane strelca ' +
                   'alebo dámy za vlastným pešiakom, ktorý na pole berie. Zadná figúrka musí mať rovnaký smer pohybu ' +
                   'ako predná.',
      ulohy: [
        { id: '6.1', typ: 'pocet', fen: '6k1/8/8/3P4/8/8/3R4/3R2K1 w - - 0 1', pole: 'd5', co: 'obrancovia',
          ocakavane: 2, vysvetlenie: 'Veža d2 stráži priamo a veža d1 v batérii za ňou.' },
        { id: '6.2', typ: 'pocet', fen: '6k1/8/5n2/8/3B4/2Q5/8/6K1 w - - 0 1', pole: 'f6', co: 'utocnici',
          ocakavane: 2, vysvetlenie: 'Strelec d4 napáda priamo a dáma c3 v batérii za ním.' },
        { id: '6.3', typ: 'pocet', fen: '6k1/8/8/8/3N4/2P5/1B6/6K1 w - - 0 1', pole: 'd4', co: 'obrancovia',
          ocakavane: 2, vysvetlenie: 'Pešiak c3 stráži šikmo dopredu a strelec b2 v batérii za ním.' },
        { id: '6.4', typ: 'slaba', fen: '4r1k1/4r3/8/4N3/3P1P2/8/8/6K1 w - - 0 1', pole: 'e5',
          ocakavane: true, vysvetlenie: 'Útočia veže e7 a e8 v batérii, strážia pešiaky d4 a f4. Dvaja na dvoch — ' +
                                       'rovnako nestačí.' },
        { id: '6.5', typ: 'pocet', fen: '6k1/8/8/4N3/4r3/8/8/4R1K1 w - - 0 1', pole: 'e5', co: 'obrancovia',
          ocakavane: 1, vysvetlenie: 'Veža e1 stojí za súperovou vežou e4. Keď čierna veža zoberie na e5, biela veža ' +
                                    'sa k poľu dostane.' },
        { id: '6.6', typ: 'najdiSlabe', fen: '4r1k1/4r3/3p4/4p3/2N5/5N2/8/6K1 w - - 0 1',
          ocakavane: ['c4', 'f3', 'd6'],
          vysvetlenie: 'Pešiak d6 má 1 : 0 a jazdce c4 a f3 nikto nestráži. Pešiak e5 slabý nie je: dvaja zlodeji ' +
                       'proti trom strážnikom vďaka batérii veží.' }
      ]
    },

    // ── Kapitola 7 ─────────────────────────────────────────────────────────
    {
      cislo: 7,
      nazov: 'Väzba',
      uvod: [
        'Viazaná figúrka stojí medzi svojím kráľom a súperovou vežou, strelcom alebo dámou. Keby sa pohla, jej ' +
        'kráľ by bol v šachu — a to pravidlá nedovolia.',
        'Taký strážnik je ako pripútaný: <b>nestráži</b>. A ak je súperov, <b>nekradne</b>. Pri počítaní ho vynechaj.'
      ],
      zapamataj: 'Viazaný strážnik nestráži, viazaný zlodej nekradne.',
      prePokrocilych: 'Viazaná figúrka môže brať po línii väzby, napríklad veža viazaná na stĺpci po tom istom ' +
                      'stĺpci. Vtedy sa počíta.',
      preTrenerov: 'Rovnako ako pri Braní so ziskom sa vynecháva len väzba na kráľa. Figúrka viazaná na dámu alebo ' +
                   'vežu sa počíta normálne.',
      ulohy: [
        { id: '7.1', typ: 'pocet', fen: '7k/8/5n2/3p4/8/8/1B6/3RK3 w - - 0 1', pole: 'd5', co: 'obrancovia',
          ocakavane: 0, vysvetlenie: 'Jazdec f6 je viazaný strelcom b2 na kráľa h8, preto nestráži.' },
        { id: '7.2', typ: 'slaba', fen: '7k/8/4pn2/3p4/8/8/1B6/3RK3 w - - 0 1', pole: 'd5',
          ocakavane: true, vysvetlenie: 'Stráži ho len pešiak e6, viazaný jazdec f6 sa neráta. Bez väzby by mal ' +
                                       'jedného zlodeja a dvoch strážnikov.' },
        { id: '7.3', typ: 'slaba', fen: '3k4/8/3n4/8/4B3/5P2/8/3RK3 w - - 0 1', pole: 'e4',
          ocakavane: false, vysvetlenie: 'Jazdec d6 je viazaný vežou d1 na kráľa d8, takže nekradne. Strelca stráži pešiak f3.' },
        { id: '7.4', typ: 'najdiSlabe', fen: '7k/8/4pn2/3p4/8/8/1B6/3RK3 w - - 0 1',
          ocakavane: ['b2', 'e6', 'f6', 'd5'],
          vysvetlenie: 'Strelec b2 a pešiak e6 nemajú strážnika, jazdec f6 má 1 : 0 a pešiak d5 1 : 1, lebo viazaný ' +
                       'jazdec ho nestráži.' }
      ]
    },

    // ── Kapitola 8 — zručnosť a šachová hra ────────────────────────────────
    {
      cislo: 8,
      nazov: 'Zručnosť a šachová hra',
      uvod: [
        'Na trhu je 64 stánkov a Grošík pri každom len <b>spočíta</b> zlodejov a strážnikov. Nepýta sa, kto je ' +
        'silnejší, ani či by sa krádež oplatila.',
        'Preto niekedy povie „slabo pokrytá“ aj figúrke, ktorej teraz nič nehrozí. Napríklad keď na ňu mierí len ' +
        'kráľ: sám ju zobrať nesmie, lebo ju niekto stráži. Kráľ je však <b>zlodej v zálohe</b> — keď príde na ' +
        'pomoc ďalší zlodej, kráľ berie ako posledný a figúrka padne. Alebo keď ju nikto nenapáda: stačí jeden útok.'
      ],
      uvodKoniec: 'Nevadí. Učíš sa rýchlo vidieť slabé miesta. Čo s nimi urobiť, rozhodneš v partii.',
      zapamataj: 'Počítam strážnikov a zlodejov. Či sa krádež oplatí, je iná otázka.',
      prePokrocilych: 'Slabo pokrytá figúrka je terč: keď na ňu pribudne ďalší útočník, strážnici nestačia. Preto ' +
                      'sa oplatí vidieť ju skôr, než príde útok.',
      preTrenerov: 'Zručnosť Slabo pokryté figúrky trénuje rýchle spočítanie útočníkov a obrancov každej figúrky. ' +
                   'Netrénuje hodnotenie pozície ani výpočet výmeny. Kráľ sa ráta ako útočník aj na krytú figúrku, ' +
                   'hoci ju sám zobrať nesmie (8.1, 8.2). Pri 1 : 1 sa figúrka väčšinou so ziskom zobrať nedá, ale ' +
                   'keď pribudne ďalší útočník, kráľ sa do výmeny zapojí a figúrka padne. Tak počíta aj tréning ' +
                   'v Zručnostiach.',
      ulohy: [
        { id: '8.1', typ: 'slaba', fen: '8/8/5k2/4R1N1/8/8/8/6K1 w - - 0 1', pole: 'g5',
          ocakavane: true, vysvetlenie: 'Útočí kráľ f6, stráži veža e5. Sám ho kráľ zobrať nesmie, ale je zlodej v zálohe.' },
        { id: '8.2', typ: 'slaba', fen: '8/8/1k2b3/7B/8/1pK5/8/8 w - - 0 1', pole: 'b3',
          ocakavane: true, vysvetlenie: 'Kráľ c3 ho sám zobrať nesmie, lebo ho stráži strelec e6. Po Sd1 však pribudne ' +
                                       'druhý zlodej (2 : 1) a pešiak padne: S×b3 S×b3 K×b3.' },
        { id: '8.3', typ: 'slaba', fen: '5q2/1p2k3/p2p4/5bp1/1B6/P2P1P2/2K3P1/1Q6 w - - 0 1', pole: 'b7',
          otazka: 'Pozícia zo skutočnej partie. Je {figurka} <b>slabo {pokryty}</b>?',
          ocakavane: true, vysvetlenie: 'V partii mu teraz nič nehrozí, ale nikto ho nestráži — stačí jeden útok.' },
        { id: '8.4', typ: 'najdiSlabe', fen: '5q2/1p2k3/p2p4/5bp1/1B6/P2P1P2/2K3P1/1Q6 w - - 0 1',
          ocakavane: ['d3', 'g2', 'b7', 'd6', 'g5'],
          vysvetlenie: 'Pešiaky d3 a d6 majú 1 : 1 a pešiaky b7, g5 a g2 nikto nestráži. Teraz žiadneho z nich ' +
                       'nemožno zobrať so ziskom, ale sú to slabé miesta.' }
      ]
    },

    // ── Kapitola 9 — záverečná skúška (pripravujeme, krok 3) ───────────────
    {
      cislo: 9,
      nazov: 'Záverečná skúška'
    }
  ]
};
