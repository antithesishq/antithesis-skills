.PHONY: validate validate-links install-dev test

validate:
	uv run python scripts/validate-skills.py

test:
	uv run python antithesis-triage/assets/process-logs.py --test

validate-links:
	lychee --config lychee.toml .

install-dev:
	./scripts/install.sh
