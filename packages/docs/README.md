# Apiary Docs

The Apiary documentation site, built with [Astro](https://astro.build) and
[Starlight](https://starlight.astro.build).

## Development

```bash
pnpm install                          # install the workspace
pnpm --filter packages-docs dev       # start the dev server
pnpm --filter packages-docs build     # static build -> packages/docs/dist
```

Content lives in `src/content/docs` (Markdown/MDX). Styling uses SCSS in
`src/styles/theme.scss`, registered through Starlight's `customCss`.

## Deployment

Deployed on Cloudflare Pages:
[apiary-f4n.pages.dev](https://apiary-f4n.pages.dev)
