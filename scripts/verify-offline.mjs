import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'
const stores = new Map()
const handlers = {}
class MemoryCache {
  data = new Map()
  key(request) { return typeof request === 'string' ? request : request.url }
  async put(request,response) { this.data.set(this.key(request),response.clone()) }
  async match(request) { return this.data.get(this.key(request))?.clone() }
  async delete(request) { return this.data.delete(this.key(request)) }
  async keys() { return [...this.data.keys()].map(url=>new Request(url)) }
}
const caches = {
  async open(name) { if (!stores.has(name)) stores.set(name,new MemoryCache()); return stores.get(name) },
  async keys() { return [...stores.keys()] },
  async delete(name) { return stores.delete(name) },
  async match(request) { for (const cache of stores.values()) { const r=await cache.match(request); if(r) return r } },
}
const context = vm.createContext({ Request,Response,Headers,Blob,URL,console,caches,
  self:{ registration:{scope:'https://example.test/chunkyreader/'}, clients:{claim:async()=>{}}, skipWaiting:async()=>{}, addEventListener:(name,fn)=>handlers[name]=fn },
  fetch:async()=>{throw new Error('Offline')}
})
vm.runInContext(fs.readFileSync('public/sw.js','utf8'),context)
const test = code => vm.runInContext(code,context)
assert.equal(test("isSharedMedia(new URL('https://nvrofeaaewwdeefxtmqu.supabase.co/storage/v1/object/sign/chunky-reader-private/x?token=y'))"),false)
assert.equal(test("isSharedMedia(new URL(MEDIA_BASE+'v1/'+'a'.repeat(64)+'.mp3'))"),true)
assert.equal(test("isSharedMedia(new URL(MEDIA_BASE+'v1/'+'a'.repeat(64)+'.mp3?token=y'))"),false)
for (let i=0;i<390;i++) await test(`putBounded('https://example.test/item-${i}',new Response('abc'))`)
assert.equal((await (await caches.open(test('RUNTIME_CACHE'))).keys()).length,384)
const partial = await test("mediaResponse(new Request('https://example.test/a',{headers:{range:'bytes=2-4'}}),new Response('abcdef'))")
assert.equal(partial.status,206); assert.equal(await partial.text(),'cde')
const invalid = await test("mediaResponse(new Request('https://example.test/a',{headers:{range:'bytes=99-100'}}),new Response('abcdef'))")
assert.equal(invalid.status,416)
await caches.open('chunky-audio-pack-v2')
await caches.open('chunky-learner-v12-static')
let pending
handlers.activate({waitUntil:promise=>pending=promise})
await pending
assert(stores.has('chunky-audio-pack-v2'))
assert(!stores.has('chunky-learner-v12-static'))
let intercepted=false
handlers.fetch({request:new Request('https://nvrofeaaewwdeefxtmqu.supabase.co/storage/v1/object/sign/chunky-reader-private/file?token=secret'),respondWith:()=>intercepted=true})
assert.equal(intercepted,false)
console.log('Offline cache bound, audio byte ranges, private URL exclusion, and installed-audio preservation passed.')
