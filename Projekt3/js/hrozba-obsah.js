// ============================================================================
//  hrozba-obsah.js — obsah hry Hrozba na trhu (kapitoly, texty, úlohy)
// ----------------------------------------------------------------------------
//  Hra vysvetľuje zručnosť Priame hrozby. Štvrtá hra s Grošíkom: nadväzuje
//  na Šachový trh (branie so ziskom = zisk hneď) a ide o krok ďalej —
//  hrozba je tichý ťah, po ktorom by hráč mal branie so ziskom, keby súper
//  vynechal ťah. Na trh prišiel opatrný zlodej: nekradne hneď, najprv sa
//  postaví tak, aby mohol ukradnúť nabudúce.
//
//  Jediné miesto, kde sú texty a pozície hry. Herný rámec (hra-engine.js) ich
//  len zobrazuje. Správne odpovede sa NEPÍŠU ručne — vždy ich vypočíta
//  VisionCore rovnako ako tréning Priame hrozby. Pole „ocakavane" slúži len na
//  kontrolu: keby sa výpočet a scenár rozišli, hra to vypíše do konzoly.
//
//  TYPY ÚLOH:
//    jeHrozba       — je ťah `tah` priama hrozba? Áno / Nie (fen, tah)
//    precoNieHrozba — prečo ťah `tah` nie je hrozba? (fen, tah, moznosti)
//                     dôvody: ticha (branie alebo šach), nic (nič nové nehrozí),
//                     super (súper niečo získa), vazba (figúrka je viazaná)
//    coHrozi        — čo by hráč po ťahu `tah` zobral so ziskom? (fen, tah)
//    najdiHrozbu    — zahraj hrozbu strany `strana` (predvolene tá na ťahu)
//    najdiHrozby    — nájdi všetky hrozby za oboch (fen, pomocka); aj záverečná skúška
//  Ťah sa píše ako v tréningu: 'd1d4'.
//
//  V pozíciách na začiatku nikomu nič nevisí a nikto nie je v šachu — tak ako
//  v tréningu. Výnimkou je úloha 2.1, ktorá ukazuje branie visiacej figúrky.
//
//  KAPITOLA môže mať aj:
//    tip    — rada Grošíka pred odpoveďou pre všetky úlohy kapitoly
//    cennik — v úvode ukázať ceny figúrok (ako v Šachovom trhu)
//
//  ÚLOHA môže mať aj:
//    otazka — vlastné znenie otázky ({tah} = napr. „Vd1–d4")
//    tip    — vlastná rada Grošíka pred odpoveďou
//
//  Figúrky v textoch: K D V S J (slovensky), vo FEN anglicky (K Q R B N P).
// ============================================================================

(window.VERZIE = window.VERZIE || {})['hrozba-obsah.js'] = '2026-09-30b';

const OBSAH_HROZBA = {
  kluc: 'hrozba-na-trhu',
  // Verzia číslovania kapitol (pozri trh-obsah.js). Pri zmene poradia kapitol sa zvýši.
  verzia: 1,
  nazov: 'Hrozba na trhu',
  podtitul: 'Hra, ktorá vysvetľuje zručnosť Priame hrozby',
  sprievodca: 'Grošík',
  pozdrav: 'Ahoj, to som zase ja, Grošík! Na trhu sa objavil opatrný zlodej. Nekradne hneď — najprv sa postaví ' +
           'tak, aby mohol ukradnúť nabudúce. Naučím ťa, ako sa počíta priama hrozba v tejto hre ' +
           'a v zručnostiach. Vyber si kapitolu.',

  // Texty, ktoré sa líšia od Šachového trhu
  texty: {
    pochvaly: ['Výborne!', 'Presne tak!', 'Hrozbu vidíš na prvý pohľad.', 'Správne!', 'To je ono!'],
    odznak: 'Majster hrozby',
    zosit: 'Toto sú pravidlá, ktoré si už získal. Majster hrozby ich má vždy po ruke.',
    bublinaUlohy: 'Čo by si mohol zobrať, keby súper vynechal ťah?',
    odkazy: [{ text: 'Vidlička na trhu', href: 'vidlicka-na-trhu.html' }],
    koniec3: 'Skvelá práca! Tri hviezdičky.',
    koniec2: 'Dobrá práca! Na tri hviezdičky ti chýba len kúsok.',
    koniec1: 'Kapitola je za tebou. Skús ju ešte raz — pôjde to lepšie.'
  },

  kapitoly: [
    // ── Kapitola 1 ─────────────────────────────────────────────────────────
    {
      cislo: 1,
      nazov: 'Čo je hrozba',
      tip: 'Predstav si, že súper vynechá ťah. Mohol by si potom niečo zobrať so ziskom?',
      uvod: [
        'Na Šachovom trhu si sa naučil <b>branie so ziskom</b> — zisk hneď teraz. Hrozba je o krok skôr. ' +
        '<b>Priama hrozba</b> je ťah, po ktorom by si mal branie so ziskom, keby súper vynechal ťah.',
        'Ako zlodej, ktorý sa postaví k nestráženému stánku. Teraz ešte nekradne — ukradne nabudúce, ak majiteľ ' +
        'nič neurobí. V úlohách na začiatku nikomu nič nevisí: nikto nemôže hneď nič zobrať so ziskom.'
      ],
      zapamataj: 'Hrozba je ťah, po ktorom by som nabudúce zobral niečo so ziskom.',
      prePokrocilych: 'Zručnosť sa pýta: keby súper nehral (vynechal ťah), mal by som branie so ziskom, ktoré som ' +
                      'pred ťahom nemal? Zisk počíta celým rebríkom výmeny ako na Šachovom trhu.',
      preTrenerov: 'Tréning Priame hrozby hľadá všetky tiché ťahy za oboch hráčov, po ktorých by hráč pri vynechanom ' +
                   'ťahu súpera mal nové branie so ziskom alebo mat jedným ťahom, a súper tým ťahom nič nové nezíska. ' +
                   'V pozíciách pred ťahom nikto nemá branie so ziskom a nikto nie je v šachu. Najčastejšie hrozí veža ' +
                   '(25 %) a dáma (23 %), terčom je najčastejšie pešiak (42 %).',
      ulohy: [
        { id: '1.1', typ: 'jeHrozba', fen: '6k1/5pp1/7p/8/1n6/8/5PPP/3R2K1 w - - 0 1', tah: 'd1d4',
          ocakavane: true, vysvetlenie: 'Veža z d4 napadne jazdca b4 a nikto ho nestráži. Keby čierny vynechal ťah, ' +
                                        'veža by ho zobrala.' },
        { id: '1.2', typ: 'jeHrozba', fen: '6k1/5pp1/7p/2n5/8/8/5PPP/4R1K1 w - - 0 1', tah: 'e1e3',
          ocakavane: false, vysvetlenie: 'Veža z e3 nič nenapadne. Keby bol biely hneď znova na ťahu, nemal by čo ' +
                                         'zobrať so ziskom.' },
        { id: '1.3', typ: 'najdiHrozbu', fen: '6k1/3r1pp1/7p/8/8/8/5PPP/5BK1 w - - 0 1',
          ocakavane: ['f1b5'], vysvetlenie: 'Strelec z b5 napadne vežu d7. Nikto ju nestráži a strelca na b5 nikto nenapadne.' },
        { id: '1.4', typ: 'jeHrozba', fen: '6k1/6p1/5n1p/8/4P3/5P2/6PP/6K1 w - - 0 1', tah: 'e4e5',
          ocakavane: true, vysvetlenie: 'Pešiak z e5 napadne jazdca f6. Jazdca síce stráži pešiak g7, ale pešiak ' +
                                        'za jazdca je dobrý obchod: zisk +2.' },
        { id: '1.5', typ: 'coHrozi', fen: '6k1/6p1/5p1p/b3n3/8/8/5PPP/3R2K1 w - - 0 1', tah: 'd1d5',
          ocakavane: ['a5'], vysvetlenie: 'So ziskom sa dá zobrať len strelec a5 — nikto ho nestráži. Jazdca e5 ' +
                                          'stráži pešiak f6, veža za jazdca by bola strata.' },
        { id: '1.6', typ: 'najdiHrozbu', fen: '6k1/5pp1/7p/8/2b5/8/5PPP/3Q2K1 w - - 0 1',
          ocakavane: ['d1a4', 'd1d4', 'd1g4', 'd1c2', 'd1c1'],
          vysvetlenie: 'Strelca c4 nikto nestráži. Dáma ho napadne z a4, d4, g4, c2 aj c1. Z e2 nie — tam by ju ' +
                       'strelec zobral.' }
      ]
    },

    // ── Kapitola 2 ─────────────────────────────────────────────────────────
    {
      cislo: 2,
      nazov: 'Len tichý ťah',
      tip: 'Berie ťah niečo alebo dáva šach? Potom to hrozba nie je.',
      uvod: [
        'Priama hrozba je vždy <b>tichý ťah</b>: nič neberie a nedáva šach. Branie so ziskom je zisk hneď — ' +
        'to je iná zručnosť. Aj šach je samostatná zručnosť.',
        'Pozor aj na <b>odkrytý šach</b>: keď figúrka uhne a šach dá iná figúrka za ňou, je to stále šach, ' +
        'nie tichý ťah.'
      ],
      zapamataj: 'Hrozba je tichý ťah: nič neberie a nedáva šach.',
      prePokrocilych: 'Zručnosť vylúči každý ťah, po ktorom je súperov kráľ v šachu, aj keď šach dáva iná figúrka. ' +
                      'Šach s útokom na ďalšiu figúrku býva vidlička — tú precvičuje Vidlička na trhu.',
      preTrenerov: 'Tri zručnosti sa neprekrývajú: branie so ziskom (zisk hneď), šachy a priame hrozby (tiché ťahy). ' +
                   'Hráč, ktorý v tréningu Priame hrozby označí branie alebo šach, dostane chybu.',
      ulohy: [
        { id: '2.1', typ: 'jeHrozba', fen: '6k1/5pp1/7p/1n6/8/8/5PPP/1R4K1 w - - 0 1', tah: 'b1b5',
          tip: 'Tentoraz jazdec b5 visí — biely ho môže zobrať hneď. Je jeho zobratie hrozba?',
          ocakavane: false, vysvetlenie: 'Veža berie jazdca b5, ktorý visí. To je branie so ziskom — zisk hneď, nie hrozba.' },
        { id: '2.2', typ: 'jeHrozba', fen: 'r5k1/6pp/8/8/8/8/5PPP/3Q2K1 w - - 0 1', tah: 'd1d5',
          ocakavane: false, vysvetlenie: 'Dd5 dáva šach a napadne vežu a8. Je to šach (dokonca vidlička), ale nie ' +
                                         'tichý ťah — hrozba to nie je.' },
        { id: '2.3', typ: 'precoNieHrozba', fen: '4k3/1p3pp1/7p/8/4N3/8/5PPP/4R1K1 w - - 0 1', tah: 'e4c5',
          ocakavane: 'ticha', vysvetlenie: 'Jazdec uhne a veža e1 dá kráľovi e8 šach. Odkrytý šach je šach, nie tichý ťah.' },
        { id: '2.4', typ: 'jeHrozba', fen: 'r5k1/5pp1/7p/8/8/8/5PPP/3Q2K1 w - - 0 1', tah: 'd1d5',
          ocakavane: true, vysvetlenie: 'Teraz stojí na f7 pešiak, takže Dd5 šach nedáva. Je to tichý ťah a dáma ' +
                                        'napadne nestráženú vežu a8. Porovnaj s úlohou 2.2.' },
        { id: '2.5', typ: 'najdiHrozbu', fen: '6k1/5pp1/2n4p/8/8/8/5PPP/1R2R1K1 w - - 0 1',
          ocakavane: ['b1b6', 'b1c1', 'e1c1'], tip: 'Pozor, šach nie je hrozba. Hľadaj tichý ťah.',
          vysvetlenie: 'Jazdca c6 nikto nestráži: veža ho napadne z b6 alebo z c1. Šachy Vb8+ a Ve8+ hrozbou nie sú.' }
      ]
    },

    // ── Kapitola 3 ─────────────────────────────────────────────────────────
    {
      cislo: 3,
      nazov: 'Hrozba musí stáť za to',
      tip: 'Oplatilo by sa to branie? Spočítaj výmenu ako na Šachovom trhu.',
      cennik: true,
      uvod: [
        'Zlodej sa nepostaví k stánku, z ktorého nič nevynesie. Hrozba sa počíta, len keď by sa branie ' +
        '<b>oplatilo</b> — keď by si na výmene zarobil.',
        'Napadnúť krytú figúrku rovnakej ceny nestačí: bola by to len výmena. Napadnúť cennejšiu figúrku sa ' +
        'oplatí, aj keď je krytá. Ceny sú ako na Šachovom trhu:'
      ],
      zapamataj: 'Hrozba sa počíta, len keď by sa branie oplatilo (zisk podľa rebríka výmeny).',
      prePokrocilych: 'Zisk sa počíta celou výmenou na poli terča, s batériami aj väzbami na kráľa — presne ako ' +
                      'v zručnosti Branie so ziskom. Výmena so ziskom 0 sa nepočíta.',
      preTrenerov: 'Terčom hrozby je v tréningu najčastejšie pešiak (42 %). Časté chyby: hráč označí útok na krytú ' +
                   'figúrku rovnakej ceny, alebo prehliadne útok na krytú, ale cennejšiu figúrku.',
      ulohy: [
        { id: '3.1', typ: 'jeHrozba', fen: '4b1k1/3n1pp1/7p/8/3P4/5N2/5PPP/6K1 w - - 0 1', tah: 'f3e5',
          ocakavane: false, vysvetlenie: 'Jazdec napadne jazdca d7, ale toho stráži strelec e8 — bola by to len ' +
                                         'výmena. A pešiaka f7 stráži kráľ.' },
        { id: '3.2', typ: 'jeHrozba', fen: '6k1/1p3pp1/2r4p/8/8/8/5PPP/5BK1 w - - 0 1', tah: 'f1b5',
          ocakavane: true, vysvetlenie: 'Strelec napadne vežu c6. Stráži ju pešiak b7, ale strelec za vežu je zisk +2.' },
        { id: '3.3', typ: 'coHrozi', fen: '4k3/1p1r4/2b5/8/2p5/5N1P/5PP1/6K1 w - - 0 1', tah: 'f3e5',
          ocakavane: ['c4', 'd7'], vysvetlenie: 'Veža d7 je cennejšia ako jazdec (zisk +2) a pešiaka c4 nikto ' +
                                                 'nestráži. Strelca c6 stráži pešiak b7 — to by bola len výmena.' },
        { id: '3.4', typ: 'jeHrozba', fen: '4b1k1/3r1pp1/7p/8/3P4/2P2N2/5PPP/6K1 w - - 0 1', tah: 'f3e5',
          ocakavane: true, vysvetlenie: 'Teraz na d7 stojí veža. Stráži ju strelec e8, ale jazdec za vežu je ' +
                                        'zisk +2. Porovnaj s úlohou 3.1.' },
        { id: '3.5', typ: 'precoNieHrozba', fen: '6k1/5pp1/1p5p/p7/8/8/5PPP/3Q2K1 w - - 0 1', tah: 'd1d5',
          ocakavane: 'nic', vysvetlenie: 'Dáma napadne pešiaka a5 aj f7, ale oba sú kryté. Dáma za pešiaka by bola ' +
                                         'veľká strata.' },
        { id: '3.6', typ: 'najdiHrozbu', fen: '6k1/1p3pp1/2n4p/4b3/8/8/5PPP/2BR2K1 w - - 0 1',
          ocakavane: ['f2f4', 'd1d7'], tip: 'Nie každé napadnutie je hrozba. Spočítaj, či sa branie oplatí.',
          vysvetlenie: 'Pešiak f4 napadne strelca e5: stráži ho jazdec c6, ale pešiak za strelca je zisk +2. Veža d7 ' +
                       'napadne nestráženého pešiaka b7. Strelec na f4 by bol len výmena.' }
      ]
    },

    // ── Kapitola 4 ─────────────────────────────────────────────────────────
    {
      cislo: 4,
      nazov: 'Súper nič nezíska',
      tip: 'Nezíska tvojím ťahom niečo súper? Pozri sa na figúrku, ktorá sa pohla, aj na ostatné.',
      uvod: [
        'Zlodej musí byť opatrný: keď sa postaví k stánku, nesmie nechať nič ležať. Hrozba sa počíta, len keď ' +
        '<b>súper po ťahu nič nové nezíska</b>.',
        'Súper nesmie zobrať so ziskom figúrku, ktorá sa pohla, ani inú figúrku, ktorú ťah nechal bez ochrany. ' +
        'Nesmie dať mat ani premeniť pešiaka so ziskom. <b>Výmena však nevadí</b>: keď môže súper hroziacu figúrku len vymeniť, nič nezíska ' +
        'a hrozba platí. Pri vidličke to bolo inak — vidličkár musel stáť bezpečne.'
      ],
      zapamataj: 'Po hrozbe súper nič nezíska: nič mu nevisí, nepremení pešiaka a nedá mat. Výmena nevadí.',
      prePokrocilych: 'Zručnosť je prísna: stačí, aby súper po ťahu získal hocičo nové, aj pešiaka na druhom konci ' +
                      'šachovnice, a ťah hrozbou nie je — aj keby hrozil zobrať dámu.',
      preTrenerov: 'Miernejšie pravidlo (porovnať, kto získa viac) sa pri tvorbe zručnosti skúšalo dvakrát a zamietlo — ' +
                   'prinieslo rovnako veľa sporných riešení ako dobrých. Výmena hroziacej figúrky sa za zisk súpera ' +
                   'nepočíta: v tréningu je to 21 % riešení (napríklad veža napadne vežu, ktorá ju môže zobrať späť).',
      ulohy: [
        { id: '4.1', typ: 'jeHrozba', fen: '6k1/5pp1/1p1r3p/p7/8/8/5PPP/4B1K1 w - - 0 1', tah: 'e1b4',
          ocakavane: false, vysvetlenie: 'Strelec napadne vežu d6, ale pešiak a5 ho zoberie zadarmo.' },
        { id: '4.2', typ: 'jeHrozba', fen: '6k1/6p1/r6p/5P2/8/8/6PP/4R1K1 w - - 0 1', tah: 'e1e6',
          ocakavane: true, vysvetlenie: 'Veža napadne nestráženú vežu a6. Čierna veža ju môže zobrať, ale pešiak f5 ' +
                                        'vezme späť — je to len výmena, súper nič nezíska. Hrozba platí.' },
        { id: '4.3', typ: 'jeHrozba', fen: '3r2k1/1p3pp1/7p/8/3B4/8/5PPP/3R2K1 w - - 0 1', tah: 'd1b1',
          ocakavane: false, vysvetlenie: 'Veža napadne pešiaka b7, ale prestane strážiť strelca d4 — ten by potom ' +
                                         'padol.' },
        { id: '4.4', typ: 'precoNieHrozba', fen: '4r1k1/1p3pp1/2n4p/8/8/5P2/5PPP/3Q2K1 w - - 0 1', tah: 'd1d7',
          ocakavane: 'super', vysvetlenie: 'Dáma napadne vežu e8 aj pešiaka b7, ale opustí prvý rad a čierny dá mat Ve1.' },
        { id: '4.5', typ: 'jeHrozba', fen: '6k1/3r1pp1/b6p/8/2N5/1P6/5PPP/5RK1 w - - 0 1', tah: 'c4e5',
          ocakavane: false, vysvetlenie: 'Jazdec napadne vežu d7, ale otvorí strelcovi a6 cestu k veži f1 — strelec ' +
                                         'by ju zobral so ziskom.' },
        { id: '4.6', typ: 'najdiHrozbu', fen: '6k1/5pp1/1r2p2p/2p5/8/2B5/5PPP/5RK1 w - - 0 1',
          ocakavane: ['c3a5'], tip: 'Pozor na pasce: niektoré napadnutia nechajú niečo visieť.',
          vysvetlenie: 'Vežu b6 nikto nestráži. Z a5 ju strelec napadne a stojí bezpečne. Na d4 by ho zobral pešiak ' +
                       'c5 a veža na b1 by visela.' },
        { id: '4.7', typ: 'jeHrozba', fen: '6k1/3R1pp1/1p5p/8/8/2b4P/3p1PP1/6K1 w - - 0 1', tah: 'd7b7',
          ocakavane: false, vysvetlenie: 'Veža napadne pešiaka b6, ale odíde zo stĺpca d. Nikto potom nestráži pole ' +
                                         'd1 a čierny pešiak sa premení na dámu. Vd6 by pešiaka b6 napadla a stĺpec ' +
                                         'd by nepustila.' }
      ]
    },

    // ── Kapitola 5 ─────────────────────────────────────────────────────────
    {
      cislo: 5,
      nazov: 'Hrozí iná figúrka',
      tip: 'Pozri sa aj za figúrku, ktorá sa pohla. Neotvorila cestu inej figúrke? Nepribudol druhý útočník?',
      uvod: [
        'Branie, ktoré hrozí, nemusí urobiť figúrka, ktorá sa pohla. Ťah môže <b>otvoriť cestu</b> inej figúrke ' +
        '(odkrytý útok) alebo <b>pridať druhého útočníka</b>, takže sa branie zrazu oplatí.',
        'Pomôcť môže aj kráľ: postaví sa k figúrke, ktorú súper stráži len kráľom. Pri hrozbe sa počíta všetko, ' +
        'čo by si po ťahu mohol zobrať so ziskom — aj odkrytý útok, ktorý pri vidličke nerátal.'
      ],
      zapamataj: 'Hrozbu môže vykonať aj iná figúrka: odkrytý útok alebo druhý útočník.',
      prePokrocilych: 'V tréningu hrozí figúrka, ktorá sa pohla, v 87 % riešení. Ostatné: druhý útočník 6 %, odkrytý ' +
                      'útok 3 %, uvoľnená väzba necelé 1 %, pokazená obrana súpera necelé 1 %.',
      preTrenerov: 'Hráči zvyknú hľadať len útoky figúrky, ktorá sa pohla. Odkrytý útok sa pri vidličke nepočíta, ' +
                   'pri priamej hrozbe áno — na tento rozdiel treba deti upozorniť.',
      ulohy: [
        { id: '5.1', typ: 'jeHrozba', fen: '6k1/4qpp1/7p/8/8/4B3/5PPP/4RK2 w - - 0 1', tah: 'e3b6',
          ocakavane: true, vysvetlenie: 'Strelec uhne a veža e1 napadne dámu e7. To je odkrytý útok — hrozba sa ' +
                                        'počíta, hoci by brala iná figúrka.' },
        { id: '5.2', typ: 'jeHrozba', fen: '6k1/6b1/7p/4n3/8/8/4RPPP/3R2K1 w - - 0 1', tah: 'd1e1',
          ocakavane: true, vysvetlenie: 'Jazdca e5 stráži strelec g7. S jednou vežou by to bola strata, s dvoma ' +
                                        'vežami za sebou sa branie oplatí: zisk +1.' },
        { id: '5.3', typ: 'coHrozi', fen: '6k1/2p3p1/5r1p/8/3N4/8/1B3PPP/6K1 w - - 0 1', tah: 'd4b5',
          ocakavane: ['c7', 'f6'], vysvetlenie: 'Jazdec napadne nestráženého pešiaka c7 a zároveň odkryje strelca ' +
                                                 'b2 na vežu f6 (zisk +2).' },
        { id: '5.4', typ: 'jeHrozba', fen: '8/8/4k3/3p3R/8/2K5/8/8 w - - 0 1', tah: 'c3d4',
          ocakavane: true, vysvetlenie: 'Pešiaka d5 stráži len kráľ e6. Keď sa k nemu postaví biely kráľ, čierny ' +
                                        'kráľ ho už brániť nemôže — veža h5 by ho zobrala.' },
        { id: '5.5', typ: 'najdiHrozbu', fen: '6k1/6p1/5q1p/8/8/2N5/1B3PPP/1R4K1 w - - 0 1',
          ocakavane: ['c3b5', 'c3d5', 'c3a4', 'c3e4', 'c3a2', 'c3e2', 'c3d1'],
          vysvetlenie: 'Stačí pohnúť jazdcom a strelec b2 napadne dámu f6. Jazdec z d5 alebo e4 ju napadne aj sám.' }
      ]
    },

    // ── Kapitola 6 ─────────────────────────────────────────────────────────
    {
      cislo: 6,
      nazov: 'Pokazená obrana',
      tip: 'Nepokazí ťah súperovi obranu? Nepostaví sa do cesty obrancovi, nezviaže ho, neuvoľní tvoju figúrku?',
      uvod: [
        'Niekedy ťah nič nenapadne, a predsa hrozí. <b>Pokazí súperovi obranu</b>: postaví sa do cesty obrancovi ' +
        'alebo obrancu zviaže na kráľa. Viazaný strážnik nestráži — to už poznáš zo Stráže na trhu.',
        'Funguje to aj naopak: keď bola viazaná tvoja figúrka, ťah ju môže <b>uvoľniť</b> — napríklad kráľ uhne ' +
        'z línie väzby. Figúrka potom zrazu môže brať.'
      ],
      zapamataj: 'Hrozba vznikne aj vtedy, keď ťah pokazí súperovi obranu alebo uvoľní moju figúrku.',
      prePokrocilych: 'Zručnosť nerozlišuje, ako hrozba vznikla — len porovná brania so ziskom pred ťahom a po ňom ' +
                      '(akoby súper vynechal ťah). Pokazená obrana je v tréningu zriedkavá (menej ako 2 % riešení), ' +
                      'ale v partiách býva nenápadná a silná.',
      preTrenerov: 'Kapitola je pre pokročilých. Deti tu vidia, že hrozba nie je len „napadnem figúrku" — stačí, keď ' +
                   'ťah zmení výsledok výmeny na poli terča.',
      ulohy: [
        { id: '6.1', typ: 'jeHrozba', fen: '6k1/5pp1/7p/r3n3/1N2P3/8/1B3PPP/6K1 w - - 0 1', tah: 'b4d5',
          ocakavane: true, vysvetlenie: 'Jazdca e5 stráži veža a5 po piatom rade. Jazdec d5 sa jej postaví do cesty — ' +
                                        'strelec b2 by potom jazdca e5 zobral zadarmo.' },
        { id: '6.2', typ: 'jeHrozba', fen: '8/6k1/5n1p/3p4/8/6B1/5PPP/3R2K1 w - - 0 1', tah: 'g3e5',
          ocakavane: true, vysvetlenie: 'Strelec zviaže jazdca f6 na kráľa g7. Viazaný jazdec nestráži pešiaka d5 — ' +
                                        'veža d1 by ho zobrala.' },
        { id: '6.3', typ: 'jeHrozba', fen: '6k1/5pp1/7p/3p4/1b6/2N5/1P3PPP/4K3 w - - 0 1', tah: 'e1e2',
          ocakavane: true, vysvetlenie: 'Jazdec c3 je viazaný strelcom b4 na kráľa e1. Keď kráľ uhne, jazdec sa ' +
                                        'uvoľní a pešiak d5 by padol.' },
        { id: '6.4', typ: 'jeHrozba', fen: '8/5pk1/6p1/3R1PK1/4P1P1/7r/8/8 b - - 0 1', tah: 'd5d7',
          otazka: 'Je <b>{tah}</b> priama hrozba? <span class="slabo">(Na ťahu je čierny — hodnotíme ťah bieleho.)</span>',
          ocakavane: true, vysvetlenie: 'Zo skutočnej partie: veža d7 zviaže pešiaka f7 na kráľa g7. Pešiaka g6 ' +
                                        'potom nikto nestráži a pešiak f5 by ho zobral.' },
        { id: '6.5', typ: 'najdiHrozbu', fen: '6k1/5pp1/8/4n2r/4P3/4N3/1B5P/6K1 w - - 0 1',
          ocakavane: ['e3f5'], vysvetlenie: 'Jazdca e5 stráži veža h5. Jazdec f5 sa jej postaví do cesty a strelec b2 ' +
                                            'by jazdca zobral.' }
      ]
    },

    // ── Kapitola 7 ─────────────────────────────────────────────────────────
    {
      cislo: 7,
      nazov: 'Hrozba matu a premeny',
      tip: 'Hrozí po ťahu mat jedným ťahom alebo premena pešiaka so ziskom, ktorá predtým nehrozila?',
      uvod: [
        'Najväčšia hrozba je <b>hrozba matu</b>. Tichý ťah, po ktorom by si mohol dať mat jedným ťahom, je priama ' +
        'hrozba — aj keď nič iné nenapadne. Počíta sa len nový mat, ktorý pred ťahom nehrozil. Pozor na kráľa ' +
        's okienkom: keď kráľ môže uniknúť, mat nehrozí.',
        'Veľká hrozba je aj <b>premena pešiaka</b>. Premena je zisk rovnako ako branie: pešiak sa zmení na dámu ' +
        '(+8). Hrozbou je tichý ťah, po ktorom by sa pešiak premenil <b>so ziskom</b> — pole premeny musí byť ' +
        'bezpečné, alebo musíš premenu podporiť, aby si po výmene ostal v zisku. Samotná premena hrozbou nie je, ' +
        'je to zisk hneď.'
      ],
      zapamataj: 'Tichý ťah, po ktorom hrozí mat jedným ťahom alebo premena so ziskom, je hrozba.',
      prePokrocilych: 'Mat aj premena sa hľadajú rovnako ako všetko ostatné: akoby súper vynechal ťah. Mat alebo ' +
                      'premena, ktoré sa dali urobiť už pred ťahom, sa tomuto ťahu nepripíšu. Zisk premeny je 8 mínus ' +
                      'to, čo súper získa braním novej dámy (rebrík výmeny).',
      preTrenerov: 'Hrozba matu je v tréningu v 3 % riešení, v polovici z nich aj s napadnutou figúrkou. Typická je ' +
                   'hrozba matu na poslednom rade. Hrozbu premeny zručnosť počíta od 30. 9. 2026 — v tréningu je ' +
                   'v 1,4 % riešení, najmä v koncovkách.',
      ulohy: [
        { id: '7.1', typ: 'jeHrozba', fen: '6k1/1p3ppp/p7/8/8/8/5PPP/R5K1 w - - 0 1', tah: 'a1d1',
          ocakavane: true, vysvetlenie: 'Veža z d1 hrozí Vd8 mat. Čierny kráľ nemá okienko — pešiaky f7, g7 a h7 mu ' +
                                        'zatarasili cestu.' },
        { id: '7.2', typ: 'jeHrozba', fen: '5rk1/5ppp/8/8/8/3B4/5PPP/3Q2K1 w - - 0 1', tah: 'd1h5',
          ocakavane: true, vysvetlenie: 'Dáma h5 spolu so strelcom d3 hrozí D×h7 mat. A zároveň by zobrala pešiaka h7.' },
        { id: '7.3', typ: 'najdiHrozbu', fen: '5r1k/6pp/8/7Q/8/5N2/5PPP/6K1 w - - 0 1',
          ocakavane: ['f3g5', 'h5c5'], tip: 'Hľadaj tichý ťah, po ktorom hrozí mat.',
          vysvetlenie: 'Jg5 hrozí D×h7 mat — jazdec pomôže dáme a pešiaka h7 stráži len kráľ. Dc5 hrozí D×f8 mat.' },
        { id: '7.4', typ: 'jeHrozba', fen: '6k1/1p3pp1/p6p/8/8/8/5PPP/R5K1 w - - 0 1', tah: 'a1d1',
          ocakavane: false, vysvetlenie: 'Kráľ má okienko na h7, takže Vd8 by mat nebol — kráľ by ušiel. Nič iné veža ' +
                                         'nenapadne. Porovnaj s úlohou 7.1.' },
        { id: '7.5', typ: 'jeHrozba', fen: '6k1/5pp1/1P5p/8/8/8/5PPP/6K1 w - - 0 1', tah: 'b6b7',
          ocakavane: true, vysvetlenie: 'Pešiak b7 hrozí premenu na b8. Pole b8 nikto nestráži — nová dáma by ostala ' +
                                        'stáť (zisk +8).' },
        { id: '7.6', typ: 'jeHrozba', fen: 'r5k1/6p1/4P2p/8/8/7P/5PP1/6K1 w - - 0 1', tah: 'e6e7',
          ocakavane: false, vysvetlenie: 'Pole e8 stráži veža a8. Po e8D V×e8 by si stratil pešiaka — premena sa ' +
                                         'počíta, len keď je so ziskom.' },
        { id: '7.7', typ: 'jeHrozba', fen: '6k1/1P3pp1/7p/4b3/8/8/5PPP/3R2K1 w - - 0 1', tah: 'd1b1',
          ocakavane: true, vysvetlenie: 'Pole b8 stráži strelec e5. Veža b1 premenu podporí: po b8D S×b8 V×b8 ' +
                                        'získaš strelca za pešiaka (zisk +2).' }
      ]
    },

    // ── Kapitola 8 ─────────────────────────────────────────────────────────
    {
      cislo: 8,
      nazov: 'Každá figúrka, obe strany',
      tip: 'Hľadaj za oboch hráčov a skús každú figúrku, aj kráľa a pešiaka.',
      uvod: [
        'Hroziť môže každá figúrka: veža, dáma, strelec, jazdec, pešiak aj <b>kráľ</b>. Kráľ v koncovke rád ' +
        'napadne nestráženého pešiaka.',
        'A hrozby sú na oboch stranách trhu. Zručnosť ich hľadá <b>za bieleho aj za čierneho</b>, bez ohľadu na ' +
        'to, kto je na ťahu. Takmer polovica riešení v tréningu je za hráča, ktorý na ťahu nie je!'
      ],
      zapamataj: 'Hľadám hrozby každej figúrky a za oboch hráčov.',
      prePokrocilych: 'V tréningu hrozí veža v 25 % riešení, dáma 23 %, pešiak 20 %, strelec 15 %, jazdec 13 % ' +
                      'a kráľ 4 %.',
      preTrenerov: '45 % hrozieb v tréningu je za stranu, ktorá nie je na ťahu. Úloha Nájdi všetky funguje presne ako ' +
                   'tréning v Zručnostiach; pozície 8.3 a 8.5 sú z tréningu.',
      ulohy: [
        { id: '8.1', typ: 'jeHrozba', fen: '8/8/8/5k2/8/1p6/8/2K5 w - - 0 1', tah: 'c1b2',
          ocakavane: true, vysvetlenie: 'Kráľ napadne pešiaka b3. Nikto ho nestráži — kráľ by ho zobral.' },
        { id: '8.2', typ: 'najdiHrozbu', fen: 'r5k1/5pp1/7p/8/8/8/1B3PPP/6K1 w - - 0 1', strana: 'b',
          ocakavane: ['a8b8', 'a8d8', 'a8e8', 'a8a2'], tip: 'Hľadaj za čierneho, hoci je na ťahu biely.',
          vysvetlenie: 'Čierna veža napadne strelca b2 z b8 alebo z a2. Z d8 a e8 hrozí mat na prvom rade.' },
        { id: '8.3', typ: 'najdiHrozby', fen: '8/k2n4/1p1b4/8/PP1N4/1K6/6P1/8 w - - 0 1', pomocka: 'strany',
          ocakavane: ['d4f5', 'd6e5'], vysvetlenie: 'Zo skutočnej partie. Biely: Jf5 napadne strelca d6. Čierny: Se5 ' +
                                                     'napadne jazdca d4.' },
        { id: '8.4', typ: 'jeHrozba', fen: '6k1/1p3pp1/2p4p/8/3N4/8/5PPP/6K1 w - - 0 1', tah: 'c6c5',
          otazka: 'Je <b>{tah}</b> priama hrozba? <span class="slabo">(Na ťahu je biely — hodnotíme ťah čierneho.)</span>',
          ocakavane: true, vysvetlenie: 'Čierny pešiak c5 napadne jazdca d4. Nikto ho nestráži.' },
        { id: '8.5', typ: 'najdiHrozby', fen: '8/2N5/1P1k1pbp/3p2p1/8/8/3K1PP1/8 w - - 0 1', pomocka: 'strany',
          ocakavane: ['d6c6', 'd6c5', 'g6e4'], vysvetlenie: 'Zo skutočnej partie: všetky tri hrozby má čierny, hoci je ' +
                                                             'na ťahu biely. Kráľ z c6 alebo c5 napadne pešiaka b6, ' +
                                                             'strelec z e4 napadne pešiaka g2.' }
      ]
    },

    // ── Kapitola 9 ─────────────────────────────────────────────────────────
    {
      cislo: 9,
      nazov: 'Zručnosť a šachová hra',
      tip: 'Rozhoduj podľa pravidiel hrozby, nie podľa toho, či je ťah v partii dobrý.',
      uvod: [
        'Grošík kontroluje len <b>pravidlá hrozby</b>, nie či je ťah najlepší. Nepozerá sa, ako sa súper bráni: ' +
        'môže figúrku odtiahnuť, kryť alebo vymeniť, alebo zahrať vlastnú hrozbu.',
        'A niektoré silné ťahy zručnosť za hrozbu nepočíta: šach, branie, premenu alebo hrozbu vidličky. Hrozbu ' +
        'treba vidieť vždy. <b>Či ju zahráš, rozhodneš v partii.</b>'
      ],
      zapamataj: 'Hrozbu vidím. Či ju zahrám, rozhodnem v partii.',
      prePokrocilych: 'Zručnosť vidí len hrozbu zisku, premeny a matu o jeden ťah. Nevidí hrozbu šachu ani vidličky, ' +
                      'ktorá by prišla neskôr.',
      preTrenerov: 'Zručnosť cvičí videnie hrozieb, nie hľadanie najlepšieho ťahu (rovnako ako Branie so ziskom ' +
                   'a Vidlička). V záverečnej skúške budú len pozície, kde sa zručnosť a partia nerozchádzajú.',
      ulohy: [
        { id: '9.1', typ: 'jeHrozba', fen: 'r3k3/5ppp/8/8/8/2N4P/5PP1/6K1 w - - 0 1', tah: 'c3b5',
          ocakavane: false, vysvetlenie: 'Jb5 hrozí Jc7+ — šach a vidlička na kráľa a vežu a8. Zručnosť však počíta ' +
                                         'len hrozbu zisku, premeny a matu jedným ťahom, hrozbu šachu ani vidličky ' +
                                         'nevidí. V partii je to pritom silná hrozba!' },
        { id: '9.2', typ: 'jeHrozba', fen: '6k1/6p1/2n4p/8/8/6Q1/5PPP/4R1K1 w - - 0 1', tah: 'e1e6',
          ocakavane: true, vysvetlenie: 'Podľa pravidiel je to hrozba: veža napadne nestráženého jazdca c6 aj ' +
                                        'pešiaka h6. V partii však jazdec uskočí na d4 a sám napadne vežu.' },
        { id: '9.3', typ: 'jeHrozba', fen: '2q3k1/5pp1/7p/3N4/8/7P/5PP1/6K1 w - - 0 1', tah: 'd5e7',
          ocakavane: false, vysvetlenie: 'Je7+ je najlepší ťah — šach a vidlička na dámu c8. Hrozbou však nie je: ' +
                                         'šach nie je tichý ťah.' },
        { id: '9.4', typ: 'jeHrozba', fen: '8/8/3r2k1/7p/7K/1B6/3p4/5R2 b - - 0 1', tah: 'd6f6',
          ocakavane: true, vysvetlenie: 'Zo skutočnej partie: veža f6 napadne nestráženú vežu f1, takže podľa ' +
                                        'pravidiel je to hrozba. Biely však jednoducho vymení veže V×f6+ K×f6.' }
      ]
    },

    // ── Kapitola 10: záverečná skúška ───────────────────────────────────────
    {
      cislo: 10,
      nazov: 'Záverečná skúška',
      uvod: [
        'Grošík ti zverí celý trh! Čaká ťa <b>10 pozícií zo skutočných partií</b>.',
        'V každej nájdi všetky priame hrozby za oboch hráčov. Máš na to čas, takže buď rýchly aj presný.',
        'Keď vyriešiš aspoň 8 pozícií úplne a bez chyby, získaš odznak <b>Majster hrozby</b>.'
      ],
      uvodKoniec: 'Ak sa nepodarí, poviem ti, ktoré kapitoly si zopakovať. Pozície budú zakaždým iné.',
      zapamataj: 'Majster hrozby hľadá za oboch hráčov a pri každom tichom ťahu skontroluje: hrozí zisk alebo mat? ' +
                 'Nezíska niečo súper?',
      preTrenerov: 'Pozície sú zo skutočných partií, z tých istých ako úlohy v tréningu Priame hrozby (60 pozícií s 1 ' +
                   'až 3 riešeniami, po 12 z každej úrovne ELO, náhodne sa vyberie 10). Vynechané sú sporné pozície: ' +
                   'tie, kde by uznaná hrozba v partii hrubo pokazila pozíciu (šachový program ju hodnotí o viac ako ' +
                   '3 pešiaky horšie, než keby hráč ťah vynechal), a tie, kde je dobrým ťahom hrozba, ktorú zručnosť ' +
                   'nepočíta, lebo by súper niečo získal. Čas ako v tréningu na úrovni 1: 60 s + 10 s na každé ' +
                   'riešenie. Skúška sa nezapisuje do štatistík tréningu a nemení ELO. Skúšku možno opakovať, ' +
                   'zakaždým s inými pozíciami. Kto ju zložil a ako idú kapitoly, uvidíš v menu Tréner → Prehľad hier.',
      skuska: {
        typ: 'najdiHrozby',
        pocet: 10,
        hranica: 8,              // vyriešených úplne a bez chyby
        casZaklad: 60,           // sekúnd (ako tréning, úroveň 1)
        casNaRiesenie: 10,       // sekúnd za každé riešenie
        textZlozena: 'Teraz si naozajstný majster hrozby a môžeš trénovať Priame hrozby v menu Zručnosti.',
        odkaz: { text: 'Trénovať Priame hrozby →', href: 'skills.html?type=direct_threat' },
        // Rozbor chýb: ktorá kapitola pomôže
        dovody: {
          1: 'Prehliadnutá hrozba',
          2: 'Označené branie alebo šach',
          3: 'Označený ťah, ktorý nič nové nehrozí, alebo prehliadnutá hrozba na krytý terč',
          4: 'Označený ťah, po ktorom by súper niečo získal',
          5: 'Prehliadnutá hrozba inej figúrky (odkrytý útok, druhý útočník)',
          6: 'Prehliadnutá pokazená obrana alebo chyba, pri ktorej rozhoduje väzba',
          7: 'Prehliadnutá hrozba matu alebo premeny',
          8: 'Prehliadnutá hrozba kráľa, pešiaka alebo hráča, ktorý nie je na ťahu'
        },
        // 60 pozícií z úloh tréningu Priame hrozby (tabuľka skill_puzzles, stav po oprave 30. 9. 2026 —
        // hrozba premeny), 1 až 3 riešenia, 8 až 22 figúrok, po 12 z každej úrovne ELO (po 4 s 1, 2 a 3
        // riešeniami), bez sporných pozícií a bez pozícií z kapitol 1 až 9; v 4 pozíciách hrozí premena
        pozicie: [
          // ELO 1400
          '4bk1r/2q2ppB/3p1b2/p1p1p3/2P5/1P3P2/P1Q3PP/1R1K3R b - - 0 1',
          '8/p4p2/2K2k2/4p2p/4P2P/1P6/P7/8 b - - 0 1',
          '8/7p/5k2/5p2/2p4P/4KPP1/8/8 w - - 0 1',
          '6k1/4n1pp/4p3/1b1pNp2/p2P4/4P3/4qPPP/1Q3NK1 w - - 0 1',
          '8/6R1/2p2Bp1/3p1kP1/b1pP4/5K2/5PP1/4r3 w - - 0 1',
          '6rk/6p1/2p3Qp/8/8/3R2PP/2q2NK1/8 b - - 0 1',
          'r7/3R2P1/1p6/8/7P/2k5/3p1PK1/8 b - - 0 1',
          '4r1k1/p4pp1/3b3p/1p1p4/1PpP4/2P2N1P/P2QqPP1/R5K1 w - - 0 1',
          '4r3/ppR3R1/2bpr3/3k3p/3P4/P2K4/1P5P/8 w - - 0 1',
          '8/5Rrk/8/2p2p2/5Pb1/1B1P2P1/PPP4r/R4K2 b - - 0 1',
          '8/4kp2/8/1KP1p3/4P3/4bP2/7p/3R4 b - - 0 1',
          '2k1r3/1p1r2pp/1B3n2/4p3/2P5/3P2KP/PP1R2P1/R7 b - - 0 1',
          // ELO 1600
          '8/4kp1p/6p1/6P1/2PR1PKP/2r5/8/8 b - - 0 1',
          '8/5pp1/p2k1n1p/N1pp4/P6P/1P1RPP2/1r4P1/5K2 w - - 0 1',
          '8/8/7p/p1p1k1p1/6P1/PP1K3P/8/8 w - - 0 1',
          '2r5/2pk2p1/1bRnppp1/pP6/P3p3/B3P3/4BPPP/6K1 w - - 0 1',
          'r4k2/5p2/p1pp1B2/1p1bp3/8/5P2/1P3K2/2R5 w - - 0 1',
          '8/4k3/1R6/2p1PP2/4K3/1prp2P1/8/8 b - - 0 1',
          '8/6p1/4k3/7p/2RP3r/2P5/8/3K4 w - - 0 1',
          '2q2r1k/2p3pn/p2p3p/8/PQ1NP3/3P3P/1P4P1/R6K b - - 0 1',
          '3r4/5pkp/p5p1/Pb6/1PN5/1P1p1P2/3Rr1PP/2R3K1 b - - 0 1',
          '4r1k1/6qp/p1n1p3/1p3r2/4R2Q/P1P5/1P3PPP/5RK1 w - - 0 1',
          '1nb3k1/pp2p1bp/6p1/2r1n3/8/2P2N2/PP2BPPP/3RK2R w K - 0 1',
          '8/3k3p/p2n4/PpK3p1/2p2p2/8/6PP/4R3 w - - 0 1',
          // ELO 1800
          '6k1/1p3ppp/pq4b1/2RKP3/1P4P1/P6P/5P2/Q7 b - - 0 1',
          '8/1p4pp/2bk4/3p1p2/r2Rp3/P1R1K3/5PPP/8 b - - 0 1',
          '1R6/1Pr1kpp1/4p2p/8/3K4/5P2/5P1P/8 w - - 0 1',
          '8/8/p1R5/P1P5/3PkB2/4P2K/6r1/5b2 b - - 0 1',
          '5r2/7q/b1p1p2k/1pPpPpRp/3B1P1P/4P3/5K2/6Q1 w - - 0 1',
          '8/6p1/6p1/1p5p/1P3PPP/5K2/7k/8 b - - 0 1',
          '2r2R2/5Qqk/1pr3pp/8/8/6PK/7P/5R2 w - - 0 1',
          '4k3/5pp1/1P5p/p7/1n6/5P2/1K2B3/8 w - - 0 1',
          '7k/R5p1/7p/5K2/5P1P/p5P1/1b6/r7 w - - 0 1',
          '6k1/5pp1/3P1q1p/5N2/3P4/6Q1/r3r1PP/5RK1 w - - 0 1',
          '5rk1/pppq1rpp/8/3pp2N/6Q1/3PP2P/PPP5/2K3R1 w - - 0 1',
          '2r2rk1/5ppp/p3p3/1p2q3/2p5/P1Qn2P1/1P1R1PBP/R5K1 w - - 0 1',
          // ELO 2000
          '1r1qr1k1/n2p1p1p/Bp4p1/3N4/P1P5/4R1P1/1P3P1P/R5K1 w - - 0 1',
          '8/4k3/1p1p2pp/p2P4/P3KP1P/1P6/8/8 b - - 0 1',
          '8/6p1/5k1p/K4p2/2P1n2R/7P/8/8 b - - 0 1',
          '2r5/7p/p5p1/1p6/1k1K4/4N2P/PP1P1PP1/8 w - - 0 1',
          '2q1k2r/p1pn1ppp/1bQ1p3/1N2P3/8/1P4P1/P1P2P1P/3R2K1 w k - 0 1',
          '4r1k1/pp3pp1/1np3P1/3p3P/3P4/3B4/PPPR4/2KRr3 w - - 0 1',
          '4r1k1/6p1/8/pp3q2/3Rp3/P1PbQ2P/1P3PP1/6K1 w - - 0 1',
          '8/8/6p1/7p/4k2P/r3N1P1/4KP2/8 w - - 0 1',
          '5rk1/5ppp/2n1p3/3p4/3P1P2/2q1P3/3N2PP/R3Q1K1 w - - 0 1',
          '3r4/5kbR/p5p1/1p1p4/3N1P2/2P5/PP6/2K5 w - - 0 1',
          '7r/1k6/pp5p/2p1P1p1/3n1p2/B7/P4PPP/4RNK1 b - - 0 1',
          'r6r/p1kb2p1/2nq4/2Q4p/3P4/2P5/P4PPP/1R2R1K1 w - - 0 1',
          // ELO 2200
          'R7/8/3r4/P5p1/5k2/7P/6P1/7K b - - 0 1',
          '8/1r1r1qkp/1p2R1p1/pPp2p2/P2p1P2/1P4P1/4Q2P/4R1K1 w - - 0 1',
          '8/6pp/1K1k4/4pp2/PP6/5P1P/6P1/8 b - - 0 1',
          '8/8/p7/2ppk1p1/6P1/PP2K3/2P5/8 b - - 0 1',
          '8/2k3p1/8/PR1p1r2/2p5/2P1K3/1P6/8 b - - 0 1',
          '8/kp6/2p5/p1P5/8/1K6/P1R2R2/4q3 b - - 0 1',
          '3r4/4kp2/p4p2/8/7R/P4r2/KP5P/6R1 w - - 0 1',
          'r1b1r1k1/1p3pp1/p4q1p/3P4/3N1Q2/1B5P/PP4P1/R1B3K1 b - - 0 1',
          'r3r3/p5pp/8/8/6PP/5P2/PPPR2R1/2K2k2 b - - 0 1',
          '8/ppq5/2p3p1/3p1k2/3Pp2P/2P1Q1P1/PP6/6K1 w - - 0 1',
          '3r1n1k/R2r1R1p/6p1/5p2/5N1P/5P2/6PK/8 w - - 0 1',
          '2b5/4k3/p3nb2/1p3R2/6Bq/3P3P/P3Q2K/8 w - - 0 1'
        ]
      }
    }
  ]
};
