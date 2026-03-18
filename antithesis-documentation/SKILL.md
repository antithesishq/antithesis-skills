---
name: antithesis-documentation
description: Use Antithesis documentation efficiently for product, workflow, and integration questions. Prefer the snouty docs CLI when available, and otherwise request markdown versions of documentation pages directly.
---

# Antithesis Documentation

## Antithesis Overview

Antithesis is a testing platform that works like a specialized staging environment. You ensure your software is reliable by deploying it to Antithesis and running it there before you deploy it to production. It supplements your existing testing tools and lives alongside your normal CI/CD workflow.

When you deploy to Antithesis, your software runs in a simulation environment that is much more hostile than production. This quickly exposes bugs, including complicated, unlikely, and severe failures.

Because Antithesis's environment is perfectly deterministic, problems are reproducible with minimal effort. Unlike typical shared staging, you do not need to compete for deployment locks or worry about environmental drift since every deployment is completely isolated from one another.

## Accessing Documentation

The best way to access Antithesis documentation on the command line is via the Antithesis CLI which is called snouty.

Run `snouty docs --help` to get started.

## If `snouty` is missing

1. Tell the user `snouty` is the Antithesis CLI.
2. Point them to the install source: `https://github.com/antithesishq/snouty`
3. Ask whether they want you to install it. If yes, follow instructions in `https://raw.githubusercontent.com/antithesishq/snouty/refs/heads/main/README.md`.
4. After installation, re-run `snouty --help`.

## Using `snouty docs`

Use `snouty docs` to discover authoritative Antithesis documentation before giving detailed guidance. Inspect `snouty docs --help` to discover subcommands and usage examples.

Recommended workflow:

1. Start with `snouty docs tree --depth 2` to get a quick overview of the docs.
2. Use `snouty docs tree <filter>` to explore a section when you know the area but not the exact page name.
3. Use `snouty docs search <terms>` to find likely pages for a specific topic.
4. Use `snouty docs search -l <terms>` when you want just the page paths.
5. Use `snouty docs show <path>` to read the full markdown page once you know the path.
6. Cite the relevant documentation pages in your answer.

Useful details:

- `snouty docs show` accepts page paths like `using_antithesis/sdk/go`.
- `snouty docs show` also accepts `/docs/.../` style paths and tries to normalize them for you.
- A warning about failing to update docs and falling back to cached docs is usually fine, especially in sandboxes without network access. Treat it as non-fatal if the requested docs content is still returned.
- `snouty docs sqlite` prints the path to a local SQLite database containing all of the Antithesis documentation. Use this if you want to directly query the docs.

## Direct Markdown Fallback

If `snouty` is unavailable, you may fetch markdown pages directly from `https://antithesis.com/docs/`.

A plain text index of all markdown pages is available at `https://antithesis.com/docs/llms.txt`. Load this first.

Always add the `.md` extension before requesting files from `https://antithesis.com/docs/`.

Examples:

- `https://antithesis.com/docs/using_antithesis/sdk/go/` becomes `https://antithesis.com/docs/using_antithesis/sdk/go.md`
- `/using_antithesis/sdk/go/` becomes `https://antithesis.com/docs/using_antithesis/sdk/go.md`

Exceptions:

- URLs with explicit file extensions such as `.txt`, `.js`, or `.so`
- `docs/generated/...` paths should be requested as-is

When presenting links to the user, prefer the normal HTML page URL instead of the `.md` URL.

If you want to link a user directly to a section, use a fragment with the slugified header when practical. If the slug is uncertain, link the page and name the section explicitly.

## Output

- Clear, grounded answers about Antithesis behavior, SDKs, setup, and best practices.
- Relevant links to the documentation pages you used.
- If the `snouty` command is missing ask the user if they want to install it, telling them that it is a CLI for working with the Antithesis API and docs.
