import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { api, getConn, setConn } from "@/lib/agent";
import { PageTitle, Panel } from "@/components/console";

export const Route = createFileRoute("/conexao")({
  head: () => ({ meta: [
    { title: "Conexão — Samba AD Console" },
    { name: "description", content: "Conecte a interface ao agente samba-agent." },
    { property: "og:title", content: "Conexão — Samba AD Console" },
    { property: "og:description", content: "Conecte a interface ao agente samba-agent." },
  ] }),
  component: Page,
});

function Page() {
  const [url, setUrl] = useState("");
  const [token, setToken] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { const c = getConn(); setUrl(c.url); setToken(c.token); }, []);
  async function save() {
    setConn({ url, token });
    try { await api("/api/status"); setMsg("Conectado."); } catch (e) { setMsg("Falhou: " + (e as Error).message); }
  }
  return (
    <>
      <PageTitle title="Conexão" sub="Endereço e token do agente Rust rodando no servidor." />
      <Panel title="agente">
        <div className="grid gap-4 md:grid-cols-2">
          <div><label className="label">URL</label><input className="field font-mono" value={url} onChange={(e) => setUrl(e.target.value)} /></div>
          <div><label className="label">Token (SAMBA_AGENT_TOKEN)</label><input type="password" className="field font-mono" value={token} onChange={(e) => setToken(e.target.value)} /></div>
        </div>
        <button className="btn mt-4" onClick={save}>Salvar e testar</button>
        {msg && <p className="mt-3 font-mono text-xs text-muted-foreground">{msg}</p>}
      </Panel>
      <div className="mt-4">
        <Panel title="como iniciar o agente">
          <pre className="terminal whitespace-pre-wrap">{`cd samba-agent
cargo build --release
sudo SAMBA_AGENT_TOKEN=$(openssl rand -hex 24) \\
  SAMBA_AGENT_ADDR=127.0.0.1:8787 ./target/release/samba-agent`}</pre>
          <p className="mt-2 text-xs text-muted-foreground">Mantenha o agente em 127.0.0.1 e acesse via túnel SSH (ssh -L 8787:127.0.0.1:8787 dc1).</p>
        </Panel>
      </div>
    </>
  );
}
