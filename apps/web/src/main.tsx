import "@fontsource-variable/archivo/wdth.css"
import "@fontsource-variable/jetbrains-mono/index.css"
import "./styles/tokens.css"
import "./styles/base.css"
import "./styles/components.css"
import "./styles/pages.css"

import { StrictMode, Suspense, lazy } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Route, Routes } from "react-router"
import { Layout } from "./components/Layout"
import { AnnouncerProvider } from "./lib/announce"
import { initTheme } from "./lib/theme"
import { WalletProvider } from "./lib/wallet"
import Landing from "./pages/Landing"

const Archive = lazy(() => import("./pages/Archive"))
const Record = lazy(() => import("./pages/Record"))
const Preserve = lazy(() => import("./pages/Preserve"))
const Collections = lazy(() => import("./pages/Collections"))
const Publish = lazy(() => import("./pages/Publish"))
const Insights = lazy(() => import("./pages/Insights"))
const Developers = lazy(() => import("./pages/Developers"))
const HowItWorks = lazy(() => import("./pages/HowItWorks"))
const Legal = lazy(() => import("./pages/Legal"))
const NotFound = lazy(() => import("./pages/NotFound"))

initTheme()

function PageFallback() {
  return (
    <div className="wrap" style={{ paddingBlock: "6rem" }} aria-busy="true">
      <p className="faint">Loading…</p>
    </div>
  )
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <AnnouncerProvider>
        <WalletProvider>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Landing />} />
                <Route path="archive" element={<Archive />} />
                <Route path="records/:key" element={<Record />} />
                <Route path="preserve" element={<Preserve />} />
                <Route path="collections" element={<Collections />} />
                <Route path="publish" element={<Publish />} />
                <Route path="insights" element={<Insights />} />
                <Route path="developers" element={<Developers />} />
                <Route path="how-it-works" element={<HowItWorks />} />
                <Route path="privacy" element={<Legal kind="privacy" />} />
                <Route path="terms" element={<Legal kind="terms" />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </WalletProvider>
      </AnnouncerProvider>
    </BrowserRouter>
  </StrictMode>,
)
