# wtfleming.github.io

A blog written in org-mode and published with
[org-static-blog](https://github.com/bastibe/org-static-blog) (vendored in
`vendor/`, so no package installation is needed).

## Building

    make publish     # build into public/
    make serve       # build for localhost, then serve at http://localhost:8000/
    make clean

Requires Emacs only. Pushing to `master` rebuilds and deploys to the
`gh-pages` branch via `.github/workflows/main.yml`.

org-static-blog bakes absolute URLs into every link, so a normal build is only
clickable on the real domain. `make serve` therefore rebuilds with
`SITE_URL=http://localhost:8000/` first; set `SITE_URL` yourself for any other
preview host. Use `make publish` (no `SITE_URL`) for anything you intend to
deploy.

## Writing a post

Create `posts/YYYY-MM-DD-slug.org`:

```org
#+TITLE: Rust benchmarking with Criterion
#+DATE: <2024-07-03>
#+FILETAGS: :rust:

Body goes here.
```

- The published URL is `/blog/<slug>/` — the date prefix is stripped from the
  filename, and kept only so posts sort chronologically on disk.
- `#+DATE:` is what actually dates the post. **It is not derived from the
  filename**, and if you omit it the post is silently dated "now" and jumps to
  the top of the index and feed.
- Tags cannot contain spaces; each becomes `/tags/<tag>/`.
- Link to images and other posts from the site root: `[[/images/foo.png]]`,
  `[[/blog/other-post/]]`.
- Raw HTML (demos, embeds) goes in an export block:

```org
#+begin_export html
<canvas id="demo" width="256" height="256"></canvas>
#+end_export
```

Files in `drafts/` are not published at all. Move one into `posts/` when it is
ready.

## Layout

| Path | Purpose |
|---|---|
| `posts/`, `drafts/` | Post sources |
| `pages/` | Standalone pages (`/about/`, `/404.html`) |
| `static/` | Copied verbatim into the site root |
| `publish.el` | All configuration, including URL overrides |
| `vendor/` | Vendored org-static-blog |
| `tools/migrate.py` | One-time Zola→org converter, kept for reference |

Code is highlighted in the browser by highlight.js rather than at build time,
so adding a language needs no Emacs packages — see `static/js/hljs-init.js`.
