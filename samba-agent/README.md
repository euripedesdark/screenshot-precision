# samba-agent

Agente HTTP em Rust que a interface web usa para administrar e provisionar um Samba AD DC
(baseado no guia "Samba AD DC Linux" de Euripedes Batista).

## Segurança
- Firewall: **apenas adiciona** regras (`iptables -C` e depois `iptables -I INPUT 1`). Flush, delete, zero e
  mudança de política são bloqueados no código e cobertos por testes.
- Comandos sem shell, binários em allowlist, senhas mascaradas nas respostas.
- Token obrigatório (`SAMBA_AGENT_TOKEN`, ≥16 caracteres). Escute em 127.0.0.1 e use túnel SSH.
- Provisionamento recusa rodar se já houver `sam.ldb`. Limpeza (STEP 0) não é automatizada.

## Uso
```
cargo test
cargo build --release
sudo SAMBA_AGENT_TOKEN=$(openssl rand -hex 24) ./target/release/samba-agent
```
