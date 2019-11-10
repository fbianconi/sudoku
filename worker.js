
var CACHE_NAME = 'sudoku-v1';
var urlsToCache = [
    'index.html',
    'css/style.css',
    'src/main.js',
    'src/vue.js',
    'img/icon.svg'
];

self.addEventListener('install', function(event) {
    // Perform install steps
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request).then(function(response) {
            return response || fetch(event.request);
        })
    );
});
