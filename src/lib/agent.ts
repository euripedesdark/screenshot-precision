export type CmdResult = { command: string; ok: boolean; code: number; stdout: string; stderr: string; dry_run: boolean };

const KEY = "samba-agent-conn";
export type Conn = { url: string; token: string };

export function getConn(): Conn {
  if (typeof window === "undefined") return { url: "http://127.0.0.1:8787", token: "" };
  try { return JSON.parse(localStorage.getItem(KEY) || "") as Conn; } catch { return { url: "http://127.0.0.1:8787", token: "" }; }
}
export function setConn(c: Conn) { localStorage.setItem(KEY, JSON.stringify(c)); }

export async function api<T = any>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const c = getConn();
  const res = await fetch(c.url.replace(/\/$/, "") + path, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.token}` },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}
