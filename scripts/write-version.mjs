// Writes <outDir>/version.json with the source commit of this build, so a deployment can be matched
// to its exact revision. Uses Vercel's VERCEL_GIT_COMMIT_SHA when building from Git, else git.
//   node scripts/write-version.mjs <outDir>
import { execSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import { join } from "node:path"

const out = process.argv[2]
if (!out) throw new Error("usage: write-version.mjs <outDir>")
let commit = process.env.VERCEL_GIT_COMMIT_SHA || ""
let dirty = null
if (!commit) {
  try {
    commit = execSync("git rev-parse HEAD").toString().trim()
    dirty = execSync("git status --porcelain").toString().trim().length > 0
  } catch {
    commit = "unknown"
  }
}
writeFileSync(join(out, "version.json"), `${JSON.stringify({ commit, dirtyWorkingTree: dirty, builtAt: new Date().toISOString(), source: process.env.VERCEL ? "vercel-git" : "local" }, null, 2)}\n`)
console.log(`version.json: ${commit}`)
