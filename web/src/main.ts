import "@/web/src/style.css";
import { Game } from "@/web/src/game/Game";

const adminPath = window.location.pathname === "/admin" || window.location.pathname === "/admin/";
if (adminPath) {
  void import("@/web/src/admin/mount").then(({ mountAdmin }) => {
    const root = document.getElementById("ui");
    if (root) mountAdmin(root);
  });
} else {
  void Game.start();
}
