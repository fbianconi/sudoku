
var CACHE_NAME = 'sudoku-v1';
var urlsToCache = [
    'index.html',
    'css/style.css',
    'src/main.js',
    'src/vue.js',
    'css/Glyphter.css',
    'fonts/Glyphter.woff',
    'fonts/Glyphter.ttf',
    'fonts/Glyphter.svg',
    'fonts/Glyphter.eot',
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
        //network, then cache
        fetch(event.request).catch(function() {
            return caches.match(event.request);
        })

        // cache, then network 
        // caches.match(event.request).then(function(response) {
        //     return response || fetch(event.request);
        // })
    );
});
