import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import ts from 'typescript';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=file=>fs.readFile(path.join(root,file),'utf8');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(await read('assets/manifest.json'));
const context=vm.createContext({window:{}});
for(const file of manifest.offlinePacks)vm.runInContext(await read(file),context,{timeout:5000});
const fontCss=await read('assets/offline/fonts.css');
const fontHashes=new Set([...fontCss.matchAll(/data:font\/[^;,]+;base64,([A-Za-z0-9+/=]+)/g)].map(match=>hash(Buffer.from(match[1],'base64'))));

for(const [file,info] of Object.entries(manifest.files)){
  assert.ok(file.startsWith('assets/')&&!file.split('/').includes('..'),file);
  const bytes=await fs.readFile(path.join(root,file));
  assert.equal(bytes.length,info.bytes,file+' size');
  assert.equal(hash(bytes),info.sha256,file+' original hash');
  if(file.startsWith('assets/fonts/'))assert.ok(fontHashes.has(info.sha256),file+' offline font');
  else{
    const encoded=context.window.__PRODUCT_ASSETS__[file];
    assert.ok(encoded?.startsWith('data:'),file+' offline data');
    assert.equal(hash(Buffer.from(encoded.slice(encoded.indexOf(',')+1),'base64')),info.sha256,file+' offline hash');
  }
}
vm.runInContext(await read('data/demo-content.js'),context,{timeout:5000});
function verifyContent(value){
  if(typeof value==='string'&&value.startsWith('assets/'))assert.ok(manifest.files[value],'Content image missing: '+value);
  else if(value&&typeof value==='object')Object.values(value).forEach(verifyContent);
}
verifyContent(context.window.__PRODUCT_DATA__);
const bundle=await read('runtime/product.js');
assert.ok(!/data:(?:image\/[\w.+-]+|font\/[\w.+-]+|application\/wasm|model\/gltf-binary)[;,][^"'`]{80}/.test(bundle),'Media leaked into application code');
assert.ok(!bundle.includes('/Users/')&&!bundle.includes('/private/tmp/'),'Machine-specific runtime path');
for(const file of ['styles/product.css','styles/fonts.css']){
  const css=await read(file);
  for(const match of css.matchAll(/url\((['"]?)([^)'"\s]+)\1\)/g)){
    assert.ok(!/^(https?:|data:)/.test(match[2]),'External or embedded asset in '+file);
    if(match[2].startsWith('#'))continue;
    const resolved=path.resolve(root,path.dirname(file),match[2]);
    assert.ok(resolved.startsWith(root),'CSS escapes product folder');await fs.access(resolved);
  }
}
async function scan(directory){
 for(const entry of await fs.readdir(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);if(entry.isDirectory())await scan(file);
  else if(/\.[cm]?[jt]sx?$/.test(file)){
   const source=await fs.readFile(file,'utf8');
   assert.ok(!source.includes('@threadpeak/'),'Main application dependency in '+file);
   const parsed=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
   for(const statement of parsed.statements){
    const spec=statement.moduleSpecifier?.text;if(!spec?.startsWith('.'))continue;
    const resolved=path.resolve(path.dirname(file),spec.split('?')[0]);
    assert.ok(resolved.startsWith(root),'Source import escapes product folder: '+file);
   }
  }
 }
}
await scan(path.join(root,'src'));
for (const dumped of ['assets/images/articles','assets/images/ticker','src/types.d.ts','scripts/source-provenance.json']) {
  await fs.access(path.join(root,dumped)).then(() => { throw new Error('Extra unused path remains: '+dumped); }, () => {});
}
async function assertNoJunk(directory) {
  for (const entry of await fs.readdir(directory, {withFileTypes:true})) {
    const file = path.join(directory, entry.name);
    if (entry.name === '.DS_Store') continue;
    if (entry.isDirectory() && entry.name !== 'node_modules') await assertNoJunk(file);
  }
}
await assertNoJunk(root);
const authorHashes = new Map();
for (const file of Object.keys(manifest.files).filter(name => name.startsWith('assets/images/authors/'))) {
  const digest = manifest.files[file].sha256;
  assert.ok(!authorHashes.has(digest), 'Duplicate author photo: '+file+' = '+authorHashes.get(digest));
  authorHashes.set(digest, file);
}
for (const extra of ['licenses/MaShanZheng-OFL.txt','licenses/MaShanZheng-font-OFL.txt','licenses/zod--LICENSE','licenses/Rive-MIT.txt']) {
  await fs.access(path.join(root, extra)).then(() => { throw new Error('Unused license remains: '+extra); }, () => {});
}
async function imageFiles(directory, prefix) {
  const found = [];
  for (const entry of await fs.readdir(directory, {withFileTypes:true})) {
    const name = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) found.push(...await imageFiles(path.join(directory, entry.name), name));
    else found.push(name);
  }
  return found;
}
for (const file of await imageFiles(path.join(root,'assets/images'), 'assets/images')) {
  if (file.endsWith('.DS_Store')) continue;
  assert.ok(manifest.files[file], 'Unreferenced image: '+file);
}
for (const file of Object.keys(manifest.files)) {
  assert.ok(/^[\x00-\x7F]+$/.test(file), 'Non-ASCII asset path is not portable: '+file);
}
const vendor = await fs.readFile(path.join(root,'runtime/vendor.js'));
const product = await fs.stat(path.join(root,'runtime/product.js'));
assert.ok(vendor.includes('WebGLRenderer') || vendor.includes('THREE'), 'Three.js belongs in vendor.js');
assert.ok(product.size < vendor.length, 'Application bundle must stay smaller than vendor libraries');
assert.match(await read('src/runtime/bootstrap.js'), /runtime\/vendor\.js/);
const html = await read('index.html');
assert.match(html, /href="\.\/styles\/product\.css"/);
assert.match(html, /src="\.\/runtime\/bootstrap\.js"/);
assert.ok(!/https?:\/\//i.test(html), 'index.html must open without a network URL');
assert.match(await read('runtime/bootstrap.js'), /location\.protocol === 'file:'/);
assert.match(await read('runtime/bootstrap.js'), /assets\/offline\/characters\.js/);
for (const file of ['runtime/vendor.js','runtime/product.js','data/demo-content.js','assets/offline/fonts.css','assets/offline/images.js','assets/offline/lettering.js','assets/offline/characters.js','assets/offline/models.js']) {
  await fs.access(path.join(root, file));
}
console.log(`PASS: ${Object.keys(manifest.files).length} original assets match offline copies; content, styles, source boundaries and code/asset separation verified.`);
