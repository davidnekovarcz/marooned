<script setup lang="ts">
import Death from "@/web/src/view/Death.vue";
import Gear from "@/web/src/view/Gear.vue";
import Hint from "@/web/src/view/Hint.vue";
import Hud from "@/web/src/view/Hud.vue";
import InteractPrompt from "@/web/src/view/InteractPrompt.vue";
</script>

<template>
  <Hint />
  <Hud />
  <Gear />
  <InteractPrompt />
  <Death />
</template>
