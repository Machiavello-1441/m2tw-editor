import React, { useState } from 'react';
import { useEDB } from '../components/edb/EDBContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Download, Package, FileText, AlertCircle, CheckCircle2, Code2 } from 'lucide-react';
import JSZip from 'jszip';

function getLuaScripts() {
  try {
    const saved = localStorage.getItem('m2tw_lua_scripts');
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
}

function buildMergedLua(scripts) {
  const plugin = scripts.find(s => s.id === 'plugin');
  const imgui = scripts.filter(s => s.type === 'imgui');
  const custom = scripts.filter(s => s.type === 'custom');
  let out = plugin ? plugin.code : '';
  if (imgui.length) { out += '\n\n-- ═══ ImGUI Scripts ═══\n'; imgui.forEach(s => { out += `\n-- ${s.name}\n${s.code}`; }); }
  if (custom.length) { out += '\n\n-- ═══ Custom Scripts ═══\n'; custom.forEach(s => { out += `\n-- ${s.name}\n${s.code}`; }); }
  return out;
}
import ValidationDashboard from '../components/export/ValidationDashboard';
import TriggerValidationPanel from '../components/export/TriggerValidationPanel';

export default function Export() {
  const { edbData, exportEDB, textData, exportTextFile } = useEDB();
  const [building, setBuilding] = useState(false);
  const [done, setDone] = useState(false);

  const modName = (() => {
    try { return localStorage.getItem('m2tw_mod_name') || 'my_mod'; } catch { return 'my_mod'; }
  })();

  const handleExportZip = async () => {
    setBuilding(true);
    setDone(false);

    const zip = new JSZip();
    const dataFolder = zip.folder(`${modName}/data`);

    if (edbData) {
      const edbText = exportEDB();
      dataFolder.file('export_descr_buildings.txt', edbText);
    }

    if (textData && Object.keys(textData).length > 0) {
      const textOut = exportTextFile();
      dataFolder.folder('text').file('export_buildings.txt', textOut);
    }

    // Include Lua scripts
    const luaScripts = getLuaScripts();
    if (luaScripts.length > 0) {
      const mergedLua = buildMergedLua(luaScripts);
      zip.folder(`${modName}/eopData/eopScripts`).file('luaPluginScript.lua', mergedLua);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${modName}_data.zip`;
    a.click();
    URL.revokeObjectURL(url);

    setBuilding(false);
    setDone(true);
  };

  const hasEDB = !!edbData;
  const hasText = textData && Object.keys(textData).length > 0;
  const edbStats = edbData ? {
    buildings: edbData.buildings.length,
    levels: edbData.buildings.reduce((s, b) => s + b.levels.length, 0),
  } : null;

  return (
    <div className="h-screen flex flex-col">
      <div className="h-10 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-card/50">
        <Download className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground">Export Mod</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 max-w-2xl mx-auto space-y-5">

          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Package className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-foreground">Output path inside zip</p>
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{modName}/data/</p>
              </div>
              <p className="text-[10px] text-muted-foreground">Set mod name on the Home page</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm">Files to include in zip</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-2">
              <ExportRow
                icon={<FileText className="w-4 h-4 text-primary/70" />}
                label="export_descr_buildings.txt"
                path={`${modName}/data/`}
                status={hasEDB ? 'ready' : 'missing'}
                detail={edbStats ? `${edbStats.buildings} buildings, ${edbStats.levels} levels` : 'No EDB loaded'}
              />
              <ExportRow
                icon={<FileText className="w-4 h-4 text-chart-4/70" />}
                label="export_buildings.txt"
                path={`${modName}/data/text/`}
                status={hasText ? 'ready' : 'skip'}
                detail={hasText ? `${Object.keys(textData).length} text entries` : 'No text data — will be skipped'}
              />
            </CardContent>
          </Card>

          <ValidationDashboard edbData={edbData} />
          <TriggerValidationPanel />

          <Button
            className="w-full h-12 text-base gap-2"
            onClick={handleExportZip}
            disabled={building || !hasEDB}
          >
            {building ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Building zip…
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Download {modName}_data.zip
              </>
            )}
          </Button>

          {done && (
            <div className="flex items-center gap-2 text-green-400 text-xs justify-center">
              <CheckCircle2 className="w-4 h-4" />
              Zip downloaded! Drop the <code className="font-mono bg-accent px-1 rounded">{modName}/</code> folder into your M2TW <code className="font-mono bg-accent px-1 rounded">mods/</code> directory.
            </div>
          )}

          {!hasEDB && (
            <div className="flex items-center gap-2 text-muted-foreground text-xs justify-center">
              <AlertCircle className="w-3.5 h-3.5" />
              Load the EDB file on the Home page first to enable export.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ExportRow({ icon, label, path, status, detail }) {
  const statusStyle = { ready: 'text-green-400', skip: 'text-muted-foreground', missing: 'text-destructive' };
  const statusIcon = {
    ready:   <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />,
    skip:    <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />,
    missing: <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />,
  };
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg bg-accent/30 ${status === 'skip' ? 'opacity-50' : ''}`}>
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground font-mono">{label}</p>
        <p className="text-[10px] text-muted-foreground truncate font-mono">{path}</p>
      </div>
      <div className="text-right shrink-0">
        <div className="flex items-center gap-1 justify-end">{statusIcon[status]}</div>
        <p className={`text-[10px] mt-0.5 ${statusStyle[status]}`}>{detail}</p>
      </div>
    </div>
  );
}