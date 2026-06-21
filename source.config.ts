import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import lastModified from "fumadocs-mdx/plugins/last-modified";

// Fumadocs source config. Content lives in `content/docs/` and is compiled
// at build time into `src/.source/` by the `fumadocs-mdx` CLI (wired into
// `next.config.ts` via `createMDX()` and the `postinstall` script in
// `package.json`). Raw MDX is NOT read at request time, so the Next.js
// standalone output doesn't need to trace `content/`.
export const docs = defineDocs({
    dir: "content/docs",
});

export default defineConfig({
    // `lastModified` reads `git log` for each MDX file and exports a
    // `lastModified` field on every page. It requires BOTH the `git`
    // binary on $PATH AND a `.git/` repo present at build time. We skip
    // it inside the Docker build to avoid archiving the entire `.git/`
    // history into the build context. The runner stage doesn't carry
    // git either. Consumers: `src/app/sitemap.ts` (sitemap <lastmod>)
    // and the docs page footer. Self-hosters building directly from a
    // git checkout will still get lastModified dates.
    plugins: process.env.RIFFADO_DOCKER_BUILD ? [] : [lastModified()],
    mdxOptions: {
        // Warm dual-theme shiki palette that lives close to the Riffado
        // OKLCH tokens defined in `src/app/globals.css`. `vitesse-light`
        // sits well on the cream background; `vesper` matches the dark
        // mocha surface without the high-contrast neon of e.g. `dracula`.
        // The `.dark` class on `<html>` (driven by the app-wide theme
        // provider) flips between the two automatically.
        rehypeCodeOptions: {
            themes: {
                light: "vitesse-light",
                dark: "vesper",
            },
        },
    },
});
