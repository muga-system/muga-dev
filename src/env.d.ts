/// <reference path="../.astro/types.d.ts" />
/// <reference path="../.astro/content.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  readonly SUPABASE_LEADS_TABLE?: string;
}
