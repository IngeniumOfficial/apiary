---
title: Installation
description: Installing Apiary packages from npm.
---

## Runtime requirements

Apiary targets any runtime with modern Web Standard support: **Node.js 18+**,
**Deno**, **Bun**, or **Cloudflare Workers**. The core package has **no runtime
dependencies**.

## `@apiary-dev/core`

Install with your package manager of choice:

```bash
# pnpm
pnpm add @apiary-dev/core

# npm
npm install @apiary-dev/core

# yarn
yarn add @apiary-dev/core

# bun
bun add @apiary-dev/core
```

The npm package ships **ESM and CJS** bundles plus type declarations. Import
from either module system:

```ts
import { generateTimeSlots } from "@apiary-dev/core"; // ESM

const { rangesOverlap } = require("@apiary-dev/core"); // CJS
```

## `@apiary-dev/postgres`

The PostgreSQL adapter is a regular npm package. It depends on `pg`
(node-postgres), which you install alongside it:

```bash
pnpm add @apiary-dev/postgres pg
```

Then apply the migration and pass a `pg.Pool` to the repository. See the
[PostgreSQL guide](guides/postgres/) for the full setup.

## `@apiary-dev/server`

The transport-agnostic operations package. Pair it with an adapter such as
`@apiary-dev/postgres`:

```bash
pnpm add @apiary-dev/server
```

See the [Server Operations guide](guides/server-integration/) for wiring it into
your framework.

## ESM and CJS

All packages are authored in TypeScript with `moduleResolution: "nodenext"`
and published as dual ESM/CJS with bundled type declarations, so no special
transpilation is required in consumers.

## Requirements of your bundler

Because the core package is zero-dependency and uses only standard APIs, it
tree-shakes cleanly in Vite, esbuild, Rollup, webpack, and tsup. The postgres
package should be used in server contexts where `node:` built-ins are
available.
