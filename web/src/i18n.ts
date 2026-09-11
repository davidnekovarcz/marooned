import en from "@/web/locales/en.json";

export type LocaleCode = "en";

type MessageTree = { [key: string]: string | MessageTree };

const catalogs: Record<LocaleCode, MessageTree> = {
  en: en as MessageTree,
};

let locale: LocaleCode = "en";
let vueT: ((key: string, params?: Record<string, unknown>) => string) | null = null;

export function currentLocale(): LocaleCode {
  return locale;
}

export function setLocale(next: LocaleCode): void {
  locale = next;
}

/** Wired once Vue i18n is mounted so `t()` and `$t` share the same catalogs. */
export function bindVueI18n(fn: (key: string, params?: Record<string, unknown>) => string): void {
  vueT = fn;
}

function lookup(tree: MessageTree, path: string): string | undefined {
  let cur: string | MessageTree | undefined = tree;
  for (const part of path.split(".")) {
    if (!cur || typeof cur === "string") return undefined;
    cur = cur[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(template: string, params?: Record<string, unknown>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    return value === undefined || value === null ? `{${name}}` : String(value);
  });
}

export function t(key: string, params?: Record<string, unknown>): string {
  if (vueT) {
    const translated = vueT(key, params);
    if (translated && translated !== key) return translated;
  }
  const raw = lookup(catalogs[locale], key) ?? lookup(catalogs.en, key);
  if (!raw) return key;
  return interpolate(raw, params);
}
