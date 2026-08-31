(()=>{
  const supplied=window.TRASY_DEPLOYMENT_CONFIG&&typeof window.TRASY_DEPLOYMENT_CONFIG==='object'
    ?window.TRASY_DEPLOYMENT_CONFIG:{};
  const hostname=String(location.hostname||'').toLowerCase();
  const automatic=hostname==='localhost'||hostname==='127.0.0.1'||hostname==='trasy.tyli.pl'||hostname.endsWith('.pages.dev')
    ?'test':'production';
  const mode=['test','pilot','production'].includes(supplied.mode)?supplied.mode:automatic;
  const defaults={
    test:{
      appName:'Trasy 2.0 TEST',manifest:'./manifest-test.json',allowLegacySheet:false,
      allowFallbackRoutes:false,temporaryFeedbackEmail:'',showVersion:true,
      requirePlatform:true
    },
    pilot:{
      appName:'Trasy 2.0 PILOT',manifest:'./manifest-pilot.json',allowLegacySheet:false,
      allowFallbackRoutes:false,temporaryFeedbackEmail:'',showVersion:true,requirePlatform:true
    },
    production:{
      appName:'Trasy 2.0',manifest:'./manifest-production.json',allowLegacySheet:false,
      allowFallbackRoutes:false,temporaryFeedbackEmail:'',showVersion:false,requirePlatform:true
    }
  }[mode];
  const profile=Object.freeze({...defaults,...supplied,mode});
  window.__trasyDeploymentProfile=profile;
  document.documentElement.dataset.deploymentMode=mode;
  const manifest=document.querySelector('link[rel="manifest"]');
  if(manifest)manifest.href=profile.manifest;
  const version=document.getElementById('globalTestVersion');
  if(version)version.hidden=!profile.showVersion;
  document.dispatchEvent(new CustomEvent('trasy:deployment-profile-ready',{detail:profile}));
})();
