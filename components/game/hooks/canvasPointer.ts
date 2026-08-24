export function canvasPointerPos(e: {
  currentTarget: { getBoundingClientRect(): DOMRect; width: number; height: number };
  clientX: number;
  clientY: number;
}) {
  const canvas = e.currentTarget;
  const r = canvas.getBoundingClientRect();
  const scaleX = canvas.width / r.width;
  const scaleY = canvas.height / r.height;
  return { x: (e.clientX - r.left) * scaleX, y: (e.clientY - r.top) * scaleY };
}
