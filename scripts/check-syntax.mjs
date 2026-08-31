import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const ignored=new Set(['.git','.wrangler','node_modules','vendor']);
function files(directory){
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry=>{
    if(ignored.has(entry.name))return[];
    const path=join(directory,entry.name);
    return entry.isDirectory()?files(path):entry.isFile()&&entry.name.endsWith('.js')?[path]:[];
  });
}
const failures=[];
for(const file of files(root)){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(result.status!==0)failures.push(`${relative(root,file)}\n${result.stderr||result.stdout}`);
}
if(failures.length){console.error(failures.join('\n'));process.exit(1)}
console.log(`Składnia poprawna: ${files(root).length} plików JavaScript.`);
