#!/usr/bin/env python3
"""One-time converter: Zola Markdown posts -> org-mode posts.

Reads content/blog/*.md and writes posts/*.org (drafts/*.org for drafts).
Run once from the repo root; the .org output is then committed and this
script is only kept for reference.

The interesting part is raw HTML. Pandoc's org writer silently DROPS inline
raw HTML, and it classifies <button>, <canvas>, <span>, <section> and <sub>
as inline -- so eleven posts would lose their interactive demos. We therefore
lift every raw HTML region out of the Markdown ourselves, hand pandoc a
placeholder, and splice the HTML back in as #+begin_export blocks afterwards.
"""

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "content" / "blog"
POSTS = ROOT / "posts"
DRAFTS = ROOT / "drafts"

PLACEHOLDER = "RAWHTMLPLACEHOLDER{}ENDRAWHTML"


def parse_front_matter(text):
    """Split a Zola +++ TOML block off the front of a post."""
    m = re.match(r"\+\+\+\n(.*?)\n\+\+\+\n", text, re.DOTALL)
    if not m:
        sys.exit("no +++ front matter found")
    fm, body = m.group(1), text[m.end():]

    title = re.search(r'^title\s*=\s*"(.*)"\s*$', fm, re.M)
    tags = re.search(r"^tags\s*=\s*\[(.*)\]\s*$", fm, re.M)
    draft = bool(re.search(r"^draft\s*=\s*true\s*$", fm, re.M))

    return {
        "title": title.group(1) if title else "",
        "tags": re.findall(r'"([^"]+)"', tags.group(1)) if tags else [],
        "draft": draft,
    }, body


def fix_links(body, slug_of):
    """Repair Zola- and Jekyll-era link syntax before pandoc runs."""
    # Zola internal links: [x](@/blog/2019-05-12-foo.md) -> [x](/blog/foo/)
    def repl(m):
        target = m.group(1)
        if target not in slug_of:
            sys.exit(f"internal link to unknown post: {target}")
        return "(/blog/%s/)" % slug_of[target]

    body = re.sub(r"\(@/blog/([^)]+\.md)\)", repl, body)

    # Jekyll leftovers that are broken on the live site today.
    body = body.replace("{{ site.url }}images/", "/images/")
    body = re.sub(r"^\[part-2\]:\s*\{%\s*post_url.*%\}\s*$\n?", "", body, flags=re.M)

    return body


def extract_raw_html(body):
    """Replace runs of block-level raw HTML with placeholders.

    Returns (body_with_placeholders, [html_chunk, ...]).

    A run starts at a line beginning with '<' in column 0 and continues
    until a blank line -- except that a blank line inside an unclosed
    <script> or <style> does not end the run.
    """
    lines = body.split("\n")
    out, chunks = [], []
    i, in_fence = 0, False

    while i < len(lines):
        line = lines[i]

        if re.match(r"^\s*```", line):
            in_fence = not in_fence
            out.append(line)
            i += 1
            continue

        if in_fence or not re.match(r"^<[a-zA-Z/!]", line):
            out.append(line)
            i += 1
            continue

        chunk, depth = [], 0
        while i < len(lines):
            cur = lines[i]
            depth += len(re.findall(r"<(?:script|style)\b", cur))
            depth -= len(re.findall(r"</(?:script|style)\s*>", cur))
            if not cur.strip() and depth <= 0:
                break
            chunk.append(cur)
            i += 1

        out.append(PLACEHOLDER.format(len(chunks)))
        chunks.append("\n".join(chunk).rstrip())

    return "\n".join(out), chunks


def restore_raw_html(org, chunks):
    for n, html in enumerate(chunks):
        token = PLACEHOLDER.format(n)
        block = "#+begin_export html\n%s\n#+end_export" % html
        pattern = re.compile(r"^[ \t]*%s[ \t]*$" % re.escape(token), re.M)
        org, count = pattern.subn(lambda _: block, org)
        if count != 1:
            sys.exit(f"placeholder {n} matched {count} times (expected 1)")
    return org


def clean_org(org):
    """Tidy up pandoc's org output."""
    # Pandoc hangs a :PROPERTIES: drawer with a :CUSTOM_ID: off every heading.
    org = re.sub(r"^:PROPERTIES:\n(?::[^\n]*\n)*?:END:\n", "", org, flags=re.M)
    # #+begin_html is org 8 syntax; org 9 renders it as an escaped div.
    org = re.sub(r"^#\+begin_html$", "#+begin_export html", org, flags=re.M)
    org = re.sub(r"^#\+end_html$", "#+end_export", org, flags=re.M)
    # Normalise language names so the highlight.js class is predictable.
    org = re.sub(
        r"^(#\+begin_src\s+)(\S+)",
        lambda m: m.group(1) + m.group(2).lower(),
        org,
        flags=re.M,
    )
    return re.sub(r"\n{3,}", "\n\n", org).strip() + "\n"


def to_org(markdown):
    return subprocess.run(
        ["pandoc", "-f", "gfm", "-t", "org", "--wrap=none"],
        input=markdown,
        capture_output=True,
        text=True,
        check=True,
    ).stdout


def main():
    sources = sorted(p for p in SRC.glob("*.md") if p.name != "_index.md")
    if not sources:
        sys.exit(f"no posts found in {SRC}")

    # Zola strips the date prefix to form the URL slug; we must reproduce it
    # exactly, typos included (see erlang-cluster-elxir-...).
    slug_of = {p.name: re.sub(r"^\d{4}-\d{2}-\d{2}-", "", p.stem) for p in sources}

    POSTS.mkdir(exist_ok=True)
    DRAFTS.mkdir(exist_ok=True)

    for path in sources:
        meta, body = parse_front_matter(path.read_text(encoding="utf-8"))
        date = re.match(r"(\d{4}-\d{2}-\d{2})-", path.name).group(1)

        body = fix_links(body, slug_of)
        body, chunks = extract_raw_html(body)
        org = clean_org(restore_raw_html(to_org(body), chunks))

        header = ["#+TITLE: " + meta["title"], "#+DATE: <%s>" % date]
        if meta["tags"]:
            # Org tags cannot contain spaces; Zola slugified them the same way.
            header.append(
                "#+FILETAGS: :%s:" % ":".join(t.replace(" ", "-") for t in meta["tags"])
            )

        dest = (DRAFTS if meta["draft"] else POSTS) / (path.stem + ".org")
        dest.write_text("\n".join(header) + "\n\n" + org, encoding="utf-8")
        print("%-70s -> %s (%d raw html)" % (path.name, dest.name, len(chunks)))


if __name__ == "__main__":
    main()
