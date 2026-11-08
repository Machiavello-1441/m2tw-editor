/** Resize outside ResizeObserver delivery, once per actual container size. */
export default function observePaintCanvasSize(map, canvasRef, drawRef) {
  const container = map.getContainer();
  let frame = null, width = -1, height = -1, stopped = false;
  const redraw = () => drawRef.current?.();
  const resize = () => {
    frame = null;
    if (stopped) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const nextWidth = container.clientWidth, nextHeight = container.clientHeight;
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth; height = nextHeight;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    if (width > 0 && height > 0) map.invalidateSize({ animate: false });
    redraw();
  };
  const schedule = () => {
    if (!stopped && frame === null) frame = requestAnimationFrame(resize);
  };
  const observer = new ResizeObserver(schedule);
  observer.observe(container);
  map.on('resize', schedule);
  map.on('move zoom', redraw);
  schedule();
  return () => {
    stopped = true;
    observer.disconnect();
    map.off('resize', schedule);
    map.off('move zoom', redraw);
    if (frame !== null) cancelAnimationFrame(frame);
  };
}