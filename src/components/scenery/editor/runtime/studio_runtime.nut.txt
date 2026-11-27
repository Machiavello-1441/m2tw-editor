// Portable integration. This module needs M2EX's Squirrel model API.
if ("sceneryStudioPortableLoaded" in getroottable()) return
if (!("game" in getroottable()) || !("models" in ::game) || !("setOnTile" in ::game.models) || !("events" in getroottable()) || !("UI" in getroottable())) {
  println("Scenery Studio: this M2EX build does not expose the required model API.")
  return
}
::sceneryStudioPortableLoaded <- true
// Named, static campaign scenery exported by tools/scenery_editor.
// IDs are private to this module. Empty configuration does no work.
local sites=[]
foreach(site in require("scenery.sites")){
 if(site.kind=="bridge"){println("Scenery Studio: bridge installation is disabled; export the CAS for use after a replacement API is confirmed.");continue}
 sites.append(site)
}
if(sites.len()==0)return

local registered=false,failed=false,wasCampaign=false,lastTurn=null
local models=[],baseId=880000
local function refresh(){
 if(failed)return
 try{
  if(!registered){
   foreach(i,site in sites){
    local first=baseId+i*2,second=first
    if(::game.models.exists(first)||::game.models.exists(first+1))
     throw "Custom scenery model ID already in use: "+first
    if(!::game.models.add(site.primary,first,site.kind=="settlement"))throw "Could not register "+site.primary
    if(site.kind=="port"||site.kind=="fort"){
     second=first+1
     if(!::game.models.add(site.secondary,second,false))throw "Could not register "+site.secondary
    }
    models.append({x=site.x,y=site.y,first=first,second=second,kind=site.kind,primary=site.primary,secondary=site.secondary})
   }
   registered=true
  }
  foreach(m in models){
   if(!::game.models.exists(m.first)&&!::game.models.add(m.primary,m.first,m.kind=="settlement"))throw "Could not restore "+m.primary
   if(m.second!=m.first&&!::game.models.exists(m.second)&&!::game.models.add(m.secondary,m.second,false))throw "Could not restore "+m.secondary
   if(!::game.models.setOnTile(m.x,m.y,m.first,m.second))throw "Could not apply scenery at "+m.x+", "+m.y
  }
 }catch(e){
  failed=true
  println("Scenery Studio: could not apply site models: "+e)
 }
}
::events.on("campaignMapLoaded",function(){refresh()})
::UI.onFrame(function(){
 local active=(::UI.context() & ::Enum.UiContext.campaign)!=0
 if(!active){wasCampaign=false;return}
 if(!wasCampaign){refresh();wasCampaign=true}
 if(failed)return
 try{
  local campaign=::game.campaign()
  if(campaign!=null&&campaign.turnNumber!=lastTurn){
   lastTurn=campaign.turnNumber
   refresh()
  }
 }catch(e){println("Scenery Studio: campaign state unavailable: "+e);failed=true}
})
