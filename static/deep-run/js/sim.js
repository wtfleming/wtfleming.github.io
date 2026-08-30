/* sim.js: the state machine. Travel, stops, and how much of the pass has
 * happened by now.
 *
 * The van drives the road once. At each station it stops for as long as that
 * station's write-up takes to read on a first visit, and for a beat on any
 * later one — what the reader has already read survives a restart.
 *
 * Every number this file hands to the UI comes from Deep.run(); sim decides
 * only *when* each part of that result has happened, never what it is.
 */
(function (global) {
  'use strict';

  var World = global.World;
  var Deep = global.Deep;

  /* The two beats of the Merge Depot stop, as a fraction of the stop. The
     counters here and the depot animation in render both read these, so the
     number on the panel and the cubes on screen cannot drift apart. */
  var MERGE_AT = 0.62;      /* duplicates collapse; the counter flips */
  var PROMOTE_AT = 0.75;    /* the two promotions leave as Warnings */

  var WPM = 190;                 /* reading pace for a first stop */
  var MIN_READ = 5, MAX_READ = 17;

  function readSeconds(id) {
    var copy = World.copy[id];
    if (!copy) return 4;
    var words = (copy.title + ' ' + copy.body).split(/\s+/).length;
    return Math.max(MIN_READ, Math.min(MAX_READ, words / (WPM / 60)));
  }

  var result = Deep.run();

  var state = {
    d: 0,
    mode: 'travel',            /* 'travel' | 'stop' | 'done' */
    idx: 0,                    /* index of the station being travelled to */
    stopT: 0,
    stopLen: 0,
    speed: 2,               /* the default pace; the button steps 1/2/4 */
    paused: true,          /* nothing moves until the reader presses play */
    finished: false,
    visited: Object.create(null),
    station: null,             /* the station currently stopped at */
    result: result
  };

  var SPEED_UNITS = 3.6;       /* grid units per second of travel */

  function startStop(st) {
    state.mode = 'stop';
    state.station = st;
    state.stopT = 0;
    state.stopLen = state.visited[st.id] ? st.dwell : readSeconds(st.id);
    state.visited[st.id] = true;
  }

  function step(dt) {
    if (state.paused || state.finished) return;
    dt = Math.min(dt, 0.1) * state.speed;

    if (state.mode === 'travel') {
      var target = World.stations[state.idx];
      state.d += SPEED_UNITS * dt;
      if (state.d >= target.dist) {
        state.d = target.dist;
        startStop(target);
      }
    } else if (state.mode === 'stop') {
      state.stopT += dt;
      if (state.stopT >= state.stopLen) {
        state.idx++;
        if (state.idx >= World.stations.length) {
          state.mode = 'done';
          state.finished = true;
        } else {
          state.mode = 'travel';
          state.station = null;
        }
      }
    }
  }

  /* How far through the current stop we are, 0..1. Drives every station
     animation, so nothing animates on its own clock. */
  function stopProgress() {
    if (state.mode !== 'stop' || !state.stopLen) return state.finished ? 1 : 0;
    return Math.max(0, Math.min(1, state.stopT / state.stopLen));
  }

  /* Has station `id` been reached? Used by render and ui to decide what
     exists yet. */
  function reached(id) {
    for (var i = 0; i < World.stations.length; i++) {
      if (World.stations[i].id === id) {
        if (state.finished) return true;
        if (state.idx > i) return true;
        return state.idx === i && state.mode === 'stop';
      }
    }
    return false;
  }

  function at(id) {
    return state.mode === 'stop' && state.station && state.station.id === id;
  }

  /* Fraction of station `id` that has played: 1 once it is behind us. */
  function phase(id) {
    if (at(id)) return stopProgress();
    return reached(id) ? 1 : 0;
  }

  /* ---- what has happened, in the model's terms --------------------------- */

  /* How many lens desks are lit right now. counts(), the van's rack and the
     kiosks all read this one number instead of recomputing it. */
  function lensesLit() {
    return Math.round(phase('lenses') * Deep.LENSES.length);
  }

  /* The counters the panel shows. Each is the model's own number, revealed at
     the point in the road where that step of the pass actually happens. */
  function counts() {
    var r = state.result;
    var mergeP = phase('merge');
    var refP = phase('refuters');
    var pressP = phase('press');

    var lensAgents = lensesLit();
    var reviewerFindings = r.byAgent.reviewer.length;

    /* findings in hand: the reviewer's, then each lens's as its desk lights */
    var raw = reached('reviewer') ? reviewerFindings : 0;
    for (var i = 0; i < Deep.LENSES.length; i++) {
      if (i < lensAgents) raw += r.byAgent[Deep.LENSES[i].id].length;
    }

    var merged = mergeP > MERGE_AT ? r.merged : raw;
    var dupes = mergeP > MERGE_AT ? r.dupes : 0;
    var promoted = mergeP > PROMOTE_AT ? r.promoted.length : 0;

    var settled = Math.round(refP * r.refuters);
    var refuted = 0, stands = 0;
    for (var j = 0; j < settled && j < r.verified.length; j++) {
      if (r.verified[j].verdict === 'refuted') refuted++; else stands++;
    }

    return {
      agents: (reached('reviewer') ? 1 : 0) + lensAgents + settled,
      raw: raw,
      merged: merged,
      dupes: dupes,
      promoted: promoted,
      refuters: settled,
      stands: stands,
      refuted: refuted,
      printed: pressP > 0.5 ? r.printed : 0,
      tiers: r.tiers
    };
  }

  /* Which refuter booths have answered, and how. Render reads this. */
  function verdicts() {
    var r = state.result;
    var settled = Math.round(phase('refuters') * r.refuters);
    return r.verified.map(function (f, i) { return i < settled ? f.verdict : null; });
  }

  /* The van's rack: one entry per finding in hand, in the tier it is filed at
     right now. Duplicates are still aboard until the merge collapses them, and
     the promotions change two tiers at the depot — the rack shows both. */
  function inHand() {
    var r = state.result;
    var lensLit = lensesLit();
    var ids = [];
    if (reached('reviewer')) ids = ids.concat(r.byAgent.reviewer);
    for (var i = 0; i < lensLit; i++) ids = ids.concat(r.byAgent[Deep.LENSES[i].id]);

    if (phase('merge') > MERGE_AT) {
      var seen = Object.create(null), uniq = [];
      ids.forEach(function (id) { if (!seen[id]) { seen[id] = true; uniq.push(id); } });
      ids = uniq;
    }

    var promoted = phase('merge') > PROMOTE_AT;
    return ids.map(function (id) {
      if (promoted) {
        for (var j = 0; j < r.findings.length; j++) {
          if (r.findings[j].id === id) return r.findings[j].tier;
        }
      }
      return Deep.byId(id).tier;
    });
  }

  /* Restart the drive, keeping what has already been read so a second lap is
     brisk. state.visited is deliberately not cleared. */
  function reset() {
    state.d = 0;
    state.mode = 'travel';
    state.idx = 0;
    state.stopT = 0;
    state.station = null;
    state.finished = false;
  }

  global.Sim = {
    state: state,
    step: step,
    reset: reset,
    reached: reached,
    at: at,
    phase: phase,
    stopProgress: stopProgress,
    counts: counts,
    inHand: inHand,
    verdicts: verdicts,
    lensesLit: lensesLit,
    MERGE_AT: MERGE_AT,
    PROMOTE_AT: PROMOTE_AT
  };
})(window);
