
const CACHE = 'xingce-v4';
self.addEventListener('install', function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) {
    return c.addAll(['/','/index.html','/app.js','/style.css','/prompts.js','/storage.js','/stats.js','/manifest.json']);
  }));
});
self.addEventListener('activate', function(e) {
  // 清理旧版本缓存，避免老用户拿到过期文件
  e.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
  }));
});
self.addEventListener('fetch', function(e) {
  if (e.request.url.includes('api.deepseek.com') || e.request.url.includes('dashscope.aliyuncs.com')) return;
  e.respondWith(caches.match(e.request).then(function(r) { return r || fetch(e.request); }));
});
