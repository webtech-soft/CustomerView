/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DVI_EDITOR_URL?: string
  readonly VITE_CHECK_IN_URL?: string
  /** URL for resolving external inv tokens (e.g. portal). Expects ?inv=<token>, returns { invoiceNum: number }. */
  readonly VITE_RESOLVE_INV_TOKEN_URL?: string
  readonly DEV?: boolean
  readonly MODE?: string
  readonly PROD?: boolean
  readonly SSR?: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

