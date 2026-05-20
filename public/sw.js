// Service worker básico usado por el navegador para capacidades de aplicación instalable.

self.addEventListener('install', (event) => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
