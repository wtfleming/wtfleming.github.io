/* world.js: the static place — the road, the stations, the buildings, the copy.
 *
 * Nothing here animates and nothing here computes the lesson. It only answers
 * "where is everything, and what does each place mean".
 *
 * The metaphor: a --deep run is a small studio campus. The road is the run.
 * The van is the run's findings, and its rack carries the real tiers. Work
 * that happens in parallel is a row of desks the van parks in front of.
 */
(function (global) {
  'use strict';

  var Iso = global.Iso;

  /* ---- palette ----------------------------------------------------------- */

  var PAL = {
    hall:    '#e6e2d8',
    roof:    '#4c5a63',
    kiosk:   '#f2efe7',
    booth:   '#dcd6c8',
    van:     '#2f8f74',
    vanTrim: '#1f6b57',
    critical:'#c0392b',
    warning: '#d68910',
    suggest: '#8a97a3',
    pre:     '#6c5b8f'
  };

  /* ---- the road ---------------------------------------------------------- */

  var ROAD_Y = 10;
  var ROUTE = Iso.makeRoute([
    [3, ROAD_Y],
    [34, ROAD_Y]
  ]);

  function at(x) { return x - 3; }   /* distance along the route for a given x */

  /* ---- the stations ------------------------------------------------------ */

  /* `dwell` is the beat at a station once its write-up has been read. The much
     longer first stop is derived from the length of the copy; see ui.js. */
  var STATIONS = [
    { id: 'intake',   dist: at(5),    dwell: 1.2, name: 'Intake' },
    { id: 'reviewer', dist: at(8.5),  dwell: 1.6, name: 'Reviewer Hall' },
    { id: 'lenses',   dist: at(16),   dwell: 2.4, name: 'Lens Row' },
    { id: 'merge',    dist: at(23.5), dwell: 1.8, name: 'Merge Depot' },
    { id: 'refuters', dist: at(28),   dwell: 2.4, name: 'The Refuter Pit' },
    { id: 'press',    dist: at(31.5), dwell: 1.8, name: 'The Press' },
    { id: 'desk',     dist: at(34),   dwell: 2.0, name: 'Your Desk' }
  ];

  /* ---- the write-ups ----------------------------------------------------- */

  var COPY = {
    intake: {
      title: 'Intake',
      body: 'The run begins with a scope and nothing else: a ref, a branch, a path, or a pull request number. No summary of the change goes with it, and no opinion about which parts are safe — those come from the conversation that wrote the code, and they are the bias the whole design exists to remove. Here the scope is PR #105, an htmx 2 to 4 upgrade: 12 files, +43/-44, one commit.'
    },
    reviewer: {
      title: 'Reviewer Hall',
      body: 'One agent, fresh context. It runs the real test suite and the real linter — 463 tests, clean clippy — then reads the diff and the full text of every changed file, because a diff alone hides the callers. It tries to refute each finding before it writes it down. Everything it reports here it also has to survive a refuter later.'
    },
    lenses: {
      title: 'Lens Row',
      body: 'Eight desks, eight agents, one dimension each, all reading the same scope at the same time. A lens reports only in its own lane and drops anything belonging to another, which is what stops eight agents filing eight copies of one report. Watch two desks light up on the same defect anyway: the reviewer overlaps every lens, and that overlap is what the next stop is for.'
    },
    merge: {
      title: 'Merge Depot',
      body: 'Nine reports arrive and are deduplicated by the defect described, not by the line cited — two agents routinely anchor the same defect a few lines apart, and matching on file and line would miss it. Then the promotion rule runs: a Suggestion that states a concrete failure is a Warning filed a tier low, and it moves up now, before any refuter is spawned, so that it gets one.'
    },
    refuters: {
      title: 'The Refuter Pit',
      body: 'One booth per Critical and Warning, promoted and pre-existing included. Each gets its finding verbatim and the scope, nothing else — no hint about where to look, no reason it might be wrong — and instructions to kill it. The default verdict is refuted. A finding stands only when the booth cannot make the problem go away. Nothing prints anywhere until every booth has answered.'
    },
    press: {
      title: 'The Press',
      body: 'Refuted findings never reach the page. What survives is printed in four sections: Critical, Warning, Suggestion, and Pre-existing for problems the change did not cause. The refutation and promotion counts are printed with it, so the gate can be watched: a gate that never bites deserves doubt.'
    },
    desk: {
      title: 'Your Desk',
      body: 'Nothing has been edited. The report is a report, and the decisions are yours again. Ask for fixes and each fixed Critical or Warning gets a fresh refuter against the fixed tree, where the verdicts read inverted: refuted now means the problem is gone.'
    }
  };

  /* ---- buildings --------------------------------------------------------- */

  var HALL     = { x: 6.6, y: 5.0, w: 4.0, d: 3.4, h: 2.6 };
  var DEPOT    = { x: 22.0, y: 5.2, w: 3.6, d: 3.2, h: 2.0 };
  var PRESS    = { x: 30.0, y: 4.8, w: 3.4, d: 3.4, h: 2.4 };
  var DESK     = { x: 33.2, y: 11.6, w: 1.8, d: 1.6, h: 0.6 };

  /* Lens Row: four desks north of the road, four south, so the parallelism is
     visible as a shape rather than a caption. Order follows Deep.LENSES. */
  var KIOSKS = [];
  (function () {
    var lenses = global.Deep.LENSES;
    for (var i = 0; i < lenses.length; i++) {
      var north = i < 4;
      var col = north ? i : i - 4;
      KIOSKS.push({
        id: lenses[i].id,
        hue: lenses[i].hue,
        x: 13.0 + col * 2.3,
        y: north ? 5.6 : 13.2,
        w: 1.5, d: 1.5, h: 1.0,
        north: north
      });
    }
  })();

  /* One booth per refuter, derived from the run the way KIOSKS is derived
     from the lenses — so editing a defect moves the booths with the
     verdicts. Two rows, split as evenly as the count allows. */
  var BOOTHS = [];
  (function () {
    var n = global.Deep.run().refuters;
    var perRow = Math.ceil(n / 2);
    for (var i = 0; i < n; i++) {
      var row = i < perRow ? 0 : 1;
      var col = i % perRow;
      BOOTHS.push({
        x: 25.2 + col * 1.25,
        y: 13.0 + row * 1.5,
        w: 0.9, d: 0.9, h: 0.9
      });
    }
  })();

  /* ---- ground ------------------------------------------------------------ */

  /* Kenney's CC0 isometric city tiles (kenney.nl, CC0 1.0). One sprite per
     grid cell. The diamond top of a 132 px tile is 132 x 66, so a tile drawn
     at 2*TW / 132 lines up exactly with the engine's grid. */
  var TILE_SRC = {
    plain: 'img/cityTiles_097.png',
    trees: 'img/cityTiles_036.png',
    trees2: 'img/cityTiles_044.png'
  };

  var GROUND = { x0: 1, x1: 37, y0: 3, y1: 18 };

  /* Which tile goes in each cell. Deterministic — a hash of the coordinates,
     never Math.random(), or the whole campus shimmers every frame. The road
     itself is drawn over the tiles rather than tiled: the pack's road pieces
     are single-lane segments, and repeating one lays its markings across the
     road, not along it. */
  function tileAt(x, y) {
    if (y === ROAD_Y) return null;                       /* the road is drawn */
    if (y === ROAD_Y - 1 || y === ROAD_Y + 1) return 'plain';
    if (y === 4 || y === 17) {
      var h = Iso.hash2(x, y, 7);
      if (h > 0.80) return 'trees2';
      if (h > 0.62) return 'trees';
    }
    return 'plain';
  }

  global.World = {
    PAL: PAL,
    ROAD_Y: ROAD_Y,
    route: ROUTE,
    stations: STATIONS,
    copy: COPY,
    hall: HALL, depot: DEPOT, press: PRESS, desk: DESK,
    kiosks: KIOSKS, booths: BOOTHS,
    ground: GROUND, tileSrc: TILE_SRC, tileAt: tileAt
  };
})(window);
