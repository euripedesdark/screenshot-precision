//! Provisionamento de um novo Samba AD DC seguindo o artigo (PARTS 1–8).
//! Etapa de limpeza (STEP 0) NÃO é automatizada por ser destrutiva.
use crate::exec::{a, run, CmdResult};
use crate::firewall;
use serde::Deserialize;

#[derive(Deserialize, Debug)]
pub struct ProvisionReq {
    pub hostname: String,     // dc1.fedora.lan
    pub realm: String,        // FEDORA.LAN
    pub domain: String,       // FEDORA
    pub admin_password: String,
    pub dns_forwarder: String, // 8.8.8.8 ou 127.0.0.1:5353
    pub install_packages: bool,
    pub open_firewall: bool,
    pub dry_run: bool,
}

pub const PACKAGES: &[&str] = &[
    "samba-dc", "samba-client", "bind", "chrony", "bind-utils", "python3-samba",
    "oddjob", "oddjob-mkhomedir", "openssl", "rsync", "jq",
];

pub fn validate(r: &ProvisionReq) -> Result<(), String> {
    let ok = |s: &str| !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == ':');
    if !ok(&r.hostname) || r.hostname.split('.').count() < 3 { return Err("hostname deve ser FQDN, ex: dc1.fedora.lan".into()); }
    if !ok(&r.realm) || r.realm != r.realm.to_uppercase() { return Err("realm deve estar em MAIÚSCULAS".into()); }
    if !ok(&r.domain) || r.domain.len() > 15 { return Err("domínio NetBIOS até 15 caracteres".into()); }
    if r.admin_password.len() < 8 { return Err("senha do Administrator: mínimo 8 caracteres e complexa".into()); }
    if !r.dns_forwarder.is_empty() && !ok(&r.dns_forwarder) { return Err("dns forwarder inválido".into()); }
    let suffix = r.hostname.splitn(2, '.').nth(1).unwrap_or("").to_uppercase();
    if suffix != r.realm { return Err(format!("o sufixo do hostname ({suffix}) deve igualar o realm")); }
    Ok(())
}

pub fn provision(r: &ProvisionReq) -> Vec<CmdResult> {
    let d = r.dry_run;
    let mut out = vec![];
    let mut step = |res: CmdResult, out: &mut Vec<CmdResult>| -> bool { let ok = res.ok; out.push(res); ok };

    if r.install_packages {
        let mut args = a(&["install", "-y"]); args.extend(PACKAGES.iter().map(|s| s.to_string()));
        if !step(run("dnf", args, d), &mut out) { return out; }
    }
    if !step(run("hostnamectl", a(&["set-hostname", &r.hostname]), d), &mut out) { return out; }
    step(run("systemctl", a(&["enable", "--now", "chronyd"]), d), &mut out);

    let mut args = a(&["domain", "provision", "--server-role=dc", "--use-rfc2307",
        "--dns-backend=SAMBA_INTERNAL"]);
    args.push(format!("--realm={}", r.realm));
    args.push(format!("--domain={}", r.domain));
    args.push(format!("--adminpass={}", r.admin_password));
    if !r.dns_forwarder.is_empty() { args.push(format!("--option=dns forwarder = {}", r.dns_forwarder)); }
    if !step(run("samba-tool", args, d), &mut out) { return out; }

    step(run("cp", a(&["--backup=numbered", "/var/lib/samba/private/krb5.conf", "/etc/krb5.conf"]), d), &mut out);

    if r.open_firewall {
        for p in firewall::ad_ports() { out.extend(firewall::open_port(&p, d)); }
    }
    step(run("systemctl", a(&["enable", "--now", "samba"]), d), &mut out);
    step(run("samba-tool", a(&["domain", "level", "show"]), d), &mut out);
    let realm_l = r.realm.to_lowercase();
    step(run("host", vec!["-t".into(), "SRV".into(), format!("_ldap._tcp.{realm_l}"), "127.0.0.1".into()]), d), &mut out);
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    fn req() -> ProvisionReq { ProvisionReq { hostname: "dc1.fedora.lan".into(), realm: "FEDORA.LAN".into(), domain: "FEDORA".into(),
        admin_password: "S3nh@Forte!".into(), dns_forwarder: "8.8.8.8".into(), install_packages: true, open_firewall: true, dry_run: true } }
    #[test] fn valid_req() { assert!(validate(&req()).is_ok()); }
    #[test] fn lowercase_realm_rejected() { let mut r = req(); r.realm = "fedora.lan".into(); assert!(validate(&r).is_err()); }
    #[test] fn no_flush_in_plan() {
        let plan = provision(&req());
        assert!(plan.iter().all(|c| !c.command.contains("iptables -F") && !c.command.contains("iptables -P")));
        assert!(plan.iter().all(|c| !c.command.contains("S3nh@Forte!")));
    }
}
