(() => {
  const root = document.documentElement;
  root.classList.add('highfly-native-shell');
  document.title = 'HIGHFLY';

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  const brandOfflineCreator = () => {
    document.title = 'HIGHFLY';
    document.body?.setAttribute('data-highfly-mode', 'offline');

    const titleLogo = document.getElementById('title-logo');
    if (titleLogo) titleLogo.setAttribute('hidden', '');
    const introLogo = document.getElementById('intro-logo');
    if (introLogo) introLogo.setAttribute('hidden', '');

    const panel = document.getElementById('offline-select');
    if (panel && !document.getElementById('highfly-native-brand')) {
      const brand = document.createElement('div');
      brand.id = 'highfly-native-brand';
      brand.innerHTML = '<strong>HIGHFLY</strong><span>NEXUS · CLEAN CORE · OFFLINE</span>';
      panel.prepend(brand);
    }

    const title = panel?.querySelector('.auth-title');
    if (title) title.textContent = 'CREAR CAZADOR';

    const name = document.getElementById('char-name');
    if (name instanceof HTMLInputElement) {
      name.placeholder = 'NOMBRE DEL CAZADOR';
      name.autocomplete = 'off';
    }

    setText('btn-start-offline', 'ENTRAR A HIGHFLY');

    const online = document.getElementById('btn-online');
    if (online) online.setAttribute('hidden', '');

    document.querySelectorAll('a[href*="worldofclaudecraft.com"], a[href*="discord.com/invite/worldofclaudecraft"]').forEach((el) => {
      el.setAttribute('hidden', '');
    });
  };

  const enterOffline = () => {
    brandOfflineCreator();
    const offline = document.getElementById('btn-offline');
    const panel = document.getElementById('offline-select');
    if (!offline || !panel) return false;

    if (panel.hasAttribute('hidden')) offline.click();
    if (panel.hasAttribute('hidden')) return false;

    document.body.dataset.startPanel = 'offline-select';
    document.body.classList.add('highfly-native-ready');
    brandOfflineCreator();
    return true;
  };

  window.addEventListener('DOMContentLoaded', () => {
    let tries = 0;
    const tick = () => {
      tries += 1;
      if (enterOffline()) return;
      if (tries < 80) window.setTimeout(tick, 50);
      else document.body?.classList.add('highfly-native-ready');
    };
    tick();
  });

  window.addEventListener('pageshow', brandOfflineCreator);
})();
