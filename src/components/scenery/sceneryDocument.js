// Bundle the editor with the app so private deployments do not need a second
// set of authenticated script requests. These are program sources, never mod data.
const sources = import.meta.glob('./editor/**/*.txt', { query: '?raw', import: 'default', eager: true });
const source = name => {
  const text = sources['./editor/' + name + '.txt'];
  if (typeof text !== 'string') throw Error('Missing bundled editor file: ' + name);
  return text;
};
export function createSceneryDocument() {
  const urls = [];
  const blob = (text, type) => { const url = URL.createObjectURL(new Blob([text], { type })); urls.push(url); return url; };
  let html = source('index.html').replace("script-src 'self'", "script-src 'self' blob:").replace("style-src 'self'", "style-src 'self' blob:");
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (_, name) => `<link rel="stylesheet" href="${blob(source(name), 'text/css')}">`);
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (_, name) => {
    let text = source(name);
    if (name === 'portable.js') text = text.replace("fetch('runtime/studio_runtime.nut')", 'Promise.resolve(new Response(' + JSON.stringify(source('runtime/studio_runtime.nut')) + '))');
    return `<script src="${blob(text, 'text/javascript')}"></script>`;
  });
  return { html, dispose: () => urls.forEach(url => URL.revokeObjectURL(url)) };
}
