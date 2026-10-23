//! Execução segura de comandos: sem shell, binários em allowlist, com modo dry-run.
use serde::Serialize;
use std::process::Command;

const ALLOWED: &[&str] = &[
    "samba-tool", "systemctl", "dnf", "hostnamectl", "iptables", "iptables-save",
    "host", "testparm", "chronyc", "cp", "kinit", "klist", "setsebool", "ldapsearch",
];

#[derive(Serialize, Clone, Debug)]
pub struct CmdResult {
    pub command: String,
    pub ok: bool,
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
    pub dry_run: bool,
}

pub fn render(bin: &str, args: &[String]) -> String {
    let mut s = bin.to_string();
    for a in args {
        if a.contains(' ') { s.push_str(&format!(" '{}'", a)); } else { s.push(' '); s.push_str(a); }
    }
    s
}

/// Mascara senhas no texto exibido.
pub fn mask(cmd: &str) -> String {
    cmd.split(' ')
        .map(|p| if p.starts_with("--adminpass=") || p.starts_with("--newpassword=") {
            let k = p.split('=').next().unwrap(); format!("{k}=********")
        } else { p.to_string() })
        .collect::<Vec<_>>().join(" ")
}

pub fn run(bin: &str, args: Vec<String>, dry_run: bool) -> CmdResult {
    let command = mask(&render(bin, &args));
    if !ALLOWED.contains(&bin) {
        return CmdResult { command, ok: false, code: -1, stdout: String::new(),
            stderr: format!("binário '{bin}' não permitido"), dry_run };
    }
    if dry_run {
        return CmdResult { command, ok: true, code: 0, stdout: String::new(), stderr: String::new(), dry_run };
    }
    match Command::new(bin).args(&args).output() {
        Ok(o) => CmdResult {
            command, ok: o.status.success(), code: o.status.code().unwrap_or(-1),
            stdout: String::from_utf8_lossy(&o.stdout).into(),
            stderr: String::from_utf8_lossy(&o.stderr).into(), dry_run,
        },
        Err(e) => CmdResult { command, ok: false, code: -1, stdout: String::new(), stderr: e.to_string(), dry_run },
    }
}

pub fn a(v: &[&str]) -> Vec<String> { v.iter().map(|s| s.to_string()).collect() }
