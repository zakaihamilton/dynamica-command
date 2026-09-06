export class MinHeap {
  private xs = new Float64Array(64);
  private ys = new Float64Array(64);
  private gs = new Float64Array(64);
  private fs = new Float64Array(64);
  private seqs = new Float64Array(64);
  private size = 0;
  x = 0;
  y = 0;
  g = 0;
  f = 0;
  seq = 0;

  get length(): number {
    return this.size;
  }

  clear(): void {
    this.size = 0;
  }

  push(x: number, y: number, g: number, f: number, seq: number): void {
    const index = this.size;
    this.ensureCapacity(index + 1);
    this.xs[index] = x;
    this.ys[index] = y;
    this.gs[index] = g;
    this.fs[index] = f;
    this.seqs[index] = seq;
    this.size = index + 1;
    this.up(index);
  }

  pop(): boolean {
    const n = this.size;
    if (!n) return false;
    this.x = this.xs[0]!;
    this.y = this.ys[0]!;
    this.g = this.gs[0]!;
    this.f = this.fs[0]!;
    this.seq = this.seqs[0]!;
    const last = n - 1;
    if (last > 0) {
      this.xs[0] = this.xs[last]!;
      this.ys[0] = this.ys[last]!;
      this.gs[0] = this.gs[last]!;
      this.fs[0] = this.fs[last]!;
      this.seqs[0] = this.seqs[last]!;
    }
    this.size = last;
    if (last > 0) this.down(0);
    return true;
  }

  private less(i: number, j: number): boolean {
    const a = this.fs[i]!;
    const b = this.fs[j]!;
    if (a !== b) return a < b;
    return this.seqs[i]! < this.seqs[j]!;
  }

  private swap(i: number, j: number): void {
    let value = this.xs[i]!;
    this.xs[i] = this.xs[j]!;
    this.xs[j] = value;
    value = this.ys[i]!;
    this.ys[i] = this.ys[j]!;
    this.ys[j] = value;
    value = this.gs[i]!;
    this.gs[i] = this.gs[j]!;
    this.gs[j] = value;
    value = this.fs[i]!;
    this.fs[i] = this.fs[j]!;
    this.fs[j] = value;
    value = this.seqs[i]!;
    this.seqs[i] = this.seqs[j]!;
    this.seqs[j] = value;
  }

  private up(index: number): void {
    let i = index;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!this.less(i, p)) break;
      this.swap(i, p);
      i = p;
    }
  }

  private down(index: number): void {
    const n = this.size;
    let i = index;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let best = i;
      if (l < n && this.less(l, best)) best = l;
      if (r < n && this.less(r, best)) best = r;
      if (best === i) break;
      this.swap(i, best);
      i = best;
    }
  }

  private ensureCapacity(required: number): void {
    if (required <= this.fs.length) return;
    const capacity = Math.max(required, this.fs.length * 2);
    const xs = new Float64Array(capacity);
    const ys = new Float64Array(capacity);
    const gs = new Float64Array(capacity);
    const fs = new Float64Array(capacity);
    const seqs = new Float64Array(capacity);
    xs.set(this.xs);
    ys.set(this.ys);
    gs.set(this.gs);
    fs.set(this.fs);
    seqs.set(this.seqs);
    this.xs = xs;
    this.ys = ys;
    this.gs = gs;
    this.fs = fs;
    this.seqs = seqs;
  }
}
