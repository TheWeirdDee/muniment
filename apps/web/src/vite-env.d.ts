/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_TRUSTED_PUBLISHERS?: string
  readonly VITE_TRUSTED_REVIEWERS?: string
  readonly VITE_SITE_URL?: string
  readonly VITE_DASHBOARD_URL?: string
}
