
const CACHE = 'xingce-v2';
self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) {
    return c.addAll(['/','/index.html','/app.js','/style.css','/prompts.js','/manifest.json']);
  }));
});
self.addEventListener('fetch', function(e) {
  if (e.request.url.includes('api.deepseek.com') || e.request.url.includes('dashscope.aliyuncs.com')) return;
  e.respondWith(caches.match(e.request).then(function(r) { return r || fetch(e.request); }));
});
