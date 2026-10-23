import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/agent";
import { PageTitle, Panel, Results, useAction, ErrorLine, DryRun } from "@/components/console";

export const Route = createFileRoute("/usuarios")({
  head: () => ({ meta: [
    { title: "Usuários — Samba AD Console" },
    { name: "description", content: "Criar, habilitar, desabilitar e redefinir senhas de usuários do AD." },
    { property: "og:title", content: "Usuários — Samba AD Console" },
    { property: "og:description", content: "Gerenciar usuários do Active Directory." },
  ] }),
  component: Page,
});

function Page() {
  const [items, setItems] = useState<string[]>([]);
  const [f, setF] = useState({ username: "", password: "", given: "", surname: "" });
  const [dry, setDry] = useState(true);
  const act = useAction();
  const load = () => api<{ items: string[] }>("/api/users").then((r) => setItems(r.items)).catch(() => {});
  useEffect(() => { load(); }, []);
  const after = async (p: Promise<any>) => { const r = await p; load(); return r; };

  return (
    <>
      <PageTitle title="Usuários" sub="samba-tool user — listagem e operações." />
      <Panel title="novo usuário" actions={<DryRun value={dry} onChange={setDry} />}>
        <div className="grid gap-3 md:grid-cols-4">
          {(["username", "password", "given", "surname"] as const).map((k) => (
            <div key={k}><label className="label">{{ username: "login", password: "senha", given: "nome", surname: "sobrenome" }[k]}</label>
              <input type={k === "password" ? "password" : "text"} className="field" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
          ))}
        </div>
        <button className="btn mt-4" disabled={act.busy || !f.username || !f.password} onClick={() => act.go(() => after(api("/api/users", { method: "POST", body: { ...f, dry_run: dry } })))}>Criar</button>
        <ErrorLine msg={act.error} />
        <Results items={act.results} />
      </Panel>
      <div className="mt-4">
        <Panel title={`usuários (${items.length})`}>
          <ul className="divide-y divide-border">
            {items.map((u) => (
              <li key={u} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-mono text-sm">{u}</span>
                <div className="flex gap-2">
                  <button className="btn-ghost" onClick={() => { const p = prompt(`Nova senha para ${u}`); if (p) act.go(() => api(`/api/users/${u}/password`, { method: "POST", body: { password: p, dry_run: dry } })); }}>Senha</button>
                  <button className="btn-ghost" onClick={() => act.go(() => api(`/api/users/${u}/enable?dry_run=${dry}`, { method: "POST" }))}>Habilitar</button>
                  <button className="btn-ghost" onClick={() => act.go(() => api(`/api/users/${u}/disable?dry_run=${dry}`, { method: "POST" }))}>Desabilitar</button>
                  <button className="btn-danger" onClick={() => confirm(`Excluir ${u}?`) && act.go(() => after(api(`/api/users/${u}/delete?dry_run=${dry}`, { method: "POST" })))}>Excluir</button>
                </div>
              </li>
            ))}
            {!items.length && <li className="py-2 text-sm text-muted-foreground">Nenhum usuário carregado.</li>}
          </ul>
        </Panel>
      </div>
    </>
  );
}
