import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../src/components/scenery/sceneryFiles.js',import.meta.url),'utf8');
const {normalizePath,fileListMount,createScenerySession}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
globalThis.localStorage={getItem:()=>null,setItem:()=>{}};
const file=(name,text,rel)=>({name,webkitRelativePath:rel,size:text.length,lastModified:1,arrayBuffer:async()=>new TextEncoder().encode(text).buffer});
const imported=fileListMount([file('A.cas','CAS','Test/data/models_strat/A.cas'),file('map_regions.tga','MAP','Test/data/world/maps/base/map_regions.tga')]);
const zip=createScenerySession({mod:imported});
assert.equal(zip.config.webDownloadOnly,true);assert((await zip.stat('/mod/data/world/maps')).isDir);
assert.equal((await zip.catalogue()).models.length,1);assert.equal((await zip.list('/mod/data/models_strat'))[0].name,'A.cas');
await zip.write('/mod/data/New.txt',new Uint8Array([1,2,3]));assert.equal(zip.pending.size,1);assert.equal(zip.pendingVersion,1);assert.equal((await zip.stat('/mod/data/new.txt')).size,3);
assert.equal(normalizePath('/mod/data/models/site/../_materials/a.tga'),'/mod/data/models/_materials/a.tga');
assert.throws(()=>normalizePath('/mod/../../outside'));await assert.rejects(zip.write('/game/data/bad.txt',new Uint8Array()));
// A native DirectoryHandle has an entries() METHOD, unlike a FileList mount's Map.
class Handle{
 constructor(name,kind='directory',bytes=new Uint8Array()){this.name=name;this.kind=kind;this.bytes=bytes;this.children=new Map();}
 async *values(){yield* this.children.values();} async *entries(){yield* this.children;}
 async getDirectoryHandle(name,{create=false}={}){return this.child(name,'directory',create);}
 async getFileHandle(name,{create=false}={}){return this.child(name,'file',create);}
 child(name,kind,create){if(!this.children.has(name)){if(!create)throw new DOMException('Missing','NotFoundError');this.children.set(name,new Handle(name,kind));}return this.children.get(name);}
 async getFile(){return {size:this.bytes.length,lastModified:1,arrayBuffer:async()=>this.bytes.buffer};}
 async createWritable(){return {write:async b=>{this.bytes=b.slice();},close:async()=>{},abort:async()=>{}};}
}
const handle=new Handle('Native Mod'),native=createScenerySession({mod:handle});
assert.equal(native.config.webDownloadOnly,false);await native.write('/mod/data/Test.txt',new Uint8Array([8,9]));assert.equal((await native.list('/mod/data'))[0].name,'Test.txt');assert.deepEqual(await native.read('/MOD/DATA/test.TXT'),new Uint8Array([8,9]));
await native.saveWithBackup({files:[{path:'/mod/data/Test.txt',data:new Uint8Array([3])}],backupRoot:'/mod/backups/test',relBase:'/mod'});
assert.deepEqual(await native.read('/mod/backups/test/data/test.txt'),new Uint8Array([8,9]));assert.equal(native.pending.size,0);
console.log('PASS browser folder import, native handles, case-insensitive paths, local writes/backups, ZIP change buffer and path boundaries');
