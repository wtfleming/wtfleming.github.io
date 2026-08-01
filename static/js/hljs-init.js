// Org exports source blocks as <pre class="src src-rust">, but highlight.js
// looks for class="language-rust". Bridge the two, then highlight explicitly
// so we never depend on highlight.js's own auto-detection.
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("pre.src").forEach(function (block) {
    // Blocks with no language export as <pre class="example"> and won't match.
    var match = block.className.match(/\bsrc-(\S+)/);
    if (!match) return;

    // Anything highlight.js doesn't know stays plain text rather than guessing.
    var lang = match[1].toLowerCase();
    if (!hljs.getLanguage(lang)) return;

    // .value is escaped by highlight.js -- it is markup by contract, and the
    // input is our own already-rendered post text, so innerHTML is safe here.
    block.innerHTML = hljs.highlight(block.textContent, { language: lang }).value;
    block.classList.add("hljs");
  });
});
