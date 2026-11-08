import { persistCampaignRecovery } from '@/components/map/campaignRecoveryStore';

/** One serialized writer, a short debounce and a maximum wait during continuous edits. */
export default class CampaignRecoveryController {
  constructor(current, notify) {
    this.current = current; this.notify = notify;
    this.revision = 0; this.durable = 0; this.previous = null;
    this.timer = null; this.running = null; this.since = 0; this.skipNext = false;
    this.status = { pending: false, savedAt: null, error: '' };
  }
  updateStatus(next) {
    const previous = this.status;
    if (previous.pending === next.pending && previous.savedAt === next.savedAt && previous.error === next.error) return;
    // Update before dispatch: a status render must not dispatch the same status again.
    this.status = next;
    this.notify(next);
  }
  pause() { clearTimeout(this.timer); this.timer = null; }
  changed() {
    const current = this.current();
    this.pause();
    if (!current.enabled || !current.ready) return;
    if (this.skipNext) { this.skipNext = false; return; }
    this.revision++;
    this.since ||= Date.now();
    this.timer = setTimeout(() => this.flush(), Math.min(600, Math.max(0, 2000 - (Date.now() - this.since))));
    this.updateStatus({ ...this.status, pending: true });
  }
  async flush() {
    this.pause();
    if (this.running) {
      const ok = await this.running;
      return ok && this.revision > this.durable ? this.flush() : ok;
    }
    if (this.revision <= this.durable || !this.current().ready) return true;
    const { library, id, snapshot } = this.current(), revision = this.revision;
    this.since = 0;
    this.running = (async () => {
      try {
        this.previous = await persistCampaignRecovery(library, id, snapshot, this.previous);
        this.durable = revision;
        this.updateStatus({ pending: this.revision > this.durable, savedAt: this.previous.recoveryAt, error: '' });
        return true;
      } catch (error) {
        this.updateStatus({ ...this.status, pending: true, error: `Auto-save failed: ${error.message}. Retrying in the background. Keep this tab open and export your work if this continues.` });
        return false;
      } finally { this.running = null; }
    })();
    return this.running;
  }
  committed() {
    this.pause(); this.previous = null; this.durable = this.revision; this.skipNext = true;
    this.updateStatus({ pending: false, savedAt: Date.now(), error: '' });
  }
}