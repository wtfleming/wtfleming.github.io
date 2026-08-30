/* main.js: canvas, camera, input, frame loop.
 *
 * The camera is fixed: the whole campus is on screen at once, scaled to fit,
 * because the point of the picture is that eight desks work at the same time.
 */
(function (global) {
  'use strict';

  var Iso = global.Iso, World = global.World, Sim = global.Sim, Render = global.Render, UI = global.UI;

  var canvas, ctx, dpr = 1;
  var view = { scale: 1, ox: 0, oy: 0 };
  var last = 0, t = 0, ready = false, started = false;

  /* The canvas's CSS size, read once per resize. Reading clientWidth inside
     the frame loop forces a synchronous layout every frame, and because the UI
     panels are written to just before it, that read lands right after a DOM
     write — the read/write/read cycle that makes a canvas flicker under a
     changing overlay. */
  var cssW = 0, cssH = 0;

  /* Paint only when something changed. While the sim is paused — which is how
     it starts — the scene is static, so the page can sit at zero frames
     instead of repainting sixty times a second under the panels. */
  var dirty = true;

  /* Set when the run reaches the end, so the frame loop can stop the van,
     flip the toolbar back to Play and let the scene settle to zero frames. */
  var onFinish = null;

  /* World bounds in projected pixels, with headroom above for roofs and the
     label plates that sit over them. */
  function bounds() {
    var g = World.ground;
    var left = Iso.project(g.x0, g.y1 + 1, 0).x;
    var right = Iso.project(g.x1 + 1, g.y0, 0).x;
    var top = Iso.project(g.x0, g.y0, 0).y - 3.4 * Iso.TZ;
    var bottom = Iso.project(g.x1 + 1, g.y1 + 1, 0).y + 1.2 * Iso.TZ;
    return { x: left, y: top, w: right - left, h: bottom - top };
  }

  function resize() {
    dpr = Math.min(2, global.devicePixelRatio || 1);
    cssW = canvas.clientWidth;
    cssH = canvas.clientHeight;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    var b = bounds();
    view.scale = Math.min(cssW / b.w, cssH / b.h) * 0.98;
    view.ox = (cssW - b.w * view.scale) / 2 - b.x * view.scale;
    view.oy = (cssH - b.h * view.scale) / 2 - b.y * view.scale;
    dirty = true;              /* the backing store was just cleared */
  }

  function paint() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#dfe6ea';
    ctx.fillRect(0, 0, cssW, cssH);      /* opaque, so no clearRect is needed */

    ctx.save();
    ctx.translate(view.ox, view.oy);
    ctx.scale(view.scale, view.scale);
    Render.draw(ctx, t);
    /* Labels share the world transform, so they sit at world positions and
       scale with the campus. They come last only so no roof can cover one. */
    Render.labels(ctx);
    ctx.restore();
  }

  function frame(now) {
    var dt = last ? (now - last) / 1000 : 0;
    last = now;

    var running = ready && !Sim.state.paused && !Sim.state.finished;
    if (running) {
      t += dt;                 /* frozen while paused: the scene is still */
      Sim.step(dt);
      UI.update(false);
      if (Sim.state.finished && onFinish) onFinish();
    }

    if (running || dirty) {
      paint();
      dirty = false;
    }

    requestAnimationFrame(frame);
  }

  function button(id, fn) {
    var b = document.getElementById(id);
    if (b) b.addEventListener('click', fn);
    return b;
  }

  function init() {
    canvas = document.getElementById('scene');
    ctx = canvas.getContext('2d');
    resize();
    global.addEventListener('resize', resize);

    UI.init();

    var playBtn = document.getElementById('play');
    var overlay = document.getElementById('start');

    /* One place decides how the control looks, so the toolbar button, the
       overlay and the paused flag can never disagree. */
    function sync() {
      playBtn.textContent = Sim.state.paused ? '\u25B6 Play' : '\u275A\u275A Pause';
      playBtn.classList.toggle('is-primary', Sim.state.paused);
      overlay.hidden = started || !Sim.state.paused;
      dirty = true;
    }

    function play() {
      started = true;
      Sim.state.paused = false;
      sync();
    }

    function restart() {
      Sim.reset();
      play();
      UI.update(true);
    }

    /* Once the run is over the button offers another lap rather than an
       inert Pause; play and pause are the only moves mid-run. */
    playBtn.addEventListener('click', function () {
      if (Sim.state.finished) restart();
      else if (Sim.state.paused) play();
      else { Sim.state.paused = true; sync(); }
    });
    overlay.addEventListener('click', play);

    button('restart', restart);

    onFinish = function () { Sim.state.paused = true; sync(); };

    sync();

    var speeds = [1, 2, 4];
    var si = speeds.indexOf(Sim.state.speed);
    if (si < 0) si = 0;
    var speedBtn = button('speed', function () {
      si = (si + 1) % speeds.length;
      Sim.state.speed = speeds[si];
      speedBtn.textContent = speeds[si] + '×';
    });
    speedBtn.textContent = speeds[si] + '×';   /* sim owns the default */

    ready = true;              /* the ground is decorative; don't gate on it */
    Render.loadTiles(function () { dirty = true; });
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
