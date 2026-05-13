declare const __VRSRC_K__: string;

// API key injected at build time via Vite define — never in source/git
export const PUBLIC_MIRROR_API_KEY: string =
  typeof __VRSRC_K__ !== "undefined" ? __VRSRC_K__ : "";
