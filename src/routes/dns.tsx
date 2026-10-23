import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/agent";
import { PageTitle, Panel, Results, useAction, ErrorLine, DryRun } from "@/components/console";

export const Route = createFileRoute("/dns")({
  head: () => ({ meta: [
    { title: "DNS — Samba AD Console" },
    { name: "description", content: "Zonas diretas e reversas e registros do DNS interno do Samba." },
    { property: "og:title", content: "DNS — Samba AD Console" },
    { property: "og:description", content: "Zonas e registros do DNS interno do Samba." },
  ] }),
  component: Page,
});

function Page() {
  const [raw, setRaw] = useState("");
  const [zone, setZone] = useState("fedora.lan");
  const [newZone, setNewZone] = useState("");
  const [rec, setRec] = useState({ name: "", rtype: "A", value: "" });
  const [dry, setDry] = useState(true);
  const act = useAction();
  const show = (p: Promise<{ raw: string; error: string }>) => p.then((r) => setRaw(r.raw || r.error)).catch((e) => setRaw(e.message));

  return (
    <>
      <PageTitle title="DNS" sub="Zona reversa é essencial para Kerberos e clientes Windows (PART 11–12)." />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="nova zona" actions={<DryRun value={dry} onChange={setDry} />}>
          <label className="label">zona (ex: 100.100.100.in-addr.arpa)</label>
          <div className="flex gap-2">
            <input className="field font-mono" value={newZone} onChange={(e) => setNewZone(e.target.value)} />
            <button className="btn" disabled={!newZone} onClick={() => act.go(() => api("/api/dns/zones", { method: "POST", body: { zone: newZone, dry_run: dry } }))}>Criar</button>
          </div>
        </Panel>
        <Panel title="novo registro">
          <div className="grid grid-cols-3 gap-2">
            <input className="field font-mono" placeholder="nome" value={rec.name} onChange={(e) => setRec({ ...rec, name: e.target.value })} />
            <select className="field" value={rec.rtype} onChange={(e) => setRec({ ...rec, rtype: e.target.value })}>
              {["A", "AAAA", "PTR", "CNAME", "TXT", "MX", "SRV"].map((t) => <option key={t}>{t}</option>)}
            </select>
            <input className="field font-mono" placeholder="valor" value={rec.value} onChange={(e) => setRec({ ...rec, value: e.target.value })} />
          </div>
          <button className="btn mt-3" disabled={!rec.name || !rec.value} onClick={() => act.go(() => api("/api/dns/records", { method: "POST", body: { zone, ...rec, dry_run: dry } }))}>Adicionar em {zone}</button>
        </Panel>
      </div>
      <ErrorLine msg={act.error} />
      <Results items={act.results} />
      <div className="mt-4">
        <Panel title="consulta" actions={
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => show(api("/api/dns/zones"))}>Listar zonas</button>
            <button className="btn-ghost" onClick={() => show(api(`/api/dns/records?zone=${encodeURIComponent(zone)}`))}>Registros</button>
          </div>}>
          <label className="label">zona ativa</label>
          <input className="field mb-3 font-mono" value={zone} onChange={(e) => setZone(e.target.value)} />
          <pre className="terminal max-h-96 overflow-auto whitespace-pre-wrap">{raw || "—"}</pre>
        </Panel>
      </div>
    </>
  );
}
