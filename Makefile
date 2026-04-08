.PHONY: validate validate-changelog validate-links install-dev test

validate:
	uv run python scripts/validate-skills.py

validate-changelog:
	python3 .ci-scripts/changelog.py validate

test:
	uv run python antithesis-triage/assets/process-logs.py --test

validate-links:
	lychee --config lychee.toml .

install-dev:
	./scripts/install.sh
