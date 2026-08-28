import path from "node:path"
import babel from "@rolldown/plugin-babel"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react, { reactCompilerPreset } from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { viteStaticCopy } from "vite-plugin-static-copy"

const fontsourceFiles = (pkg: string) =>
  path.resolve(
    __dirname,
    `../../../lib/typescript/ui/base/node_modules/@fontsource-variable/${pkg}/files/*.woff2`,
  )

const ASSETS_DIR = "admin-assets"

export default defineConfig(({ mode }) => ({
  // Do not share `/assets` with the dashboard: only this namespace tells the website proxy which
  // fixed static project owns an asset. Dev continues to mount the admin SPA below `/admin`.
  base: mode === "production" ? "/" : "/admin/",
  build: { assetsDir: ASSETS_DIR },
  define: {
    "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(process.env.NEXT_PUBLIC_API_URL ?? ""),
  },
  plugins: [
    tanstackRouter({ quoteStyle: "double" }),
    react(),
    tailwindcss(),
    babel({ presets: [reactCompilerPreset()] }),
    viteStaticCopy({
      targets: [
        { src: fontsourceFiles("geist"), dest: `${ASSETS_DIR}/files`, rename: { stripBase: true } },
        {
          src: fontsourceFiles("geist-mono"),
          dest: `${ASSETS_DIR}/files`,
          rename: { stripBase: true },
        },
      ],
    }),
  ],
  optimizeDeps: {
    entries: [
      "index.html",
      "src/**/*.{ts,tsx}",
      "../../../lib/typescript/ui/base/src/**/*.{ts,tsx}",
      "../../../lib/typescript/ui/spa-shared/src/**/*.{ts,tsx}",
      "../../../lib/typescript/ui/seo-shared/src/**/*.{ts,tsx}",
      "../../../lib/typescript/api-client/src/**/*.{ts,tsx}",
    ],
  },
  resolve: {
    alias: {
      "@frontends/admin": path.resolve(__dirname, "./src"),
      "@ui/base": path.resolve(__dirname, "../../../lib/typescript/ui/base/src"),
      "@ui/spa-shared": path.resolve(__dirname, "../../../lib/typescript/ui/spa-shared/src"),
      // Must come before the "@ui/seo-shared" prefix alias so seo-shared components render
      // links with TanStack Router's Link instead of the plain <a> template.
      "@ui/seo-shared/_internal/seo-link": path.resolve(__dirname, "./src/components/seo-link.tsx"),
      "@ui/seo-shared": path.resolve(__dirname, "../../../lib/typescript/ui/seo-shared/src"),
      "@lib/api-client": path.resolve(__dirname, "../../../lib/typescript/api-client/src"),
    },
  },
  server: {
    port: 3003,
  },
}))
