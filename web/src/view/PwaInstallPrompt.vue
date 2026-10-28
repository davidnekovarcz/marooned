<template>
  <div v-if="showPrompt" class="pwa-install-prompt">
    <div class="pwa-install-content">
      <div class="pwa-install-header">
        <h3>Install PragueGTA</h3>
        <button class="pwa-close" @click="dismissPrompt" aria-label="Close">×</button>
      </div>
      <p>Install this app on your device for a better experience and offline play!</p>
      <div class="pwa-install-actions">
        <button class="pwa-install-btn" @click="installApp">Install</button>
        <button class="pwa-dismiss-btn" @click="dismissPrompt">Not now</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const showPrompt = ref(false);
let deferredPrompt: any = null;

onMounted(() => {
  const dismissed = localStorage.getItem('pwa-install-dismissed');
  const installedBefore = localStorage.getItem('pwa-installed');
  
  if (dismissed || installedBefore) {
    return;
  }

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    
    setTimeout(() => {
      showPrompt.value = true;
    }, 3000);
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem('pwa-installed', 'true');
    showPrompt.value = false;
    deferredPrompt = null;
  });
});

const installApp = async () => {
  if (!deferredPrompt) {
    return;
  }

  deferredPrompt.prompt();
  
  const { outcome } = await deferredPrompt.userChoice;
  
  if (outcome === 'accepted') {
    localStorage.setItem('pwa-installed', 'true');
  }
  
  deferredPrompt = null;
  showPrompt.value = false;
};

const dismissPrompt = () => {
  localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  showPrompt.value = false;
};
</script>

<style scoped>
.pwa-install-prompt {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  max-width: 400px;
  width: calc(100% - 40px);
  animation: slideUp 0.3s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}

.pwa-install-content {
  background: rgba(22, 33, 62, 0.95);
  backdrop-filter: blur(10px);
  border: 2px solid rgba(233, 69, 96, 0.5);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.pwa-install-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.pwa-install-header h3 {
  margin: 0;
  color: #e94560;
  font-size: 1.2rem;
}

.pwa-close {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.pwa-close:hover {
  background: rgba(255, 255, 255, 0.1);
}

.pwa-install-content p {
  margin: 0 0 16px 0;
  color: #fff;
  line-height: 1.5;
}

.pwa-install-actions {
  display: flex;
  gap: 10px;
}

.pwa-install-btn,
.pwa-dismiss-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.pwa-install-btn {
  background: #e94560;
  color: #fff;
}

.pwa-install-btn:hover {
  background: #d63651;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(233, 69, 96, 0.4);
}

.pwa-dismiss-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.pwa-dismiss-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

@media (max-width: 480px) {
  .pwa-install-prompt {
    bottom: 10px;
    width: calc(100% - 20px);
  }
  
  .pwa-install-content {
    padding: 16px;
  }
  
  .pwa-install-actions {
    flex-direction: column;
  }
}
</style>
