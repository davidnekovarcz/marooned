# Marooned

You wash up on a shared island with nothing in your pockets. Walk, drink, eat, stay dry, and keep a fire going. Other players can be on the same island.

The playable build is a Vue 3 and Three.js app in `web/`. Longer design notes are in `_docs/`.

## Getting started

Node 22.17.0. `package.json` sets `engines.node` to `22.x`.

From the repo root:

```bash
npm ci --include=dev --prefix web
npm run dev:web
```

Vite serves the game at http://localhost:5173.

Shared rooms read `web/.env`. Copy `web/.env.example` and fill in the values listed there. With no `web/.env`, the game stays solo.

## Checks

```bash
npm test
npm run lint:check
npm run tsc
```

## Review deploy

Heroku app `marooned-island`: https://marooned-island-e8bc6f06ff39.herokuapp.com/
