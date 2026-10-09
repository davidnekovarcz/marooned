import { createApp } from "vue";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import Admin from "@/web/src/admin/Admin.vue";
import en from "@/web/locales/en.json";

export function mountAdmin(root: HTMLElement): void {
  document.body.classList.add("admin");
  document.body.classList.remove("gate");
  const i18n = createI18n({
    legacy: false,
    locale: "en",
    fallbackLocale: "en",
    messages: { en },
  });
  const app = createApp(Admin);
  app.use(createPinia());
  app.use(i18n);
  app.mount(root);
}
