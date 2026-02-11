# Contributing to Calendaria

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Foundry VTT](https://foundryvtt.com/) source (for intellisense only)

## Getting Started

```bash
npm install
npm run setup
```

The setup script creates a symlink to your local Foundry VTT folder for IDE path resolution (`@client/*`, `@common/*`). Set the `FOUNDRY_PATH` environment variable or enter the path when prompted.

## Commands

| Command                 | Description                         |
| ----------------------- | ----------------------------------- |
| `npm run lint`          | Run ESLint                          |
| `npm run lint:fix`      | Run ESLint with auto-fix            |
| `npm run format`        | Format with Prettier                |
| `npm run format:check`  | Check formatting                    |
| `npm run stylelint`     | Lint CSS                            |
| `npm run stylelint:fix` | Lint CSS with auto-fix              |
| `npm test`              | Run tests                           |
| `npm run test:watch`    | Run tests in watch mode             |
| `npm run test:coverage` | Run tests with coverage             |
| `npm run validate`      | Run lint + format check + stylelint |

## Code Style

- **JavaScript** — ESLint + Prettier (`eslint.config.mjs`, `.prettierrc`)
- **CSS** — Stylelint (`.stylelintrc.json`). Use `rem`/`em` units, not `px`.
- **JSON** — FracturedJSON (VS Code extension). Prettier ignores JSON files.
- **Templates** — Handlebars (`.hbs`). Excluded from Prettier.
- **JSDoc** — Required on all functions. Follow existing patterns.
- **Localization** — Only add or update keys in `lang/en.json`. Do not modify other language files directly; translations are managed through [Weblate](https://hosted.weblate.org/projects/calendaria/).

## Tests

Tests live in `dev/tests/` using [Vitest](https://vitest.dev/). Mocks are in `dev/__mocks__/`.

Write tests for new utility functions and bug fixes.

## Pre-commit Hook

After `npm install`, a pre-commit hook runs automatically via [Husky](https://typicode.github.io/husky/). It uses [lint-staged](https://github.com/lint-staged/lint-staged) to auto-fix staged files:

- **JS/MJS** — Prettier + ESLint
- **CSS** — Prettier + Stylelint
- **YAML** — Prettier

You don't need to remember to run formatters — the hook handles it. If a lint error can't be auto-fixed, the commit is blocked until you fix it manually.

## Submitting Changes

All pull requests **must** reference an open issue. Open one first if none exists.

1. Fork the repository and create a branch from `main`.
2. Make your changes in focused, logical commits.
3. Run `npm test` — all tests must pass.
4. Open a pull request against `main` and reference the issue (e.g. `Closes #123`).

## Translations

Translations are managed through [Weblate](https://hosted.weblate.org/projects/calendaria/). To contribute a translation or update an existing one, use the Weblate interface — do not submit PRs that modify language files other than `lang/en.json`.

## Reporting Issues

Use [GitHub Issues](../../issues) with the appropriate template:

- **Bug Report** — defects or unexpected behavior
- **Feature Request** — new functionality or enhancements

Include steps to reproduce, expected vs actual behavior, and your Foundry VTT version.

## License

By contributing, you agree that your contributions will be licensed under the project's [MIT License](LICENSE).
