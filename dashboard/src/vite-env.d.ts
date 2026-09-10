/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google AI Studio key, read from the gitignored `dashboard/.env.local`. */
  readonly VITE_GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
