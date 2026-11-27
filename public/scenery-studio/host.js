'use strict';
(function(){
  const session=window.parent.__SCENERY_STUDIO_SESSION__;
  if(!session)throw Error('Open Scenery Studio from the M2TW Editor navigation and choose a mod folder.');
  const read=path=>session.read(path),stat=path=>session.stat(path);
  window.host={
    checkServer:async()=>'',read,readText:async path=>new TextDecoder('windows-1252').decode(await read(path)),
    stat,statMany:paths=>Promise.all(paths.map(stat)),exists:async path=>!!await stat(path),list:session.list,
    roots:async()=>({roots:['/mod',...(session.config.gameRoot?['/game']:[]),...(session.config.libraryRoot?['/library']:[])],sep:'/'}),
    args:async()=>session.config,detectGame:async()=>[{gameDir:session.config.gameRoot,mods:[{name:session.mounts.mod.name,path:'/mod'}]}],
    catalogue:session.catalogue,loadSettings:async()=>session.loadSettings(),saveSettings:async value=>session.saveSettings(value),
    saveWithBackup:session.saveWithBackup,writeFile:session.write,appdir:async()=>({dir:'/workspace',brushes:'/workspace/brushes'}),
    removeFile:async path=>session.remove(path),showItem:async path=>window.parent.alert(path),openPath:async()=> 'Use the selected local folder to open this file.',
    copyText:text=>navigator.clipboard.writeText(text),watchFiles:async()=>{},onWatch:()=>{},shutdown:async()=>{},
  };
  window.addEventListener('load',()=>{const button=document.querySelector('#scStop');if(button)button.textContent='Save designs';});
})();
