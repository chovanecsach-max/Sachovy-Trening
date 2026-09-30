// ============================================================================
//  vidlicka-obsah.js — obsah hry Vidlička na trhu (kapitoly, texty, úlohy)
// ----------------------------------------------------------------------------
//  Hra vysvetľuje zručnosť Vidlička. Tretia hra s Grošíkom: spája Šachový trh
//  (terč musí stáť za to, pole musí byť bezpečné — výmena) a Stráž na trhu
//  (strážnici, väzba). Na trh prišiel šikovný zlodej, ktorý sa postaví tak,
//  že dosiahne na dva stánky naraz.
//
//  Jediné miesto, kde sú texty a pozície hry. Herný rámec (hra-engine.js) ich
//  len zobrazuje. Správne odpovede sa NEPÍŠU ručne — vždy ich vypočíta
//  VisionCore rovnako ako tréning Vidlička. Pole „ocakavane" slúži len na
//  kontrolu: keby sa výpočet a scenár rozišli, hra to vypíše do konzoly.
//
//  TYPY ÚLOH:
//    jeVidlicka    — je ťah `tah` vidlička? Áno / Nie (fen, tah)
//    precoNie      — prečo ťah `tah` nie je vidlička? (fen, tah, moznosti)
//                    dôvody: dva_terce, cena, pole, kral, vazba
//    ktoreTerce    — ktoré terče ťahu `tah` sa počítajú? (fen, tah)
//    najdiVidlicku — zahraj vidličku strany `strana` (predvolene tá na ťahu)
//    najdiVidlicky — nájdi všetky vidličky za oboch (fen, pomocka); aj záverečná skúška
//  Ťah sa píše ako v tréningu: 'd4c6'. Pri premene s písmenom: 'd7d8n'.
//
//  KAPITOLA môže mať aj:
//    tip    — rada Grošíka pred odpoveďou pre všetky úlohy kapitoly
//    cennik — v úvode ukázať ceny figúrok (ako v Šachovom trhu)
//
//  ÚLOHA môže mať aj:
//    otazka — vlastné znenie otázky ({tah} = napr. „Jd4–c6")
//    tip    — vlastná rada Grošíka pred odpoveďou
//
//  Figúrky v textoch: K D V S J (slovensky), vo FEN anglicky (K Q R B N P).
// ============================================================================

(window.VERZIE = window.VERZIE || {})['vidlicka-obsah.js'] = '2026-09-30b';

const OBSAH_VIDLICKA = {
  kluc: 'vidlicka-na-trhu',
  // Verzia číslovania kapitol (pozri trh-obsah.js). Pri zmene poradia kapitol sa zvýši.
  verzia: 1,
  nazov: 'Vidlička na trhu',
  podtitul: 'Hra, ktorá vysvetľuje zručnosť Vidlička',
  sprievodca: 'Grošík',
  pozdrav: 'Ahoj, to som zase ja, Grošík! Na trh prišiel šikovný zlodej. Postaví sa tak, že dosiahne na dva ' +
           'stánky naraz, a majiteľ zachráni len jeden. Naučím ťa, ako sa počíta vidlička v tejto hre ' +
           'a v zručnostiach. Vyber si kapitolu.',

  // Texty, ktoré sa líšia od Šachového trhu
  texty: {
    pochvaly: ['Výborne!', 'Presne tak!', 'Máš oko na vidličky.', 'Správne!', 'To je ono!'],
    odznak: 'Majster vidličky',
    zosit: 'Toto sú pravidlá, ktoré si už získal. Majster vidličky ich má vždy po ruke.',
    bublinaUlohy: 'Hľadaj dva terče naraz.',
    odkazy: [{ text: 'Stráž na trhu', href: 'straz-na-trhu.html' }],
    koniec3: 'Skvelá práca! Tri hviezdičky.',
    koniec2: 'Dobrá práca! Na tri hviezdičky ti chýba len kúsok.',
    koniec1: 'Kapitola je za tebou. Skús ju ešte raz — pôjde to lepšie.'
  },

  kapitoly: [
    // ── Kapitola 1 ─────────────────────────────────────────────────────────
    {
      cislo: 1,
      nazov: 'Jeden ťah, dva terče',
      tip: 'Pozri sa, na čo figúrka z nového poľa dosiahne. Napadne dva terče naraz?',
      uvod: [
        'Vidlička je <b>jeden ťah jednej figúrky</b>, po ktorom figúrka napadne <b>dva terče naraz</b>. ' +
        'Ako zlodej, ktorý sa postaví medzi dva stánky a dosiahne na oba. Súper zachráni len jeden.',
        'Vidličkovať môže každá figúrka: jazdec, strelec, veža, dáma, aj pešiak. Po ťahu sa pozri, na čo ' +
        'figúrka z nového poľa dosiahne. Jeden terč nestačí — musia byť dva.'
      ],
      zapamataj: 'Vidlička je jeden ťah jednej figúrky, ktorá naraz napadne dva terče.',
      prePokrocilych: 'Terčom môže byť aj kráľ — vtedy je to šach. Zručnosť berie tichý ťah aj branie. ' +
                      'Rošádu ani branie mimochodom nepočíta.',
      preTrenerov: 'Tréning Vidlička hľadá všetky ťahy za oboch hráčov, po ktorých jedna figúrka napadne aspoň dva ' +
                   'nové terče, ktoré stoja za to, a stojí na bezpečnom poli. Nezisťuje, či je ťah najlepší. ' +
                   'Najviac vidličiek robí dáma (61 %), jazdec len 20 %.',
      ulohy: [
        { id: '1.1', typ: 'jeVidlicka', fen: '6k1/8/2n1n3/8/3P4/8/8/6K1 w - - 0 1', tah: 'd4d5',
          ocakavane: true, vysvetlenie: 'Pešiak napadne jazdca c6 aj jazdca e6. Súper zachráni len jedného.' },
        { id: '1.2', typ: 'jeVidlicka', fen: '1r4k1/4qppp/8/8/3N4/7P/5PP1/6K1 w - - 0 1', tah: 'd4c6',
          ocakavane: true, vysvetlenie: 'Jazdec napadne dámu e7 aj vežu b8.' },
        { id: '1.3', typ: 'jeVidlicka', fen: '6k1/5ppp/8/2b5/8/PP6/5PPP/6K1 w - - 0 1', tah: 'b3b4',
          ocakavane: false, vysvetlenie: 'Pešiak napadne len strelca c5. Jeden terč nie je vidlička.' },
        { id: '1.4', typ: 'ktoreTerce', fen: '6k1/p4pp1/7p/1n5b/8/8/5PPP/2R3K1 w - - 0 1', tah: 'c1c5',
          ocakavane: ['b5', 'h5'], vysvetlenie: 'Veža na c5 napadá jazdca b5 aj strelca h5 — počítajú sa oba terče.' },
        { id: '1.5', typ: 'najdiVidlicku', fen: '6k1/5ppp/3n1b2/8/3PP3/8/5PPP/6K1 w - - 0 1',
          ocakavane: ['e4e5'], vysvetlenie: 'Aj pešiak vie vidličkovať. Pešiak e5 napadne jazdca d6 aj strelca f6 ' +
                                            'a kryje ho pešiak d4.' },
        { id: '1.6', typ: 'najdiVidlicku', fen: '6k1/5r2/8/8/8/1r6/5PBP/6K1 w - - 0 1',
          ocakavane: ['g2d5'], vysvetlenie: 'Zo stredu šachovnice dosiahne strelec na obe veže.' }
      ]
    },

    // ── Kapitola 2 ─────────────────────────────────────────────────────────
    {
      cislo: 2,
      nazov: 'Len nové terče',
      tip: 'Napadne figúrka dva terče? A sú oba nové — nenapádala ich už predtým?',
      uvod: [
        'Zlodej, ktorý na stánok dosiahol už predtým, nekradne nič nové. Do vidličky sa počítajú len ' +
        '<b>nové terče</b> — tie, ktoré figúrka zo starého poľa nenapádala.',
        'A napádať ich musí <b>figúrka, ktorá sa pohla</b>. Keď figúrka len uhne a otvorí cestu inej figúrke ' +
        'za sebou, je to <b>odkrytý útok</b>. V partii býva silný, ale vidlička to nie je.'
      ],
      zapamataj: 'Oba terče musia byť nové a napadá ich figúrka, ktorá sa pohla.',
      prePokrocilych: 'Odkrytý útok (aj odkrytý šach) je samostatný motív. Zručnosť Vidlička počíta len terče ' +
                      'figúrky, ktorá ťahala.',
      preTrenerov: 'Generátor porovná, čo figúrka napáda z nového poľa a čo napádala zo starého. Keď jeden z dvoch ' +
                   'terčov nie je nový, ide len o presunutie starej hrozby a ťah sa nepočíta.',
      ulohy: [
        { id: '2.1', typ: 'jeVidlicka', fen: '6k1/5ppp/3n4/8/7b/8/5PPP/3R2K1 w - - 0 1', tah: 'd1d4',
          ocakavane: false, vysvetlenie: 'Veža napadne strelca h4, ale jazdca d6 napádala už z d1. Nový je len jeden terč.' },
        { id: '2.2', typ: 'jeVidlicka', fen: '6k1/1r3r2/8/8/8/8/5PBP/6K1 w - - 0 1', tah: 'g2d5',
          ocakavane: false, vysvetlenie: 'Vežu b7 napádal strelec už z g2. Nový terč je len veža f7. Porovnaj s úlohou 1.6.' },
        { id: '2.3', typ: 'ktoreTerce', fen: 'r5k1/5ppp/8/5n2/8/8/5PPP/1B4K1 w - - 0 1', tah: 'b1e4',
          ocakavane: ['a8'], vysvetlenie: 'Počíta sa len veža a8. Jazdca f5 strelec napádal už z b1.' },
        { id: '2.4', typ: 'jeVidlicka', fen: '4k3/pp3ppp/8/4N3/5q2/8/PP3PPP/4R1K1 w - - 0 1', tah: 'e5d3',
          ocakavane: false, vysvetlenie: 'Jazdec napadne len dámu f4. Šach dáva veža e1, ktorá sa nepohla — to je odkrytý ' +
                                         'šach. V partii biely dámu vyhrá, ale vidlička to nie je.' },
        { id: '2.5', typ: 'precoNie', fen: '4q1k1/3r1pp1/7p/8/4N3/8/5PPP/4R1K1 w - - 0 1', tah: 'e4c5',
          ocakavane: 'dva_terce', vysvetlenie: 'Jazdec napadne len vežu d7. Dámu e8 napáda veža e1 — odkrytý útok sa nepočíta.' }
      ]
    },

    // ── Kapitola 3 ─────────────────────────────────────────────────────────
    {
      cislo: 3,
      nazov: 'Terč musí stáť za to',
      tip: 'Stoja oba terče za to? Terč musí byť cennejší ako vidličkár, alebo sa musí dať zobrať so ziskom.',
      cennik: true,
      uvod: [
        'Nie každý stánok stojí za krádež. Terč sa počíta, keď je <b>cennejší ako vidličkár</b> (jazdec napadne ' +
        'vežu), alebo keď sa dá <b>zobrať so ziskom</b> — napríklad ho nikto nestráži.',
        'Strážený tovar rovnakej alebo nižšej ceny sa nepočíta. Jazdec, ktorý napadne dva strážené strelce, nič ' +
        'nezíska: dal by jazdca za strelca. Ceny sú rovnaké ako na Šachovom trhu:'
      ],
      zapamataj: 'Terč sa počíta, keď je cennejší ako vidličkár alebo sa dá zobrať so ziskom.',
      prePokrocilych: 'Či sa terč dá zobrať so ziskom, sa počíta celou výmenou na jeho poli — ako rebrík výmeny zo ' +
                      'Šachového trhu, aj s batériami a väzbami.',
      preTrenerov: 'Najbežnejšia vidlička v tréningu je dáma, ktorá napadne dva nekryté pešiaky (pešiaky sú 40 % ' +
                   'terčov). Deti ju často za vidličku nepovažujú. Krytá figúrka rovnakej alebo nižšej ceny sa nepočíta.',
      ulohy: [
        { id: '3.1', typ: 'jeVidlicka', fen: '3k4/2b1b3/8/8/8/2N5/8/4K3 w - - 0 1', tah: 'c3d5',
          ocakavane: false, vysvetlenie: 'Oba strelce stráži kráľ d8. Jazdec by za strelca dal jazdca — nič by nezískal.' },
        { id: '3.2', typ: 'jeVidlicka', fen: '6k1/5p1b/4r3/8/8/5N2/5PPP/6K1 w - - 0 1', tah: 'f3g5',
          ocakavane: false, vysvetlenie: 'Veža e6 je cennejšia ako jazdec, tá sa počíta. Pešiaka f7 aj strelca h7 však ' +
                                         'stráži kráľ a nie sú cennejšie ako jazdec. Počíta sa len jeden terč.' },
        { id: '3.3', typ: 'jeVidlicka', fen: '8/8/k7/6K1/8/1Q6/1p3r1r/8 w - - 0 1', tah: 'b3g3',
          ocakavane: false, vysvetlenie: 'Dáma napadne dve veže, ale veže sa strážia navzájom a sú lacnejšie ako dáma. ' +
                                         'Ani jedna nestojí za to.' },
        { id: '3.4', typ: 'ktoreTerce', fen: '6k1/2p2pp1/7p/p7/8/5Q2/5PPP/6K1 w - - 0 1', tah: 'f3c3',
          ocakavane: ['a5', 'c7'], vysvetlenie: 'Pešiaky a5 a c7 nikto nestráži. Pešiaka g7 stráži kráľ, ten sa nepočíta.' },
        { id: '3.5', typ: 'precoNie', fen: '6k1/1p3p1p/2b3b1/8/8/5N2/5PPP/6K1 w - - 0 1', tah: 'f3e5',
          ocakavane: 'cena', vysvetlenie: 'Oba strelce strážia pešiaky a nie sú cennejšie ako jazdec. Pešiaka f7 stráži kráľ.' },
        { id: '3.6', typ: 'najdiVidlicku', fen: '2r3k1/5pp1/b6p/8/5n2/7P/5PP1/3Q2K1 w - - 0 1',
          ocakavane: ['d1a4', 'd1d6'], vysvetlenie: 'Strelca a6 ani jazdca f4 nikto nestráži. Dáma ich napadne naraz ' +
                                                     'z a4 aj z d6.' }
      ]
    },

    // ── Kapitola 4 ─────────────────────────────────────────────────────────
    {
      cislo: 4,
      nazov: 'Bezpečné pole',
      tip: 'Pozri sa aj na pole vidličkára: nezoberie ho súper bez straty?',
      uvod: [
        'Zlodej musí stáť tam, kde ho <b>nechytia bez straty</b>. Keď súper vidličkára zoberie a nič nestratí, ' +
        'krádež sa nekoná.',
        'Pole je bezpečné, keď na ňom súper nemá čím brať, alebo keď by braním stratil. Pomôže rebrík výmeny zo ' +
        'Šachového trhu. Pozor: <b>výmena</b> (jazdec za jazdca) nestačí — také pole bezpečné nie je.'
      ],
      zapamataj: 'Vidličkár musí stáť tam, kde ho súper nezoberie bez straty.',
      prePokrocilych: 'Bezpečnosť poľa sa počíta celou výmenou: súper berie najlacnejšou figúrkou a ďalej berie, ' +
                      'len keď sa mu to oplatí.',
      preTrenerov: 'Zručnosť nezisťuje, či má súper inú obranu, počíta len výmenu na poli vidličkára. Preto jazdec ' +
                   'takmer nikdy nevidličkuje jazdca: napadnutý jazdec ho môže zobrať a vznikne výmena.',
      ulohy: [
        { id: '4.1', typ: 'jeVidlicka', fen: '6k1/5ppp/8/1b1n4/8/2P5/5PPP/6K1 w - - 0 1', tah: 'c3c4',
          ocakavane: false, vysvetlenie: 'Strelec b5 pešiaka c4 zoberie zadarmo — nikto ho nestráži.' },
        { id: '4.2', typ: 'jeVidlicka', fen: '2r3k1/5ppp/6n1/3N4/8/7P/5PP1/4R1K1 w - - 0 1', tah: 'd5e7',
          ocakavane: false, vysvetlenie: 'Jazdec g6 zoberie jazdca e7 a veža e1 vezme späť. Jazdec za jazdca je výmena ' +
                                         '— pole nie je bezpečné.' },
        { id: '4.3', typ: 'precoNie', fen: 'r5k1/5ppp/4p3/7n/8/1Q6/5PPP/6K1 w - - 0 1', tah: 'b3d5',
          ocakavane: 'pole', vysvetlenie: 'Dáma napadne vežu a8 aj jazdca h5, ale pešiak e6 ju zoberie.' },
        { id: '4.4', typ: 'jeVidlicka', fen: '6k1/5ppp/8/1b1n4/8/2PB4/5PPP/6K1 w - - 0 1', tah: 'c3c4',
          ocakavane: true, vysvetlenie: 'Teraz pešiaka stráži strelec d3. Po S×c4 S×c4 by čierny prerobil — pole je ' +
                                        'bezpečné. Porovnaj s úlohou 4.1.' },
        { id: '4.5', typ: 'najdiVidlicku', fen: '2r3k1/5p1p/1r6/8/4Q3/8/6P1/6K1 w - - 0 1',
          ocakavane: ['e4g4'], tip: 'Pozor na pascu: jedna lákavá vidlička stojí na nebezpečnom poli.',
          vysvetlenie: 'De8+ láka, ale veža c8 dámu zoberie. Z g4 dáma napadne kráľa aj vežu c8 a stojí bezpečne.' }
      ]
    },

    // ── Kapitola 5 ─────────────────────────────────────────────────────────
    {
      cislo: 5,
      nazov: 'Šach ako terč',
      tip: 'Pri šachu sa pozri na druhý terč: je cennejší? Ak nie, neubráni ho kráľ ústupom?',
      uvod: [
        'Najväčší poplach je, keď zlodej ohrozí kráľa. <b>Šach a cennejší terč</b> je vždy vidlička: kráľ musí ' +
        'uhnúť a terč padne. Napríklad jazdec dá šach a napadne vežu.',
        'Keď je druhý terč len nestrážený (zvyčajne pešiak), Grošík sa pozrie ďalej: <b>ubráni ho kráľ ústupom?</b> ' +
        'Ak áno, vidlička to nie je. Ak ho kráľ neubráni žiadnym ústupom, je to vidlička.'
      ],
      zapamataj: 'Šach a cennejší terč je vidlička. Šach a nestrážený terč je vidlička, len keď ho kráľ neubráni.',
      prePokrocilych: 'Zručnosť skúma len ústupy kráľa, nie zakrytie šachu inou figúrkou. Keď súper zakryje šach ' +
                      'figúrkou, ktorá zároveň kryje terč, zručnosť to aj tak počíta ako vidličku (kapitola 9).',
      preTrenerov: 'Šach s nestráženým terčom je 35 % vidličiek v tréningu. Klasická kráľovská vidlička (šach ' +
                   'a cennejší terč) je len 8 %.',
      ulohy: [
        { id: '5.1', typ: 'jeVidlicka', fen: '2r3k1/5ppp/8/3N4/8/7P/5PP1/4R1K1 w - - 0 1', tah: 'd5e7',
          ocakavane: true, vysvetlenie: 'Šach a veža c8, ktorá je cennejšia ako jazdec. Kráľ musí uhnúť a veža padne. ' +
                                        'Porovnaj s úlohou 4.2 — tam jazdca e7 zobral jazdec g6.' },
        { id: '5.2', typ: 'jeVidlicka', fen: '4k3/p4ppp/8/8/8/7P/2Q2PP1/6K1 w - - 0 1', tah: 'c2a4',
          ocakavane: true, vysvetlenie: 'Šach a nestrážený pešiak a7. Kráľ z e8 k pešiakovi nedôjde — nech ustúpi ' +
                                        'kamkoľvek, pešiak padne.' },
        { id: '5.3', typ: 'jeVidlicka', fen: 'Q7/5k1p/8/5p2/8/8/5PPP/6K1 w - - 0 1', tah: 'a8d5',
          ocakavane: false, vysvetlenie: 'Šach a pešiak f5, ale kráľ ustúpi na f6 alebo g6 a pešiaka ubráni.' },
        { id: '5.4', typ: 'jeVidlicka', fen: '6k1/1p3ppp/2b5/3N4/8/8/5PPP/6K1 w - - 0 1', tah: 'd5e7',
          ocakavane: false, vysvetlenie: 'Šach je, ale strelca c6 stráži pešiak b7 a strelec nie je cennejší ako jazdec. ' +
                                         'Druhý terč nestojí za to.' },
        { id: '5.5', typ: 'precoNie', fen: '8/2k4p/8/2p5/8/8/3Q1PPP/6K1 w - - 0 1', tah: 'd2a5',
          ocakavane: 'kral', vysvetlenie: 'Kráľ ustúpi na c6 alebo d6 a pešiaka c5 ubráni.' },
        { id: '5.6', typ: 'ktoreTerce', fen: '3q3k/6p1/3N3p/8/8/8/5PPP/6K1 w - - 0 1', tah: 'd6f7',
          ocakavane: ['d8', 'h8'], vysvetlenie: 'Počíta sa dáma d8 aj kráľ h8. Aj kráľ je terč. Pešiaka h6 stráži pešiak g7, ' +
                                                 'ten sa nepočíta.' }
      ]
    },

    // ── Kapitola 6 ─────────────────────────────────────────────────────────
    {
      cislo: 6,
      nazov: 'Hrozba matu',
      tip: 'Napadne ťah figúrku a zároveň pripraví mat na inom poli?',
      uvod: [
        'Druhým terčom nemusí byť figúrka. Môže to byť <b>hrozba matu</b>. Keď ťah napadne figúrku, ktorá stojí ' +
        'za to, a zároveň hrozí mat, súper nestihne oboje: buď zachráni kráľa, alebo figúrku.',
        'Hrozba matu sa počíta, len keď ju <b>vytvoril práve tento ťah</b>. Keď mat hrozil už predtým, ' +
        'nie je to zásluha ťahu.'
      ],
      zapamataj: 'Hrozba matu a napadnutá figúrka je tiež vidlička.',
      prePokrocilych: 'Mat musí mieriť na iné pole ako napadnutá figúrka. Keď sa dá dať mat len zobratím tej istej ' +
                      'figúrky, je to jedna hrozba, nie dve — súper ju odvráti jedným ťahom.',
      preTrenerov: 'Hrozba matu a terč tvorí asi 5 % vidličiek v tréningu. Generátor ju hľadá tak, akoby súper ' +
                   'vynechal ťah: skúsi, či by strana vedela dať mat jedným ťahom. Mat, ktorý sa dal dať už pred ' +
                   'ťahom, sa nepočíta.',
      ulohy: [
        { id: '6.1', typ: 'jeVidlicka', fen: '7k/6pp/2P5/1n6/8/8/8/6KQ w - - 0 1', tah: 'h1d5',
          ocakavane: true, vysvetlenie: 'Dáma napadne jazdca b5 a zároveň hrozí mat Dd8. Čierny nestihne oboje.' },
        { id: '6.2', typ: 'najdiVidlicku', fen: '1b4k1/5ppp/8/8/5p2/8/5QPP/6K1 w - - 0 1',
          ocakavane: ['f2b6'], tip: 'Hľadaj ťah, ktorý napadne figúrku a zároveň pripraví mat.',
          vysvetlenie: 'Db6 napadne strelca b8 a hrozí mat Dd8 — kráľ nemá kam ujsť.' },
        { id: '6.3', typ: 'najdiVidlicky', fen: '6k1/3B1p1p/5nN1/5r2/8/8/5PPP/6K1 w - - 0 1', pomocka: 'strany',
          ocakavane: ['g6e7', 'f5d5'], vysvetlenie: 'Biely: Je7+ dá šach a napadne vežu f5. Čierny: Vd5 napadne ' +
                                                     'strelca d7 a hrozí mat Vd1.' },
        { id: '6.4', typ: 'jeVidlicka', fen: '1b4k1/5pp1/8/7p/5p2/8/5QPP/6K1 w - - 0 1', tah: 'f2b6',
          ocakavane: false, vysvetlenie: 'Teraz má čierny kráľ okienko na h7, takže Dd8 už mat nie je. Dáma napadne len ' +
                                         'strelca b8 — jeden terč. Porovnaj s úlohou 6.2.' }
      ]
    },

    // ── Kapitola 7 ─────────────────────────────────────────────────────────
    {
      cislo: 7,
      nazov: 'Každá figúrka, obe strany',
      uvod: [
        'Vidličkovať môže každá figúrka. Najviac vidličiek robí <b>dáma</b>, ale nezabúdaj na pešiaka a dokonca ' +
        'na <b>kráľa</b>. Aj pešiak, ktorý dôjde na posledný rad, môže vidličkovať — ako nový jazdec alebo dáma.',
        'Zlodeji sú na oboch stranách trhu. Zručnosť hľadá vidličky <b>za bieleho aj za čierneho</b>, bez ohľadu ' +
        'na to, kto je na ťahu. Takmer polovica riešení v tréningu je za stranu, ktorá na ťahu nie je!'
      ],
      zapamataj: 'Hľadám vidličky každej figúrky a za oboch hráčov.',
      prePokrocilych: 'Pri premene zručnosť skúša nového jazdca aj novú dámu. Typická je premena na jazdca so ' +
                      'šachom, ktorá napadne aj dámu.',
      preTrenerov: '41 % vidličiek v tréningu je za stranu, ktorá nie je na ťahu. Hráč, ktorý hľadá len svoje ťahy, ' +
                   'prehliadne takmer polovicu riešení. Úloha Nájdi všetky funguje presne ako tréning v Zručnostiach.',
      ulohy: [
        { id: '7.1', typ: 'jeVidlicka', fen: '2k5/8/8/7p/8/5bn1/1P6/4K3 w - - 0 1', tah: 'e1f2',
          ocakavane: true, vysvetlenie: 'Kráľ napadne strelca f3 aj jazdca g3. Nikto ich nestráži a na f2 kráľa nikto nenapáda.' },
        { id: '7.2', typ: 'jeVidlicka', fen: '8/1q1P1k1p/8/8/8/8/6PP/6K1 w - - 0 1', tah: 'd7d8n',
          otazka: 'Pešiak sa premení na jazdca. Je <b>{tah}</b> vidlička?',
          ocakavane: true, vysvetlenie: 'Nový jazdec dá šach kráľovi f7 a napadne dámu b7.' },
        { id: '7.3', typ: 'najdiVidlicku', fen: '6k1/5p2/1r6/8/4N1N1/8/5PP1/6K1 w - - 0 1', strana: 'b',
          ocakavane: ['f7f5'], tip: 'Hľadaj za čierneho, hoci je na ťahu biely.',
          vysvetlenie: 'Čierny pešiak f5 napadne oba jazdce naraz.' },
        { id: '7.4', typ: 'najdiVidlicky', fen: '2kq3r/1p6/p7/4N3/B1N5/8/5PPP/6K1 w - - 0 1', pomocka: 'strany',
          ocakavane: ['e5f7', 'b7b5'], vysvetlenie: 'Biely: Jf7 napadne dámu d8 a vežu h8. Čierny: pešiak b5 napadne ' +
                                                     'strelca a4 a jazdca c4.' },
        { id: '7.5', typ: 'najdiVidlicky', fen: '6k1/p4pp1/7p/8/7p/8/5PPP/3Q2K1 w - - 0 1',
          ocakavane: ['d1d8', 'd1a4', 'd1d4'], vysvetlenie: 'Jedna dáma, tri vidličky: Dd8+ (šach a pešiak h4), ' +
                                                              'Da4 a Dd4 (pešiaky a7 a h4).' }
      ]
    },

    // ── Kapitola 8 ─────────────────────────────────────────────────────────
    {
      cislo: 8,
      nazov: 'Väzba',
      tip: 'Nie je figúrka viazaná na kráľa? A nekryje terč len viazaná figúrka?',
      uvod: [
        'Figúrka <b>viazaná na kráľa</b> sa nesmie pohnúť, lebo by kráľ ostal v šachu. Viazaný zlodej preto ' +
        'nekradne — takú vidličku nemožno zahrať.',
        'A viazaný strážnik nestráži: keď figúrku kryje len viazaná figúrka, je to, akoby ju nekryl nikto. ' +
        'Pozor, väzbu <b>na dámu</b> zručnosť nevidí — figúrka viazaná na dámu ťahať smie.'
      ],
      zapamataj: 'Viazaný zlodej nekradne, viazaný strážnik nestráži.',
      prePokrocilych: 'Figúrka viazaná na kráľa sa smie pohnúť len po línii väzby. Viazaný jazdec sa nepohne vôbec.',
      preTrenerov: 'Zručnosť rešpektuje len väzbu na kráľa (absolútnu). Väzbu na dámu nesleduje, rovnako ako ' +
                   'Branie so ziskom — preto môže uznať vidličku figúrkou, ktorá v partii odkryje dámu.',
      ulohy: [
        { id: '8.1', typ: 'jeVidlicka', fen: '6k1/5ppp/1b6/4r3/1r6/8/5NPP/6K1 w - - 0 1', tah: 'f2d3',
          ocakavane: false, vysvetlenie: 'Jazdec f2 je viazaný strelcom b6 na kráľa g1. Nesmie sa pohnúť, takže vidličku ' +
                                         'zahrať nemôže. Bez strelca b6 by to vidlička bola.' },
        { id: '8.2', typ: 'jeVidlicka', fen: '4k3/4n3/2n5/8/7b/8/5PPP/3QR1K1 w - - 0 1', tah: 'd1a4',
          ocakavane: true, vysvetlenie: 'Jazdca c6 kryje len jazdec e7, a ten je viazaný vežou e1 na kráľa. Viazaný ' +
                                        'strážnik nestráži, takže jazdec c6 aj strelec h4 sa dajú zobrať so ziskom.' },
        { id: '8.3', typ: 'ktoreTerce', fen: '4k3/3b4/8/1B3n2/8/7r/5PPP/3Q2K1 w - - 0 1', tah: 'd1g4',
          ocakavane: ['f5', 'h3'], vysvetlenie: 'Počíta sa jazdec f5 aj veža h3. Jazdca f5 kryje len strelec d7, a ten je ' +
                                                 'viazaný strelcom b5 na kráľa.' },
        { id: '8.4', typ: 'jeVidlicka', fen: '3qk3/8/5n2/6B1/8/2R5/8/4K3 b - - 0 1', tah: 'f6e4',
          ocakavane: true, vysvetlenie: 'Jazdec napadne vežu c3 a nestráženého strelca g5. Že biely môže zobrať dámu ' +
                                        'ťahom S×d8, nám nevadí — hľadáme vidličky, nie najlepší ťah.' },
        { id: '8.5', typ: 'precoNie', fen: '4r1k1/5ppp/1q6/8/5r2/4N3/5PPP/4K3 w - - 0 1', tah: 'e3d5',
          moznosti: ['dva_terce', 'cena', 'pole', 'vazba'],
          ocakavane: 'vazba', vysvetlenie: 'Jazdec e3 je viazaný vežou e8 na kráľa e1 a nesmie sa pohnúť.' }
      ]
    },

    // ── Kapitola 9 ─────────────────────────────────────────────────────────
    {
      cislo: 9,
      nazov: 'Zručnosť a šachová hra',
      tip: 'Rozhoduj podľa pravidiel vidličky, nie podľa toho, či je ťah v partii dobrý.',
      uvod: [
        'Grošík kontroluje len <b>pravidlá vidličky</b>, nie či je ťah najlepší. Nepozerá sa, čo odpovie súper: ' +
        'či nemá vlastnú silnejšiu hrozbu, či šach nezakryje, či ťah niečo iné nestratí.',
        'Preto niektoré vidličky v partii prehrávajú a niektoré výborné ťahy vidličkou nie sú. Vidličku treba ' +
        'vidieť vždy. <b>Či ju zahráš, rozhodneš v partii.</b>'
      ],
      zapamataj: 'Vidličku vidím. Či ju zahrám, rozhodnem v partii.',
      prePokrocilych: 'Šachový program označil vidličku za najlepší ťah len v 41 % prípadov. Naopak, často je ' +
                      'najlepší dvojitý útok, ktorý zručnosť nepočíta — odkrytý útok alebo obeť, po ktorej ' +
                      'vidlička príde o ťah neskôr.',
      preTrenerov: 'Zručnosť cvičí videnie vzoru, nie hľadanie najlepšieho ťahu (rovnako ako Branie so ziskom). ' +
                   'V záverečnej skúške sú preto len pozície, kde sa zručnosť a partia nerozchádzajú.',
      ulohy: [
        { id: '9.1', typ: 'jeVidlicka', fen: '6k1/8/2n1n3/8/3P4/5b2/8/3Q2K1 w - - 0 1', tah: 'd4d5',
          ocakavane: true, vysvetlenie: 'Podľa pravidiel je to vidlička. V partii by však čierny zobral dámu S×d1! ' +
                                        'Lepšie je D×f3.' },
        { id: '9.2', typ: 'jeVidlicka', fen: '7k/pp4r1/3b1N2/8/4pP2/8/5P1P/6RK w - - 0 1', tah: 'f6e8',
          ocakavane: true, vysvetlenie: 'Jazdec napadne vežu g7 aj strelca d6, takže je to vidlička. V partii však ' +
                                        'čierny zahrá V×g1+ a strelec ujde. Jednoduché V×g7 je lepšie.' },
        { id: '9.3', typ: 'jeVidlicka', fen: '3qk3/p4ppp/8/8/8/7P/2Q2PP1/6K1 w - - 0 1', tah: 'c2a4',
          ocakavane: true, vysvetlenie: 'Šach a nekrytý pešiak a7, ktorého kráľ ústupom neubráni — je to vidlička. ' +
                                        'V partii však čierny zakryje šach Dd7 a dáma zároveň kryje a7.' },
        { id: '9.4', typ: 'jeVidlicka', fen: '4k3/pp3ppp/8/8/4B3/7r/PP3P1P/4R1K1 w - - 0 1', tah: 'e4f5',
          ocakavane: false, vysvetlenie: 'Strelec napadne len vežu h3, šach dáva veža e1 — odkrytý šach. Zručnosť ho ' +
                                         'nepočíta, ale v partii biely vežu vyhrá.' },
        { id: '9.5', typ: 'jeVidlicka', fen: '5k2/5n1R/p4p2/3P1K2/1P2P3/3b4/8/8 b - - 0 1', tah: 'd3e4',
          ocakavane: false, vysvetlenie: 'Strelca zoberie kráľ zadarmo, pole nie je bezpečné. V partii je to však ' +
                                         'výborná obeť: po K×e4 príde vidlička Jg5+ na kráľa a vežu h7.' }
      ]
    },

    // ── Kapitola 10: záverečná skúška ───────────────────────────────────────
    {
      cislo: 10,
      nazov: 'Záverečná skúška',
      uvod: [
        'Grošík ti zverí celý trh! Čaká ťa <b>10 pozícií zo skutočných partií</b>.',
        'V každej nájdi všetky vidličky za oboch hráčov. Máš na to čas, takže buď rýchly aj presný.',
        'Keď vyriešiš aspoň 8 pozícií úplne a bez chyby, získaš odznak <b>Majster vidličky</b>.'
      ],
      uvodKoniec: 'Ak sa nepodarí, poviem ti, ktoré kapitoly si zopakovať. Pozície budú zakaždým iné.',
      zapamataj: 'Majster vidličky hľadá za oboch hráčov a pri každom ťahu skontroluje: dva nové terče, stoja za to, ' +
                 'bezpečné pole, šach.',
      preTrenerov: 'Pozície sú zo skutočných partií, z tých istých ako úlohy v tréningu Vidličky (60 pozícií s 1 až 3 ' +
                   'riešeniami, po 12 z každej úrovne ELO, náhodne sa vyberie 10). Vynechané sú sporné pozície: tie, kde ' +
                   'by uznaná vidlička v partii stratila viac ako 3 pešiaky oproti najlepšiemu ťahu, a tie, kde je ' +
                   'najlepším ťahom dvojitý útok, ktorý zručnosť nepočíta. Čas ako v tréningu na úrovni 1: 60 s + 10 s ' +
                   'na každé riešenie. Skúška sa nezapisuje do štatistík tréningu a nemení ELO. Skúšku možno opakovať, ' +
                   'zakaždým s inými pozíciami. Kto ju zložil a ako idú kapitoly, uvidíš v menu Tréner → Prehľad hier.',
      skuska: {
        typ: 'najdiVidlicky',
        pocet: 10,
        hranica: 8,              // vyriešených úplne a bez chyby
        casZaklad: 60,           // sekúnd (ako tréning, úroveň 1)
        casNaRiesenie: 10,       // sekúnd za každé riešenie
        textZlozena: 'Teraz si naozajstný majster vidličky a môžeš trénovať Vidličky v menu Zručnosti.',
        odkaz: { text: 'Trénovať Vidličky →', href: 'skills.html?type=fork' },
        // Rozbor chýb: ktorá kapitola pomôže
        dovody: {
          1: 'Prehliadnutá vidlička',
          2: 'Označený ťah, ktorý nenapadne dva nové terče (aj odkrytý útok)',
          3: 'Terč, ktorý nestojí za to, alebo prehliadnutá vidlička na nekryté pešiaky',
          4: 'Označený ťah, po ktorom vidličkára zoberú',
          5: 'Šach, pri ktorom kráľ terč ubráni, alebo prehliadnutý šach s nekrytým terčom',
          6: 'Prehliadnutá hrozba matu s terčom',
          7: 'Prehliadnutá vidlička strany, ktorá nie je na ťahu, alebo kráľa',
          8: 'Chyba, pri ktorej rozhoduje väzba'
        },
        // 60 pozícií z úloh tréningu Vidličky (tabuľka skill_puzzles, stav po oprave 27. 9. 2026),
        // 1 až 3 riešenia, 8 až 22 figúrok, po 12 z každej úrovne ELO, bez sporných pozícií
        pozicie: [
          // ELO 1500
          '6r1/p3k3/3ppp1p/1p6/3nPP2/5N2/PPP3rP/2K3RR w - - 0 1',
          '8/pk5p/1p2Bpr1/8/4n3/2P1N1BK/PP5P/8 b - - 0 1',
          '5rk1/4qpp1/p1p4p/4p3/2P1N1Q1/PP1P4/4K3/6R1 b - - 0 1',
          '4r3/ppR3R1/2bpr3/3k3p/3P4/P2K4/1P5P/8 w - - 0 1',
          '1rq2k2/2p1rp2/p3p3/1n1pP2p/2pP1P1P/4P3/P1Q2K2/6RR w - - 0 1',
          'r2q4/pp3kpQ/2b1p2p/2p1P3/2Pp4/3B1P2/PP3P1P/5RK1 w - - 0 1',
          'Q7/6pk/3pr1pp/3N4/P7/KP6/2q5/6R1 b - - 0 1',
          '3r4/2r1kp2/R5p1/1B1pP2p/1P2n3/P6P/6PK/3R4 b - - 0 1',
          '6k1/5ppp/p3p3/1p1pPP2/2q4P/2r2P2/P2Q1K2/3R3R b - - 0 1',
          'r3r1k1/2pb1pb1/1p3nBp/p7/5P2/BQP5/PP4PP/R5K1 b - - 0 1',
          'r4bk1/pp3rpp/n1p2p2/5N2/8/5NR1/PB2bPPP/R5K1 w - - 0 1',
          '5rk1/3R1ppp/p1Q5/1p6/1Pn1Pp1q/P4P2/2P1R1PP/7K b - - 0 1',
          // ELO 1700
          '7k/p3rp2/3N3B/2qpPQ2/2p3rP/P7/6PK/2R5 b - - 0 1',
          '6k1/2R5/5Pb1/8/3P3P/r7/3K4/8 w - - 0 1',
          'r2q1r2/pp1k4/2p4Q/3pn3/8/2P3PP/PP1N4/2KRR3 b - - 0 1',
          '7Q/pp3k2/1qp2p2/3p2p1/8/2P5/PP2rPPP/1R4K1 w - - 0 1',
          '6k1/pp3ppp/2p4r/2Np4/1P6/P5P1/2P1qP2/3R1QK1 b - - 0 1',
          'r4r1k/1p1b2p1/2q1p1P1/p7/8/2PB1p2/P4P2/1K1Q2R1 w - - 0 1',
          '6k1/pQ3pp1/2p4p/4n3/3r4/2q3P1/P5BP/5R1K w - - 0 1',
          '4r1k1/2p2ppp/p1Pp4/1p1Pr1q1/8/3Q3P/PP3PP1/3R1RK1 w - - 0 1',
          'r3r3/2qb1pk1/2p2bP1/p2p2p1/3P2P1/B2B4/P4QN1/4RR1K b - - 0 1',
          '3r2k1/pp4bp/4Rnp1/2q3P1/2P5/5Q1P/P4P1B/2R3K1 b - - 0 1',
          '8/p3r1pk/1p1R1p1p/1P1p1KnP/P2P2P1/4P3/3B4/8 b - - 0 1',
          '2r3k1/4R1p1/p6p/1p6/3P2R1/3K3P/P1r3P1/8 b - - 0 1',
          // ELO 1900
          '7k/4Q1p1/1r5p/8/5q2/4p2P/2P3P1/4R2K w - - 0 1',
          '2r2rk1/pp3ppp/8/3N4/3qP3/KP6/P1P5/R6Q w - - 0 1',
          'r7/4R3/p1k1p1p1/1p2q2p/2p1P3/1P1P3Q/1PP3PP/2K5 b - - 0 1',
          '1nkb3r/R6p/3Rqn2/1Np1p3/4P3/1PQ5/2P2KPP/8 b - - 0 1',
          '5rk1/pQ4pp/3pb1q1/5r2/3P1P2/P3B2P/1P3PP1/2R2RK1 b - - 0 1',
          '6R1/ppq2kp1/2p4p/2N1n2P/4p3/2P5/P5P1/R6K w - - 0 1',
          '8/Q2br3/p1k1p1B1/1p1p4/2nP4/2b5/P4PPP/6K1 w - - 0 1',
          '8/K5p1/2k5/pp5p/P6P/1P4P1/8/8 w - - 0 1',
          'r5k1/p2r2p1/2N2p1p/2QP2q1/2P1R1b1/8/P4PPP/R5K1 b - - 0 1',
          '6k1/5pp1/P3p2p/2p5/2P4P/2rq2P1/R5K1/2R5 w - - 0 1',
          '8/4r2k/p5p1/1bR4p/3pB2b/1K1Pn2P/PP3R2/8 w - - 0 1',
          '6rk/p4Qp1/1p2P2p/8/3n4/1P4R1/P5PP/3q2NK b - - 0 1',
          // ELO 2100
          '1n4k1/1p3rp1/2p3Bp/1P1p4/6QN/2B1P1P1/5q1P/R4b1K b - - 0 1',
          '4r3/p2pkppp/1p2p3/4Q3/1q3NP1/8/4KP1P/4R3 w - - 0 1',
          '2n3r1/6bk/6Rp/3QPp2/1P3q2/8/7P/6RK b - - 0 1',
          'r4rk1/p4ppp/1pp5/4RP2/P1q3nP/2N3Q1/2P2PP1/R5K1 w - - 0 1',
          'r5bk/7n/4P2R/p2pP3/1p4PQ/4P3/P5KP/q7 w - - 0 1',
          '2r1kbnr/pp3ppp/8/4B3/3n4/3B1P2/PPP4P/RN2K2R b KQk - 0 1',
          '7r/1k6/pp5p/2p1P1p1/3n1p2/B7/P4PPP/4RNK1 b - - 0 1',
          '4r2k/pb4p1/1p1pB2p/3P4/r1PR4/6P1/5P1P/1R4K1 w - - 0 1',
          '4rk2/2Q3pp/1p6/5p2/7P/P2K4/5R2/4q3 w - - 0 1',
          'r4r2/1b4k1/p1q3pp/2p1bp2/1pB1N2Q/3P4/1PP1R2P/5RK1 w - - 0 1',
          '2r5/6pk/4r1qp/4B3/p3QP2/P7/1P5P/4R2K w - - 0 1',
          '3r2k1/pb3pp1/1np1p2p/8/P7/2P1P3/1B2BPPP/R5K1 b - - 0 1',
          // ELO 2200
          '8/p7/1p6/3R4/1P2n1k1/P7/2rBK3/8 b - - 0 1',
          '2rr2k1/5ppp/2b1p3/1N6/1PnNPK1P/5P2/6P1/R6R b - - 0 1',
          '8/pp3pkp/4q3/3b3p/3P4/7P/3Q1PP1/4R2K b - - 0 1',
          '8/1pp1r3/p2p3p/P2PpQpk/2P1P3/3q3P/1P4PK/8 w - - 0 1',
          '8/5qpk/3p3p/3Pp2P/6Q1/5NPK/6P1/1r6 w - - 0 1',
          '3q1rk1/pR3pp1/1p3b1p/1N1p4/8/PQ1nPNP1/1P4PP/6K1 b - - 0 1',
          '5rk1/5p1p/p1p2Pn1/3p1R2/3Bp3/r3P1PP/8/2R3K1 w - - 0 1',
          '5r2/6Q1/p2k1rBp/1p1p3P/1q3Pb1/4R3/6PK/8 w - - 0 1',
          '2k2r2/pp4pp/2np1p2/8/P4Q2/8/1PqBr1PP/R4R1K w - - 0 1',
          '5rk1/rp3p1p/2p1n1p1/4b2P/2P3P1/1Q1B1R2/PP6/6K1 b - - 0 1',
          '2b1r1k1/3n1ppp/p1BBp1q1/8/3p3Q/8/P1r2PPP/R4RK1 w - - 0 1',
          'q6k/2Q5/p1R1p2p/1p3p2/1P4p1/P3P1P1/5PKP/3r4 b - - 0 1'
        ]
      }
    }
  ]
};
