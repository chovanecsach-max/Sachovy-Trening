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
//
//  Figúrky v textoch: K D V S J (slovensky), vo FEN a v poliach a/b/dal/dostal
//  anglicky ako vo FEN (K Q R B N P).
// ============================================================================

const OBSAH_TRH = {
  kluc: 'sachovy-trh',
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
      preTrenerov: 'Hodnoty zodpovedajú PIECE_VALUE v generate_vision.py. Strelec a jazdec sú rovnocenní, ' +
                   'preto je S×J krytého jazdca vždy výmena za 0 (kapitola 5).',
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
        'Figúrka je <b>krytá</b>, keď ju chráni iná figúrka jej farby. Keby si ju zobral, strážca zoberie tvoju figúrku späť.',
        'Figúrka je <b>nekrytá</b>, keď ju nechráni nikto. Je ako peňaženka zabudnutá na lavičke: kto ju vezme, má všetky mince a nič neplatí.',
        'Pozor, aj kráľ môže brať! Ale len nekrytú figúrku, lebo kráľ nesmie vstúpiť na napadnuté pole.'
      ],
      zapamataj: 'Nekrytá figúrka = zisk celej jej ceny.',
      prePokrocilych: 'Nekrytá figúrka je branie so ziskom, nech ju berieš čímkoľvek, aj dámou. Súper nemá čím brať späť.',
      preTrenerov: 'Pri nekrytej figúrke generátor pridá vetu „Nikto ho/ju nebráni." Krytie počíta funkcia ' +
                   'count_attackers, teda vrátane batérií a bez absolútne viazaných figúrok (kapitola 9).',
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
      preTrenerov: 'Generátor pre každú stranu dočasne prepne, kto je na ťahu, a hľadá jej brania. Preto nesmie byť ' +
                   'žiadny kráľ v šachu, inak by strana, ktorá nie je na ťahu, mohla „brať" kráľa.',
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

    // ── Ďalšie kapitoly (obsah príde v kroku 4) ────────────────────────────
    { cislo: 4,  nazov: 'Lacnejší berie drahšieho', ulohy: [] },
    { cislo: 5,  nazov: 'Výmena nie je zisk', ulohy: [] },
    { cislo: 6,  nazov: 'Počet nestačí', ulohy: [] },
    { cislo: 7,  nazov: 'Rovnaký terč, iná figúrka', ulohy: [] },
    { cislo: 8,  nazov: 'Batéria', ulohy: [] },
    { cislo: 9,  nazov: 'Väzba: obranca, ktorý nebráni', ulohy: [] },
    { cislo: 10, nazov: 'Záverečná skúška', ulohy: [] }
  ]
};
