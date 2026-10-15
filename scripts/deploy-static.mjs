// Prepares a static deploy folder from a built app: copies dist, writes version.json with the exact
// source commit, and writes a vercel.json with headers/rewrites but no build step.
//   node scripts/deploy-static.mjs apps/web .deploy/web
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { execSync } from "node:child_process"
import { join } from "node:path"

const [app, out] = process.argv.slice(2)
if (!app || !out) throw new Error("usage: deploy-static.mjs <appDir> <outDir>")
const sha = execSync("git rev-parse HEAD").toString().trim()
const dirty = execSync("git status --porcelain").toString().trim().length > 0
// Keep the Vercel project link (.vercel) across rebuilds; replace everything else.
if (existsSync(out)) {
  for (const entry of readdirSync(out)) if (entry !== ".vercel") rmSync(join(out, entry), { recursive: true, force: true })
}
mkdirSync(out, { recursive: true })
cpSync(join(app, "dist"), out, { recursive: true })
const cfg = JSON.parse(readFileSync(join(app, "vercel.json"), "utf8"))
for (const k of ["installCommand", "buildCommand", "outputDirectory"]) delete cfg[k]
writeFileSync(join(out, "vercel.json"), `${JSON.stringify(cfg, null, 2)}\n`)
writeFileSync(join(out, "version.json"), `${JSON.stringify({ commit: sha, dirtyWorkingTree: dirty, builtAt: new Date().toISOString() }, null, 2)}\n`)
console.log(`prepared ${out} from ${app} at ${sha}${dirty ? " (working tree dirty)" : ""}`)
