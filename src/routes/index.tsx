import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, type CmdResult } from "@/lib/agent";
import { PageTitle, Panel, Results, ErrorLine } from "@/components/console";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel — Samba AD Console" },
      { name: "description", content: "Estado do controlador de domínio Samba AD." },
      { property: "og:title", content: "Painel — Samba AD Console" },
      { property: "og:description", content: "Estado do controlador de domínio Samba AD." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type Status = { installed: boolean; provisioned: boolean; active: boolean; level: string; info: string };

function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <div className="panel p-4">
      <div className="label">{label}</div>
      <div className={`font-mono text-lg ${on ? "text-success" : "text-warning"}`}>{on ? "SIM" : "NÃO"}</div>
    </div>
  );
}

function Index() {
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState("");
  const [checks, setChecks] = useState<CmdResult[]>([]);
  useEffect(() => { api<Status>("/api/status").then(setS).catch((e) => setErr(e.message)); }, []);

  return (
    <>
      <PageTitle title="Painel" sub="Estado do controlador de domínio conectado ao agente." />
      {err && (
        <div className="panel p-4 text-sm">
          Não foi possível falar com o agente ({err}). <Link to="/conexao" className="text-primary underline">Configure a conexão</Link>.
        </div>
      )}
      {s && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Flag on={s.installed} label="Samba instalado" />
            <Flag on={s.provisioned} label="Domínio provisionado" />
            <Flag on={s.active} label="Serviço ativo" />
          </div>
          {!s.provisioned && (
            <div className="panel mt-4 p-4 text-sm">
              Nenhum AD encontrado neste host. <Link to="/provisionar" className="text-primary underline">Provisionar um novo domínio</Link>.
            </div>
          )}
          {s.provisioned && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Panel title="domain info"><pre className="terminal whitespace-pre-wrap">{s.info || "—"}</pre></Panel>
              <Panel title="functional level"><pre className="terminal whitespace-pre-wrap">{s.level || "—"}</pre></Panel>
            </div>
          )}
          <div className="mt-4">
            <Panel title="checklist de validação" actions={<button className="btn-ghost" onClick={() => api("/api/checks").then((r) => setChecks(r.results)).catch((e) => setErr(e.message))}>Executar</button>}>
              <p className="text-sm text-muted-foreground">testparm, dbcheck, chrony, Kerberos e registros SRV (_ldap, _kerberos, _kpasswd).</p>
              <Results items={checks} />
            </Panel>
          </div>
        </>
      )}
      <ErrorLine msg={""} />
    </>
  );
}
