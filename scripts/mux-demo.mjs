// Combines demo/out/raw.webm with the per-scene narration WAVs into demo/out/muniment-demo.mp4,
// trimming the pre-roll before scene 1, placing each narration clip at its scene's real start time,
// and embedding the captions as a soft subtitle track. Fails if the result exceeds 180 seconds.
//   FFMPEG=/path/to/ffmpeg node scripts/mux-demo.mjs
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")
const OUT = join(ROOT, "demo", "out")
const ff = process.env.FFMPEG || "ffmpeg"
const meta = JSON.parse(readFileSync(join(OUT, "scenes.json"), "utf8"))
const offset = Math.max(0, meta.scenes[0].startMs - 300)
const total = meta.scenes[meta.scenes.length - 1].endMs - offset
if (total > 180_000) throw new Error(`film would be ${(total / 1000).toFixed(1)} s, over the 3-minute limit`)

const ts = (ms) => {
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), x = ms % 1000
  return `00:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(x).padStart(3, "0")}`
}
const srt = meta.scenes.map((s, i) => `${i + 1}\n${ts(s.startMs - offset)} --> ${ts(s.endMs - offset)}\n${s.text}\n`).join("\n")
writeFileSync(join(OUT, "muniment-demo.srt"), srt)

const inputs = ["-ss", (offset / 1000).toFixed(3), "-i", join(OUT, "raw.webm")]
const filters = []
meta.scenes.forEach((s, i) => {
  inputs.push("-i", join(OUT, `scene${s.n}.wav`))
  const d = Math.max(0, s.startMs - offset + 250)
  filters.push(`[${i + 1}:a]adelay=${d}|${d}[a${i}]`)
})
filters.push(`${meta.scenes.map((_, i) => `[a${i}]`).join("")}amix=inputs=${meta.scenes.length}:normalize=0[aout]`)
inputs.push("-i", join(OUT, "muniment-demo.srt"))
const subIdx = meta.scenes.length + 1
execFileSync(
  ff,
  [
    "-y",
    ...inputs,
    "-filter_complex", filters.join(";"),
    "-map", "0:v", "-map", "[aout]", "-map", `${subIdx}:s`,
    "-t", (total / 1000).toFixed(3),
    "-c:v", "libx264", "-preset", "medium", "-crf", "23", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-c:s", "mov_text", "-metadata:s:s:0", "language=eng",
    "-movflags", "+faststart",
    join(OUT, "muniment-demo.mp4"),
  ],
  { stdio: "inherit" },
)
console.log(`wrote demo/out/muniment-demo.mp4 (${(total / 1000).toFixed(1)} s)`)
