---
title: Installation
description: Installing Apiary packages from npm.
---

## Runtime requirements

Apiary targets any runtime with modern Web Standard support: **Node.js 18+**,
**Deno**, **Bun**, or **Cloudflare Workers**. The core package has **no runtime
dependencies**.

## `@apiary/core`

Install with your package manager of choice:

```bash
# pnpm
pnpm add @apiary/core

# npm
npm install @apiary/core

# yarn
yarn add @apiary/core

# bun
bun add @apiary/core
```

The npm package ships **ESM and CJS** bundles plus type declarations. Import
from either module system:

```ts
import { generateTimeSlots } from "@apiary/core"; // ESM

const { rangesOverlap } = require("@apiary/core"); // CJS
```

## `@apiary/postgres`

The PostgreSQL adapter is a regular npm package. It depends on `pg`
(node-postgres), which you install alongside it:

```bash
pnpm add @apiary/postgres pg
```

Then apply the migration and pass a `pg.Pool` to the repository. See the
[PostgreSQL guide](guides/postgres/) for the full setup.

## ESM and CJS

Both packages are authored in TypeScript with `moduleResolution: "nodenext"`
and published as dual ESM/CJS with bundled type declarations, so no special
transpilation is required in consumers.

## Requirements of your bundler

Because the core package is zero-dependency and uses only standard APIs, it
tree-shakes cleanly in Vite, esbuild, Rollup, webpack, and tsup. The postgres
package should be used in server contexts where `node:` built-ins are
available.
