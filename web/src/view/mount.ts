import { createApp } from "vue";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { bindVueI18n } from "@/web/src/i18n";
import App from "@/web/src/view/App.vue";
import en from "@/web/locales/en.json";

export function mountUi(root: HTMLElement): void {
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    fallbackLocale: "en",
    messages: { en },
  });
  bindVueI18n((key, params) => String(i18n.global.t(key, params ?? {})));
  const app = createApp(App);
  app.use(createPinia());
  app.use(i18n);
  app.mount(root);
}
