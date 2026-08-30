/* model.js: the --deep pass, actually executed.
 *
 * THIS IS THE LESSON. Everything else in this project is presentation.
 *
 * The defect table below is the real output of `/wtf-code-review PR 105
 * --deep` on the htmx 2 -> 4 upgrade. What this file *computes* is the
 * pipeline that turns a defect table into a report: the fan-out to nine
 * agents, the merge that deduplicates by defect, the promotion rule, the
 * refuter pass, and every count the panels show. No tallies are stored — they
 * are all derived by run(), so changing a defect below changes the numbers on
 * screen.
 *
 * The honest boundary, restated in the README:
 *
 *   Computed   fan-out, duplicate collapse, promotion, refuter tally, tier
 *              counts, agent count.
 *   Real       the 21 findings, their tiers, and the 12 verdicts.
 *   Assumed    which lens found which finding, except the three the report
 *              names.
 *   Faked      elapsed time. Real agents take minutes and return out of order.
 */
(function (global) {
  'use strict';

  var LENSES = [
    { id: 'correctness',     hue: '#d94f4f' },
    { id: 'security',        hue: '#b4508f' },
    { id: 'tests',           hue: '#3f7fbf' },
    { id: 'maintainability', hue: '#6b7a8f' },
    { id: 'resilience',      hue: '#c98a2b' },
    { id: 'reuse',           hue: '#4f9d7a' },
    { id: 'performance',     hue: '#7a63c0' },
    { id: 'dependencies',    hue: '#2f8f8f' }
  ];

  /* One row per defect the run reported.
   *   tier      as filed by the agent that found it (before promotion)
   *   found     the agents that reported it. 'reviewer' plus lens ids.
   *   concrete  states a specific input and a specific wrong result — the
   *             test the promotion step applies to a Suggestion
   *   pre       the change did not cause it
   *   verdict   what the real refuter answered, for findings that got one
   */
  var DEFECTS = [
    { id: 'history',   where: 'base.html:68',        tier: 'critical',
      found: ['correctness'], concrete: true, pre: false, verdict: 'stands',
      what: 'htmx 4 hijacks Back/Forward on every page; the head is dropped, so SortableJS is gone after a swap',
      why: 'Verified against the SRI-matched bundle.' },

    { id: 'title',     where: 'base.html:68',        tier: 'warning',
      found: ['reviewer', 'correctness'], concrete: true, pre: false, verdict: 'stands',
      what: 'noSwap stops the body of a 4xx being injected, but the error page title still overwrites the tab',
      why: 'Reproduced in Chromium: title changed, target unchanged.' },

    { id: 'reorder',   where: 'admin/platforms.html:93', tier: 'warning',
      found: ['correctness'], concrete: true, pre: false, verdict: 'stands',
      what: 'htmx 4 queues "first" and silently drops later drags; the UI shows an order the database does not have',
      why: 'Confirmed in both htmx 2.0.8 and 4.0.0 source.' },

    { id: 'hxtarget',  where: 'handlers/common.rs:300', tier: 'warning',
      found: ['reviewer', 'tests'], concrete: true, pre: false, verdict: 'stands',
      what: 'new HX-Target parsing with no test at any level; a wrong parse returns the whole dashboard into a tbody',
      why: 'Greps confirm zero coverage.' },

    { id: 'nexttag',   where: 'base.html:69',        tier: 'warning',
      found: ['dependencies'], concrete: false, pre: false, verdict: 'stands',
      what: 'htmx 4.0.0 is published under the npm next tag, one day old; latest is still 2.0.10',
      why: 'Registry state confirmed live.' },

    { id: 'errtest',   where: 'base.html:65',        tier: 'warning',
      found: ['tests'], concrete: false, pre: false, verdict: 'stands',
      what: 'nothing exercises an htmx request that fails, and the noSwap meta is all that stands between a 4xx and the fragment',
      why: 'Narrowed: the config itself is correct. The coverage gap survives.' },

    { id: 'renames',   where: 'user-detail.html:75', tier: 'warning',
      found: ['tests'], concrete: false, pre: false, verdict: 'stands',
      what: 'the renamed event handlers have no coverage and fail silently when the spelling is wrong',
      why: 'Full e2e inventory: no test references these event names.' },

    { id: 'searchq',   where: 'base.html:178',       tier: 'suggestion',
      found: ['correctness'], concrete: true, pre: false, verdict: 'stands',
      what: 'the same queue-first default drops typeahead queries when the server is slower than the debounce',
      why: 'Stands. Only bites when latency exceeds the debounce.' },

    { id: 'inherited', where: 'show-game.html:218',  tier: 'warning',
      found: ['reviewer', 'correctness', 'maintainability', 'dependencies'],
      concrete: false, pre: false, verdict: 'refuted',
      what: ':inherited is on three elements and left off three structurally identical siblings',
      why: 'The split follows a rule: the marker is on exactly the elements with an htmx descendant.' },

    { id: 'andthen',   where: 'handlers/common.rs:304', tier: 'suggestion',
      found: ['maintainability'], concrete: false, pre: false,
      what: 'and_then chained onto an iterator step that can never yield None' },

    { id: 'docs',      where: 'CLAUDE.md:534',       tier: 'suggestion',
      found: ['maintainability'], concrete: false, pre: false,
      what: 'three conventions now fail silently when written the old way, and only the version string was updated' },

    { id: 'statusdup', where: 'show-game.html:220',  tier: 'suggestion',
      found: ['reuse'], concrete: false, pre: false,
      what: 'the same reach into htmx internals copied verbatim at three sites' },

    { id: 'toast',     where: 'base.html:339',       tier: 'suggestion',
      found: ['tests'], concrete: false, pre: false,
      what: 'the rewritten toast listener is untested and must satisfy two payload shapes' },

    { id: 'pkgjson',   where: 'package.json',        tier: 'suggestion',
      found: ['dependencies'], concrete: false, pre: false,
      what: 'htmx has no entry, so dependabot never opened the two patch releases' },

    { id: 'scanner',   where: 'package.json',        tier: 'suggestion',
      found: ['dependencies'], concrete: false, pre: false,
      what: "run htmx's own upgrade-check before a 2 to 4 jump" },

    { id: 'xss',       where: 'show-list.html:103',  tier: 'critical',
      found: ['security'], concrete: true, pre: true, verdict: 'stands',
      what: 'stored XSS: a user note is interpolated into an Alpine expression on a public page',
      why: 'Confirmed the escaper table and the CSP.' },

    { id: 'closefail', where: 'user-detail.html:75', tier: 'warning',
      found: ['resilience'], concrete: true, pre: true, verdict: 'stands',
      what: 'the admin form closes on every response, so a failed suspend looks like a successful one',
      why: 'after:request fires before the status check.' },

    { id: 'fakeassert', where: 'e2e/search.page.ts:105', tier: 'suggestion',
      found: ['tests'], concrete: true, pre: true, verdict: 'stands',
      what: 'the arrow-key test asserts on a class every result already has, so it cannot fail',
      why: 'Neither class updateSelection toggles is the one asserted on.' },

    { id: 'spinner',   where: 'base.html:182',       tier: 'suggestion',
      found: ['correctness'], concrete: false, pre: true,
      what: 'the search spinner never appears and never has' },

    { id: 'confirm',   where: 'base.html:347',       tier: 'suggestion',
      found: ['reuse'], concrete: false, pre: true,
      what: 'a hand-rolled confirm wrapper with zero callers repo-wide' },

    { id: 'reviewdup', where: 'show-game.html:218',  tier: 'suggestion',
      found: ['reuse'], concrete: false, pre: true,
      what: 'the review UI exists twice and the copies have drifted' },

    { id: 'defer',     where: 'base.html:69',        tier: 'suggestion',
      found: ['performance'], concrete: false, pre: true,
      what: 'the htmx script blocks the parser for a round trip with no defer' }
  ];

  var TIER_RANK = { critical: 0, warning: 1, suggestion: 2 };

  /* ---- the pipeline ------------------------------------------------------ */

  /* Step 1. Fan out. Every agent reads the same scope and reports only what
     falls in its lane, so one defect can arrive from two agents at once. */
  function fanOut() {
    var byAgent = { reviewer: [] };
    LENSES.forEach(function (l) { byAgent[l.id] = []; });
    DEFECTS.forEach(function (d) {
      d.found.forEach(function (agent) {
        if (byAgent[agent]) byAgent[agent].push(d.id);
      });
    });
    return byAgent;
  }

  /* Step 2. Merge. Deduplicate by the defect described, not by file and line:
     two agents routinely anchor the same defect a few lines apart. */
  function merge(byAgent) {
    var seen = Object.create(null), order = [], dupes = 0, raw = 0;
    Object.keys(byAgent).forEach(function (agent) {
      byAgent[agent].forEach(function (id) {
        raw++;
        if (seen[id]) { dupes++; return; }
        seen[id] = true;
        order.push(id);
      });
    });
    return { ids: order, raw: raw, dupes: dupes };
  }

  /* Step 3. Promote. A Suggestion that states a concrete failure is a Warning
     filed a tier low. It moves here, before any refuter is spawned, so that it
     gets one rather than an unverified pass. */
  function promote(ids) {
    var out = [], moved = [];
    ids.forEach(function (id) {
      var d = byId(id);
      var tier = d.tier;
      if (tier === 'suggestion' && d.concrete) { tier = 'warning'; moved.push(id); }
      out.push({ id: id, tier: tier });
    });
    return { findings: out, promoted: moved };
  }

  /* Step 4. Verify. One refuter per Critical and Warning, promoted and
     pre-existing included. Its default verdict is refuted; the finding stands
     only when the attack fails. Verdicts are stamped onto the findings, so the
     report step must run on what this returns, not on the pre-verify list. */
  function verify(findings) {
    findings.forEach(function (f) {
      if (f.tier === 'suggestion') return;
      var v = byId(f.id).verdict;
      if (v !== 'stands' && v !== 'refuted') {
        if (global.console) console.warn('deep-run: ' + f.id +
          ' is Critical/Warning but carries no verdict; defaulting to refuted');
        v = 'refuted';               /* the documented default, made loud above */
      }
      f.verdict = v;
    });
    return findings;
  }

  /* Step 5. The report. Refuted findings never appear; Pre-existing ones are
     split out of the three tiers into a section of their own. */
  function report(findings) {
    var kept = findings.filter(function (f) { return f.verdict !== 'refuted'; });
    var tiers = { critical: [], warning: [], suggestion: [], pre: [] };
    kept.forEach(function (f) {
      if (byId(f.id).pre) tiers.pre.push(f);
      else tiers[f.tier].push(f);
    });
    Object.keys(tiers).forEach(function (k) {
      tiers[k].sort(function (a, b) { return TIER_RANK[a.tier] - TIER_RANK[b.tier]; });
    });
    return tiers;
  }

  function byId(id) {
    for (var i = 0; i < DEFECTS.length; i++) if (DEFECTS[i].id === id) return DEFECTS[i];
    return null;
  }

  /* The whole pass, in order. Every number the UI shows comes from here. */
  function run() {
    var byAgent = fanOut();
    var merged = merge(byAgent);
    var promoted = promote(merged.ids);
    var stamped = verify(promoted.findings);   /* findings with verdicts stamped */
    var tiers = report(stamped);                /* consumes verify's output */
    var verified = stamped.filter(function (f) { return f.tier !== 'suggestion'; });

    return {
      byAgent: byAgent,
      dupes: merged.dupes,
      merged: merged.ids.length,
      findings: promoted.findings,
      promoted: promoted.promoted,
      refuters: verified.length,
      verified: verified,
      tiers: tiers,
      printed: tiers.critical.length + tiers.warning.length +
               tiers.suggestion.length + tiers.pre.length
    };
  }

  global.Deep = {
    LENSES: LENSES,
    byId: byId,
    run: run
  };
})(window);
