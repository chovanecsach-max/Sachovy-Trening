// ============================================================================
//  trh-obsah.js — obsah hry Šachový trh (kapitoly, texty, úlohy)
// ----------------------------------------------------------------------------
//  Jediné miesto, kde sú texty a pozície hry. Herný rámec (hra-engine.js) ich
//  len zobrazuje. Správne odpovede sa NEPÍŠU ručne — pri úlohách so
//  šachovnicou ich vždy vypočíta VisionCore (rovnako ako generátor úloh).
//  Pole „ocakavane" slúži len na kontrolu: keby sa výpočet a scenár
//  rozišli, hra to vypíše do konzoly.
//
//  TYPY ÚLOH:
//    vazenie  — porovnaj dve skupiny figúrok (a, b = reťazce figúrok, napr. 'BP')
//    obchod   — dal som / dostal som, koľko som zarobil (dal, dostal)
//    anonie   — je ťah `tah` branie so ziskom? (fen, tah)
//    kolko    — aký je zisk ťahu `tah`? (fen, tah)
//    pasca    — ktoré z braní `moznosti` je so ziskom? (fen, moznosti)
//    najdi    — nájdi všetky brania so ziskom za oboch (fen, pomocka)
//    stanok   — na ktorom poli (stánku) sa počíta zisk ťahu `tah`? (fen, tah, moznosti = polia)
//
//  KAPITOLA môže mať aj:
//    skuska     — záverečná skúška (náhodný výber pozícií, časový limit)
//    znacka     — čo sa ukáže namiesto čísla (napr. 'B' pre bonus)
//    odomknePo  — číslo kapitoly, po ktorej sa odomkne (inak po predchádzajúcej)
//    otazka     — vlastné znenie otázky Áno/Nie ({tah} = názov ťahu)
//
//  PRÍPRAVA NA SKÚŠKU (kapitola s poľom `priprava`, 30. 9. 2026): stojí pred
//  skúškou a skúška sa odomkne až po nej (hráč ju môže kedykoľvek ukončiť).
//  Úlohy sú ako na skúške (druh úloh, čas), len ich je `pocet` a na každú je
//  o `casNavyse` sekúnd viac. Pozície sú iné ako na skúške.
//
//  Figúrky v textoch: K D V S J (slovensky), vo FEN a v poliach a/b/dal/dostal
//  anglicky ako vo FEN (K Q R B N P).
// ============================================================================

(window.VERZIE = window.VERZIE || {})['trh-obsah.js'] = '2026-09-30';

const OBSAH_TRH = {
  kluc: 'sachovy-trh',
  // Verzia číslovania kapitol. Pri zmene poradia kapitol sa zvýši — kópia postupu
  // v prehliadači zo starého číslovania sa potom nepoužije (databázu prečísluje SQL).
  //   2 = 24. 9. 2026: nová kapitola 10 Zručnosť a šachová hra, skúška 10 → 11, bonus zrušený
  verzia: 2,
  nazov: 'Šachový trh',
  podtitul: 'Hra, ktorá vysvetľuje zručnosť Branie so ziskom',
  sprievodca: 'Grošík',
  pozdrav: 'Ahoj! Som Grošík, obchodník na šachovnicovom trhu. Naučím ťa rozoznať, ' +
           'kedy sa oplatí figúrku zobrať a kedy nie. Vyber si kapitolu.',

  kapitoly: [
    // ── Kapitola 1 ─────────────────────────────────────────────────────────
    {
      cislo: 1,
      nazov: 'Koľko stoja figúrky',
      uvod: [
        'Ahoj, ja som <b>Grošík</b>, obchodník na šachovnicovom trhu! Každá figúrka tu má svoju cenu v minciach.',
        'Keď zoberieš súperovu figúrku, jej mince získaš ty. Keď súper zoberie tvoju, mince stratíš.'
      ],
      cennik: true,
      uvodKoniec: 'Kráľa nemožno zobrať ani vymeniť, preto nemá cenu.',
      zapamataj: 'Pešiak 1, jazdec 3, strelec 3, veža 5, dáma 9.',
      prePokrocilych: 'Tieto ceny sú dohoda. V skutočnej partii môže mať figúrka väčšiu alebo menšiu hodnotu ' +
                      '(aktívny jazdec, dvojica strelcov). V tejto hre však platia presne.',
      preTrenerov: 'Ceny figúrok sú rovnaké ako v tréningu Brania so ziskom v menu Zručnosti. Strelec a jazdec sú ' +
                   'rovnocenní, preto je S×J krytého jazdca vždy výmena za 0 (kapitola 5).',
      ulohy: [
        { id: '1.1', typ: 'vazenie', a: 'R',  b: 'N',  vysvetlenie: 'Veža stojí 5 mincí, jazdec 3.' },
        { id: '1.2', typ: 'vazenie', a: 'R',  b: 'BP', vysvetlenie: 'Veža stojí 5 mincí, strelec a pešiak spolu 4.' },
        { id: '1.3', typ: 'vazenie', a: 'Q',  b: 'RR', vysvetlenie: 'Dve veže stoja 10 mincí, dáma 9.' },
        { id: '1.4', typ: 'vazenie', a: 'B',  b: 'N',  vysvetlenie: 'Strelec aj jazdec stoja po 3 mince — rovnako.' },
        { id: '1.5', typ: 'obchod',  dal: 'N', dostal: 'R',  vysvetlenie: 'Dostal si 5, dal si 3. Zarobil si 2 mince.' },
        { id: '1.6', typ: 'obchod',  dal: 'B', dostal: 'N',  vysvetlenie: 'Dal si 3 a dostal si 3. To je výmena, nie zisk.' },
        { id: '1.7', typ: 'obchod',  dal: 'Q', dostal: 'RP', vysvetlenie: 'Dal si 9, dostal si 5 + 1 = 6. Stratil si 3 mince.' }
      ]
    },

    // ── Kapitola 2 ─────────────────────────────────────────────────────────
    {
      cislo: 2,
      nazov: 'Nekrytá figúrka',
      uvod: [
        'Každé pole šachovnice je jeden <b>stánok</b> nášho trhu. Obchod sa počíta vždy na stánku, kde sa berie.',
        'Figúrka je <b>krytá</b>, keď ju chráni iná figúrka jej farby. Keby si ju zobral, strážca zoberie tvoju figúrku späť.',
        'Figúrka je <b>nekrytá</b>, keď ju nechráni nikto. Je ako peňaženka zabudnutá na lavičke: kto ju vezme, má všetky mince a nič neplatí.',
        'Pozor, aj kráľ môže brať! Ale len nekrytú figúrku, lebo kráľ nesmie vstúpiť na napadnuté pole.'
      ],
      zapamataj: 'Nekrytá figúrka = zisk celej jej ceny.',
      prePokrocilych: 'Nekrytá figúrka je branie so ziskom, nech ju berieš čímkoľvek, aj dámou. Súper nemá čím brať späť.',
      preTrenerov: 'Pri nekrytej figúrke tréning v Zručnostiach vypíše vetu „Nikto ho/ju nebráni.“ Za obrancu sa ' +
                   'počíta aj figúrka v batérii (kapitola 8), nepočíta sa figúrka viazaná na kráľa (kapitola 9).',
      ulohy: [
        { id: '2.1', typ: 'anonie', fen: '6k1/8/3n4/8/8/8/8/3R2K1 w - - 0 1', tah: 'd1d6',
          ocakavane: 3, vysvetlenie: 'Jazdca nikto nebráni.' },
        { id: '2.2', typ: 'anonie', fen: '6k1/8/4p3/3p4/8/2N5/8/6K1 w - - 0 1', tah: 'c3d5',
          ocakavane: -2, vysvetlenie: 'Pešiak d5 je krytý pešiakom e6. Za pešiaka by si dal jazdca.' },
        { id: '2.3', typ: 'kolko', fen: '7k/8/4r3/8/8/8/Q7/6K1 w - - 0 1', tah: 'a2e6',
          ocakavane: 5, vysvetlenie: 'Vežu nikto nebráni, dostaneš celých 5 mincí.' },
        { id: '2.4', typ: 'anonie', fen: '6k1/8/8/8/2pK4/8/8/8 w - - 0 1', tah: 'd4c4',
          ocakavane: 1, vysvetlenie: 'Aj kráľ smie zobrať nekrytú figúrku.' },
        { id: '2.5', typ: 'najdi', fen: '6k1/8/5p2/3np3/8/r7/1B6/3R2K1 w - - 0 1',
          ocakavane: ['b2a3', 'd1d5'],
          vysvetlenie: 'Veža a3 a jazdec d5 sú nekryté. Pešiaka e5 kryje pešiak f6, preto Sb2×e5 nie je zisk.' }
      ]
    },

    // ── Kapitola 3 ─────────────────────────────────────────────────────────
    {
      cislo: 3,
      nazov: 'Hľadáme za oboch',
      uvod: [
        'Na trhu nie si sám, aj súper hľadá výhodné obchody.',
        'Preto hľadáš brania za bieleho <b>AJ</b> za čierneho. Nezáleží na tom, kto je práve na ťahu.',
        'Dobrý hráč vždy vidí, čo môže zobrať on, aj čo môže zobrať súper.'
      ],
      uvodKoniec: 'V tejto kapitole ti pomôžem: ukážem, koľko braní so ziskom má každá strana.',
      zapamataj: 'Vždy sa pozri za oboch.',
      prePokrocilych: 'Obe strany môžu mať zisk naraz. V úlohe 3.1 berie veža jazdca a zároveň jazdec môže zobrať strelca.',
      preTrenerov: 'Brania sa hľadajú za oboch bez ohľadu na to, kto je na ťahu. Preto sa v úlohách nikdy neobjaví ' +
                   'pozícia, v ktorej je niektorý kráľ v šachu.',
      ulohy: [
        { id: '3.1', typ: 'najdi', pomocka: 'strany', fen: '6k1/8/8/8/4n3/6B1/8/4R1K1 w - - 0 1',
          ocakavane: ['e1e4', 'e4g3'],
          vysvetlenie: 'Veža berie nekrytého jazdca a jazdec môže zobrať nekrytého strelca. Zisk majú obaja.' },
        { id: '3.2', typ: 'najdi', pomocka: 'strany', fen: '6k1/8/5p2/3np3/8/p7/1B6/3R2K1 w - - 0 1',
          ocakavane: ['b2a3', 'd1d5', 'a3b2'],
          vysvetlenie: 'Nezabudni na čierneho pešiaka a3 — aj on môže zobrať strelca b2.' },
        { id: '3.3', typ: 'najdi', pomocka: 'strany', fen: '6k1/8/4pb2/3p2n1/8/2N4P/8/6K1 w - - 0 1',
          ocakavane: ['f6c3', 'g5h3'],
          vysvetlenie: 'Tentoraz má zisk len čierny. Biely jazdec by na d5 narazil na krytého pešiaka.' },
        { id: '3.4', typ: 'najdi', pomocka: 'strany', fen: '6k1/2r5/8/8/4n3/6B1/8/4R1K1 w - - 0 1',
          ocakavane: ['g3c7', 'e1e4', 'e4g3'],
          vysvetlenie: 'Tri brania so ziskom: dve biele a jedno čierne.' }
      ]
    },

    // ── Kapitola 4 ─────────────────────────────────────────────────────────
    {
      cislo: 4,
      nazov: 'Lacnejší berie drahšieho',
      uvod: [
        'Pešiak zoberie jazdca. Súper ti pešiaka zoberie späť.',
        'Dostal si 3 mince a zaplatil si 1, takže si zarobil 2.',
        'Aj krytú figúrku sa oplatí zobrať, keď ju berieš <b>lacnejšou</b> figúrkou.'
      ],
      zapamataj: 'Lacnejšou figúrkou beriem drahšiu, aj krytú.',
      prePokrocilych: 'Zisk je vtedy aspoň rozdiel cien: cena obete mínus cena mojej figúrky. Môže byť aj väčší, ' +
                      'keď súper späť nezoberie. Pozor na úlohu 4.3: veža berie dámu (+4), ale zároveň čierna dáma ' +
                      'môže zobrať nekrytú vežu (+5).',
      preTrenerov: 'Pri krytej figúrke tréning napíše len výsledok, napríklad „Berie jazdca na d5 (zisk +2).“ Celý ' +
                   'priebeh výmeny ukazuje v hre rebrík výmeny — hodí sa, keď hráč nechápe, prečo je branie so ' +
                   'ziskom.',
      ulohy: [
        { id: '4.1', typ: 'kolko', fen: '6k1/8/2p5/3n4/4P3/8/8/6K1 w - - 0 1', tah: 'e4d5',
          ocakavane: 2, vysvetlenie: 'Jazdca kryje pešiak c6. Dostaneš 3, zaplatíš 1.' },
        { id: '4.2', typ: 'kolko', fen: '6k1/8/p7/1r6/8/2N5/8/6K1 w - - 0 1', tah: 'c3b5',
          ocakavane: 2, vysvetlenie: 'Vežu kryje pešiak a6. Dostaneš 5, zaplatíš 3.' },
        { id: '4.3', typ: 'kolko', fen: '6k1/2p5/3q4/8/8/8/8/3R2K1 w - - 0 1', tah: 'd1d6',
          ocakavane: 4, vysvetlenie: 'Dámu kryje pešiak c7. Dostaneš 9, zaplatíš 5.' },
        { id: '4.4', typ: 'anonie', fen: '6k1/6p1/5r2/8/8/8/1B6/6K1 w - - 0 1', tah: 'b2f6',
          ocakavane: 2, vysvetlenie: 'Vežu kryje pešiak g7, ale strelec je lacnejší: +5 −3 = +2.' },
        { id: '4.5', typ: 'pasca', fen: '6k1/8/2p2p2/3nr3/8/5N2/8/3R2K1 w - - 0 1', moznosti: ['f3e5', 'd1d5'],
          ocakavane: ['f3e5'],
          vysvetlenie: 'Jf3×e5 berie vežu lacnejším jazdcom. Vd1×d5 berie jazdca drahšou vežou — a jazdca kryje pešiak c6.' },
        { id: '4.6', typ: 'najdi', fen: '6k1/8/p1p5/1r1n4/4P3/2N5/8/6K1 w - - 0 1',
          ocakavane: ['e4d5', 'c3b5', 'd5c3'],
          vysvetlenie: 'Pešiak berie jazdca, jazdec berie vežu a čierny jazdec môže zobrať nekrytého jazdca c3. Jc3×d5 je len výmena.' }
      ]
    },

    // ── Kapitola 5 ─────────────────────────────────────────────────────────
    {
      cislo: 5,
      nazov: 'Výmena nie je zisk',
      uvod: [
        'Keď dáš strelca a dostaneš jazdca, nič si nezarobil ani nestratil. To je <b>výmena</b>, nie zisk.',
        'A keď zoberieš dámou pešiaka, ktorého chráni iný pešiak? Dostaneš 1 mincu, ale zaplatíš 9. Strata 8 mincí!'
      ],
      zapamataj: 'Zisk musí byť väčší ako nula. Výmena sa nepočíta.',
      prePokrocilych: 'Výmena môže byť v partii dobrá, napríklad na zjednodušenie alebo proti dobrej figúrke súpera. ' +
                      'Branie so ziskom to však nie je.',
      preTrenerov: 'Branie musí priniesť viac, než hráč dá. Rovnocenná výmena (zisk 0) sa medzi riešeniami nikdy ' +
                   'neobjaví, ani keď je pozične výhodná.',
      ulohy: [
        { id: '5.1', typ: 'anonie', fen: '6k1/1p6/2n5/1B6/8/8/8/6K1 w - - 0 1', tah: 'b5c6',
          ocakavane: 0, vysvetlenie: 'Strelec za jazdca — 3 za 3. To je výmena, nie zisk.' },
        { id: '5.2', typ: 'anonie', fen: '6k1/2p5/3r4/8/8/8/8/2KR4 w - - 0 1', tah: 'd1d6',
          ocakavane: 0, vysvetlenie: 'Veža za vežu. Nič nezískaš ani nestratíš.' },
        { id: '5.3', typ: 'kolko', fen: '6k1/8/4p3/3p4/8/8/8/3Q2K1 w - - 0 1', tah: 'd1d5',
          ocakavane: -8, vysvetlenie: 'Dostaneš pešiaka za 1 mincu, pešiak e6 ti zoberie dámu za 9.' },
        { id: '5.4', typ: 'pasca', fen: '6k1/8/4p3/1b1n4/8/2N5/8/6K1 w - - 0 1', moznosti: ['c3d5', 'c3b5'],
          ocakavane: ['c3b5'],
          vysvetlenie: 'Strelca b5 nikto nekryje. Jc3×d5 je len výmena jazdca za jazdca.' },
        { id: '5.5', typ: 'najdi', fen: '6k1/1pp5/2nr4/PB6/8/8/8/2KR4 w - - 0 1',
          ocakavane: ['c6a5'],
          vysvetlenie: 'Jediný zisk: čierny jazdec berie nekrytého pešiaka a5. Ostatné brania sú len výmeny.' }
      ]
    },

    // ── Kapitola 6 ─────────────────────────────────────────────────────────
    {
      cislo: 6,
      nazov: 'Počet nestačí',
      uvod: [
        'Myslíš si: mám dvoch útočníkov, súper má jedného obrancu, takže vyhrám? Nie vždy!',
        'Pešiak d5 je krytý pešiakom c6 a biely naň útočí jazdcom aj vežou. Jazdec zoberie pešiaka (+1), ' +
        'pešiak zoberie jazdca (−3), veža zoberie pešiaka (+1). Spolu −1.',
        'A naopak: súper niekedy späť nezoberie, lebo by stratil ešte viac. Vtedy zarobíš, aj keď je figúrka krytá.'
      ],
      zapamataj: 'Nepočítaj figúrky, počítaj mince.',
      prePokrocilych: 'Každá strana berie svojou najlacnejšou figúrkou a môže kedykoľvek prestať. Keď súper späť ' +
                      'nezoberie (6.2, 6.3), zisk je celá cena obete.',
      preTrenerov: 'Zisk = cena zobratej figúrky mínus to, čo súper získa braním späť — ale len ak sa mu braním ' +
                   'späť oplatí. Pozor na rozdiel oproti zručnosti Slabo pokryté figúrky (obrancov je rovnako alebo ' +
                   'menej ako útočníkov): v pozícii 6.1 je pešiak d5 slabo pokrytý, a predsa naň nie je žiadne ' +
                   'branie so ziskom.',
      ulohy: [
        { id: '6.1', typ: 'kolko', fen: '4k3/8/2p5/3p4/5N2/8/8/3RK3 w - - 0 1', tah: 'f4d5',
          ocakavane: -1, vysvetlenie: 'Jazdec za dvoch pešiakov: +1 −3 +1 = −1.' },
        { id: '6.2', typ: 'anonie', fen: '6k1/8/5n2/3n4/8/1B6/8/3R2K1 w - - 0 1', tah: 'b3d5',
          ocakavane: 3, vysvetlenie: 'Keby čierny zobral späť jazdcom f6, veža zoberie jeho jazdca. Nič by nezískal, preto späť neberie.' },
        { id: '6.3', typ: 'anonie', fen: '6k1/4q3/8/4p3/8/5N2/8/4R1K1 w - - 0 1', tah: 'f3e5',
          ocakavane: 1, vysvetlenie: 'Pešiaka kryje len dáma. Keby zobrala jazdca, veža e1 zoberie dámu — preto čierny späť neberie.' },
        { id: '6.4', typ: 'kolko', fen: '3r2k1/8/5n2/3p4/8/8/3R4/3R2K1 w - - 0 1', tah: 'd2d5',
          ocakavane: -4, vysvetlenie: 'Pešiaka kryjú veža aj jazdec. Zoberieš pešiaka (+1), jazdec ti zoberie vežu (−5) a ďalej sa ti brať neoplatí.' },
        { id: '6.5', typ: 'najdi', fen: '6k1/8/2p2p2/3pn3/5N2/8/1B6/3RR1K1 w - - 0 1',
          ocakavane: ['b2e5'],
          vysvetlenie: 'Vyjde jedine Sb2×e5: +3 −3 +1. Ostatné brania sú straty, aj keď máš viac útočníkov.' }
      ]
    },

    // ── Kapitola 7 ─────────────────────────────────────────────────────────
    {
      cislo: 7,
      nazov: 'Rovnaký terč, iná figúrka',
      uvod: [
        'V tejto hre neklikáš na figúrku, ktorú chceš zobrať. Klikáš na <b>ťah</b>: KTO berie a ČO.',
        'Veža d5 je krytá pešiakom. Keď ju zoberie jazdec, zarobíš. Keď ju zoberie dáma, stratíš, lebo pešiak zoberie dámu.',
        'A keď terč nikto nekryje? Potom je so ziskom každé jeho branie. Treba nájsť všetky!'
      ],
      zapamataj: 'Riešenie je ťah, nie pole.',
      prePokrocilych: 'Prvú figúrku vo výmene si vyberáš ty, preto záleží, ČÍM začneš. Ďalej už obe strany berú ' +
                      'svojou najlacnejšou figúrkou.',
      preTrenerov: 'Prvou figúrkou vo výmene je vždy tá, ktorou hráč berie; ďalej obe strany berú najlacnejšou ' +
                   'figúrkou. Preto môže byť Jf4×d5 branie so ziskom a Da2×d5 nie. V úlohe Nájdi všetky sa každé ' +
                   'branie hodnotí samostatne.',
      ulohy: [
        { id: '7.1', typ: 'pasca', fen: '7k/8/2p5/3r4/5N2/8/Q7/6K1 w - - 0 1', moznosti: ['f4d5', 'a2d5'],
          ocakavane: ['f4d5'],
          vysvetlenie: 'Jazdec je lacnejší ako veža, dáma drahšia. Na tom istom poli rozhoduje, čím berieš.' },
        { id: '7.2', typ: 'pasca', fen: '6k1/8/5p2/4n3/3P4/8/8/4R1K1 w - - 0 1', moznosti: ['d4e5', 'e1e5'],
          ocakavane: ['d4e5'],
          vysvetlenie: 'Pešiak berie jazdca a čierny späť nezoberie. Veža by po f6×e5 stratila viac, ako získala.' },
        { id: '7.3', typ: 'najdi', fen: '6k1/8/8/3n4/8/1B6/8/3R2K1 w - - 0 1',
          ocakavane: ['b3d5', 'd1d5'],
          vysvetlenie: 'Jazdca nikto nekryje, takže so ziskom ho zoberie strelec aj veža. Rátajú sa oba ťahy.' },
        { id: '7.4', typ: 'najdi', fen: '6k1/8/2p5/3n4/4P3/8/8/3Q2K1 w - - 0 1',
          ocakavane: ['e4d5'],
          vysvetlenie: 'Pešiak berie jazdca so ziskom. Dáma by na d5 prerobila.' }
      ]
    },

    // ── Kapitola 8 ─────────────────────────────────────────────────────────
    {
      cislo: 8,
      nazov: 'Batéria',
      uvod: [
        'Niekedy stoja figúrky za sebou na jednom stĺpci, rade alebo uhlopriečke — ako vagóny vláčika.',
        'Keď predná zoberie, zadná sa hneď dostane k slovu. Tomu hovoríme <b>batéria</b>.',
        'Pozor, batériu môže mať aj súper medzi obrancami!'
      ],
      zapamataj: 'Pozri sa aj ZA figúrku, môže tam stáť posila.',
      prePokrocilych: 'Batéria funguje na stĺpci a rade (veža + veža, veža + dáma) aj na uhlopriečke (strelec + dáma). ' +
                      'Zadná figúrka ide do výmeny až vtedy, keď predná odišla.',
      preTrenerov: 'Po každom braní sa do výmeny zapojí aj figúrka, ktorá stála v batérii za tou, čo práve brala. ' +
                   'Porovnanie k 8.4: bez Db1 a Va2 (Biely: Kg1, Va1, Sc2) sú obe brania bez zisku, Sc2×f5 = 0 a ' +
                   'Va1×a5 = −4.',
      ulohy: [
        { id: '8.1', typ: 'kolko', fen: '3rk3/8/8/3p4/8/8/3R4/3QK3 w - - 0 1', tah: 'd2d5',
          ocakavane: 1, vysvetlenie: 'Za vežou d2 stojí dáma. Keby čierny zobral vežu, dáma zoberie jeho vežu — preto čierny späť neberie.' },
        { id: '8.2', typ: 'anonie', fen: '3r2k1/3r4/8/3p4/8/8/3R4/3R2K1 w - - 0 1', tah: 'd2d5',
          ocakavane: -4, vysvetlenie: 'Aj čierny má zdvojené veže. Po Vd7×d5 by si ďalej len prerábal.' },
        { id: '8.3A', typ: 'anonie', fen: '3q2k1/8/5n2/6B1/7Q/8/8/6K1 w - - 0 1', tah: 'g5f6',
          ocakavane: 3, vysvetlenie: 'Za strelcom stojí dáma h4. Keby čierna dáma zobrala strelca, biela dáma zoberie ju.' },
        { id: '8.3B', typ: 'anonie', fen: '3q2k1/8/5n2/6B1/8/8/8/6K1 w - - 0 1', tah: 'g5f6',
          ocakavane: 0, vysvetlenie: 'Tá istá pozícia, ale bez dámy na h4. Teraz je to len výmena: strelec za jazdca.' },
        { id: '8.4', typ: 'najdi', fen: 'r5k1/8/4p3/p4n2/8/8/R1B5/RQ4K1 w - - 0 1',
          ocakavane: ['a2a5', 'c2f5'],
          vysvetlenie: 'Obe brania vyjdú len vďaka batérii: za vežou a2 stojí veža a1, za strelcom c2 dáma b1.' }
      ]
    },

    // ── Kapitola 9 ─────────────────────────────────────────────────────────
    {
      cislo: 9,
      nazov: 'Väzba: obranca, ktorý nebráni',
      uvod: [
        'Viazaná figúrka stojí medzi svojím kráľom a súperovou vežou, strelcom alebo dámou. Keby odišla, jej kráľ ' +
        'by bol v šachu — a to pravidlá nedovolia.',
        'Taká figúrka je ako strážca, ktorý nesmie opustiť bránu. Nemôže nikoho brať, takže nikoho ani nechráni.'
      ],
      zapamataj: 'Viazaná figúrka nie je obranca.',
      prePokrocilych: 'Viazaná figúrka môže brať po línii väzby, napríklad zobrať samotnú figúrku, ktorá ju viaže. ' +
                      'Viazaný môže byť aj pešiak (9.3).',
      preTrenerov: 'Figúrka viazaná na kráľa sa za obrancu nepočíta — brať nesmie, lebo by to bol nelegálny ťah. ' +
                   'Preto tréning pri 9.1 napíše „Nikto ho nebráni“, hoci jazdec f6 na pole d5 vidí. Väzba na dámu ' +
                   'alebo vežu sa nepočíta, pozri kapitolu 10.',
      ulohy: [
        { id: '9.1', typ: 'anonie', fen: '7k/8/5n2/3p4/8/8/1B6/3RK3 w - - 0 1', tah: 'd1d5',
          ocakavane: 1, vysvetlenie: 'Jazdec f6 je viazaný strelcom b2 na kráľa h8. Pešiaka d5 preto nikto nebráni.' },
        { id: '9.2', typ: 'anonie', fen: '7k/8/5n2/8/4P3/8/1B6/6K1 w - - 0 1', tah: 'f6e4',
          ocakavane: 'nelegalny',
          vysvetlenie: 'Jazdec f6 je viazaný strelcom b2 na kráľa h8. Nesmie sa pohnúť, takže nemôže brať.' },
        { id: '9.3', typ: 'kolko', fen: '3k4/8/5p2/4r3/2N4B/8/8/6K1 w - - 0 1', tah: 'c4e5',
          ocakavane: 5, vysvetlenie: 'Pešiak f6 je viazaný strelcom h4 na kráľa d8 a nemôže brať späť.' },
        { id: '9.4', typ: 'najdi', fen: '7k/8/5n2/3p4/4P3/8/1B6/3R2K1 w - - 0 1',
          ocakavane: ['e4d5', 'b2f6', 'd1d5', 'd5e4'],
          vysvetlenie: 'Štyri brania so ziskom. A pozor na pascu: viazaný jazdec f6 nesmie zobrať pešiaka e4.' }
      ]
    },

    // ── Kapitola 10 — zručnosť a šachová hra ───────────────────────────────
    {
      cislo: 10,
      nazov: 'Zručnosť a šachová hra',
      uvod: [
        'Náš trh má <b>64 stánkov</b> — každé pole šachovnice je jeden stánok. Keď začneš brať, vyberieš si stánok: ' +
        'je to pole, na ktorom berieš. Tam sa uzatvára celý obchod: berieš ty, berie súper, berieš ty…',
        'Zisk počítame <b>len na tomto stánku</b>. Čo sa potom môže stať na inom stánku, je iný obchod. ' +
        'Nezaujíma nás, aj keby tam bol veľký zisk alebo veľká strata.'
      ],
      uvodKoniec: 'V skutočnej partii sa pozeráš na celú šachovnicu. Tu sa učíš jednu vec: rýchlo a presne vidieť zisk na jednom stánku.',
      zapamataj: 'Počítam len na stánku, kde som začal brať. Ostatné stánky sú iný obchod.',
      prePokrocilych: 'Na našom stánku platia pravidlá šachu: viazaná figúrka na kráľa nesmie brať (kapitola 9), ' +
                      'kráľ nesmie zobrať krytú figúrku a pešiak na poslednom rade sa mení na dámu. Nepočítame však, ' +
                      'čo sa potom stane na inom stánku: väzbu na dámu, odkrytý útok, preťaženého obrancu, medziťah ani mat.',
      preTrenerov: 'Zručnosť Branie so ziskom trénuje len videnie možnosti zisku materiálu na určitom poli. ' +
                   'Netrénuje hľadanie najlepšieho ťahu. Výmena sa počíta len na poli, kde sa začalo brať; väzbu na ' +
                   'dámu, odkrytý útok, preťaženého obrancu, medziťah ani mat po braní zámerne nevidí. Pravidlá ' +
                   'šachu na tom poli však platia: figúrka viazaná na kráľa nesmie brať, kráľ nevstúpi do šachu a ' +
                   'pešiak na poslednom rade sa mení na dámu.',
      ulohy: [
        { id: '10.1', typ: 'stanok', fen: '1k5q/8/5n2/8/3Bp3/8/8/4RK2 w - - 0 1', tah: 'e1e4',
          moznosti: ['e4', 'f6', 'h8'], ocakavane: -4,
          vysvetlenie: 'Stánok je pole, na ktorom sa berie: e4. Tam sa uzatvára celý obchod.' },
        { id: '10.2', typ: 'anonie', fen: '1k5q/8/5n2/8/3Bp3/8/8/4RK2 w - - 0 1', tah: 'e1e4',
          ocakavane: -4,
          vysvetlenie: 'Na stánku e4 stratíš 4 mince: jazdec f6 zoberie vežu. Že potom Sd4×h8 zoberie dámu, ' +
                       'je iný stánok — iný obchod.' },
        { id: '10.3', typ: 'anonie', fen: 'r5k1/pp1q2pp/2p1r3/3pP3/6Q1/2N5/PPP2PPK/R4R2 b - - 0 1', tah: 'e6e5',
          otazka: 'Na ťahu je čierny. Je <b>{tah}</b> branie so ziskom?',
          ocakavane: 1,
          vysvetlenie: 'Na stánku e5 čierny zarobí pešiaka, nikto ho nebráni. Že potom Dg4×d7 zoberie dámu, ' +
                       'je iný stánok — iný obchod.' },
        { id: '10.4', typ: 'anonie', fen: '6k1/8/1b2p3/8/3N4/8/5Q2/7K w - - 0 1', tah: 'd4e6',
          ocakavane: 1,
          vysvetlenie: 'Na stánku e6 zarobíš pešiaka, nikto ho nebráni. Že jazdec odkryl uhlopriečku a Sb6×f2 ' +
                       'zoberie dámu, je iný stánok — iný obchod.' },
        { id: '10.5', typ: 'najdi', fen: '6k1/8/5p2/3np3/8/p7/1B6/3R2K1 w - - 0 1', pomocka: 'strany',
          ocakavane: ['b2a3', 'd1d5', 'a3b2'],
          vysvetlenie: 'Tri stánky, tri obchody: d5 a a3 pre bieleho, b2 pre čierneho. Pri Vd1×d5 nás b2 nezaujíma — ' +
                       'ale je to ďalší stánok, a aj ten treba nájsť.' }
      ]
    },

    // ── Príprava na skúšku ──────────────────────────────────────────────────
    //  Na mape stojí pred skúškou. Číslo 20 slúži len na uloženie postupu —
    //  skúška si tak nechala číslo 11 a uložený postup hráčov sa nemenil.
    {
      cislo: 20,
      nazov: 'Príprava na skúšku',
      uvod: [
        'Pred skúškou si to vyskúšaj naostro: <b>20 pozícií z ozajstných partií</b>. V každej nájdi všetky ' +
        'brania so ziskom za oboch hráčov. Pozície sú iné ako na skúške.',
        'Na každú pozíciu máš o <b>minútu viac</b> ako na skúške. Keď vyriešiš aspoň 80 % pozícií úplne a bez ' +
        'chyby, si na skúšku pripravený.',
        'Tréning môžeš kedykoľvek ukončiť tlačidlom <b>Ukončiť tréning</b>. Vyhodnotím, čo si stihol, a skúška ' +
        'sa ti odomkne.'
      ],
      preTrenerov: 'Príprava je povinná pred skúškou, ale hráč ju môže kedykoľvek ukončiť a ísť na skúšku (kto skúšku ' +
                   'už skúšal, má ju odomknutú aj bez prípravy). ' +
                   'Pozície sú zo skutočných partií, z toho istého zdroja ako pozície skúšky, ale ' +
                   'iné (60 pozícií s 1 až 4 riešeniami, náhodne sa vyberie 20). ' +
                   'Čas: ako na skúške + 60 s na každú pozíciu. Príprava nedáva hviezdičky ani odznak, nezapisuje sa ' +
                   'do štatistík tréningu a nemení ELO. Najlepší výsledok a počet pokusov uvidíš v menu Tréner → ' +
                   'Prehľad hier.',
      priprava: {
        pocet: 20,
        casNavyse: 60,           // sekúnd navyše oproti skúške na každú pozíciu
        // 60 pozícií zo skutočných partií (Skills.pgn, rovnaký zdroj ako skúška), 1 až 4 riešenia,
        // 6 až 24 figúrok, rovnaké rozdelenie počtu riešení ako skúška, mimo skúšky a kapitol
        pozicie: [
          '6k1/pp2rp2/6pp/3R1n2/8/3Q4/Pq4PP/5R1K w - - 0 1',
          'r2r4/1p1R3p/2p1p1k1/b1B1Pp2/2P2P2/8/2P4P/2KR4 w - - 0 1',
          '3r3k/p1p2rb1/3n2pp/2Bq4/1P1pN2P/3P2PB/P2Q1P1K/4R3 w - - 0 1',
          '4br2/p1q1p1k1/4Q1p1/1pN2n2/1P1b4/8/P3B1PP/4BR1K b - - 0 1',
          '7k/5prp/6q1/p2pP3/P2P3b/4B2Q/7P/5R1K b - - 0 1',
          '8/2pp2pp/8/2PP1P2/1p5k/8/PP4p1/6K1 w - - 0 1',
          '2R1r3/2Q1N1pk/5p2/7K/2P3PP/8/8/5q2 b - - 0 1',
          '5Bk1/pr2pp1p/2b3pQ/2p1q3/8/P1P4P/1P4P1/1B1Rb1K1 w - - 0 1',
          '1k6/2R3p1/1K6/R3p2P/8/8/6q1/8 w - - 0 1',
          '2B1K1k1/4Q2n/7P/5P2/6r1/7q/5P2/8 w - - 0 1',
          '1R6/8/P3b1p1/k7/8/7n/p5K1/8 w - - 0 1',
          '8/4R3/1P6/5p2/1k2b2P/4P3/7r/K7 w - - 0 1',
          '2k5/8/1PpK1p1p/8/1Pp1PP2/8/8/8 w - - 0 1',
          '2k4b/2P5/8/6N1/8/P7/2K5/8 w - - 0 1',
          'b2kN3/8/5P2/8/p7/p7/P3K3/8 w - - 0 1',
          '6kq/4K1pp/p4p2/P3PP1R/6P1/8/8/8 w - - 0 1',
          '8/7p/8/1Bk4b/2N5/K7/7N/8 w - - 0 1',
          'rr3nk1/6q1/2p1pRP1/3pP1Qp/6p1/2P3P1/N6P/K1R5 w - - 0 1',
          '5rk1/pp1rbp1p/5p2/5N1b/2P1p3/2BqQ1P1/PP3R1P/R3K3 b Q - 0 1',
          'r4rk1/1p2QN1p/4nPp1/1n1p4/4q3/1P6/1NR3PP/2R4K b - - 0 1',
          '2kr4/pp3ppp/8/4qb2/Q1Pn4/P3PB2/1P3PPP/R1K4R b - - 0 1',
          'r4rk1/pp2ppbp/6p1/8/Qnq1P3/2N1BPP1/PP4KP/R4R2 b - - 0 1',
          '3rr1k1/p4ppp/1p3q2/1P2n3/3Rn3/B3P3/B1Q2PPP/5RK1 b - - 0 1',
          '5r2/4prkp/3q2p1/2pP1n2/N1Q2R2/1P4PP/P5K1/4R3 b - - 0 1',
          '3q4/p2rRpkp/1p4p1/2p5/3p4/1P1P3P/P1P1QPP1/6K1 w - - 0 1',
          'r4rk1/5ppp/p2pbb2/3B3Q/qp2p3/4B3/PPP2P1P/2KR2R1 w - - 0 1',
          '2b1k3/p5p1/1p5p/2p1b3/5P2/2Pp2P1/PP4P1/4R1K1 b - - 0 1',
          '1r2r3/5B1k/5Q2/7p/7P/8/7K/8 b - - 0 1',
          '8/3r2p1/pp1Bp1p1/1kP5/1n2K3/6R1/1P3P2/8 w - - 0 1',
          '2r1k2r/pp1b1ppp/8/2qpP3/6n1/2NB4/PP3PPP/1R1QR1K1 w k - 0 1',
          '5r1k/pp1n1p1p/1b1qpP2/8/1PrN4/P1N1Q1P1/7P/3R1R1K w - - 0 1',
          'k7/2K5/8/1b6/B3N3/8/8/6B1 w - - 0 1',
          'b5r1/2P5/8/7K/2R5/4k3/6Pp/8 w - - 0 1',
          '4b3/p3b3/PP5R/1N6/K1k5/8/8/8 w - - 0 1',
          'k3K3/N7/1P6/4P3/3b4/8/8/8 w - - 0 1',
          '8/6pR/3P4/4P3/8/4rp2/8/k2K4 w - - 0 1',
          '8/8/6P1/3B2k1/8/2r3P1/8/K7 w - - 0 1',
          'N7/1p1kqP2/8/3P4/KP6/4B3/8/8 w - - 0 1',
          '8/8/1p1K4/Pp6/2k1p3/8/1P6/8 w - - 0 1',
          'K7/8/4P3/6b1/P4n2/1k6/8/8 w - - 0 1',
          '4k3/2n2p2/4pP2/P2nN2p/4qP2/8/Q5RP/2r3NK b - - 0 1',
          '2b2rk1/p2q2pp/8/np4QN/8/PP4pP/6P1/2R3BK w - - 0 1',
          '3knR2/4R3/2br2rp/2N5/1P1pp3/1B2P2P/7K/8 w - - 0 1',
          '1k5r/pr4p1/QP3pq1/2p3n1/2P5/8/1B1PP3/R3K1R1 w Q - 0 1',
          '3rkr2/pR2b1pp/2p1qn2/8/8/4B3/P1P1QPPP/4R1K1 w - - 0 1',
          '1R1K4/k1n5/1p6/1P6/8/8/8/8 w - - 0 1',
          'r3k3/1b2n2p/p2BBqr1/1pb2N2/8/7P/PP1R3K/4QR2 b q - 0 1',
          '4rb2/1p1q1ppk/p1n1p2p/2p1Pn2/3PNR2/2P2K2/P2QBP2/6R1 w - - 0 1',
          'r3n3/pp2q1pk/2p1BnRp/8/2p2P2/1P5P/PB4QK/8 w - - 0 1',
          '6R1/1p3p2/1K3kNp/2p1p3/4P2P/2P5/2p5/8 w - - 0 1',
          'q4N1k/1p3p2/6PK/6P1/2p5/p2R4/8/8 w - - 0 1',
          'K5R1/7p/1B3PP1/1k6/8/8/6r1/7r w - - 0 1',
          '1k3q2/3r1p2/Kb6/p7/2N1Q3/1P6/8/8 w - - 0 1',
          '8/1p6/1Pp4B/K1P1qN2/P1k1p3/2p5/2P2P2/8 w - - 0 1',
          '8/8/8/4N3/8/B1k2p1p/4Pp1P/2K5 w - - 0 1',
          '6k1/2Qn3p/6r1/3p4/5N1q/5P1P/PP2r1P1/1R3NK1 b - - 0 1',
          'r3r1k1/3RBpbp/p3p1p1/1pp1P3/2P5/5Q2/P1q2PPP/4R1K1 w - - 0 1',
          '7R/1rk1bpp1/3p4/6P1/1p1qBQ2/p7/PPP5/1K6 w - - 0 1',
          '1r1Rr1k1/p4pp1/1np5/2p1P1Q1/4B3/Pq4P1/1B2PP1P/6K1 w - - 0 1',
          'R7/3p3p/8/3P2P1/3k4/1p5p/1P1NKP1P/7q w - - 0 1'
        ]
      }
    },

    // ── Kapitola 11 — záverečná skúška ─────────────────────────────────────
    {
      cislo: 11,
      nazov: 'Záverečná skúška',
      uvod: [
        'Teraz si naozajstný obchodník! Čaká ťa <b>10 pozícií z ozajstných partií</b>.',
        'V každej nájdi všetky brania so ziskom za oboch hráčov. Máš na to čas, takže sa snaž byť rýchly aj presný.',
        'Keď vyriešiš aspoň 8 pozícií úplne a bez chyby, získaš odznak <b>Obchodník</b>.'
      ],
      uvodKoniec: 'Ak sa nepodarí, poviem ti, ktoré kapitoly si zopakovať. Pozície budú zakaždým iné.',
      zapamataj: 'Obchodník vidí za oboch, počíta celú výmenu na stánku a berie len so ziskom.',
      preTrenerov: 'Pozície sú zo skutočných partií, z tých istých ako úlohy v tréningu Brania so ziskom (60 ' +
                   'pozícií s 1 až 4 riešeniami, náhodne sa vyberie 10). Čas ako v tréningu na úrovni 1: 15 s + 10 ' +
                   's na každé riešenie. Skúška sa nezapisuje do štatistík tréningu a nemení ELO. Skúšku možno ' +
                   'opakovať, zakaždým s inými pozíciami. Kto ju zložil a ako idú kapitoly, uvidíš v menu Tréner → ' +
                   'Prehľad hier.',
      skuska: {
        pocet: 10,
        hranica: 8,
        casZaklad: 15,
        casNaRiesenie: 10,
        pozicie: [
          'r3bb2/p1q1N1kp/2P1p1p1/1pQ1p1B1/8/5P2/P5PP/3R3K w - - 0 1',
          'r2kr3/pR2p1Q1/2b5/3pP3/P1p1p1P1/2q5/2P1BP2/5K1R w - - 0 1',
          '8/1P3kp1/5PN1/6PK/3p4/p2n4/3B3b/8 w - - 0 1',
          '5r2/p2p2kp/3PnNp1/1qr1Pp2/2p5/P1R5/6PP/2Q1R1K1 w - - 0 1',
          '1n1K4/8/p1R5/k7/N7/4p3/8/8 w - - 0 1',
          '5bk1/2p2pp1/3p1r1p/3P4/Br2PB2/2q2nPP/R4PQ1/2R4K b - - 0 1',
          '8/3p4/6b1/P1P5/k2P4/3p4/2P5/2K5 w - - 0 1',
          '8/8/R7/1k1r4/3B4/5K2/7p/6rN w - - 0 1',
          'r6N/1R6/B6p/2k5/1p6/8/8/2K5 w - - 0 1',
          '6n1/8/2p4P/8/8/r1p3K1/B7/4B1k1 w - - 0 1',
          '6k1/6p1/2P1ppK1/8/p2P4/P5B1/3r2P1/8 w - - 0 1',
          '8/p3P3/8/4r3/8/7R/k1K5/8 w - - 0 1',
          '8/5B2/8/3R1P2/6k1/3p4/3K1p2/8 w - - 0 1',
          '8/7r/4R3/6k1/3n4/4K3/1B1p4/8 w - - 0 1',
          '8/3B4/3P4/7k/8/8/2p4p/Kb3N2 w - - 0 1',
          '8/8/3p2p1/1K2R3/1P6/7p/5b2/k7 w - - 0 1',
          '2b2r1k/2p3pp/2Nb4/pP5q/2PP4/P4pP1/5P1P/R1BQ2K1 b - - 0 1',
          '3rr1k1/1b5p/p6p/1p3N2/6P1/P1Q1p3/1PP2b1P/R4K2 b - - 0 1',
          '8/3p3B/1n2P2r/8/8/7k/R4P2/7K w - - 0 1',
          '4kr2/1pp3pp/3qP3/3p2B1/8/P1N5/1Pn1Q1PP/1R2b2K b - - 0 1',
          '8/5R2/8/1k2q2p/1P5P/5p2/P1N4P/6Kn w - - 0 1',
          '3q3k/1p2rQ1p/1npbpN1P/4N1p1/3P2P1/1P6/r7/3R2RK w - - 0 1',
          'k7/8/1K6/3r4/8/5N2/2Pp4/5R1b w - - 0 1',
          '2kr4/1b1n1R2/2nBp2r/2NpP1q1/8/2P2Qp1/1P2B1P1/R5K1 w - - 0 1',
          '1kqr3r/p1p4p/RpQP4/2P1p3/4B3/4Bp2/P4P1P/6K1 b - - 0 1',
          '5rk1/5p2/4P2P/8/4pR2/8/4K3/8 w - - 0 1',
          '5Bk1/2R5/2p4P/p4p2/1p3P2/1P6/7p/1bK5 w - - 0 1',
          '1k2b3/4bpp1/p2pp1P1/1p3P2/2q1P3/4B3/PPPQN2r/1K1R4 w - - 0 1',
          '4rk2/1Q3p1r/2p1bB2/p6p/P3q2b/7P/6RK/3R4 w - - 0 1',
          '2r2rk1/pp4pp/1n6/3pR3/8/P5Q1/1B1q1PPP/R5K1 w - - 0 1',
          '1r2qbk1/5p2/3P1Qn1/p3BBNp/4P2P/KP4N1/P2r4/8 w - - 0 1',
          '1R6/6p1/6Pk/3K4/3p1P2/8/3Pp2n/8 w - - 0 1',
          '2k1bN2/2r5/1qP5/1p1R4/1p1p1p2/1P3Q2/8/1K6 w - - 0 1',
          'k5r1/p5Qp/8/3q4/8/8/P4NPP/1R4K1 w - - 0 1',
          '6k1/7p/4p3/1p1n1Pp1/8/7K/Pr5P/3Q4 b - - 0 1',
          '6k1/1p1qrpp1/p7/8/PQ6/8/1PPp2PP/3R2K1 b - - 0 1',
          '3r2k1/pp1P1pb1/1q4pp/2pQn3/2B5/8/PP4PP/3R1RK1 w - - 0 1',
          '8/2p5/R2P4/p6k/r6N/8/8/1K6 w - - 0 1',
          '1k5r/1P2q3/1Q6/7p/6p1/6Pp/2R4P/7K w - - 0 1',
          '5rkB/5p1R/6P1/8/8/5K2/8/8 w - - 0 1',
          '8/3p4/7K/8/N3P1r1/4P3/4k3/8 w - - 0 1',
          '1r4k1/p2n1p1p/3Pb1p1/2pNb1B1/1p6/5Q2/qP4PP/3R1RK1 w - - 0 1',
          '6k1/bP3p2/Pr4P1/6p1/8/1p3P2/4R3/K7 w - - 0 1',
          '2r5/8/1P6/Pk6/1p2p3/3p4/1R1P4/1K6 w - - 0 1',
          '3r2k1/4Rp2/b5pQ/p1Bp4/3P1R1K/Pr5P/5P2/6q1 b - - 0 1',
          '8/3p4/6B1/8/k7/8/3KP3/5bn1 w - - 0 1',
          '2rq1bk1/5p2/3p2pp/p2Q1N2/PpnB4/7P/1P3PP1/4R1K1 w - - 0 1',
          '1nk5/2p2p2/5q2/4p2p/1R2P3/2PN2Pp/r4P1P/3Q2K1 b - - 0 1',
          '8/5k1p/5PpB/3PR3/2r4P/1p3K2/2b5/8 b - - 0 1',
          'k2N2K1/8/8/8/5R2/3n4/3p4/8 w - - 0 1',
          'Q4nk1/1pq2pp1/3p1B2/1B1P4/2P5/2P2b1p/P4PrP/4RK2 w - - 0 1',
          '6k1/pr4p1/1rnb1nQp/4p1P1/qP6/3P3N/PRNB1P1P/K1R5 b - - 0 1',
          '8/8/1p6/3kN3/8/1pr5/P3P3/4K2R w K - 0 1',
          '2r2rk1/4p1bp/1p1qP1p1/1Q1p4/P4P2/3R4/1P4PP/2B2RK1 b - - 0 1',
          '1rq1r2k/5Rbp/p2p1p1B/2p1p3/2P1P2Q/1P6/P5PP/3b3K w - - 0 1',
          '2kBb3/3R4/4K3/5P2/7b/8/8/8 w - - 0 1',
          '8/1p2N1K1/8/3P3p/5p1k/3b3P/5P2/8 w - - 0 1',
          '6k1/5ppp/4p3/p1b1n3/PpP1Pq2/5bBP/4B2K/R3RQ2 b - - 0 1',
          '5R2/4K3/5P2/4k1pp/1Pp5/2P1P2P/1P3q1P/8 w - - 0 1',
          '1r2k2r/p5bp/4p1p1/q2pn3/1p2N1P1/6QP/PPP5/1KBR3R w k - 0 1'
        ]
      }
    }
  ]
};
