import { NextResponse } from "next/server";
import db from "@/lib/db";

export const dynamic = "force-dynamic";

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "diagram";
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const { rows } = await db.query("SELECT title FROM diagrams WHERE id = $1", [id]);
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const filename = toSlug(rows[0].title || "diagram");
  const svgUrl = `/d/${id}`;

  // Return a self-contained HTML page that:
  // 1. Fetches the SVG
  // 2. Renders it on a canvas at 2x
  // 3. Auto-generates PDF via jsPDF
  // 4. Downloads immediately
  const html = `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Generating PDF...</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js"><\/script>
<style>
  body { margin: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: #f8fafc; font-family: system-ui; color: #64748b; }
  .msg { text-align: center; }
  .spinner { width: 32px; height: 32px; border: 3px solid #e2e8f0; border-top-color: #3b82f6; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head><body>
<div class="msg">
  <div class="spinner"></div>
  <div id="status">Generating PDF...</div>
</div>
<script>
(async () => {
  const status = document.getElementById('status');
  try {
    // 1. Fetch SVG
    status.textContent = 'Loading diagram...';
    const res = await fetch('${svgUrl}');
    const svgText = await res.text();

    // 2. Parse dimensions
    const wM = svgText.match(/width="(\\d+(?:\\.\\d+)?)"/);
    const hM = svgText.match(/height="(\\d+(?:\\.\\d+)?)"/);
    const w = wM ? parseFloat(wM[1]) : 800;
    const h = hM ? parseFloat(hM[1]) : 600;

    // 3. Render SVG to canvas at 2x
    status.textContent = 'Rendering...';
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const img = new Image();
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);

    // 4. Generate PDF
    status.textContent = 'Creating PDF...';
    const { jsPDF } = window.jspdf;
    const orientation = w > h ? 'landscape' : 'portrait';
    const pdf = new jsPDF({ orientation, unit: 'px', format: [w, h], hotfixes: ['px_scaling'] });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    pdf.addImage(imgData, 'JPEG', 0, 0, w, h);

    // 5. Download
    pdf.save('${filename}.pdf');
    status.textContent = 'PDF downloaded!';
    setTimeout(() => { status.innerHTML = 'Done — <a href="/?id=${id}">open in editor</a>'; }, 1000);
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
  }
})();
<\/script>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
