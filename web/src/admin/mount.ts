import { createApp } from "vue";
import Admin from "@/web/src/admin/Admin.vue";

export function mountAdmin(root: HTMLElement): void {
  document.body.classList.add("admin");
  document.body.classList.remove("gate");
  createApp(Admin).mount(root);
}
