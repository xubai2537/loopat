# gitcommit — commit verified by git log

**目的**: AI 提交的改动落到 worktree git log。
**步骤**: AI 建 NOTE.txt + git commit "dogfood note"。
**预期**: git log 顶 commit 含 "dogfood note",NOTE.txt 被跟踪。
