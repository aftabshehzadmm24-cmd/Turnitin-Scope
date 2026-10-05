/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DOCX_CONVERTER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}