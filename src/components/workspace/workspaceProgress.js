let progress = null;
export const workspaceProgressEvent = 'm2tw-folder-progress';
export const getWorkspaceProgress = () => progress;
export function setWorkspaceProgress(value) {
  progress = value;
  window.dispatchEvent(new Event(workspaceProgressEvent));
}