import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Minimize2, Maximize2 } from 'lucide-react';

const DISPLAY_SCALE = 2;

export default function ImageCropModal({ open, onClose, onConfirm, sourceDataUrl, targetW, targetH, slotLabel }) {
  const canvasRef = useRef();
  const imgRef = useRef(null);
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef(null);

  const cW = targetW * DISPLAY_SCALE;
  const cH = targetH * DISPLAY_SCALE;

  useEffect(() => {
    if (!sourceDataUrl) return;
    const img = new window.Image();
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.width, h: img.height });
      const s = Math.min(targetW / img.width, targetH / img.height);
      setScale(s);
      setOffset({ x: (targetW - img.width * s) / 2, y: (targetH - img.height * s) / 2 });
    };
    img.src = sourceDataUrl;
  }, [sourceDataUrl, targetW, targetH]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, cW, cH);
    for (let y = 0; y < cH; y += 10) for (let x = 0; x < cW; x += 10) {
      ctx.fillStyle = ((Math.floor(x / 10) + Math.floor(y / 10)) % 2 === 0) ? '#2a2a2a' : '#333';
      ctx.fillRect(x, y, 10, 10);
    }
    if (imgRef.current) {
      ctx.drawImage(
        imgRef.current,
        offset.x * DISPLAY_SCALE,
        offset.y * DISPLAY_SCALE,
        imgRef.current.width * scale * DISPLAY_SCALE,
        imgRef.current.height * scale * DISPLAY_SCALE
      );
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, cW, cH);
  }, [scale, offset, cW, cH, imgSize]);

  const handleFit = () => {
    const s = Math.min(targetW / imgSize.w, targetH / imgSize.h);
    setScale(s);
    setOffset({ x: (targetW - imgSize.w * s) / 2, y: (targetH - imgSize.h * s) / 2 });
  };
  const handleFill = () => {
    const s = Math.max(targetW / imgSize.w, targetH / imgSize.h);
    setScale(s);
    setOffset({ x: (targetW - imgSize.w * s) / 2, y: (targetH - imgSize.h * s) / 2 });
  };

  const onMouseDown = (e) => {
    setDragging(true);
    dragStart.current = { mx: e.clientX, ox: offset.x, oy: offset.y, my: e.clientY };
  };
  const onMouseMove = (e) => {
    if (!dragging || !dragStart.current) return;
    const dx = (e.clientX - dragStart.current.mx) / DISPLAY_SCALE;
    const dy = (e.clientY - dragStart.current.my) / DISPLAY_SCALE;
    setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
  };
  const onMouseUp = () => { setDragging(false); dragStart.current = null; };

  const onWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    setScale(s => Math.max(0.05, Math.min(10, s * factor)));
  };

  const handleConfirm = () => {
    const off = document.createElement('canvas');
    off.width = targetW; off.height = targetH;
    const ctx = off.getContext('2d');
    if (imgRef.current) {
      ctx.drawImage(imgRef.current, offset.x, offset.y, imgSize.w * scale, imgSize.h * scale);
    }
    const dataUrl = off.toDataURL('image/png');
    onConfirm(dataUrl, off);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">
            Edit Image — {slotLabel} ({targetW}×{targetH} px)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <canvas
            ref={canvasRef}
            width={cW}
            height={cH}
            style={{ width: '100%', aspectRatio: `${cW} / ${cH}`, cursor: dragging ? 'grabbing' : 'grab', display: 'block', margin: '0 auto', borderRadius: 4 }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
          />
          <div className="flex items-center gap-3 px-1">
            <span className="text-[11px] text-muted-foreground w-10 shrink-0">Zoom</span>
            <Slider
              value={[Math.round(scale * 100)]}
              onValueChange={([v]) => setScale(v / 100)}
              min={5} max={500} step={1}
              className="flex-1"
            />
            <span className="text-[11px] text-muted-foreground w-12 text-right shrink-0">{Math.round(scale * 100)}%</span>
          </div>
          <div className="flex gap-2 px-1">
            <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={handleFit}>
              <Minimize2 className="w-3 h-3 mr-1" /> Fit
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={handleFill}>
              <Maximize2 className="w-3 h-3 mr-1" /> Fill
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center">Drag to reposition · Scroll or slider to zoom</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleConfirm}>Apply</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}