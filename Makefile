.PHONY: validate validate-links install-dev

validate:
	uv run python scripts/validate-skills.py

validate-links:
	rg --files -g '*.md' -g '*.txt' -g '*.html' -g '*.htm' -g '*.css' | lychee --config lychee.toml --files-from -

install-dev:
	./scripts/install.sh
