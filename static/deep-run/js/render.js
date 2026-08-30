/* render.js: one sorted painter's pass over everything with a footprint,
 * then a label pass in screen space.
 *
 * Nothing in here decides anything. Every position comes from world.js and
 * every quantity from sim.js, which got it from model.js.
 */
(function (global) {
  'use strict';

  var Iso = global.Iso, World = global.World, Sim = global.Sim, Deep = global.Deep;
  var PAL = World.PAL;

  var TIER_COLOR = {
    critical: PAL.critical,
    warning: PAL.warning,
    suggestion: PAL.suggest
  };

  /* Dimmed variants for not-yet-active stations. Their arguments never vary,
     so they are mixed once here rather than every frame inside the draw loop. */
  var KIOSK_DIM = Iso.mix(PAL.kiosk, '#9aa3ab', 0.45);
  var BOOTH_DIM = Iso.mix(PAL.booth, '#a7aeb4', 0.5);
  var hueDim = {};
  function dimHue(hue) {
    return hueDim[hue] || (hueDim[hue] = Iso.mix(hue, '#aab2b9', 0.6));
  }

  /* ---- ground ------------------------------------------------------------ */

  var tiles = {}, tilesLoaded = 0, tilesWanted = 0, ground = null;

  function loadTiles(done) {
    var keys = Object.keys(World.tileSrc);
    tilesWanted = keys.length;
    keys.forEach(function (k) {
      var img = new Image();
      img.onload = function () {
        tiles[k] = img;
        if (++tilesLoaded === tilesWanted) { if (done) done(); buildGround(); }
      };
      img.onerror = function () {
        /* A missing sprite must not take the whole scene down: the campus
           still reads without its ground, and the console says why. */
        if (global.console) console.warn('tile failed to load: ' + World.tileSrc[k]);
        if (++tilesLoaded === tilesWanted) { if (done) done(); buildGround(); }
      };
      img.src = World.tileSrc[k];
    });
  }

  /* The ground is 500-odd sprites and never changes, so it is drawn once into
     an offscreen canvas and blitted from then on. */
  function buildGround() {
    var g = World.ground;
    var s = (2 * Iso.TW) / 132;          /* Kenney tile diamond is 132 wide */
    var cells = [];
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    var x, y;

    for (x = g.x0; x <= g.x1; x++) {
      for (y = g.y0; y <= g.y1; y++) {
        var key = World.tileAt(x, y);
        var img = tiles[key];
        if (!img) continue;
        var p = Iso.project(x + 0.5, y + 0.5, 0);
        var w = img.width * s, h = img.height * s;
        var px = p.x - 66 * s, py = p.y - 33 * s;
        cells.push({ img: img, px: px, py: py, w: w, h: h, key: x + y });
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px + w > maxX) maxX = px + w;
        if (py + h > maxY) maxY = py + h;
      }
    }
    if (!cells.length) return;

    cells.sort(function (a, b) { return a.key - b.key; });

    var cv = document.createElement('canvas');
    cv.width = Math.ceil(maxX - minX);
    cv.height = Math.ceil(maxY - minY);
    var c = cv.getContext('2d');
    cells.forEach(function (t) {
      c.drawImage(t.img, t.px - minX, t.py - minY, t.w, t.h);
    });

    /* The road, painted on top of the ground in the same static layer: one
       asphalt ribbon the length of the route, then a broken centre line. */
    c.save();
    c.translate(-minX, -minY);
    var r = World.route, y = World.ROAD_Y;
    var x0 = r.pts[0].x, x1 = r.pts[r.pts.length - 1].x;
    c.fillStyle = '#5d6166';
    Iso.ribbon(c, x0 - 1.2, y, x1 + 1.2, y, 2.0, 0.06);
    c.fillStyle = '#6b7075';
    Iso.ribbon(c, x0 - 1.2, y, x1 + 1.2, y, 1.75, 0.07);
    c.fillStyle = 'rgba(255,255,255,0.65)';
    for (var mx = x0 - 0.6; mx < x1 + 1.0; mx += 1.4) {
      Iso.ribbon(c, mx, y, Math.min(mx + 0.7, x1 + 1.0), y, 0.09, 0.08);
    }
    c.restore();

    ground = { canvas: cv, x: minX, y: minY };
  }

  /* ---- small parts ------------------------------------------------------- */

  function sign(ctx, x, y, z, text) {
    var p = Iso.project(x, y, z);
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.font = '600 11px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    var w = ctx.measureText(text).width + 12;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(p.x - w / 2, p.y - 15, w, 15);
    ctx.strokeRect(p.x - w / 2, p.y - 15, w, 15);
    ctx.fillStyle = '#37424c';
    ctx.fillText(text, p.x, p.y - 3);
    ctx.restore();
  }

  /* A worker: a body and a head, small enough to read as a person at this
     scale without pretending to be one. */
  function agent(ctx, x, y, z, color, bob) {
    Iso.box(ctx, { x: x, y: y, z: z, w: 0.26, d: 0.26, h: 0.34 + (bob || 0), color: color, edge: false });
    Iso.box(ctx, { x: x + 0.03, y: y + 0.03, z: z + 0.34 + (bob || 0), w: 0.2, d: 0.2, h: 0.18, color: '#f0d9bf', edge: false });
  }

  function token(ctx, x, y, z, tier, scale) {
    var s = scale || 1;
    Iso.box(ctx, {
      x: x, y: y, z: z, w: 0.3 * s, d: 0.3 * s, h: 0.3 * s,
      color: TIER_COLOR[tier] || PAL.suggest, edge: 'rgba(0,0,0,0.35)'
    });
  }

  /* ---- the pass ---------------------------------------------------------- */

  function draw(ctx, t) {
    var counts = Sim.counts();
    var items = [];
    function add(key, fn) { items.push({ key: key, fn: fn }); }

    /* ground first: it is under everything and needs no sorting */
    if (ground) ctx.drawImage(ground.canvas, ground.x, ground.y);

    /* --- Reviewer Hall --- */
    var hall = World.hall;
    add(hall.x + hall.y, function () {
      Iso.box(ctx, {
        x: hall.x, y: hall.y, z: 0, w: hall.w, d: hall.d, h: hall.h,
        color: PAL.hall, windows: { rows: 2, cols: 3 }
      });
      Iso.box(ctx, {
        x: hall.x - 0.15, y: hall.y - 0.15, z: hall.h,
        w: hall.w + 0.3, d: hall.d + 0.3, h: 0.25, color: PAL.roof
      });
      if (Sim.at('reviewer')) {
        /* the test suite running: a bar that fills once, then holds */
        var p = Sim.stopProgress();
        var bx = Iso.project(hall.x + hall.w / 2, hall.y + hall.d + 0.2, 0.1);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(bx.x - 30, bx.y - 6, 60, 8);
        ctx.fillStyle = PAL.van;
        ctx.fillRect(bx.x - 29, bx.y - 5, 58 * Math.min(1, p * 1.6), 6);
      }
      if (Sim.reached('reviewer')) agent(ctx, hall.x + hall.w + 0.3, hall.y + 1.2, 0, PAL.van, 0);
    });

    /* --- Lens Row --- */
    var lensLit = Sim.lensesLit();
    World.kiosks.forEach(function (k, i) {
      add(k.x + k.y, function () {
        var lit = i < lensLit;
        Iso.box(ctx, {
          x: k.x, y: k.y, z: 0, w: k.w, d: k.d, h: k.h,
          color: lit ? PAL.kiosk : KIOSK_DIM,
          edge: 'rgba(0,0,0,0.28)'
        });
        /* the lens's own colour on the roof, so a desk is identifiable */
        Iso.box(ctx, {
          x: k.x, y: k.y, z: k.h, w: k.w, d: k.d, h: 0.16,
          color: lit ? k.hue : dimHue(k.hue), edge: false
        });
        if (lit) {
          agent(ctx, k.x + k.w + 0.12, k.y + 0.5, 0, k.hue, Math.sin(t * 3 + i) * 0.03);
          /* findings stacked on the desk: the real count for this lens */
          var found = Sim.state.result.byAgent[k.id].length;
          for (var f = 0; f < found; f++) {
            var d = Deep.byId(Sim.state.result.byAgent[k.id][f]);
            token(ctx, k.x + 0.2 + f * 0.42, k.y - 0.5, k.h + 0.16, d.tier, 0.9);
          }
        }
      });
    });

    /* --- Merge Depot --- */
    var depot = World.depot;
    add(depot.x + depot.y, function () {
      Iso.box(ctx, {
        x: depot.x, y: depot.y, z: 0, w: depot.w, d: depot.d, h: depot.h,
        color: PAL.hall, panels: { rows: 1, cols: 3 }
      });
      Iso.box(ctx, {
        x: depot.x - 0.15, y: depot.y - 0.15, z: depot.h,
        w: depot.w + 0.3, d: depot.d + 0.3, h: 0.22, color: PAL.roof
      });
      if (Sim.at('merge')) {
        var p = Sim.stopProgress();
        /* the two duplicates arriving and collapsing into one */
        if (p > 0.2 && p < Sim.MERGE_AT) {
          var s = Math.min(1, (p - 0.2) / (Sim.MERGE_AT - 0.2));
          token(ctx, depot.x + 0.6 + (1 - s) * 1.2, depot.y + depot.d + 0.6, depot.h + 0.2 + s * 0.3, 'warning', 1 - s * 0.4);
          token(ctx, depot.x + 0.6 - (1 - s) * 1.2, depot.y + depot.d + 0.6, depot.h + 0.2 + s * 0.3, 'warning', 1 - s * 0.4);
        }
        /* the two promotions leaving as Warnings */
        if (p > Sim.PROMOTE_AT) {
          token(ctx, depot.x + 2.2, depot.y + depot.d + 0.7, depot.h + 0.5, 'warning', 1.1);
          token(ctx, depot.x + 2.7, depot.y + depot.d + 0.7, depot.h + 0.5, 'warning', 1.1);
        }
      }
    });

    /* --- The Refuter Pit --- */
    var verdicts = Sim.verdicts();
    World.booths.forEach(function (b, i) {
      add(b.x + b.y, function () {
        var v = verdicts[i];
        var live = Sim.reached('refuters');
        Iso.box(ctx, {
          x: b.x, y: b.y, z: 0, w: b.w, d: b.d, h: b.h,
          color: live ? PAL.booth : BOOTH_DIM,
          edge: 'rgba(0,0,0,0.3)'
        });
        if (!v) return;
        /* the verdict, on the roof: the finding survived, or it did not */
        if (v === 'stands') {
          Iso.box(ctx, { x: b.x + 0.2, y: b.y + 0.2, z: b.h, w: 0.5, d: 0.5, h: 0.42, color: PAL.van, edge: false });
        } else {
          Iso.box(ctx, { x: b.x + 0.25, y: b.y + 0.25, z: b.h, w: 0.4, d: 0.4, h: 0.1, color: '#9aa3ab', edge: false });
        }
      });
    });

    /* --- The Press --- */
    var press = World.press;
    add(press.x + press.y, function () {
      Iso.box(ctx, {
        x: press.x, y: press.y, z: 0, w: press.w, d: press.d, h: press.h,
        color: PAL.hall, windows: { rows: 2, cols: 2 }
      });
      Iso.box(ctx, {
        x: press.x - 0.15, y: press.y - 0.15, z: press.h,
        w: press.w + 0.3, d: press.d + 0.3, h: 0.25, color: PAL.roof
      });
      if (counts.printed) {
        /* the report coming off the press, one block per tier */
        var tiers = counts.tiers;
        var stack = [
          { n: tiers.critical.length, c: PAL.critical },
          { n: tiers.warning.length, c: PAL.warning },
          { n: tiers.suggestion.length, c: PAL.suggest },
          { n: tiers.pre.length, c: PAL.pre }
        ];
        var z = 0;
        stack.forEach(function (s) {
          if (!s.n) return;
          var h = 0.12 * s.n;
          Iso.box(ctx, {
            x: press.x + press.w + 0.4, y: press.y + 1.0, z: z,
            w: 1.0, d: 1.2, h: h, color: s.c, edge: 'rgba(0,0,0,0.3)'
          });
          z += h;
        });
      }
    });

    /* --- Your Desk --- */
    var desk = World.desk;
    add(desk.x + desk.y, function () {
      Iso.box(ctx, { x: desk.x, y: desk.y, z: 0, w: desk.w, d: desk.d, h: desk.h, color: '#b98d5e' });
      if (Sim.reached('desk')) agent(ctx, desk.x + 0.7, desk.y - 0.8, 0, '#37424c', Math.sin(t * 2) * 0.02);
    });

    /* --- the van: the run itself, carrying what it has found so far --- */
    var v = Iso.smoothAt(World.route, Sim.state.d, 0.6);
    add(v.x + v.y + 0.6, function () {
      /* a shadow, so the van sits on the road instead of floating over it */
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      Iso.disc(ctx, v.x, v.y, 0.01, 0.75);
      Iso.orientedBox(ctx, {
        x: v.x, y: v.y, z: 0.05, hx: v.dx, hy: v.dy,
        len: 2.4, wid: 1.3, h: 0.7, color: PAL.van
      });
      Iso.orientedBox(ctx, {
        x: v.x - v.dx * 0.7, y: v.y - v.dy * 0.7, z: 0.75, hx: v.dx, hy: v.dy,
        len: 1.0, wid: 1.15, h: 0.55, color: PAL.vanTrim
      });
      /* a beacon: the run is the thing to follow */
      Iso.box(ctx, {
        x: v.x - 0.1, y: v.y - 0.1, z: 1.3, w: 0.2, d: 0.2, h: 0.2,
        color: Iso.mix(PAL.van, '#ffffff', 0.4 + 0.4 * Math.sin(t * 4)), edge: false
      });
      /* the rack: one cube per finding in hand, in the tier it is filed at.
         Five rows at a tight pitch keep all 27 — the pre-merge peak, before
         the depot collapses duplicates — on the cargo roof, clear of the cab
         front at along -0.2 and never hanging past the tail. */
      var hand = Sim.inHand();
      for (var i = 0; i < hand.length; i++) {
        var row = i % 5, col = Math.floor(i / 5);
        var lat = (row - 2) * 0.24, along = 1.0 - col * 0.2;
        token(ctx,
          v.x + v.dx * along - v.dy * lat,
          v.y + v.dy * along + v.dx * lat,
          0.75, hand[i], 0.8);
      }
    });

    /* one sorted pass: everything with a ground footprint, back to front */
    items.sort(function (a, b) { return a.key - b.key; });
    items.forEach(function (it) { it.fn(); });
  }

  /* Labels are drawn after the solids and in screen space, so they never end
     up behind a roof. */
  function labels(ctx) {
    sign(ctx, World.hall.x + 2, World.hall.y + 1.5, World.hall.h + 0.9, 'REVIEWER');
    sign(ctx, 16.5, 9.4, 1.6, 'LENS ROW');
    sign(ctx, World.depot.x + 1.8, World.depot.y + 1.5, World.depot.h + 0.9, 'MERGE');
    sign(ctx, 27.5, 15.4, 1.6, 'REFUTERS');
    sign(ctx, World.press.x + 1.7, World.press.y + 1.5, World.press.h + 0.9, 'THE PRESS');
    sign(ctx, World.desk.x + 0.9, World.desk.y + 0.8, 1.1, 'YOU');
  }

  global.Render = {
    loadTiles: loadTiles,
    draw: draw,
    labels: labels
  };
})(window);
