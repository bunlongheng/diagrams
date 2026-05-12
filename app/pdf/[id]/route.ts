import { NextResponse } from "next/server";
import db from "@/lib/db";
import { parse, buildSvg, DEFAULT_OPTS, DEFAULT_LAYOUT } from "@/lib/svg-renderer";
import type { Opts, Layout } from "@/lib/svg-renderer";

export const dynamic = "force-dynamic";

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "diagram";
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const { rows } = await db.query("SELECT code, settings, title, created_at FROM diagrams WHERE id = $1", [id]);
  if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { code, settings, title, created_at } = rows[0];
  if (!code?.trim()) return NextResponse.json({ error: "No code" }, { status: 400 });

  const opts: Opts = { ...DEFAULT_OPTS, ...(settings?.opts ?? {}) };
  const layout: Layout = { ...DEFAULT_LAYOUT, ...(settings?.layout ?? {}) };

  const diagram = parse(code);
  const svg = buildSvg(diagram, opts, layout, created_at);
  const filename = toSlug(title || "diagram");

  // Self-contained HTML that renders SVG → canvas → PDF, auto-downloads
  const svgB64 = Buffer.from(svg).toString("base64");

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>PDF: ${esc(title || "Diagram")}</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;700;800&display=swap" rel="stylesheet">
<style>*{margin:0}body{background:#f1f5f9;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#64748b}.m{text-align:center}.s{width:36px;height:36px;border:3px solid #e2e8f0;border-top-color:#7c3aed;border-radius:50%;animation:sp .8s linear infinite;margin:0 auto 14px}@keyframes sp{to{transform:rotate(360deg)}}</style>
</head><body><div class="m"><div class="s"></div><div id="st">Generating PDF...</div></div>
<script>
function go(){
  var st=document.getElementById('st');
  try{
    var svgText=atob('${svgB64}');
    var wM=svgText.match(/width="(\\d+(?:\\.\\d+)?)"/);
    var hM=svgText.match(/height="(\\d+(?:\\.\\d+)?)"/);
    var w=wM?parseFloat(wM[1]):800;
    var h=hM?parseFloat(hM[1]):600;
    st.textContent='Rendering...';
    var s=2;
    var c=document.createElement('canvas');
    c.width=w*s;c.height=h*s;
    var ctx=c.getContext('2d');
    ctx.scale(s,s);ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);
    var img=new Image();
    var blob=new Blob([svgText],{type:'image/svg+xml;charset=utf-8'});
    var url=URL.createObjectURL(blob);
    img.onload=function(){
      ctx.drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);
      st.textContent='Creating PDF...';
      var jsPDF=window.jspdf.jsPDF;
      var orient=w>h?'landscape':'portrait';
      var pdf=new jsPDF({orientation:orient,unit:'px',format:[w,h],hotfixes:['px_scaling']});
      var d=c.toDataURL('image/jpeg',0.95);
      pdf.addImage(d,'JPEG',0,0,w,h);
      pdf.save('${filename}.pdf');
      st.textContent='Downloaded!';
      setTimeout(function(){st.innerHTML='Done. <a href="/?id=${id}" style="color:#3b82f6">Open editor</a>';},800);
    };
    img.onerror=function(){st.textContent='Error rendering SVG';};
    img.src=url;
  }catch(e){st.textContent='Error: '+e.message;}
}
var sc=document.querySelector('script[src*="jspdf"]');
if(window.jspdf){go();}else{sc.onload=go;}
</script></body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
