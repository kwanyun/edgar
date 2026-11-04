# EDGAR project page

Research website for **EDGAR: Efficient Diffusion-Driven Gaussian Avatar Refinement via Synthetic Failure**.

Kwan Yun, Min-Hyeok Bang, Colette Suhjung Koo, and Junyong Noh — KAIST Visual Media Lab.

The page includes synchronized original/refined avatar comparisons, rotating CAP4D examples, a method overview, and evaluation results. This repository contains the project website; the research implementation is not included.

## Preview locally

Requires Node.js; no packages or build step are needed.

```sh
node scripts/serve.mjs
```

Open http://127.0.0.1:4173. The preview server supports video seeking.

## Validate

```sh
node scripts/check-site.mjs
node --check dist/app.js
```

## Files

- `dist/index.html`: page content and resource links.
- `dist/styles.css`: responsive layout and styling.
- `dist/app.js`: comparison controls and interactions.
- `dist/data.js`: media selections and playback metadata.
- `dist/assets/`: figures, posters, and comparison videos.

## Publication

The project page is published at https://kwanyun.github.io/edgar/.

GitHub Actions validates and publishes `dist/` whenever website changes are pushed to `main`. The workflow can also be started manually from the Actions tab.

Paper and Code links intentionally have empty destinations until release URLs are ready. Set their `href` values and remove `data-placeholder`, `aria-disabled`, and the placeholder `title` when enabling them.
