//! Firewall: SOMENTE adiciona regras. Nunca limpa (-F), apaga cadeias (-X),
//! zera (-Z), remove (-D) ou muda política (-P). Antes de inserir, verifica com -C.
use crate::exec::{a, run, CmdResult};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Clone, Debug)]
pub struct PortRule { pub proto: String, pub port: String, pub label: String }

/// Portas do Samba AD DC (artigo, PART 3 / 13).
pub fn ad_ports() -> Vec<PortRule> {
    let r = |p: &str, port: &str, l: &str| PortRule { proto: p.into(), port: port.into(), label: l.into() };
    vec![
        r("tcp", "53", "DNS"), r("udp", "53", "DNS"),
        r("tcp", "88", "Kerberos"), r("udp", "88", "Kerberos"),
        r("tcp", "135", "RPC Endpoint Mapper"),
        r("udp", "137", "NetBIOS Name"), r("udp", "138", "NetBIOS Datagram"), r("tcp", "139", "NetBIOS Session"),
        r("tcp", "389", "LDAP"), r("udp", "389", "CLDAP"),
        r("tcp", "445", "SMB"),
        r("tcp", "464", "Kerberos kpasswd"), r("udp", "464", "Kerberos kpasswd"),
        r("tcp", "636", "LDAPS"),
        r("tcp", "3268", "Global Catalog"), r("tcp", "3269", "Global Catalog SSL"),
        r("tcp", "49152:65535", "RPC dinâmico"),
        r("udp", "123", "NTP (chrony)"),
    ]
}

const FORBIDDEN: &[&str] = &["-F", "--flush", "-X", "--delete-chain", "-Z", "--zero", "-D", "--delete", "-P", "--policy", "-R", "--replace"];

/// Garante que um argv de iptables não é destrutivo.
pub fn is_safe(args: &[String]) -> bool {
    !args.iter().any(|x| FORBIDDEN.contains(&x.as_str()))
}

pub fn valid(rule: &PortRule) -> bool {
    (rule.proto == "tcp" || rule.proto == "udp")
        && !rule.port.is_empty()
        && rule.port.split(':').all(|p| p.parse::<u16>().is_ok())
        && rule.port.split(':').count() <= 2
}

fn spec(rule: &PortRule) -> Vec<String> {
    a(&["INPUT", "-p", &rule.proto, "--dport", &rule.port, "-m", "comment", "--comment", &format!("samba-agent:{}", rule.label), "-j", "ACCEPT"])
}

/// Abre a porta somente se a regra ainda não existir. Usa -I INPUT 1 para
/// ficar antes de um eventual DROP final, sem tocar nas regras existentes.
pub fn open_port(rule: &PortRule, dry_run: bool) -> Vec<CmdResult> {
    if !valid(rule) {
        return vec![CmdResult { command: format!("{:?}", rule), ok: false, code: -1, stdout: String::new(), stderr: "regra inválida".into(), dry_run }];
    }
    let mut check = vec!["-C".to_string()]; check.extend(spec(rule));
    let mut ins = vec!["-I".to_string()]; let s = spec(rule);
    ins.push(s[0].clone()); ins.push("1".into()); ins.extend(s[1..].iter().cloned());
    assert!(is_safe(&check) && is_safe(&ins));
    if dry_run { return vec![run("iptables", check, true), run("iptables", ins, true)]; }
    let c = run("iptables", check, false);
    if c.ok {
        return vec![CmdResult { stdout: "regra já existe — nada alterado".into(), ..c }];
    }
    vec![c, run("iptables", ins, false)]
}

pub fn list(dry_run: bool) -> CmdResult { run("iptables", a(&["-S", "INPUT"]), dry_run) }

/// Persiste salvando um arquivo NOVO (não sobrescreve /etc/sysconfig/iptables).
pub fn snapshot(dry_run: bool) -> CmdResult { run("iptables-save", vec![], dry_run) }

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn never_flush() {
        assert!(!is_safe(&a(&["-F"])));
        assert!(!is_safe(&a(&["-P", "INPUT", "DROP"])));
        assert!(!is_safe(&a(&["-D", "INPUT", "1"])));
        assert!(!is_safe(&a(&["-X"])));
    }
    #[test]
    fn open_uses_check_then_insert() {
        let r = open_port(&PortRule { proto: "tcp".into(), port: "389".into(), label: "LDAP".into() }, true);
        assert!(r[0].command.starts_with("iptables -C INPUT"));
        assert!(r[1].command.starts_with("iptables -I INPUT 1"));
    }
    #[test]
    fn rejects_bad_port() {
        assert!(!valid(&PortRule { proto: "tcp".into(), port: "1;rm".into(), label: "x".into() }));
        assert!(!valid(&PortRule { proto: "icmp".into(), port: "1".into(), label: "x".into() }));
    }
}
