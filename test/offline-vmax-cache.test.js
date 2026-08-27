import assert from'node:assert/strict';
import test from'node:test';
import{VMAX_CACHE,clearVmaxCache,readVmaxCache,vmaxCacheKey,writeVmaxCache}from'../offline-vmax-cache.js';

class MemoryCache{
  constructor(){this.items=new Map()}
  async match(request){return this.items.get(request.url)?.clone()||null}
  async put(request,response){this.items.set(request.url,response.clone())}
  async delete(request){return this.items.delete(request.url)}
  async keys(){return[...this.items.keys()].map(url=>new Request(url))}
}

test('cache VMAX normalizuje pozycję i obsługuje świeże oraz awaryjne dane',async()=>{
  const original=globalThis.caches;
  const stores=new Map();
  globalThis.caches={
    async open(name){if(!stores.has(name))stores.set(name,new MemoryCache());return stores.get(name)},
    async delete(name){return stores.delete(name)}
  };
  try{
    const point={lat:52.229701,lon:21.012199};
    assert.equal(vmaxCacheKey(point).url,'https://trasy.invalid/_offline-vmax/52.2297/21.0122');
    assert.equal(await writeVmaxCache(point,[{type:'way',id:1}],{now:1000}),true);
    assert.deepEqual((await readVmaxCache(point,{now:1001}))?.elements,[{type:'way',id:1}]);
    assert.equal(await readVmaxCache(point,{now:1000+VMAX_CACHE.freshMs+1}),null);
    const stale=await readVmaxCache(point,{allowStale:true,now:1000+VMAX_CACHE.freshMs+1});
    assert.equal(stale?.stale,true);
    assert.equal(await readVmaxCache(point,{allowStale:true,now:1000+VMAX_CACHE.maxStaleMs+1}),null);
    assert.equal(await clearVmaxCache(),true);
  }finally{
    if(original===undefined)delete globalThis.caches;
    else globalThis.caches=original;
  }
});
