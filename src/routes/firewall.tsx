import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/agent";
import { PageTitle, Panel, Results, useAction, ErrorLine, DryRun } from "@/components/console";

export const Route = createFileRoute("/firewall")({
  head: () => ({ meta: [
    { title: "Firewall — Samba AD Console" },
    { name: "description", content: "Abrir portas do AD sem nunca limpar as regras existentes." },
    { property: "og:title", content: "Firewall — Samba AD Console" },
    { property: "og:description", content: "Abrir portas do AD sem limpar regras existentes." },
  ] }),
  component: Page,
});

type Rule = { proto: string; port: string; label: string };

function Page() {
  const [rules, setRules] = useState<string[]>([]);
  const [rec, setRec] = useState<Rule[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState<Rule>({ proto: "tcp", port: "", label: "custom" });
  const [dry, setDry] = useState(true);
  const act = useAction();
  const key = (r: Rule) => `${r.proto}/${r.port}`;
  const load = () => api<{ rules: string[]; recommended: Rule[] }>("/api/firewall").then((r) => { setRules(r.rules); setRec(r.recommended); }).catch(() => {});
  useEffect(() => { load(); }, []);
  const open = (list: Rule[]) => act.go(async () => { const r = await api("/api/firewall", { method: "POST", body: { rules: list, dry_run: dry } }); load(); return r; });

  return (
    <>
      <PageTitle title="Firewall" sub="Somente adiciona regras (iptables -C antes de -I). Nunca executa flush, delete ou mudança de política." />
      <Panel title="portas recomendadas para AD DC" actions={<DryRun value={dry} onChange={setDry} />}>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rec.map((r) => (
            <label key={key(r)} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <input type="checkbox" className="accent-primary" checked={sel.has(key(r))} onChange={(e) => { const n = new Set(sel); e.target.checked ? n.add(key(r)) : n.delete(key(r)); setSel(n); }} />
              <span className="font-mono">{key(r)}</span><span className="text-muted-foreground">{r.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button className="btn" disabled={!sel.size} onClick={() => open(rec.filter((r) => sel.has(key(r))))}>Abrir selecionadas</button>
          <button className="btn-ghost" onClick={() => setSel(new Set(rec.map(key)))}>Selecionar todas</button>
        </div>
      </Panel>
      <div className="mt-4">
        <Panel title="porta personalizada">
          <div className="flex gap-2">
            <select className="field w-24" value={custom.proto} onChange={(e) => setCustom({ ...custom, proto: e.target.value })}><option>tcp</option><option>udp</option></select>
            <input className="field font-mono" placeholder="porta ou faixa 1000:2000" value={custom.port} onChange={(e) => setCustom({ ...custom, port: e.target.value })} />
            <button className="btn" disabled={!custom.port} onClick={() => open([custom])}>Abrir</button>
          </div>
        </Panel>
      </div>
      <ErrorLine msg={act.error} />
      <Results items={act.results} />
      <div className="mt-4">
        <Panel title="regras atuais (INPUT) — somente leitura">
          <pre className="terminal max-h-96 overflow-auto whitespace-pre-wrap">{rules.join("\n") || "—"}</pre>
        </Panel>
      </div>
    </>
  );
}
