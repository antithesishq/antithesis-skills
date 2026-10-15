.PHONY: validate validate-changelog validate-links install-dev

validate:
	uv run python scripts/validate-skills.py

validate-changelog:
	python3 .ci-scripts/changelog.py validate

validate-links:
	lychee --config lychee.toml .

install-dev:
	./scripts/install.sh
