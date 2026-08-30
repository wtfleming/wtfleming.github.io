;;; publish.el --- build wtfleming.github.io  -*- lexical-binding: t; -*-

;; Run with:  emacs --batch -l publish.el
;; or:        make publish

;;; Code:

(require 'ox-html)

(defconst wtf/root
  (file-name-directory (or load-file-name buffer-file-name default-directory))
  "Repository root, so the build works from any working directory.")

(add-to-list 'load-path (expand-file-name "vendor" wtf/root))
(require 'org-static-blog)

(setq make-backup-files nil
      auto-save-default nil
      org-export-with-toc nil
      org-export-with-section-numbers nil
      ;; htmlize is installed in the author's Emacs and ox-html will happily
      ;; use it, baking the current theme's colours into every code block as
      ;; inline styles. nil keeps the markup as plain <pre class="src src-rust">
      ;; so highlight.js can colour it in the browser instead.
      org-html-htmlize-output-type nil)

;; org-static-blog writes absolute URLs into every link, so a default build is
;; only clickable on the real domain. `make serve' sets SITE_URL to localhost
;; so the preview is navigable; CI leaves it unset and gets the live domain.
(setq org-static-blog-publish-url       (or (getenv "SITE_URL")
                                            "https://wtfleming.github.io/")
      org-static-blog-publish-title     "Will's Software Journal"
      org-static-blog-publish-directory (expand-file-name "public/" wtf/root)
      org-static-blog-posts-directory   (expand-file-name "posts/" wtf/root)
      org-static-blog-drafts-directory  (expand-file-name "drafts/" wtf/root)
      org-static-blog-index-file        "index.html"
      org-static-blog-archive-file      "blog/index.html"
      org-static-blog-tags-file         "tags/index.html"
      org-static-blog-rss-file          "rss.xml"
      org-static-blog-enable-tags       t
      ;; OpenGraph: the engine emits og:title/type/url unconditionally once
      ;; this is on, and og:description and og:image from a post's own
      ;; `#+DESCRIPTION:' and `#+IMAGE:'. Posts without them fall back to
      ;; the site image below, so a shared link is never a bare URL.
      org-static-blog-enable-og-tags    t
      org-static-blog-image             "images/og-default.png"
      org-static-blog-index-length      10
      org-static-blog-use-preview       t
      org-static-blog-preview-link-p    t
      org-static-blog-preview-ellipsis  "<span class=\"read-more\">Read more →</span>")


;;; URL preservation ----------------------------------------------------------
;;
;; The live site publishes posts at /blog/<slug>/ and tags at /tags/<name>/,
;; with the date stripped from the slug. org-static-blog would instead emit
;; /<source-filename>.html and /tag-<name>.html, so every one of those URLs
;; would 404. The overrides below restore the existing scheme.

(defun org-static-blog-get-absolute-url (relative-url)
  "Return the absolute URL for RELATIVE-URL, as a clean directory URL.

Overrides the upstream function so that a trailing `index.html' is
dropped: `blog/rust-benchmarking/index.html' is the file we write, but
`https://wtfleming.github.io/blog/rust-benchmarking/' is the URL we link
to. Every internal link, RSS <guid> and og:url flows through here, so
this one change keeps posts, /blog/, /tags/ and / all clean."
  (concat-to-dir org-static-blog-publish-url
                 (replace-regexp-in-string "\\(\\`\\|/\\)index\\.html\\'" "\\1"
                                           relative-url)))

(defun org-static-blog-get-post-public-path (post-filename)
  "Return the published path for POST-FILENAME, as `blog/<slug>/index.html'.

The slug is the source filename with its `YYYY-MM-DD-' prefix removed,
matching how Zola derived permalinks. Dates are kept in the filename only
so posts sort chronologically on disk; the real date comes from #+DATE."
  (concat "blog/"
          (replace-regexp-in-string "\\`[0-9]\\{4\\}-[0-9]\\{2\\}-[0-9]\\{2\\}-" ""
                                    (file-name-base post-filename))
          "/index.html"))

;; Posts link to images and to each other with site-absolute paths such as
;; [[/images/foo.png]] and [[/blog/keras-mnist/]]. Org reads a leading slash as
;; a filesystem path and exports it as file:///images/foo.png, which breaks
;; every image and internal link. Strip the scheme back off as links are
;; exported, leaving them relative to the site root.
(defun wtf/root-relative-links (output _backend _info)
  "Rewrite exported file:// links in OUTPUT to site-absolute paths."
  (replace-regexp-in-string "\\(src\\|href\\)=\"file://" "\\1=\"" output))

(add-to-list 'org-export-filter-link-functions #'wtf/root-relative-links)

;; Post bodies carry site-absolute asset paths such as src="/images/foo.png"
;; (see `wtf/root-relative-links'). That is right for a page served from the
;; site root, but an RSS reader resolves those against its own origin, so every
;; illustrated post shows broken images in the feed. The RSS <description>
;; needs fully-qualified URLs; the on-site HTML must keep the root-relative
;; ones, so this rewrite happens only on the RSS path, not in the export.
(defun wtf/absolutize-urls (html)
  "Rewrite root-relative src/href in HTML to absolute site URLs.
Leaves protocol-relative (//) and already-absolute URLs untouched."
  (replace-regexp-in-string
   "\\(src\\|href\\)=\"/\\([^/]\\)"
   (concat "\\1=\"" org-static-blog-publish-url "\\2")
   html t))

;; Forked from org-static-blog 1.7.0 to run the body through
;; `wtf/absolutize-urls' before it goes into <description>. Upstream builds the
;; item inline with no seam for the description content, so the whole function
;; is copied; the only change is the wrapped `org-static-blog-get-post-content'
;; call. Re-check against vendor/org-static-blog.el on any upgrade.
(defun org-static-blog-get-rss-item (post-filename)
  "Assemble RSS item from POST-FILENAME, with absolute URLs in the body."
  (concat
   "<item>\n"
   "  <title><![CDATA[" (org-static-blog-get-title post-filename) "]]></title>\n"
   "  <description><![CDATA["
   (wtf/absolutize-urls (org-static-blog-get-post-content post-filename t))
   "]]></description>\n"
   (let ((categories ""))
     (when (and (org-static-blog-get-tags post-filename) org-static-blog-enable-tags)
       (dolist (tag (org-static-blog-get-tags post-filename))
         (setq categories (concat categories
                                  "  <category><![CDATA[" tag "]]></category>\n"))))
     categories)
   "  <link>"
   (url-encode-url (org-static-blog-get-post-url post-filename))
   "</link>\n"
   "  <guid>"
   (url-encode-url (org-static-blog-get-post-url post-filename))
   "</guid>\n"
   "  <pubDate>"
   (let ((system-time-locale "C"))
     (format-time-string "%a, %d %b %Y %H:%M:%S %z" (org-static-blog-get-date post-filename)))
   "</pubDate>\n"
   "</item>\n"))

(defun wtf/tag-path (tag)
  "Return the published path for TAG, as `tags/<tag>/index.html'."
  (concat "tags/" (downcase tag) "/index.html"))

;; The two functions below are forked from org-static-blog 1.7.0. Upstream
;; hardcodes "tag-<name>.html" inline in both, with no seam to hook, so the
;; only way to keep /tags/<name>/ is to copy them and swap in `wtf/tag-path'.
;; Re-check both against vendor/org-static-blog.el on any upgrade.

(defun org-static-blog-post-taglist (post-filename)
  "Return the tag list of POST-FILENAME.
Forked from upstream to route tag links through `wtf/tag-path'."
  (let ((tags (remove org-static-blog-no-comments-tag
                      (remove org-static-blog-rss-excluded-tag
                              (org-static-blog-get-tags post-filename)))))
    (when (and tags org-static-blog-enable-tags)
      (concat
       "<a href=\"" (org-static-blog-get-absolute-url org-static-blog-tags-file)
       "\"><span class=\"tag-label\">" (org-static-blog-gettext 'tags)
       "</span></a><span class=\"tag-separator\">: </span>"
       "<span class=\"taglist__tags\">"
       (let ((tag-htmls '()))
         (dotimes (i (length tags))
           (let ((tag (nth i tags)))
             (push (concat "<a href=\""
                           (org-static-blog-get-absolute-url (wtf/tag-path tag))
                           "\" class=\"tag\" data-tag=\"" (downcase tag)
                           "\" data-index=\"" (number-to-string i) "\">" tag "</a> ")
                   tag-htmls)))
         (apply #'concat (nreverse tag-htmls)))
       "</span>"))))

(defun org-static-blog-assemble-tags ()
  "Render the tag archive and tag pages.
Forked from upstream to write tag pages to `wtf/tag-path'."
  (org-static-blog-assemble-tags-archive)
  (dolist (tag (org-static-blog-get-tag-tree))
    (org-static-blog-assemble-multipost-page
     (concat-to-dir org-static-blog-publish-directory (wtf/tag-path (car tag)))
     (cdr tag)
     (concat "<h1 class=\"title\">" (org-static-blog-gettext 'posts-tagged)
             " \"" (car tag) "\":</h1>"))))


;;; Page chrome ---------------------------------------------------------------

(setq org-static-blog-page-header
      (concat
       "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
       "<meta name=\"theme-color\" content=\"#05a081\">\n"
       ;; X/Twitter reads the og:* tags but needs this to choose the wide
       ;; card over the small thumbnail.
       "<meta name=\"twitter:card\" content=\"summary_large_image\">\n"
       "<link rel=\"stylesheet\" href=\"/css/style.css\">\n"
       "<link rel=\"icon\" href=\"/icon.png\">\n"
       "<script defer src=\"/js/highlight.min.js\"></script>\n"
       "<script defer src=\"/js/hljs-init.js\"></script>\n"))

(setq org-static-blog-page-preamble
      (concat
       "<a class=\"profile-icon\" href=\"/\">"
       "<img src=\"/icon.png\" width=\"50\" height=\"50\" alt=\"profile picture\"></a>\n"
       "<nav><a href=\"/about/\">About</a><a href=\"/blog/\">Blog</a></nav>\n"))

(setq org-static-blog-page-postamble
      (concat
       "<nav><a href=\"/blog/\">Blog</a><a href=\"/tags/\">Tags</a>"
       "<a href=\"/rss.xml\">RSS</a>"
       "<a href=\"https://github.com/wtfleming\">GitHub</a></nav>\n"))

(setq org-static-blog-index-front-matter
      (concat
       "<h1 class=\"title\">Hello, this is my software engineering blog.</h1>\n"
       "<p>I am a software engineer based out of New York. I write here about"
       " topics in software engineering.</p>\n"))


;;; Standalone pages ----------------------------------------------------------
;;
;; org-static-blog has no concept of a page that is not a post, so /about/ and
;; /404.html are rendered here with the same template.

(defun wtf/publish-page (org-file out-path)
  "Render ORG-FILE as a standalone page at OUT-PATH under the publish directory."
  (let ((source (expand-file-name org-file wtf/root)))
    (org-static-blog-with-find-file
     (concat-to-dir org-static-blog-publish-directory out-path)
     (org-static-blog-template
      (concat (org-static-blog-get-title source) " | " org-static-blog-publish-title)
      (concat "<h1 class=\"title\">" (org-static-blog-get-title source) "</h1>\n"
              (org-static-blog-render-post-content source))))))


;;; Redirects -----------------------------------------------------------------
;;
;; These paths date from the blog's Jekyll era and have been dead since the
;; move to Zola. GitHub Pages cannot issue real redirects, so serve a stub.

(defconst wtf/redirects
  '(("2016/01/28/geospatial-app-elixir-postgis-phoenix" . "blog/geospatial-app-elixir-postgis-phoenix")
    ("2019/04/21/keras-mnist"                           . "blog/keras-mnist")
    ("2019/05/07/keras-cats-vs-dogs-part-1"             . "blog/keras-cats-vs-dogs-part-1")
    ("2019/05/12/keras-cats-vs-dogs-part-2"             . "blog/keras-cats-vs-dogs-part-2")
    ("2020/01/17/raytracing-webassembly-rust"           . "blog/raytracing-webassembly-rust")
    ("2020/01/26/chip8-webassembly-rust"                . "blog/chip8-webassembly-rust")
    ("2020/04/12/pytorch-cats-vs-dogs-part-3"           . "blog/pytorch-cats-vs-dogs-part-3"))
  "Alist of (OLD-PATH . NEW-PATH), both without leading or trailing slashes.")

(defun wtf/publish-redirects ()
  "Write a meta-refresh stub for every entry in `wtf/redirects'."
  (dolist (entry wtf/redirects)
    (let ((target (concat "/" (cdr entry) "/")))
      (org-static-blog-with-find-file
       (concat-to-dir org-static-blog-publish-directory
                      (concat (car entry) "/index.html"))
       (concat "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n"
               "<meta charset=\"UTF-8\">\n"
               "<link rel=\"canonical\" href=\"" (org-static-blog-get-absolute-url (cdr entry)) "/\">\n"
               "<meta http-equiv=\"refresh\" content=\"0; url=" target "\">\n"
               "<title>Moved</title>\n</head>\n<body>\n"
               "<p>This page has moved to <a href=\"" target "\">" target "</a>.</p>\n"
               "</body>\n</html>\n")))))



;;; OpenGraph type ------------------------------------------------------------
;;
;; The engine hardcodes og:type="article" into every page it writes. That is
;; right for a post and wrong for a listing, so the pages that are not posts
;; have it rewritten afterwards. Cheaper than forking the template, which would
;; then need re-checking against vendor/ on every upgrade.

(defconst wtf/listing-pages
  '("index.html" "blog/index.html" "tags/index.html" "about/index.html" "404.html")
  "Pages, relative to the publish directory, that are not posts.")

(defun wtf/fix-og-type ()
  "Rewrite og:type from `article' to `website' on every non-post page."
  (dolist (path (append wtf/listing-pages
                        (mapcar (lambda (f)
                                  (file-relative-name f org-static-blog-publish-directory))
                                (file-expand-wildcards
                                 (concat-to-dir org-static-blog-publish-directory
                                                "tags/*/index.html")))))
    (let ((file (concat-to-dir org-static-blog-publish-directory path)))
      (when (file-exists-p file)
        (with-temp-file file
          (insert-file-contents file)
          (goto-char (point-min))
          (when (search-forward "<meta property=\"og:type\" content=\"article\" />" nil t)
            (replace-match "<meta property=\"og:type\" content=\"website\" />" t t)))))))


;;; Build ---------------------------------------------------------------------

(defun wtf/publish ()
  "Build the whole site into `org-static-blog-publish-directory'."
  ;; Drafts are intentionally not rendered. They were `draft = true' under Zola
  ;; and never had a public URL; upstream would publish them as unlisted pages.
  ;; Move a file from drafts/ to posts/ to publish it.
  (dolist (file (org-static-blog-get-post-filenames))
    (org-static-blog-publish-file file))
  (org-static-blog-assemble-index)
  (org-static-blog-assemble-rss)
  (org-static-blog-assemble-archive)
  (org-static-blog-assemble-tags)

  (wtf/publish-page "pages/about.org" "about/index.html")
  (wtf/publish-page "pages/404.org" "404.html")
  (wtf/publish-redirects)
  (wtf/fix-og-type)

  ;; org-static-blog writes HTML only; CSS, JS and images are copied verbatim.
  (copy-directory (expand-file-name "static" wtf/root)
                  org-static-blog-publish-directory
                  nil t t)

  (message "Published %d posts to %s"
           (length (org-static-blog-get-post-filenames))
           org-static-blog-publish-directory))

(wtf/publish)

;;; publish.el ends here
