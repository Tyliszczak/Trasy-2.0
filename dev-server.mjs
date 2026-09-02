import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {dirname,extname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=dirname(fileURLToPath(import.meta.url));
const HOST='127.0.0.1';
const PORT=Number(process.env.TRASY_DEV_PORT)||8085;
const ROUTES_URL='https://trasy.tyli.pl/trasy-data';
const MIME={
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.png':'image/png',
  '.svg':'image/svg+xml',
  '.webp':'image/webp',
  '.ico':'image/x-icon'
};

function send(response,status,body,type='text/plain; charset=utf-8'){
  response.writeHead(status,{
    'Content-Type':type,
    'Cache-Control':'no-store, max-age=0',
    'X-Content-Type-Options':'nosniff'
  });
  response.end(body);
}

async function proxyRoutes(response){
  try{
    const upstream=await fetch(ROUTES_URL,{headers:{Accept:'application/json'},cache:'no-store'});
    const body=await upstream.arrayBuffer();
    send(response,upstream.status,Buffer.from(body),'application/json; charset=utf-8');
  }catch(error){
    send(response,502,JSON.stringify({status:'error',message:String(error?.message||error)}),'application/json; charset=utf-8');
  }
}

async function staticFile(request,response){
  const url=new URL(request.url||'/',`http://${HOST}:${PORT}`);
  let pathname=decodeURIComponent(url.pathname);
  if(pathname==='/'||pathname.endsWith('/'))pathname+='index.html';
  const file=resolve(ROOT,`.${pathname}`);
  if(file!==ROOT&&!file.startsWith(ROOT+sep)){
    send(response,403,'Forbidden');
    return;
  }
  try{
    const info=await stat(file);
    if(!info.isFile())throw new Error('Not a file');
    send(response,200,await readFile(file),MIME[extname(file).toLowerCase()]||'application/octet-stream');
  }catch{
    send(response,404,'Not found');
  }
}

const server=createServer(async(request,response)=>{
  if(request.method!=='GET'){
    send(response,405,'Method not allowed');
    return;
  }
  const pathname=new URL(request.url||'/',`http://${HOST}:${PORT}`).pathname;
  if(pathname==='/trasy-data'){
    await proxyRoutes(response);
    return;
  }
  await staticFile(request,response);
});

server.listen(PORT,HOST,()=>{
  console.log(`Trasy 2.0: http://${HOST}:${PORT}`);
});
