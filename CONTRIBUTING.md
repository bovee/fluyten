# Contributing to Fluyten

Thank you for your interest in contributing!

## Getting started

1. Fork the repository and clone your fork
2. Install dependencies: `npm install`
3. Start the dev server: `npm run dev`
4. Make your changes on a new branch

## Before submitting a pull request

- `npm run build` — must pass with no TypeScript errors
- `npm test` — all tests must pass
- `npm run lint` — no new lint errors
- `npm run format` — format your code with Prettier

## Adding or changing functionality

- Add tests for new logic where practical (tests live next to source files, e.g. `src/foo.test.ts`)
- Keep changes focused — one concern per pull request

## Reporting bugs

Please open a GitHub issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser and OS version

## Code style

- TypeScript strict mode is enabled — no implicit `any`
- Prettier handles formatting (single quotes, semicolons, trailing commas)
- ESLint enforces the rest

## Questions?

Open a GitHub issue or discussion.
