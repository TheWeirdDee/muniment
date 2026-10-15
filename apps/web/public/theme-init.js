// Resolve the saved theme before first paint. New visitors get dark; "system" follows the OS.
try {
  var t = localStorage.getItem("muniment.theme")
  var resolved = t === "light" ? "light" : t === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : "dark"
  document.documentElement.setAttribute("data-theme", resolved)
} catch (e) {
  document.documentElement.setAttribute("data-theme", "dark")
}
