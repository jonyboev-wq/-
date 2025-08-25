import React, { useEffect, useMemo, useRef, useState } from "react";
import { contours as d3Contours } from "d3-contour";

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function niceMin(val, step) { return Math.floor(val / step) * step; }
function niceMax(val, step) { return Math.ceil(val / step) * step; }
function linScale(domainMin, domainMax, rangeMin, rangeMax) {
  const d = domainMax - domainMin;
  const r = rangeMax - rangeMin;
  return (v) => rangeMin + ((v - domainMin) * r) / (d === 0 ? 1 : d);
}
function formatNum(n) {
  if (Math.abs(n) >= 1000 || Math.abs(n) < 0.01) return n.toExponential(2);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}
function parsePoints(text) {
  const lines = text.replace(/\r/g, "\n").split(/\n+/).map(s=>s.trim()).filter(Boolean);
  if (!lines.length) return [];
  let header = false;
  if (/x.*y.*z/i.test(lines[0])) header = true;
  const pts = [];
  for (let i = header ? 1 : 0; i < lines.length; i++) {
    const raw = lines[i].split(/[;,\t ]+/).map(s=>s.trim()).filter(Boolean);
    if (raw.length < 3) continue;
    let [x, y, z, id] = raw;
    const px = Number(x); const py = Number(y); const pz = Number(z);
    if (Number.isFinite(px) && Number.isFinite(py) && Number.isFinite(pz)) {
      pts.push({ id: id ?? String(i - (header ? 0 : -1)), x: px, y: py, z: pz });
    }
  }
  return pts;
}
function pointsToCSV(points) {
  const header = "x;y;z;id";
  const rows = points.map((p) => `${p.x};${p.y};${p.z};${p.id ?? ""}`);
  return [header, ...rows].join("\n");
}
function rasterizeIDW(points, { minX, maxX, minY, maxY }, cols, rows, power = 2, eps = 1e-6) {
  const values = new Float64Array(cols * rows);
  const w = cols;
  const h = rows;
  const dx = (maxX - minX) / (cols - 1);
  const dy = (maxY - minY) / (rows - 1);
  for (let j = 0; j < h; j++) {
    const y = minY + j * dy;
    for (let i = 0; i < w; i++) {
      const x = minX + i * dx;
      let num = 0;
      let den = 0;
      let exact = null;
      for (const p of points) {
        const ddx = x - p.x;
        const ddy = y - p.y;
        const dist2 = ddx * ddx + ddy * ddy;
        if (dist2 < eps * eps) { exact = p.z; break; }
        const wgt = 1 / Math.pow(dist2 + eps, power / 2);
        num += wgt * p.z;
        den += wgt;
      }
      values[j * w + i] = exact !== null ? exact : (den > 0 ? num / den : NaN);
    }
  }
  return { values, cols, rows };
}
function buildThresholds(minZ, maxZ, step) {
  if (!Number.isFinite(step) || step <= 0) return [];
  const start = niceMin(minZ, step);
  const end = niceMax(maxZ, step);
  const arr = [];
  for (let v = start; v <= end; v += step) arr.push(Number(v.toFixed(6)));
  return arr;
}
function TopoEditor() {
  const EXAMPLE_CSV = `x;y;z;id
0;0;120;P1
50;0;121;P2
100;0;122;P3
150;0;122.5;P4
200;0;123;P5
0;50;119;P6
50;50;120.5;P7
100;50;121;P8
150;50;122;P9
200;50;123;P10
0;100;118;P11
50;100;119.5;P12
100;100;120.5;P13
150;100;121.5;P14
200;100;122.5;P15
0;150;117.5;P16
50;150;118.5;P17
100;150;119.5;P18
150;150;120.5;P19
200;150;121.5;P20
0;200;117;P21
50;200;117.5;P22
100;200;118.5;P23
150;200;119.5;P24
200;200;120;P25`;

  const [csv, setCsv] = useState(EXAMPLE_CSV);
  const [points, setPoints] = useState(() => parsePoints(EXAMPLE_CSV));
  const [swapXY, setSwapXY] = useState(false);
  const [invertY, setInvertY] = useState(true);
  const [gridSpacing, setGridSpacing] = useState(25);
  const [showGrid, setShowGrid] = useState(true);
  const [showPoints, setShowPoints] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [cols, setCols] = useState(120);
  const [rows, setRows] = useState(120);
  const [idwPower, setIdwPower] = useState(2);
  const [contourStep, setContourStep] = useState(0.5);
  const [majorEvery, setMajorEvery] = useState(5);
  const [width, setWidth] = useState(1100);
  const [height, setHeight] = useState(720);
  const svgRef = useRef(null);

  const pts = useMemo(() => points.map(p => swapXY ? ({...p, x: p.y, y: p.x}) : p), [points, swapXY]);

  const domain = useMemo(() => {
    if (!pts.length) return {minX:0,maxX:1,minY:0,maxY:1};
    const xs = pts.map(p=>p.x), ys = pts.map(p=>p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const padX = (maxX - minX) * 0.1 || 1;
    const padY = (maxY - minY) * 0.1 || 1;
    return { minX: minX - padX, maxX: maxX + padX, minY: minY - padY, maxY: maxY + padY };
  }, [pts]);
  const zstats = useMemo(() => {
    if (!pts.length) return {minZ:0,maxZ:1};
    const zs = pts.map(p=>p.z);
    return { minZ: Math.min(...zs), maxZ: Math.max(...zs) };
  }, [pts]);

  const raster = useMemo(()=>rasterizeIDW(pts, domain, cols, rows, idwPower), [pts, domain, cols, rows, idwPower]);
  const thresholds = useMemo(()=>buildThresholds(zstats.minZ, zstats.maxZ, contourStep), [zstats, contourStep]);
  const d3c = useMemo(()=>{
    if (!raster || !raster.values || !thresholds.length) return [];
    const gen = d3Contours().size([raster.cols, raster.rows]).smooth(true).thresholds(thresholds);
    return gen(raster.values);
  }, [raster, thresholds]);

  const pad = 60;
  const X = linScale(domain.minX, domain.maxX, pad, width - pad);
  const Ybase = linScale(domain.minY, domain.maxY, height - pad, pad);
  const Yinv = linScale(domain.minY, domain.maxY, pad, height - pad);
  const toScreen = (x,y)=>({ X: X(x), Y: (invertY ? Ybase(y) : Yinv(y)) });

  const gridLines = useMemo(()=>{
    if (!showGrid || gridSpacing <= 0) return { xs: [], ys: [] };
    const xs = [], ys = [];
    const x0 = niceMin(domain.minX, gridSpacing);
    const x1 = niceMax(domain.maxX, gridSpacing);
    const y0 = niceMin(domain.minY, gridSpacing);
    const y1 = niceMax(domain.maxY, gridSpacing);
    for (let x=x0; x<=x1+1e-9; x+=gridSpacing) xs.push(x);
    for (let y=y0; y<=y1+1e-9; y+=gridSpacing) ys.push(y);
    return { xs, ys };
  }, [domain, gridSpacing, showGrid]);

  const gridToDomain = (gx, gy) => {
    const x = domain.minX + (gx / (cols - 1)) * (domain.maxX - domain.minX);
    const y = domain.minY + (gy / (rows - 1)) * (domain.maxY - domain.minY);
    return { x, y };
  };
  const majorLevels = useMemo(()=>{
    if (!thresholds.length) return new Set();
    const set = new Set();
    thresholds.forEach((t,i)=>{ if (i % majorEvery === 0) set.add(t); });
    thresholds.forEach((t)=>{ if (Math.abs(t - Math.round(t)) < 1e-6) set.add(t); });
    return set;
  }, [thresholds, majorEvery]);

  const ringToPath = (ring) => {
    let d = "";
    for (let i=0;i<ring.length;i++) {
      const [gx,gy] = ring[i];
      const { x, y } = gridToDomain(gx, gy);
      const { X: sx, Y: sy } = toScreen(x, y);
      d += (i===0 ? `M ${sx} ${sy}` : ` L ${sx} ${sy}`);
    }
    return d + " Z";
  };

  const onSvgClick = (e) => {
    if (!svgRef.current) return;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return;
    const inv = ctm.inverse();
    const sp = pt.matrixTransform(inv);
    const x = domain.minX + ((sp.x - pad) / (width - 2 * pad)) * (domain.maxX - domain.minX);
    const yScreen = domain.minY + ((sp.y - pad) / (height - 2 * pad)) * (domain.maxY - domain.minY);
    const y = invertY ? (domain.maxY - (yScreen - domain.minY)) : yScreen;
    const zStr = prompt("Высота точки (z):", "0");
    if (zStr === null) return;
    const z = Number(zStr);
    if (!Number.isFinite(z)) return alert("Нужно число.");
    const id = `P${points.length + 1}`;
    const newPoint = swapXY ? { id, x: y, y: x, z } : { id, x, y, z };
    const next = [...points, newPoint];
    setPoints(next);
    setCsv(pointsToCSV(next));
  };

  const onFile = (file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || "");
      setCsv(text);
      setPoints(parsePoints(text));
    };
    reader.readAsText(file);
  };
  const clearPoints = () => {
    if (confirm("Удалить все точки?")) {
      setPoints([]);
      setCsv("x;y;z;id\n");
    }
  };
  useEffect(()=>{
    const onResize = () => {
      const maxW = Math.min(1400, Math.max(900, window.innerWidth - 420));
      setWidth(maxW);
      setHeight(Math.max(560, Math.min(950, Math.floor(maxW * 0.65))));
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const downloadSVG = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "topoplan.svg";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  // --- A2 export (594 x 420 mm). Scale 1:200 if fits; otherwise scale down to fit.
  const exportA2 = () => {
    // margins in mm
    const margin = 10;
    const pageWmm = 594; const pageHmm = 420; // landscape A2
    const plotWmm = pageWmm - 2*margin;
    const plotHmm = pageHmm - 2*margin;

    // Desired mm per domain unit at 1:200. Assuming domain units = meters.
    const mmPerMeter_1_200 = 1000 / 200; // 5 mm per 1 m
    const domainWm = (domain.maxX - domain.minX);
    const domainHm = (domain.maxY - domain.minY);

    let desiredWmm = domainWm * mmPerMeter_1_200;
    let desiredHmm = domainHm * mmPerMeter_1_200;
    let scale = 1.0; // multiplier over 1:200 mm/m
    // Fit if necessary:
    const sx = plotWmm / desiredWmm;
    const sy = plotHmm / desiredHmm;
    const fit = Math.min(sx, sy);
    if (fit < 1) {
      // Not fitting at 1:200 -> scale everything by fit (actual is smaller => scale is <1)
      scale = fit;
      desiredWmm *= fit;
      desiredHmm *= fit;
    }

    // Build an SVG string sized in mm with a viewBox in mm coordinates.
    // We'll render contours anew with coordinates mapped to mm.
    const mmX = linScale(domain.minX, domain.maxX, margin, margin + desiredWmm);
    // Y up in geodetic -> page Y down; we flip so that increasing Y goes up on paper:
    const mmY_up = linScale(domain.minY, domain.maxY, margin + desiredHmm, margin);

    // Helpers to rebuild paths in mm coordinates
    const contours = d3Contours().size([raster.cols, raster.rows]).smooth(true).thresholds(thresholds)(raster.values);
    const gridToDomainLocal = (gx, gy) => {
      const x = domain.minX + (gx / (cols - 1)) * (domain.maxX - domain.minX);
      const y = domain.minY + (gy / (rows - 1)) * (domain.maxY - domain.minY);
      return { x, y };
    };
    const ringToD_mm = (ring) => {
      let d = "";
      for (let i=0;i<ring.length;i++) {
        const [gx,gy] = ring[i];
        const { x, y } = gridToDomainLocal(gx, gy);
        const Xmm = mmX(x), Ymm = mmY_up(y);
        d += (i===0 ? `M ${Xmm} ${Ymm}` : ` L ${Xmm} ${Ymm}`);
      }
      return d + " Z";
    };

    const isMajor = (val) => {
      const idx = thresholds.findIndex(t => Math.abs(t - val) < 1e-9);
      if (idx === -1) return false;
      return (idx % majorEvery) === 0 || Math.abs(val - Math.round(val)) < 1e-6;
    };

    // Build grid lines in mm
    const gxs = []; const gys = [];
    const x0 = niceMin(domain.minX, gridSpacing);
    const x1 = niceMax(domain.maxX, gridSpacing);
    const y0 = niceMin(domain.minY, gridSpacing);
    const y1 = niceMax(domain.maxY, gridSpacing);
    for (let x=x0;x<=x1+1e-9;x+=gridSpacing) gxs.push(x);
    for (let y=y0;y<=y1+1e-9;y+=gridSpacing) gys.push(y);

    let svg = [];
    svg.push(`<?xml version="1.0" encoding="UTF-8"?>`);
    svg.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${pageWmm}mm" height="${pageHmm}mm" viewBox="0 0 ${pageWmm} ${pageHmm}">`);
    svg.push(`<rect x="0" y="0" width="${pageWmm}" height="${pageHmm}" fill="white"/>`);
    // Title block + scale info
    const scaleText = scale >= 0.999 ? "1:200" : `~1:${intOrFixed(200/scale)}`;
    svg.push(`<text x="${margin}" y="${pageHmm - margin/2}" font-family="sans-serif" font-size="6">Масштаб ${scaleText} • A2 ${pageWmm}×${pageHmm} мм</text>`);

    // Plot frame
    svg.push(`<rect x="${margin}" y="${margin}" width="${desiredWmm}" height="${desiredHmm}" fill="white" stroke="#E5E7EB"/>`);

    // Grid
    for (const xv of gxs) {
      const xmm = mmX(xv);
      svg.push(`<line x1="${xmm}" y1="${margin}" x2="${xmm}" y2="${margin+desiredHmm}" stroke="#F1F5F9" stroke-width="0.2"/>`);
      svg.push(`<text x="${xmm}" y="${margin+desiredHmm+4}" font-size="3" text-anchor="middle" fill="#475569" font-family="sans-serif">${escapeXml(formatNum(xv))}</text>`);
    }
    for (const yv of gys) {
      const ymm = mmY_up(yv);
      svg.push(`<line x1="${margin}" y1="${ymm}" x2="${margin+desiredWmm}" y2="${ymm}" stroke="#F1F5F9" stroke-width="0.2"/>`);
      svg.push(`<text x="${margin-1}" y="${ymm+1}" font-size="3" text-anchor="end" fill="#475569" font-family="sans-serif">${escapeXml(formatNum(yv))}</text>`);
    }

    // Contours
    contours.forEach((cont, idx)=>{
      const stroke = isMajor(cont.value) ? "#334155" : "#64748b";
      const sw = isMajor(cont.value) ? 0.4 : 0.25; // in mm approx
      cont.coordinates.forEach((poly, pi)=>{
        const pathD = poly.map(ringToD_mm).join(" ");
        svg.push(`<path d="${pathD}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`);
      });
      // label
      const ring = cont.coordinates[0]?.[0];
      if (ring && ring.length>2) {
        const mid = ring[Math.floor(ring.length/2)];
        const { x, y } = gridToDomainLocal(mid[0], mid[1]);
        const xmm = mmX(x), ymm = mmY_up(y);
        svg.push(`<rect x="${xmm-3}" y="${ymm-2.5}" width="6" height="4" rx="1" ry="1" fill="#ffffffcc"/>`);
        svg.push(`<text x="${xmm}" y="${ymm+1}" font-size="3" text-anchor="middle" fill="#0f172a" font-family="sans-serif">${escapeXml(formatNum(cont.value))}</text>`);
      }
    });

    // Points
    pts.forEach((p)=>{
      const xmm = mmX(p.x), ymm = mmY_up(p.y);
      svg.push(`<circle cx="${xmm}" cy="${ymm}" r="1" fill="#0ea5e9" stroke="#0369a1" stroke-width="0.2"/>`);
      svg.push(`<text x="${xmm+2}" y="${ymm-2}" font-size="3" fill="#0f172a" font-family="sans-serif">${escapeXml(p.id ?? "")} <tspan fill="#475569">(${escapeXml(formatNum(p.x))}, ${escapeXml(formatNum(p.y))})</tspan> <tspan font-weight="600">${escapeXml(formatNum(p.z))}</tspan></text>`);
    });

    svg.push(`</svg>`);
    const blob = new Blob([svg.join("\n")], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "topoplan_A2.svg";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  // helpers for A2 export
  const escapeXml = (s) => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const intOrFixed = (x) => (Math.abs(x - Math.round(x)) < 1e-6 ? String(Math.round(x)) : x.toFixed(0));

  const handleCsvChange = (t) => { setCsv(t); setPoints(parsePoints(t)); };

  return (
    <div className="w-full min-h-screen flex bg-slate-50 text-slate-800">
      <div className="w-[380px] shrink-0 border-r border-slate-200 bg-white p-4 space-y-5 sticky top-0 h-screen overflow-y-auto">
        <h1 className="text-2xl font-bold">ТопоРедактор</h1>
        <p className="text-sm text-slate-500">Точки (x; y; z; id) → горизонтали. Экспорт SVG и A2 1:200.</p>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-semibold">Данные точек</label>
            <div className="flex gap-2">
              <button className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200" onClick={()=>{handleCsvChange(EXAMPLE_CSV)}}>Пример</button>
              <label className="px-2 py-1 text-xs rounded bg-slate-100 hover:bg-slate-200 cursor-pointer">
                Импорт CSV
                <input type="file" accept=".csv,.txt" className="hidden" onChange={(e)=>{ const f = e.target.files?.[0]; if (f) onFile(f); }}/>
              </label>
              <button className="px-2 py-1 text-xs rounded bg-rose-50 text-rose-700 hover:bg-rose-100" onClick={clearPoints}>Очистить</button>
            </div>
          </div>
          <textarea value={csv} onChange={(e)=>handleCsvChange(e.target.value)} className="w-full h-40 font-mono text-xs p-2 border rounded focus:outline-none focus:ring" placeholder="x;y;z;id" />
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={swapXY} onChange={(e)=>setSwapXY(e.target.checked)} /> Поменять X/Y</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={invertY} onChange={(e)=>setInvertY(e.target.checked)} /> Ось Y вверх</label>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">Сетка и точки</h2>
          <div className="grid grid-cols-2 gap-2 items-center text-sm">
            <label>Шаг сетки (м)</label>
            <input type="number" className="border rounded p-1" value={gridSpacing} onChange={(e)=>setGridSpacing(Number(e.target.value))} />
            <label>Показывать сетку</label>
            <input type="checkbox" checked={showGrid} onChange={(e)=>setShowGrid(e.target.checked)} />
            <label>Показывать точки</label>
            <input type="checkbox" checked={showPoints} onChange={(e)=>setShowPoints(e.target.checked)} />
            <label>Подписи точек</label>
            <input type="checkbox" checked={showLabels} onChange={(e)=>setShowLabels(e.target.checked)} />
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">Интерполяция (IDW) и растр</h2>
          <div className="grid grid-cols-2 gap-2 items-center text-sm">
            <label>Столбцов (cols)</label>
            <input type="range" min={40} max={240} value={cols} onChange={(e)=>setCols(Number(e.target.value))} />
            <div className="text-right text-xs text-slate-500">{cols}</div>

            <label>Строк (rows)</label>
            <input type="range" min={40} max={240} value={rows} onChange={(e)=>setRows(Number(e.target.value))} />
            <div className="text-right text-xs text-slate-500">{rows}</div>

            <label>Степень IDW</label>
            <input type="number" step="0.1" className="border rounded p-1" value={idwPower} onChange={(e)=>setIdwPower(Number(e.target.value))} />
          </div>
          <p className="text-xs text-slate-500">Больше cols/rows → детальнее, но медленнее. IDW=2 — стандартно.</p>
        </section>

        <section className="space-y-2">
          <h2 className="font-semibold">Горизонтали</h2>
          <div className="grid grid-cols-2 gap-2 items-center text-sm">
            <label>Шаг (м)</label>
            <input type="number" step="0.1" className="border rounded p-1" value={contourStep} onChange={(e)=>setContourStep(Number(e.target.value))} />
            <label>Основная через</label>
            <input type="number" className="border rounded p-1" value={majorEvery} onChange={(e)=>setMajorEvery(Number(e.target.value))} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={downloadSVG}>Скачать SVG (экран)</button>
            <button className="px-3 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700" onClick={exportA2}>SVG A2 1:200</button>
          </div>
          <p className="text-xs text-slate-500">A2 — 594×420 мм (альбомная). Если не помещается при 1:200, масштаб уменьшится с указанием фактического значения.</p>
        </section>

        <section className="space-y-1 text-xs text-slate-500">
          <p>Клик по полю добавляет точку (введите высоту).</p>
          <p>CSV можно вставлять прямо в текстовое поле.</p>
        </section>
      </div>

      <div className="flex-1 p-4 overflow-auto">
        <div className="rounded-2xl bg-white shadow-sm border border-slate-200 p-2">
          <svg ref={svgRef} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto cursor-crosshair" onClick={onSvgClick}>
            <rect x={0} y={0} width={width} height={height} fill="#fafafa" />
            <rect x={60} y={60} width={width - 120} height={height - 120} fill="#fff" stroke="#e5e7eb" />
            {showGrid && (
              <g>
                {gridLines.xs.map((xv) => {
                  const sx = X(xv);
                  return <line key={`gx-${xv}`} x1={sx} x2={sx} y1={60} y2={height - 60} stroke="#f1f5f9" />
                })}
                {gridLines.ys.map((yv) => {
                  const sy = invertY ? Ybase(yv) : Yinv(yv);
                  return <line key={`gy-${yv}`} x1={60} x2={width - 60} y1={sy} y2={sy} stroke="#f1f5f9" />
                })}
                {gridLines.xs.map((xv) => (
                  <text key={`gxl-${xv}`} x={X(xv)} y={height - 44} fontSize={10} textAnchor="middle" fill="#475569">{formatNum(xv)}</text>
                ))}
                {gridLines.ys.map((yv) => (
                  <text key={`gyl-${yv}`} x={54} y={(invertY ? Ybase(yv) : Yinv(yv)) + 3} fontSize={10} textAnchor="end" fill="#475569">{formatNum(yv)}</text>
                ))}
              </g>
            )}
            <g>
              {d3c.map((cont, idx) => {
                const isMajor = (val)=>{
                  const i = thresholds.findIndex(t=>Math.abs(t - val)<1e-9);
                  return i>=0 && (i % majorEvery === 0 || Math.abs(val - Math.round(val)) < 1e-6);
                };
                const stroke = isMajor(cont.value) ? "#334155" : "#64748b";
                const sw = isMajor(cont.value) ? 1.6 : 0.9;
                return (
                  <g key={`c-${idx}`}>
                    {cont.coordinates.map((poly, pi) => (
                      <path key={`c-${idx}-${pi}`} d={poly.map(ringToPath).join(" ")} fill="none" stroke={stroke} strokeWidth={sw} />
                    ))}
                    {cont.coordinates[0] && cont.coordinates[0][0] && (() => {
                      const ring = cont.coordinates[0][0];
                      const mid = ring[Math.floor(ring.length / 2)];
                      const { x, y } = gridToDomain(mid[0], mid[1]);
                      const { X: sx, Y: sy } = toScreen(x, y);
                      return (
                        <g key={`cl-${idx}`}>
                          <rect x={sx - 12} y={sy - 8} width={24} height={14} rx={3} ry={3} fill="#ffffffcc" />
                          <text x={sx} y={sy + 2} fontSize={10} textAnchor="middle" fill="#0f172a">{formatNum(cont.value)}</text>
                        </g>
                      );
                    })()}
                  </g>
                );
              })}
            </g>
            {showPoints && (
              <g>
                {pts.map((p, i) => {
                  const { X: sx, Y: sy } = toScreen(p.x, p.y);
                  return (
                    <g key={`pt-${i}`}>
                      <circle cx={sx} cy={sy} r={3.5} fill="#0ea5e9" stroke="#0369a1" />
                      {showLabels && (
                        <text x={sx + 6} y={sy - 6} fontSize={11} fill="#0f172a">{p.id ?? `P${i+1}`} <tspan fill="#475569">({formatNum(p.x)}, {formatNum(p.y)})</tspan> <tspan fontWeight={600}>{formatNum(p.z)}</tspan></text>
                      )}
                    </g>
                  );
                })}
              </g>
            )}
            <text x={width/2} y={height - 10} textAnchor="middle" fontSize={12} fill="#475569">X</text>
            <text x={14} y={height/2} textAnchor="middle" fontSize={12} fill="#475569" transform={`rotate(-90 14 ${height/2})`}>Y</text>
          </svg>
        </div>
        <div className="mt-3 text-xs text-slate-500 flex flex-wrap gap-4">
          <span>Точек: <b>{pts.length}</b></span>
          <span>Диапазон X: <b>{formatNum(domain.minX)}</b> … <b>{formatNum(domain.maxX)}</b></span>
          <span>Диапазон Y: <b>{formatNum(domain.minY)}</b> … <b>{formatNum(domain.maxY)}</b></span>
          <span>Высоты: <b>{formatNum(zstats.minZ)}</b> … <b>{formatNum(zstats.maxZ)}</b></span>
          <span>Горизонталей: <b>{thresholds.length}</b></span>
        </div>
      </div>
    </div>
  );
}

export default function App(){ return <TopoEditor/>; }
