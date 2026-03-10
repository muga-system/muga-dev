/// <reference path="../.astro/types.d.ts" />
/// <reference path="../.astro/content.d.ts" />
/// <reference types="astro/client" />

declare module '*.css' {
  const content: string;
  export default content;
}

declare module 'astro:transitions' {
  export const ClientRouter: any;
}

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
