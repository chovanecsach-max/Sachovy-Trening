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
//  PRÍPRAVA NA SKÚŠKU (kapitola s poľom `priprava`, 30. 9. 2026): stojí pred
//  skúškou a skúška sa odomkne až po nej (hráč ju môže kedykoľvek ukončiť).
//  Úlohy sú ako na skúške (druh úloh, čas), len ich je `pocet` a na každú je
//  o `casNavyse` sekúnd viac. Pozície sú iné ako na skúške.
//
//  Figúrky v textoch: K D V S J (slovensky), vo FEN anglicky (K Q R B N P).
// ============================================================================

(window.VERZIE = window.VERZIE || {})['straz-obsah.js'] = '2026-10-02';

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
        { id: '1.2', typ: 'pocet', fen: '6k1/8/5p2/4B3/3P4/5N2/8/4R1K1 w - - 0 1', pole: 'e5', co: 'obrancovia',
          ocakavane: 3, vysvetlenie: 'Strážnici sú pešiak d4, jazdec f3 a veža e1.' },
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
      preTrenerov: 'Figúrka bez útočníka aj bez obrancu (0 : 0) sa ráta. V úlohách tréningu je to viac ako polovica ' +
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

    // ── Príprava na skúšku ──────────────────────────────────────────────────
    //  Na mape stojí pred skúškou. Číslo 20 slúži len na uloženie postupu —
    //  skúška si tak nechala číslo 9 a uložený postup hráčov sa nemenil.
    {
      cislo: 20,
      nazov: 'Príprava na skúšku',
      uvod: [
        'Pred skúškou si to vyskúšaj naostro: <b>20 pozícií zo skutočných partií</b>. V každej nájdi všetky ' +
        'slabo pokryté figúrky za oboch hráčov. Pozície sú iné ako na skúške.',
        'Na každú pozíciu máš o <b>minútu viac</b> ako na skúške. Keď vyriešiš aspoň 80 % pozícií úplne a bez ' +
        'chyby, si na skúšku pripravený.',
        'Tréning môžeš kedykoľvek ukončiť tlačidlom <b>Ukončiť tréning</b>. Vyhodnotím, čo si stihol, a skúška ' +
        'sa ti odomkne.'
      ],
      preTrenerov: 'Príprava je povinná pred skúškou, ale hráč ju môže kedykoľvek ukončiť a ísť na skúšku (kto skúšku ' +
                   'už skúšal, má ju odomknutú aj bez prípravy). ' +
                   'Pozície sú z úloh tréningu Slabo pokryté figúrky, vybrané ' +
                   'rovnako ako pozície skúšky, ale iné (60 pozícií s 3 až 5 riešeniami, po 12 z každej úrovne ELO, ' +
                   'bez pozícií, kde o slabosti rozhoduje kráľ; náhodne sa vyberie 20). ' +
                   'Čas: ako na skúške + 60 s na každú pozíciu. Príprava nedáva hviezdičky ani odznak, nezapisuje sa ' +
                   'do štatistík tréningu a nemení ELO. Najlepší výsledok a počet pokusov uvidíš v menu Tréner → ' +
                   'Prehľad hier.',
      priprava: {
        pocet: 20,
        casNavyse: 60,           // sekúnd navyše oproti skúške na každú pozíciu
        // 60 pozícií z úloh tréningu Slabo pokryté figúrky (tabuľka skill_puzzles), 3 až 5 riešení,
        // 10 až 22 figúrok, po 12 z každej úrovne ELO, mimo skúšky a kapitol
        pozicie: [
          '5rk1/pp1rqpp1/4p2p/3n4/8/PQ3N2/1P3PPP/3RR1K1 w - - 0 1',
          'kr6/1p3Q2/p6q/4R3/3P4/2P5/PP6/K3R2r b - - 0 1',
          '3r2k1/4bppp/b3p3/q2pP3/3B4/1RN1Q3/2P2PP1/6K1 w - - 0 1',
          '4r1k1/p1B2pp1/5np1/3p4/6P1/3P3P/P1R2qPK/3Q4 b - - 0 1',
          '1rq2k2/2p1rp2/p3p3/1n1pP2p/2pP1P1P/4P3/P1Q2K2/6RR w - - 0 1',
          '8/8/p1r2pk1/8/P2RK1P1/2P5/3p4/8 b - - 0 1',
          'r4rk1/ppp3p1/7p/4N1q1/3NQn2/8/PP3PPP/R3R1K1 b - - 0 1',
          '2k1r3/1p1r2pp/1B3n2/4p3/2P5/3P2KP/PP1R2P1/R7 b - - 0 1',
          '6r1/5p1k/3Nb1q1/3pP2p/1Bp5/P4PP1/3Q1K1R/8 b - - 0 1',
          '6k1/5p2/4n3/6pp/R3P3/2rRKP1P/5P2/8 b - - 0 1',
          '8/1p4p1/p1p1pk2/2Pp3p/1P1P3P/P3K3/5PP1/8 w - - 0 1',
          '4rk2/7Q/b4q2/4p3/1P1n2R1/P2P4/6PP/6K1 w - - 0 1',
          '6q1/2p5/3b4/1k6/1rbB4/5Q2/5PPP/R5K1 w - - 0 1',
          '8/4q1pk/4P2p/3Q4/1p6/6P1/6KP/8 w - - 0 1',
          '8/6pk/4q2p/3p3P/3Pb1P1/2PNP3/4K3/3Q4 b - - 0 1',
          '3r4/8/3R4/4P3/1P5P/2kp2P1/5P2/5K2 b - - 0 1',
          '2r1r3/R5pk/6qp/8/Q7/3N4/2P2PPP/5K2 b - - 0 1',
          '3r1r2/p3q2k/6pp/2p5/2Bnp3/1P4PP/PQ3R2/5RK1 w - - 0 1',
          '7Q/4q3/1kp2n2/p2p4/P2P4/2PB4/3K4/8 w - - 0 1',
          '4R3/pp1r1qk1/6pp/2p5/4Q3/7P/P5PK/8 w - - 0 1',
          'r4rk1/p5pp/1pn1q3/1Q6/P7/5N2/1R2BKPP/1b6 w - - 0 1',
          '2kr1r2/1pp4p/p3b3/3q4/8/1PPB4/P1Q4P/1K1R1R2 b - - 0 1',
          '6k1/6p1/R7/2P5/6pP/6P1/p4K2/r7 b - - 0 1',
          '3r4/p2q3k/1p2pnp1/5p2/3P1P1P/2P2QK1/PP1B4/7R b - - 0 1',
          'r2q1r1k/6pp/1p1p4/2b1RP2/p7/P4Q2/BPP3PP/2KR4 b - - 0 1',
          '3r4/6k1/3q2pp/Q7/P1b5/4P2P/5PP1/4R1K1 w - - 0 1',
          '5b2/kp2r3/p6p/4p1p1/Bq6/7P/P1Q3P1/2R4K w - - 0 1',
          '6k1/7p/R3pp2/2Pb2p1/3P2q1/4P3/5QPP/6K1 b - - 0 1',
          '3kr3/ppp1n2R/8/3pP3/3P4/2P2Q2/q5P1/4KR2 b - - 0 1',
          '8/5kb1/4rpp1/1pQ5/4r3/P5P1/1P3PP1/2K4R b - - 0 1',
          '6k1/7p/Bp1r2p1/5p2/8/5P2/n5PP/4R1K1 w - - 0 1',
          '2r4r/Qbq2p1p/4kp2/3pp3/B7/P7/1PP2PPP/2KR3R b - - 0 1',
          '1k3r2/2p5/1p6/PQ4N1/6nP/6P1/6K1/3r4 b - - 0 1',
          '2r5/8/p1r1p3/5p1p/1PbR2pP/4Pk2/1BK5/6R1 w - - 0 1',
          '5rk1/1R3p1p/4p1p1/4P3/1Q6/2PqnN1P/5PP1/6K1 b - - 0 1',
          '5R2/8/4p1K1/3p4/3P3k/pr4p1/6P1/8 w - - 0 1',
          '4r2k/3b2pp/3P4/2Q3R1/1P3nq1/5pP1/1R3P2/5BK1 b - - 0 1',
          '1r4k1/5ppp/1p1b4/2p5/P1Nq4/1P5P/2R1QPP1/6K1 b - - 0 1',
          '2kr1b1r/pp3ppp/2n2n2/1N1q4/5B2/3b2P1/1R3P1P/2Q1R1K1 w - - 0 1',
          '8/3R1p1k/6bp/1p3B2/2p1P3/1r4P1/5PKP/8 w - - 0 1',
          '1q3b1k/6p1/5p1p/2pPpPP1/2P4P/2N2QK1/8/8 b - - 0 1',
          '6k1/pp3p1p/1q3bp1/8/8/P6P/1P2QPPK/2B5 b - - 0 1',
          '8/3P4/5rpp/4Q3/2P1P2k/6N1/3q2PP/5BK1 b - - 0 1',
          '4r2k/4qpp1/p2p3p/1p1P4/3B2P1/P1P4P/1P1Q2BK/4r3 w - - 0 1',
          'r5k1/5r1p/5n2/3p4/pBpP4/P5P1/1Pq2RKQ/4R3 b - - 0 1',
          '5rk1/pppq2p1/3p1n1p/8/4r3/2P3B1/P4PPP/R2QR1K1 w - - 0 1',
          'r2r2k1/pp1b3p/6pB/2bN1pN1/2P5/5K1P/2R3P1/8 w - - 0 1',
          '2r5/5pp1/p3k2p/3rP3/2p2K2/2Bp4/PP4P1/2R1R3 b - - 0 1',
          '8/Q4pk1/4p1p1/5r1p/2R4P/1K6/8/2r5 b - - 0 1',
          '8/8/2b1Qr2/2q2rpk/1pB2p2/3P1P2/6K1/R7 w - - 0 1',
          '3rrk2/2p3p1/p2q1p1p/1p2P3/6Q1/2P5/PP2RPPP/R5K1 b - - 0 1',
          '2b2rk1/ppN2pbp/6p1/6q1/4P3/3Q2P1/PPP4P/R4RK1 b - - 0 1',
          '6R1/7R/8/p1p5/r1k5/7P/2r3P1/6K1 w - - 0 1',
          '5rk1/pbp4p/1p4p1/4p2q/4P3/1PP1R3/P2R2Q1/6K1 w - - 0 1',
          'r3q1bk/ppp2rRp/7Q/5p2/8/7R/1P4P1/6K1 w - - 0 1',
          '2k5/6R1/1p1b2N1/8/8/Pr5P/4RKP1/8 b - - 0 1',
          '8/p2bk1p1/3p1q1p/1p1P1p2/7P/PP2N3/5PP1/4Q1K1 w - - 0 1',
          '2R5/5p2/8/1p3kp1/1Nb2p2/P1P2K1P/1P1r1PP1/8 b - - 0 1',
          '8/2k3p1/8/PR1p1r2/2p5/2P1K3/1P6/8 b - - 0 1',
          '7k/1p3Bb1/1p4Q1/8/6P1/r6q/5P2/2R3K1 b - - 0 1'
        ]
      }
    },

    // ── Kapitola 9 — záverečná skúška ──────────────────────────────────────
    {
      cislo: 9,
      nazov: 'Záverečná skúška',
      uvod: [
        'Grošík ti zverí celý trh! Čaká ťa <b>10 pozícií zo skutočných partií</b>.',
        'V každej nájdi všetky slabo pokryté figúrky za oboch hráčov. Máš na to čas, takže buď rýchly aj presný.',
        'Keď vyriešiš aspoň 8 pozícií úplne a bez chyby, získaš odznak <b>Strážca trhu</b>.'
      ],
      uvodKoniec: 'Ak sa nepodarí, poviem ti, ktoré kapitoly si zopakovať. Pozície budú zakaždým iné.',
      zapamataj: 'Strážca trhu spočíta pri každej figúrke zlodejov aj strážnikov — za oboch, aj pešiakov.',
      preTrenerov: 'Pozície sú zo skutočných partií, z tých istých ako úlohy v tréningu Slabo pokryté figúrky ' +
                   '(60 pozícií s 3 až 5 riešeniami, náhodne sa vyberie 10). Vynechané sú pozície, kde o slabosti ' +
                   'rozhoduje kráľ ako útočník na krytú figúrku. Čas ako v tréningu na úrovni 1: 20 s + 10 s na ' +
                   'každé riešenie. Skúška sa nezapisuje do štatistík tréningu a nemení ELO. Skúšku možno opakovať, ' +
                   'zakaždým s inými pozíciami. Kto ju zložil a ako idú kapitoly, uvidíš v menu Tréner → Prehľad hier.',
      skuska: {
        typ: 'najdiSlabe',
        pocet: 10,
        hranica: 8,              // vyriešených úplne a bez chyby
        casZaklad: 20,           // sekúnd (ako tréning, úroveň 1)
        casNaRiesenie: 10,       // sekúnd za každé riešenie
        textZlozena: 'Teraz si naozajstný strážca trhu a môžeš trénovať Slabo pokryté figúrky v menu Zručnosti.',
        odkaz: { text: 'Trénovať Slabo pokryté figúrky →', href: 'skills.html?type=underdefended' },
        // Rozbor chýb: ktorá kapitola pomôže
        dovody: {
          2: 'Prehliadnutá figúrka bez strážnika',
          3: 'Prehliadnutá figúrka s rovnakým počtom zlodejov a strážnikov',
          4: 'Označená dobre pokrytá figúrka',
          5: 'Prehliadnutý pešiak alebo celá strana, klik na kráľa',
          6: 'Chyba pri figúrke v batérii',
          7: 'Chyba pri viazanej figúrke'
        },
        // 60 pozícií z úloh tréningu Slabo pokryté figúrky (tabuľka skill_puzzles),
        // 3 až 5 riešení, 10 až 22 figúrok, po 12 z každej úrovne ELO
        pozicie: [
          '5rk1/2p2pp1/1q5p/8/3QbP2/2P5/1P4PP/2BR2K1 b - - 0 1',
          '8/8/p1p4p/1p2k1p1/1P4P1/P2KP2P/8/8 w - - 0 1',
          '8/ppq5/2pp4/2k5/1nP1Q3/1B5P/P5PK/8 w - - 0 1',
          '1Qn5/p2q2pp/2N1ppk1/1P1p4/8/7P/5PP1/6K1 w - - 0 1',
          '4r3/1p1n1pkp/2q3p1/3pr3/p2Q4/P1P4P/1P2BPP1/R3R1K1 w - - 0 1',
          'r2qnrk1/5ppp/2p5/1p6/1P1bPN2/6P1/1Q1P2BP/R4R1K w - - 0 1',
          'r1r4k/p5pp/1p2R3/6q1/8/2Q5/5PPP/4R1K1 w - - 0 1',
          '1RN3k1/5pp1/8/2b1P3/3r1P2/6P1/7P/6K1 b - - 0 1',
          '5rk1/5pp1/1p6/4P2Q/3R1P2/6P1/1q5P/2rR3K b - - 0 1',
          '2kr3r/ppp1n2p/8/8/4q2N/2Pp1RP1/PP1Q2KP/R7 w - - 0 1',
          'r4r2/4q1k1/p3pp2/3b3P/2pN4/P3Q3/1PP5/2KR4 w - - 0 1',
          '3R2Q1/p5p1/4p1k1/5n1p/3Pq3/6PK/5P1P/8 b - - 0 1',
          '5r1k/1R6/3p3p/2b5/2P1B1p1/3P2P1/5r1P/1R5K b - - 0 1',
          '8/8/2p2k2/1p1p1p1p/pP1P3P/P3PPK1/8/8 w - - 0 1',
          '2k2r2/2p5/1Q4p1/3p1r1p/q1n5/4P3/5PPP/1RR3K1 w - - 0 1',
          '4r2k/p1p3bp/2r3p1/2q2p2/Q1Pp1B2/1P3P1P/P5P1/R4RK1 b - - 0 1',
          '6k1/p1p3pp/3qp2r/3pN3/1PpPbP2/4P3/Q7/R4RK1 b - - 0 1',
          '5rk1/pp3p1p/q5p1/8/4NQ2/5KP1/Pr6/2R4R b - - 0 1',
          '1b1q2k1/5ppp/2b5/8/3P4/2PQ2P1/P1BN1P1K/5R2 b - - 0 1',
          'r5k1/1bq3rp/6pP/4p1p1/pp2P3/3B4/PPP1Q3/1K3R2 w - - 0 1',
          'r3r1k1/2pR1p1p/p5p1/1p6/8/P1P2qP1/1PQ2P1P/3R2K1 b - - 0 1',
          '2b5/4k3/p3nb2/1p3R2/6Bq/3P3P/P3Q2K/8 w - - 0 1',
          '8/pP5k/6p1/1P1Bp3/4PbP1/1Q1K4/6q1/8 b - - 0 1',
          '1r4k1/1r4p1/4p2p/2PpPp2/1pnP4/2q2N1P/1R2QPPK/1R6 w - - 0 1',
          '1r6/R4R1p/1pp2np1/5pk1/8/8/6PP/6K1 w - - 0 1',
          '6k1/6pp/2Q1b3/1p6/p4BnP/P1P3P1/1Pq3B1/6K1 b - - 0 1',
          '8/1B2r1p1/1p1k4/p2n1R2/8/7P/4p1P1/2r1R2K w - - 0 1',
          '1r1qr1k1/n2p1p1p/Bp4p1/3N4/P1P5/4R1P1/1P3P1P/R5K1 w - - 0 1',
          '6k1/p4ppp/1p2p3/2rq4/5P2/4PQ2/PP4PP/5RK1 w - - 0 1',
          '3r2k1/pp3pp1/2p2q1p/3n1B2/4Q3/8/PP3PPP/4R1K1 w - - 0 1',
          '2r5/p7/1p1r2p1/2b5/kq5R/6P1/P3Q1PP/7K w - - 0 1',
          'r1b2rk1/1p2q1pp/p3p3/3B4/3Q4/8/PPP2PPP/2KRR3 b - - 0 1',
          '6kN/1pp2pp1/1pb5/8/3R1R2/2P3KP/r7/8 b - - 0 1',
          '3q1r2/5pk1/p4np1/4Q2p/Pp5P/1P5N/2P3P1/1K2R3 b - - 0 1',
          'r5k1/5pp1/p6p/1p6/8/2P1rQ2/q4PPP/3R2K1 w - - 0 1',
          'rn3rk1/pB3ppp/6q1/8/8/3P2Pb/PP2PK1P/R1BQ3R b - - 0 1',
          '8/8/1P5k/P2p4/3Pb3/4P3/r5p1/4K1R1 w - - 0 1',
          'r2q3k/1p2r1pp/2p1B2R/p7/P5Q1/2Pn3P/6P1/6K1 w - - 0 1',
          'r4k2/5p2/2p1b3/8/5Q2/6RP/5PPK/r1q5 w - - 0 1',
          '2rqr1k1/5ppp/8/p1pb4/PpNP4/1P6/5PPP/2RQR1K1 w - - 0 1',
          '4r3/7k/8/8/P2P1RQ1/1P1K2PP/8/2q5 b - - 0 1',
          'Q7/6pk/3pr1pp/3N4/P7/KP6/2q5/6R1 b - - 0 1',
          '6k1/B4p1p/b5p1/4n3/4B2P/4P1P1/2R2PK1/1r6 b - - 0 1',
          'r4bk1/pp3rpp/n1p2p2/5N2/8/5NR1/PB2bPPP/R5K1 w - - 0 1',
          'r2r2k1/pp1b1pqN/2n1p3/5p2/8/P2B2Q1/5PPP/2R2RK1 w - - 0 1',
          '8/1B3R2/2K1P1p1/6kp/2n5/8/3r1P1P/8 b - - 0 1',
          '6k1/Q2r1pp1/1B2p2p/4n3/8/3q2P1/5P1P/5RK1 w - - 0 1',
          '6k1/p5r1/1pp4p/3p3q/3P1QP1/2P5/PP3R2/6K1 w - - 0 1',
          '3n4/4r1p1/p3pk2/1p1r1pp1/N2Pp3/P1R1P2P/1PR2PP1/6K1 w - - 0 1',
          '5rk1/5ppp/3Rp3/4P3/3P1QP1/8/2rq4/5RK1 w - - 0 1',
          '5k2/8/5pp1/3Pp2P/4P1K1/3n1PN1/8/8 b - - 0 1',
          'r7/2pkq1pQ/p1pp1p2/4n1p1/4P3/P1NP4/1PPB1b2/2K4R w - - 0 1',
          '5rk1/2p2p2/6rp/1p4q1/1P1RQb2/P4P2/2B1KP2/7R b - - 0 1',
          '4rk2/ppp2pp1/1q2b2p/3Q4/8/1P2R3/P1P2PPP/4R1K1 b - - 0 1',
          '1k4r1/p1p3q1/2p5/4P3/1P1PQ3/2P5/P4R1p/5R1K b - - 0 1',
          '1k2r3/pp4p1/2q5/2PR1Qp1/P7/4P3/r7/3R1K2 w - - 0 1',
          '2r2k1r/p4qp1/1p2b2p/3p3Q/3R4/P1P3P1/1P3P1P/5RK1 w - - 0 1',
          '5rk1/5bbp/R3ppp1/1q1n4/3P4/3N1N1P/1r3PPB/Q4RK1 b - - 0 1',
          '1r3rk1/7p/1pBp4/2bP2p1/6R1/1Q6/P5PK/4q3 w - - 0 1',
          '2k3r1/p2qn2p/2p5/3p4/N2P4/8/PPP1QP1K/R3R3 b - - 0 1'
        ]
      }
    }
  ]
};
