/* ui.js: the DOM panels — narration, live numbers, the station list. Reads
 * sim and model; decides nothing.
 */
(function (global) {
  'use strict';

  var World = global.World, Sim = global.Sim, Deep = global.Deep;

  var el = {};
  var lastStation = null, lastCounts = '';

  function $(id) { return document.getElementById(id); }

  function init() {
    el.title = $('st-title');
    el.body = $('st-body');
    el.copy = document.querySelector('.hud-copy');
    el.counts = $('counts');
    el.steps = $('steps');

    /* the station list doubles as a progress bar for the whole run */
    World.stations.forEach(function (s) {
      var li = document.createElement('li');
      li.textContent = s.name;
      li.setAttribute('data-id', s.id);
      el.steps.appendChild(li);
    });

    update(true);
  }

  /* Built as nodes rather than markup. Nothing here is user input, but a post
     about a stored XSS is a poor place to ship an innerHTML habit. */
  function row(parent, label, value, note) {
    var d = document.createElement('div');
    d.className = 'row';
    d.appendChild(span('k', label));
    d.appendChild(span('v', String(value)));
    if (note) d.appendChild(span('n', note));
    parent.appendChild(d);
  }

  function span(cls, text) {
    var s = document.createElement('span');
    s.className = cls;
    s.textContent = text;
    return s;
  }

  function update(force) {
    var st = Sim.state.station;
    var id = st ? st.id : null;
    var copy = id ? World.copy[id] : null;

    /* Between stations there is nothing to narrate, so the panel goes away
       rather than saying so. Outside the memo below, because leaving a station
       and never having started both read as a null station. */
    var quiet = !copy && !Sim.state.finished &&
                !(Sim.state.d === 0 && Sim.state.paused);
    if (el.copy.hidden !== quiet) el.copy.hidden = quiet;

    if (force || id !== lastStation) {
      lastStation = id;
      if (copy) {
        el.title.textContent = copy.title;
        el.body.textContent = copy.body;
      } else if (Sim.state.finished) {
        el.title.textContent = 'Done';
        el.body.textContent = 'The report is printed and nothing has been edited. Press Restart to watch it again, or read the real report below the diagram.';
      } else if (Sim.state.d === 0 && Sim.state.paused) {
        el.title.textContent = 'Not started';
        el.body.textContent = 'Press play to run /wtf-code-review PR 105 --deep against an htmx 2 to 4 upgrade. The van is the run: its rack carries what has been found so far, in the tier each finding is filed at.';
      }
      var lis = el.steps.children;
      for (var i = 0; i < lis.length; i++) {
        var sid = lis[i].getAttribute('data-id');
        lis[i].className = Sim.at(sid) ? 'is-here' : (Sim.reached(sid) ? 'is-done' : '');
      }
    }

    var c = Sim.counts();
    var key = [c.agents, c.raw, c.merged, c.dupes, c.promoted, c.refuters,
               c.stands, c.refuted, c.printed].join('|');
    if (key === lastCounts && !force) return;
    lastCounts = key;

    var box = document.createDocumentFragment();
    row(box, 'agents spawned', c.agents,
      '1 reviewer + ' + Deep.LENSES.length + ' lenses + 1 per Critical/Warning');
    row(box, 'findings in hand', c.raw, c.dupes ? c.dupes + ' duplicates collapsed' : 'before the merge');
    if (c.merged !== c.raw) row(box, 'after merge', c.merged);
    if (c.promoted) row(box, 'promoted to Warning', c.promoted, 'stated a concrete failure');
    if (c.refuters) {
      row(box, 'refuters answered', c.refuters + ' / ' + Sim.state.result.refuters);
      row(box, 'stands', c.stands);
      row(box, 'refuted', c.refuted, 'never reaches the page');
    }
    if (c.printed) {
      row(box, 'printed', c.printed,
        c.tiers.critical.length + ' critical, ' + c.tiers.warning.length + ' warning, ' +
        c.tiers.suggestion.length + ' suggestion, ' + c.tiers.pre.length + ' pre-existing');
    }
    el.counts.textContent = '';
    el.counts.appendChild(box);
  }

  global.UI = { init: init, update: update };
})(window);
