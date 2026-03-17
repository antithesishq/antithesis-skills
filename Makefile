.PHONY: validate validate-links install-dev

validate:
	uv run python scripts/validate-skills.py

validate-links:
	lychee --config lychee.toml .

install-dev:
	./scripts/install.sh
