import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/agent";
import { PageTitle, Panel, Results, useAction, ErrorLine, DryRun } from "@/components/console";

export const Route = createFileRoute("/grupos")({
  head: () => ({ meta: [
    { title: "Grupos — Samba AD Console" },
    { name: "description", content: "Gerenciar grupos e membros do Active Directory." },
    { property: "og:title", content: "Grupos — Samba AD Console" },
    { property: "og:description", content: "Gerenciar grupos e membros do Active Directory." },
  ] }),
  component: Page,
});

function Page() {
  const [items, setItems] = useState<string[]>([]);
  const [sel, setSel] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [user, setUser] = useState("");
  const [dry, setDry] = useState(true);
  const act = useAction();
  const load = () => api<{ items: string[] }>("/api/groups").then((r) => setItems(r.items)).catch(() => {});
  const loadM = (g: string) => api<{ items: string[] }>(`/api/groups/${encodeURIComponent(g)}/members`).then((r) => setMembers(r.items)).catch(() => {});
  useEffect(() => { load(); }, []);

  return (
    <>
      <PageTitle title="Grupos" sub="samba-tool group — grupos e associações." />
      <Panel title="novo grupo" actions={<DryRun value={dry} onChange={setDry} />}>
        <div className="flex gap-2">
          <input className="field" placeholder="nome do grupo" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn" disabled={!name} onClick={() => act.go(async () => { const r = await api("/api/groups", { method: "POST", body: { name, dry_run: dry } }); load(); return r; })}>Criar</button>
        </div>
        <ErrorLine msg={act.error} />
        <Results items={act.results} />
      </Panel>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Panel title={`grupos (${items.length})`}>
          <ul className="max-h-96 overflow-auto">
            {items.map((g) => (
              <li key={g}><button onClick={() => { setSel(g); loadM(g); }} className={`nav-link w-full ${sel === g ? "nav-link-active" : ""}`}>{g}</button></li>
            ))}
          </ul>
        </Panel>
        <Panel title={sel ? `membros de ${sel}` : "selecione um grupo"}>
          {sel && (
            <>
              <div className="mb-3 flex gap-2">
                <input className="field" placeholder="usuário" value={user} onChange={(e) => setUser(e.target.value)} />
                <button className="btn" disabled={!user} onClick={() => act.go(async () => { const r = await api(`/api/groups/${encodeURIComponent(sel)}/members`, { method: "POST", body: { user, dry_run: dry } }); loadM(sel); return r; })}>Adicionar</button>
              </div>
              <ul className="divide-y divide-border">
                {members.map((m) => (
                  <li key={m} className="flex items-center justify-between py-2">
                    <span className="font-mono text-sm">{m}</span>
                    <button className="btn-danger" onClick={() => act.go(async () => { const r = await api(`/api/groups/${encodeURIComponent(sel)}/members`, { method: "POST", body: { user: m, remove: true, dry_run: dry } }); loadM(sel); return r; })}>Remover</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>
      </div>
    </>
  );
}
