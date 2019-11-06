
var CACHE_NAME = 'sudoku-v1';
var urlsToCache = [
    '/',
    '/css/style.css',
    '/src/main.js'
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
