// New visitors get dark, like the main archive; a saved choice wins.
try {
  var t = localStorage.getItem("muniment.insights.theme")
  document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark")
} catch (e) {
  document.documentElement.setAttribute("data-theme", "dark")
}
