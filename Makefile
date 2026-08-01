EMACS ?= emacs
PORT  ?= 8000

.PHONY: publish serve clean

publish:
	$(EMACS) --batch -l publish.el

# Rebuilt with localhost URLs so links are clickable while previewing.
# Run `make publish` before deploying by hand; CI always builds fresh.
serve:
	SITE_URL=http://localhost:$(PORT)/ $(EMACS) --batch -l publish.el
	@echo "Serving http://localhost:$(PORT)/  (Ctrl-C to stop)"
	@python3 -m http.server $(PORT) --directory public

clean:
	rm -rf public
