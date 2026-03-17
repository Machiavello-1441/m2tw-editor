import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Globe, Save, Loader2, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

const EVENT_TYPES = ['historic', 'counter', 'emergent_faction', 'earthquake', 'volcano', 'flood', 'storm', 'horde', 'dustbowl', 'locusts', 'plague'];
const SEASONS = ['summer', 'winter', 'none'];

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-slate-400 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function HistoricEventRow({ event, onDelete, onEdit }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...event });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.HistoricEvent.update(event.id, form);
    setSaving(false);
    onEdit({ ...event, ...form });
  };

  return (
    <div className="border border-slate-700 rounded mb-1 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/60 cursor-pointer" onClick={() => setOpen(o => !o)}>
        {open ? <ChevronDown className="w-3 h-3 text-slate-400" /> : <ChevronRight className="w-3 h-3 text-slate-400" />}
        <span className="text-[10px] text-slate-400 font-mono w-10">{form.date1}</span>
        <span className="text-xs text-slate-200 flex-1 truncate">{form.title || form.event_type}</span>
        <span className="text-[10px] text-slate-500 bg-slate-700 px-1.5 py-0.5 rounded">{form.event_type}</span>
        <button onClick={e => { e.stopPropagation(); onDelete(event.id); }} className="text-slate-600 hover:text-red-400">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {open && (
        <div className="p-3 bg-slate-900 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Type">
              <select value={form.event_type} onChange={e => set('event_type', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200">
                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Date (year)">
              <input type="number" value={form.date1 ?? 0} onChange={e => set('date1', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
            </Field>
          </div>
          <Field label="Title">
            <input value={form.title || ''} onChange={e => set('title', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
          </Field>
          <Field label="Body">
            <textarea value={form.body || ''} onChange={e => set('body', e.target.value)} rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 resize-none" />
          </Field>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1 px-3 py-1 rounded bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/80 disabled:opacity-50">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </button>
        </div>
      )}
    </div>
  );
}

export default function CampaignSettings() {
  const [campaign, setCampaign] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.CampaignData.list(),
      base44.entities.HistoricEvent.list('-date1', 200),
    ]).then(([camps, evts]) => {
      const c = camps[0] || null;
      setCampaign(c);
      setForm(c || {
        name: 'imperial_campaign',
        start_year: 1080,
        start_season: 'summer',
        end_year: 1530,
        end_season: 'winter',
        timescale: 0.5,
        brigand_spawn: 15,
        pirate_spawn: 10,
        free_upkeep: false,
        free_upkeep_value: 0,
      });
      setEvents(evts.sort((a, b) => (a.date1 || 0) - (b.date1 || 0)));
      setLoading(false);
    });
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    if (campaign?.id) {
      await base44.entities.CampaignData.update(campaign.id, form);
    } else {
      const created = await base44.entities.CampaignData.create(form);
      setCampaign(created);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAddEvent = async () => {
    const ev = await base44.entities.HistoricEvent.create({ event_type: 'historic', date1: 1080, title: 'New Event' });
    setEvents(prev => [ev, ...prev]);
  };

  const handleDeleteEvent = async (id) => {
    await base44.entities.HistoricEvent.delete(id);
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const handleEditEvent = (updated) => {
    setEvents(prev => prev.map(e => e.id === updated.id ? updated : e).sort((a, b) => (a.date1 || 0) - (b.date1 || 0)));
  };

  if (loading) {
    return (
      <div className="dark h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="dark h-screen flex flex-col bg-slate-950 text-slate-200">
      <div className="h-9 border-b border-slate-800 flex items-center px-3 gap-2 shrink-0 bg-slate-900/80">
        <Globe className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold">Campaign Settings</span>
        {!campaign && <span className="text-[10px] text-amber-400">No campaign in DB — import a folder first</span>}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Settings form */}
        <div className="w-80 border-r border-slate-800 flex flex-col shrink-0 overflow-y-auto p-4 gap-4">
          <div className="text-xs font-semibold text-slate-300 border-b border-slate-800 pb-2">Global Parameters</div>

          <Field label="Campaign Name">
            <input value={form.name || ''} onChange={e => set('name', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Year">
              <input type="number" value={form.start_year ?? 1080} onChange={e => set('start_year', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
            </Field>
            <Field label="Start Season">
              <select value={form.start_season || 'summer'} onChange={e => set('start_season', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200">
                {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="End Year">
              <input type="number" value={form.end_year ?? 1530} onChange={e => set('end_year', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
            </Field>
            <Field label="End Season">
              <select value={form.end_season || 'winter'} onChange={e => set('end_season', e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200">
                {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Timescale (turns/year)">
            <input type="number" step="0.1" value={form.timescale ?? 0.5} onChange={e => set('timescale', Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Brigand Spawn">
              <input type="number" value={form.brigand_spawn ?? 15} onChange={e => set('brigand_spawn', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
            </Field>
            <Field label="Pirate Spawn">
              <input type="number" value={form.pirate_spawn ?? 10} onChange={e => set('pirate_spawn', Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
            </Field>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input type="checkbox" checked={!!form.free_upkeep} onChange={e => set('free_upkeep', e.target.checked)}
                className="w-3.5 h-3.5 accent-primary" />
              Free Upkeep
            </label>
            {form.free_upkeep && (
              <Field label="Free Upkeep Value">
                <input type="number" value={form.free_upkeep_value ?? 0} onChange={e => set('free_upkeep_value', Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200" />
              </Field>
            )}
          </div>

          <Field label="Script File">
            <input value={form.script_file || ''} onChange={e => set('script_file', e.target.value)}
              placeholder="data/scripts/…"
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-600" />
          </Field>

          <button
            onClick={handleSave}
            disabled={saving}
            className={`w-full flex items-center justify-center gap-2 py-2 rounded text-xs font-semibold transition-colors ${
              saved ? 'bg-green-700 text-white' : 'bg-primary text-primary-foreground hover:bg-primary/80'
            } disabled:opacity-50`}
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>

        {/* Historic events */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 shrink-0">
            <div>
              <span className="text-xs font-semibold text-slate-300">Historic Events</span>
              <span className="text-[10px] text-slate-500 ml-2">({events.length} events)</span>
            </div>
            <button onClick={handleAddEvent}
              className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:bg-slate-700 transition-colors">
              <Plus className="w-3 h-3" /> Add Event
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {events.length === 0 && (
              <div className="text-center py-12 text-xs text-slate-500">
                No events yet. Import a campaign or click Add Event.
              </div>
            )}
            {events.map(ev => (
              <HistoricEventRow
                key={ev.id}
                event={ev}
                onDelete={handleDeleteEvent}
                onEdit={handleEditEvent}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}