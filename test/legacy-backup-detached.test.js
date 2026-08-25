import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const LEGACY_BACKUP_SHEET=['1irLCFIje8qVU0_','uGaiFmKPpQ0INDndNs_','4UdVD1ohpI'].join('');
const LEGACY_BACKUP_DEPLOYMENT=['AKfycbzdG_','ARbbPgMdlPteqFLakZHR5EEkT4Lb3YFDbXW_','I_OyrDKo8l0_KrQLjnncxj_M9q'].join('');
const EXTENSIONS=new Set(['.js','.html','.json','.md','.txt']);
const SKIP_DIRS=new Set(['.git','node_modules','test']);

async function productionFiles(dir=ROOT){
  const entries=await readdir(dir,{withFileTypes:true});
  const files=[];
  for(const entry of entries){
    if(SKIP_DIRS.has(entry.name))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())files.push(...await productionFiles(full));
    else if(EXTENSIONS.has(path.extname(entry.name)))files.push(full);
  }
  return files;
}

test('stary projekt Apps Script kopii bezpieczeństwa jest trwale odpięty od aplikacji',async()=>{
  const offenders=[];
  for(const file of await productionFiles()){
    const source=await readFile(file,'utf8');
    if(source.includes(LEGACY_BACKUP_SHEET)||source.includes(LEGACY_BACKUP_DEPLOYMENT)){
      offenders.push(path.relative(ROOT,file));
    }
  }
  assert.deepEqual(offenders,[],`Stare źródło kopii bezpieczeństwa wróciło do aplikacji: ${offenders.join(', ')}`);
});
