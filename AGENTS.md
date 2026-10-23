<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- samba-agent/ is a standalone Rust crate (axum) the web UI calls over HTTP; firewall code must only add rules (never -F/-X/-Z/-D/-P), enforced by tests. Why: user forbids clearing existing rules.
