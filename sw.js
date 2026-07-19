/* Pocket Tutor v2 - service worker (module "pwa")
   ES5-safe. Precaches the app shell + deck data, then serves:
     - cache-first for same-origin data/*.json, icons, and the manifest
     - stale-while-revalidate for HTML / navigation requests
   Bump CACHE below whenever precached assets change to invalidate old caches.
*/

/* eslint-disable no-var */
var CACHE = "pocket-tutor-v80";

var PRECACHE_URLS = [
  "./",
  "./index.html",
  "./app.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./data/oxford.json",
  "./data/awl.json",
  "./data/colloc.json",
  "./data/syn.json",
  "./data/sentences.json",
  "./data/pv.json",
  "./data/idiom.json",
  "./data/topic.json",
  "./data/knowledge.json",
  "./data/conversations.json",
  "./data/wordchoice.json",
  "./data/exam.json",
  "./data/reading.json",
  "./data/bank.json",
  "./data/fix.json",
  "./data/stories.json"
];

// ---- install: precache the app shell + data ----
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// ---- activate: drop any caches from older versions ----
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.map(function (name) {
          if (name !== CACHE) {
            return caches.delete(name);
          }
          return undefined;
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// ---- helpers ----

function isNavigationRequest(request) {
  return request.mode === "navigate" ||
    (request.method === "GET" &&
      request.headers.get("accept") &&
      request.headers.get("accept").indexOf("text/html") !== -1);
}

function isCacheFirstAsset(url) {
  // same-origin data/*.json, icons, manifest
  if (url.pathname.indexOf("/data/") !== -1 && url.pathname.indexOf(".json") !== -1) {
    return true;
  }
  if (url.pathname.indexOf("icon-192.png") !== -1 || url.pathname.indexOf("icon-512.png") !== -1) {
    return true;
  }
  if (url.pathname.indexOf("manifest.webmanifest") !== -1) {
    return true;
  }
  return false;
}

// cache-first: serve from cache immediately if present, else fetch + store
function cacheFirst(request) {
  return caches.open(CACHE).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) {
        return cached;
      }
      return fetch(request).then(function (resp) {
        if (resp && resp.ok) {
          cache.put(request, resp.clone());
        }
        return resp;
      }).catch(function () {
        return cached; // undefined - nothing we can do offline
      });
    });
  });
}

// stale-while-revalidate: serve cache immediately, refresh in background
function staleWhileRevalidate(request) {
  return caches.open(CACHE).then(function (cache) {
    return cache.match(request).then(function (cached) {
      var fetchPromise = fetch(request).then(function (resp) {
        if (resp && resp.ok) {
          cache.put(request, resp.clone());
        }
        return resp;
      }).catch(function () {
        return cached;
      });
      return cached || fetchPromise;
    });
  });
}

// ---- fetch ----
self.addEventListener("fetch", function (event) {
  var request = event.request;

  if (request.method !== "GET") {
    return; // let non-GET pass through to the network untouched
  }

  var url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return; // don't intercept cross-origin requests
  }

  if (isNavigationRequest(request)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (isCacheFirstAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // default: try cache, fall back to network (also covers app.html script/css assets)
  event.respondWith(
    caches.match(request).then(function (cached) {
      return cached || fetch(request).catch(function () { return cached; });
    })
  );
});
