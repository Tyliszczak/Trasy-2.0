const MAINTENANCE_HTML=`<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <meta name="theme-color" content="#181818">
  <title>Trasy 2.0 — przerwa techniczna</title>
  <style>
    *{box-sizing:border-box}
    html,body{margin:0;min-height:100%;background:#181818;color:#fff;font-family:Arial,sans-serif}
    body{min-height:100vh;display:grid;place-items:center;padding:24px}
    main{width:min(100%,560px);padding:28px 24px;border:1px solid #555;border-radius:18px;background:#222;text-align:center;box-shadow:0 14px 44px #0008}
    h1{margin:0 0 14px;color:#ccff33;font-size:28px}
    p{margin:0;color:#ddd;font-size:18px;line-height:1.5}
  </style>
</head>
<body>
  <main>
    <h1>Trasy 2.0</h1>
    <p>Aplikacja jest tymczasowo wyłączona z powodu prac technicznych.</p>
  </main>
</body>
</html>`;

export async function onRequest(context){
  const url=new URL(context.request.url);
  const isAppEntry=url.pathname==='/'||url.pathname==='/index.html';
  if(!isAppEntry)return context.next();
  return new Response(MAINTENANCE_HTML,{
    status:503,
    headers:{
      'Content-Type':'text/html; charset=utf-8',
      'Cache-Control':'no-store, max-age=0',
      'Retry-After':'300',
      'X-Robots-Tag':'noindex, nofollow',
      'X-Trasy-Maintenance':'1'
    }
  });
}
