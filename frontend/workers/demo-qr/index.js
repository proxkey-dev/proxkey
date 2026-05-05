// Cloudflare Workers Site handler
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const url = new URL(request.url)
  
  // Handle root path
  if (url.pathname === '/') {
    url.pathname = '/index.html'
  }
  
  // For SPA routing, try index.html for any path that doesn't have a file extension
  if (!url.pathname.includes('.')) {
    url.pathname = '/index.html'
  }
  
  // Fetch the asset from the site bucket
  return fetch(url.toString(), request)
}
