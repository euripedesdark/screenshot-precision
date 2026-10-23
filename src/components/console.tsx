import { useState, type ReactNode } from "react";
import type { CmdResult } from "@/lib/agent";

export function Panel({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="panel">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{title}</h2>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function PageTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

export function Results({ items }: { items: CmdResult[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-4 space-y-2">
      {items.map((r, i) => (
        <div key={i} className="terminal">
          <div className={r.ok ? "text-success" : "text-destructive"}>
            {r.dry_run ? "[simulação] " : r.ok ? "[ok] " : `[erro ${r.code}] `}$ {r.command}
          </div>
          {r.stdout && <pre className="mt-1 whitespace-pre-wrap text-muted-foreground">{r.stdout}</pre>}
          {r.stderr && <pre className="mt-1 whitespace-pre-wrap text-destructive">{r.stderr}</pre>}
        </div>
      ))}
    </div>
  );
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<CmdResult[]>([]);
  async function go(fn: () => Promise<{ results?: CmdResult[] } | void>) {
    setBusy(true); setError("");
    try { const r = await fn(); if (r && r.results) setResults(r.results); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return { busy, error, results, go };
}

export function ErrorLine({ msg }: { msg: string }) {
  return msg ? <p className="mt-3 font-mono text-xs text-destructive">! {msg}</p> : null;
}

export function DryRun({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="accent-primary" />
      simulação (não executa)
    </label>
  );
}
