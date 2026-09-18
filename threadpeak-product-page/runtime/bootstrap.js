/* Classic scripts work when index.html is opened directly from Finder. */
(() => {
  const offlinePacks = [
  "./assets/offline/images.js",
  "./assets/offline/lettering.js",
  "./assets/offline/characters.js",
  "./assets/offline/models.js"
];
  const rawTextFiles = [
  "assets/lettering/network-topic-3.svg",
  "assets/lettering/network-topic-1.svg",
  "assets/lettering/network-topic-0.svg",
  "assets/lettering/network-topic-2.svg"
];

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`无法加载本地文件：${src}`));
      document.head.append(script);
    });
  }

  function loadStyles(href) {
    return new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = resolve;
      link.onerror = () => reject(new Error(`无法加载字体样式：${href}`));
      document.head.append(link);
    });
  }

  async function start() {
    if (location.protocol === 'file:') {
      // Browsers cannot fetch local WASM/GLB/Rive files. These generated packs
      // contain asset data only, separately from the application code.
      await Promise.all([
        loadStyles('./assets/offline/fonts.css'),
        ...offlinePacks.map(loadScript),
      ]);
    } else {
      await loadStyles('./styles/fonts.css');
      window.__PRODUCT_TEXT_ASSETS__ = Object.create(null);
      await Promise.all(rawTextFiles.map(async file => {
        const response = await fetch(file);
        if (!response.ok) throw new Error(`无法加载本地素材：${file}`);
        window.__PRODUCT_TEXT_ASSETS__[file] = await response.text();
      }));
    }
    await loadScript('./data/demo-content.js');
    await loadScript('./runtime/vendor.js');
    await loadScript('./runtime/product.js');
  }

  start().catch(error => {
    console.error(error);
    const message = document.createElement('p');
    message.textContent = `${error.message}。请保留完整的产品页文件夹后重新打开。`;
    message.style.cssText = 'margin:48px;font:16px/1.8 sans-serif;color:#333';
    document.getElementById('root').replaceChildren(message);
  });
})();
