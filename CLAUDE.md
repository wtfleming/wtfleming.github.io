# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

A personal blog written in org-mode, built by Emacs in batch mode, served from
GitHub Pages. Migrated off Zola in 2026; before that, off Jekyll.

## Commands

```sh
make publish   # emacs --batch -l publish.el  ->  public/
make serve     # rebuild with localhost URLs, serve on :8000
make clean
```

There is no test suite. The equivalent check is **URL parity against the
deployed site** — run this after any change that could move a URL:

```sh
git fetch origin gh-pages
git ls-tree -r origin/gh-pages --name-only | sort > /tmp/old.txt
(cd public && find . -type f | sed 's|^\./||') | sort > /tmp/new.txt
comm -23 /tmp/old.txt /tmp/new.txt     # URLs that would break
```

Other useful checks: `grep -L '#+DATE:' posts/*.org` (must be empty),
`grep -rho 'file://' public/` (must be empty), `xmllint --noout public/rss.xml`.

Deployment is automatic on push to `master` (`.github/workflows/main.yml`);
pushing any other branch does not deploy.

## Architecture

`publish.el` is the whole build. It loads the vendored engine, **redefines
several of its functions**, then runs the build — so reading
`vendor/org-static-blog.el` alone will tell you the wrong thing about how URLs
are generated. Always check `publish.el` for an override first.

The organising constraint is **URL preservation**. The live site publishes
posts at `/blog/<slug>/` and tags at `/tags/<name>/`; org-static-blog natively
emits `/<filename>.html` and `/tag-<name>.html`. Three overrides bridge that:

- `org-static-blog-get-absolute-url` strips a trailing `index.html`. Every
  internal link, RSS `<guid>` and `og:url` flows through this one function, so
  this is what makes posts, `/blog/`, `/tags/` and `/` all come out as clean
  directory URLs.
- `org-static-blog-get-post-public-path` maps `posts/2024-07-03-foo.org` to
  `blog/foo/index.html`. The date prefix exists only so posts sort on disk.
- `org-static-blog-post-taglist` and `org-static-blog-assemble-tags` are
  **forked verbatim from upstream 1.7.0** because it hardcodes tag paths inline
  with no seam to hook. Re-check both against `vendor/` on any upgrade.

`vendor/org-static-blog.el` is **not pristine upstream** — it carries one
`LOCAL PATCH` removing a stray debug `message`. Preserve it or re-apply on
upgrade.

Everything else is conventional: `posts/`/`drafts/` hold sources, `pages/` holds
the two non-post pages rendered by `wtf/publish-page`, `static/` is copied
verbatim into the site root, and `wtf/redirects` emits meta-refresh stubs for
dead Jekyll-era URLs.

## Traps

These all fail *silently* — the build succeeds and the HTML looks plausible.

- **A post without `#+DATE:` is dated "now"** and jumps to the top of the index
  and feed. Dates are not derived from the filename.
- **Site-absolute links** like `[[/images/foo.png]]` export as
  `file:///images/foo.png`, because org reads a leading slash as a filesystem
  path. `wtf/root-relative-links` (an `org-export-filter-link-functions` entry)
  rewrites them back. Don't remove it; do re-check `public/` for `file://` after
  touching link handling.
- **Raw HTML must be in a `#+begin_export html` block.** Inline raw HTML in org
  is dropped on export. This is also why `tools/migrate.py` lifts HTML out
  before handing content to pandoc — pandoc's org writer discards inline raw
  HTML, and it treats `<button>`, `<canvas>`, `<span>` and `<section>` as
  inline.
- **`make serve` leaves localhost URLs in `public/`.** Harmless for CI (fresh
  checkout, `public/` gitignored) but never hand-deploy that output.

## Conventions

- Drafts in `drafts/` are **not published at all**, matching Zola's
  `draft = true`. Move a file to `posts/` to publish it.
- Slugs are load-bearing. Don't "fix" the typo in
  `erlang-cluster-elxir-raspberry-pi-beaglebone` — it's a live URL.
- Syntax highlighting is client-side. `static/js/highlight.min.js` is a custom
  bundle (highlight.js "common" plus clojure, elixir, erlang, ocaml,
  dockerfile); a language outside it renders as plain text, so adding one means
  rebuilding the bundle, not changing Emacs config. `org-html-htmlize-output-type`
  is deliberately `nil` — leaving it default makes htmlize bake editor theme
  colors into every code block as inline styles.
- `tools/migrate.py` was a one-time Zola converter and is kept only for
  reference; its input (`content/`) no longer exists.
