mod exec;
mod firewall;
mod provision;

use axum::{
    extract::{Path, Query},
    http::{HeaderMap, StatusCode},
    routing::{delete, get, post},
    Json, Router,
};
use exec::{a, run, CmdResult};
use serde::Deserialize;
use serde_json::{json, Value};
use tower_http::cors::CorsLayer;

type Res = Result<Json<Value>, (StatusCode, Json<Value>)>;

fn auth(h: &HeaderMap) -> Result<(), (StatusCode, Json<Value>)> {
    let token = std::env::var("SAMBA_AGENT_TOKEN").unwrap_or_default();
    let got = h.get("authorization").and_then(|v| v.to_str().ok()).unwrap_or("");
    if token.is_empty() || got != format!("Bearer {token}") {
        return Err((StatusCode::UNAUTHORIZED, Json(json!({"error": "token inválido"}))));
    }
    Ok(())
}
fn bad(m: impl Into<String>) -> (StatusCode, Json<Value>) { (StatusCode::BAD_REQUEST, Json(json!({"error": m.into()}))) }
fn safe_name(s: &str) -> bool { !s.is_empty() && s.len() <= 64 && s.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c)) }
fn lines(r: &CmdResult) -> Vec<String> { r.stdout.lines().map(|l| l.trim().to_string()).filter(|l| !l.is_empty()).collect() }

#[derive(Deserialize)] struct Dry { #[serde(default)] dry_run: bool }

async fn health() -> Json<Value> { Json(json!({"ok": true, "version": env!("CARGO_PKG_VERSION")})) }

async fn status(h: HeaderMap) -> Res {
    auth(&h)?;
    let installed = std::path::Path::new("/usr/bin/samba-tool").exists();
    let provisioned = std::path::Path::new("/var/lib/samba/private/sam.ldb").exists();
    let svc = run("systemctl", a(&["is-active", "samba"]), false);
    let level = if provisioned { run("samba-tool", a(&["domain", "level", "show"]), false).stdout } else { String::new() };
    let info = if provisioned { run("samba-tool", a(&["domain", "info", "127.0.0.1"]), false).stdout } else { String::new() };
    Ok(Json(json!({"installed": installed, "provisioned": provisioned, "active": svc.stdout.trim() == "active", "level": level, "info": info})))
}

async fn users(h: HeaderMap) -> Res { auth(&h)?; Ok(Json(json!({"items": lines(&run("samba-tool", a(&["user", "list"]), false))}))) }

#[derive(Deserialize)] struct NewUser { username: String, password: String, #[serde(default)] given: String, #[serde(default)] surname: String, #[serde(default)] dry_run: bool }
async fn add_user(h: HeaderMap, Json(u): Json<NewUser>) -> Res {
    auth(&h)?;
    if !safe_name(&u.username) { return Err(bad("nome de usuário inválido")); }
    let mut args = vec!["user".into(), "create".into(), u.username.clone(), u.password.clone()];
    if !u.given.is_empty() { args.push(format!("--given-name={}", u.given)); }
    if !u.surname.is_empty() { args.push(format!("--surname={}", u.surname)); }
    let mut r = run("samba-tool", args, u.dry_run);
    r.command = r.command.replace(&u.password, "********");
    Ok(Json(json!({"results": [r]})))
}
async fn user_action(h: HeaderMap, Path((name, action)): Path<(String, String)>, Query(d): Query<Dry>) -> Res {
    auth(&h)?;
    if !safe_name(&name) { return Err(bad("nome inválido")); }
    let verb = match action.as_str() { "enable" => "enable", "disable" => "disable", "delete" => "delete", _ => return Err(bad("ação inválida")) };
    Ok(Json(json!({"results": [run("samba-tool", a(&["user", verb, &name]), d.dry_run)]})))
}
#[derive(Deserialize)] struct Pw { password: String, #[serde(default)] dry_run: bool }
async fn set_pw(h: HeaderMap, Path(name): Path<String>, Json(p): Json<Pw>) -> Res {
    auth(&h)?;
    if !safe_name(&name) { return Err(bad("nome inválido")); }
    Ok(Json(json!({"results": [run("samba-tool", vec!["user".into(), "setpassword".into(), name, format!("--newpassword={}", p.password)], p.dry_run)]})))
}

async fn groups(h: HeaderMap) -> Res { auth(&h)?; Ok(Json(json!({"items": lines(&run("samba-tool", a(&["group", "list"]), false))}))) }
async fn group_members(h: HeaderMap, Path(g): Path<String>) -> Res {
    auth(&h)?;
    Ok(Json(json!({"items": lines(&run("samba-tool", vec!["group".into(), "listmembers".into(), g], false))})))
}
#[derive(Deserialize)] struct NewGroup { name: String, #[serde(default)] dry_run: bool }
async fn add_group(h: HeaderMap, Json(g): Json<NewGroup>) -> Res {
    auth(&h)?;
    if !safe_name(&g.name) { return Err(bad("nome inválido")); }
    Ok(Json(json!({"results": [run("samba-tool", a(&["group", "add", &g.name]), g.dry_run)]})))
}
#[derive(Deserialize)] struct Member { user: String, #[serde(default)] remove: bool, #[serde(default)] dry_run: bool }
async fn member(h: HeaderMap, Path(g): Path<String>, Json(m): Json<Member>) -> Res {
    auth(&h)?;
    if !safe_name(&m.user) { return Err(bad("usuário inválido")); }
    let verb = if m.remove { "removemembers" } else { "addmembers" };
    Ok(Json(json!({"results": [run("samba-tool", vec!["group".into(), verb.into(), g, m.user], m.dry_run)]})))
}

#[derive(Deserialize)] struct DnsQ { zone: String }
async fn dns_list(h: HeaderMap, Query(q): Query<DnsQ>) -> Res {
    auth(&h)?;
    let r = run("samba-tool", vec!["dns".into(), "query".into(), "127.0.0.1".into(), q.zone, "@".into(), "ALL".into(), "-P".into()], false);
    Ok(Json(json!({"raw": r.stdout, "error": r.stderr})))
}
async fn dns_zones(h: HeaderMap) -> Res {
    auth(&h)?;
    let r = run("samba-tool", a(&["dns", "zonelist", "127.0.0.1", "-P"]), false);
    Ok(Json(json!({"raw": r.stdout, "error": r.stderr})))
}
#[derive(Deserialize)] struct DnsRec { zone: String, name: String, rtype: String, value: String, #[serde(default)] dry_run: bool }
async fn dns_add(h: HeaderMap, Json(d): Json<DnsRec>) -> Res {
    auth(&h)?;
    if !["A", "AAAA", "PTR", "CNAME", "TXT", "MX", "SRV"].contains(&d.rtype.as_str()) { return Err(bad("tipo inválido")); }
    Ok(Json(json!({"results": [run("samba-tool", vec!["dns".into(), "add".into(), "127.0.0.1".into(), d.zone, d.name, d.rtype, d.value, "-P".into()], d.dry_run)]})))
}
#[derive(Deserialize)] struct Zone { zone: String, #[serde(default)] dry_run: bool }
async fn zone_add(h: HeaderMap, Json(z): Json<Zone>) -> Res {
    auth(&h)?;
    Ok(Json(json!({"results": [run("samba-tool", vec!["dns".into(), "zonecreate".into(), "127.0.0.1".into(), z.zone, "-P".into()], z.dry_run)]})))
}

async fn fw_list(h: HeaderMap) -> Res {
    auth(&h)?;
    Ok(Json(json!({"rules": lines(&firewall::list(false)), "recommended": firewall::ad_ports()})))
}
#[derive(Deserialize)] struct Open { rules: Vec<firewall::PortRule>, #[serde(default)] dry_run: bool }
async fn fw_open(h: HeaderMap, Json(o): Json<Open>) -> Res {
    auth(&h)?;
    let res: Vec<CmdResult> = o.rules.iter().flat_map(|r| firewall::open_port(r, o.dry_run)).collect();
    Ok(Json(json!({"results": res})))
}

async fn do_provision(h: HeaderMap, Json(r): Json<provision::ProvisionReq>) -> Res {
    auth(&h)?;
    provision::validate(&r).map_err(bad)?;
    if !r.dry_run && std::path::Path::new("/var/lib/samba/private/sam.ldb").exists() {
        return Err(bad("já existe um domínio provisionado neste host — nada foi alterado"));
    }
    Ok(Json(json!({"results": provision::provision(&r)})))
}

async fn checks(h: HeaderMap) -> Res {
    auth(&h)?;
    let realm = std::env::var("SAMBA_REALM").unwrap_or_else(|_| "fedora.lan".into()).to_lowercase();
    let mut res = vec![
        run("testparm", a(&["-s"]), false),
        run("samba-tool", a(&["dbcheck"]), false),
        run("chronyc", a(&["tracking"]), false),
        run("klist", vec![], false),
    ];
    for srv in ["_ldap._tcp", "_kerberos._tcp", "_kerberos._udp", "_kpasswd._udp"] {
        res.push(run("host", vec!["-t".into(), "SRV".into(), format!("{srv}.{realm}"), "127.0.0.1".into()], false));
    }
    Ok(Json(json!({"results": res})))
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    if std::env::var("SAMBA_AGENT_TOKEN").unwrap_or_default().len() < 16 {
        anyhow::bail!("defina SAMBA_AGENT_TOKEN com pelo menos 16 caracteres");
    }
    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/status", get(status))
        .route("/api/users", get(users).post(add_user))
        .route("/api/users/:name/password", post(set_pw))
        .route("/api/users/:name/:action", post(user_action))
        .route("/api/groups", get(groups).post(add_group))
        .route("/api/groups/:name/members", get(group_members).post(member))
        .route("/api/dns/zones", get(dns_zones).post(zone_add))
        .route("/api/dns/records", get(dns_list).post(dns_add))
        .route("/api/firewall", get(fw_list).post(fw_open))
        .route("/api/provision", post(do_provision))
        .route("/api/checks", get(checks))
        .route("/api/noop", delete(health))
        .layer(CorsLayer::permissive());
    let addr = std::env::var("SAMBA_AGENT_ADDR").unwrap_or_else(|_| "127.0.0.1:8787".into());
    println!("samba-agent ouvindo em http://{addr}");
    axum::serve(tokio::net::TcpListener::bind(&addr).await?, app).await?;
    Ok(())
}
