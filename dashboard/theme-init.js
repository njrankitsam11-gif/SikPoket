(function(){ let t=localStorage.getItem('sik_theme')||'forest'; if(t==='sunset'||t==='solar') t='forest'; document.documentElement.setAttribute('data-theme', t); if(t==='obsidian') document.documentElement.classList.add('dark'); })();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    for (let r of regs) r.unregister();
  });
}
if ('caches' in window) {
  caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
}
