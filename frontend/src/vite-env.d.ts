/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

declare const __BUILD_ID__: string;

interface ImportMetaEnv {
  readonly VITE_NUTRITION_URL?: string;
}
