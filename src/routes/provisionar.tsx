import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/agent";
import { PageTitle, Panel, Results, useAction, ErrorLine, DryRun } from "@/components/console";

export const Route = createFileRoute("/provisionar")({
  head: () => ({ meta: [
    { title: "Provisionar AD — Samba AD Console" },
    { name: "description", content: "Assistente para criar um novo domínio Samba AD DC." },
    { property: "og:title", content: "Provisionar AD — Samba AD Console" },
    { property: "og:description", content: "Assistente para criar um novo domínio Samba AD DC." },
  ] }),
  component: Page,
});

const prereqs = [
  "IPv4 estático configurado (nunca DHCP no DC)",
  "Mínimo 2 vCPU, 2 GB RAM (4 GB recomendado), 20 GB livres",
  "Hostname FQDN definido (ex: dc1.fedora.lan) — causa nº 1 de falhas",
  "SELinux em Enforcing com booleans do Samba",
  "Backup feito se o host já teve Samba/BIND (limpeza é manual)",
];

function Page() {
  const [f, setF] = useState({ hostname: "dc1.fedora.lan", realm: "FEDORA.LAN", domain: "FEDORA", admin_password: "", dns_forwarder: "8.8.8.8" });
  const [opts, setOpts] = useState({ install_packages: true, open_firewall: true });
  const [dry, setDry] = useState(true);
  const [ok, setOk] = useState<boolean[]>(prereqs.map(() => false));
  const act = useAction();

  const onHost = (h: string) => {
    const suf = h.split(".").slice(1).join(".").toUpperCase();
    setF({ ...f, hostname: h, realm: suf, domain: (suf.split(".")[0] || "").slice(0, 15) });
  };
  const fields: [keyof typeof f, string, string][] = [
    ["hostname", "hostname FQDN", "text"], ["realm", "realm (MAIÚSCULAS)", "text"], ["domain", "domínio NetBIOS", "text"],
    ["admin_password", "senha Administrator", "password"], ["dns_forwarder", "dns forwarder", "text"],
  ];

  return (
    <>
      <PageTitle title="Provisionar AD" sub="Sem AD? Crie um Samba AD DC seguindo o guia (PARTS 1–8). Comece em modo simulação." />
      <Panel title="1 · pré-requisitos">
        <ul className="space-y-2">
          {prereqs.map((p, i) => (
            <label key={p} className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-primary" checked={ok[i]} onChange={(e) => setOk(ok.map((v, j) => (j === i ? e.target.checked : v)))} />{p}
            </label>
          ))}
        </ul>
      </Panel>
      <div className="mt-4">
        <Panel title="2 · parâmetros do domínio">
          <div className="grid gap-3 md:grid-cols-2">
            {fields.map(([k, l, t]) => (
              <div key={k}><label className="label">{l}</label>
                <input type={t} className="field font-mono" value={f[k]} onChange={(e) => (k === "hostname" ? onHost(e.target.value) : setF({ ...f, [k]: e.target.value }))} /></div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-primary" checked={opts.install_packages} onChange={(e) => setOpts({ ...opts, install_packages: e.target.checked })} />instalar pacotes (dnf)</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-primary" checked={opts.open_firewall} onChange={(e) => setOpts({ ...opts, open_firewall: e.target.checked })} />abrir portas do AD (sem limpar regras)</label>
          </div>
        </Panel>
      </div>
      <div className="mt-4">
        <Panel title="3 · executar" actions={<DryRun value={dry} onChange={setDry} />}>
          <p className="text-sm text-muted-foreground">Etapas: pacotes → hostname → chrony → samba-tool domain provision (RFC2307, DNS interno) → krb5.conf → firewall → serviço samba → validação.</p>
          <button className="btn mt-4" disabled={act.busy || !f.admin_password || (!dry && ok.some((v) => !v))}
            onClick={() => (dry || confirm("Provisionar de verdade neste servidor?")) && act.go(() => api("/api/provision", { method: "POST", body: { ...f, ...opts, dry_run: dry } }))}>
            {dry ? "Gerar plano (simulação)" : "Provisionar"}
          </button>
          {!dry && ok.some((v) => !v) && <p className="mt-2 text-xs text-warning">Marque todos os pré-requisitos para executar de verdade.</p>}
          <ErrorLine msg={act.error} />
          <Results items={act.results} />
        </Panel>
      </div>
    </>
  );
}
