# tooluse — AI writes a file (sandbox truth)

**目的**: 验证 AI 用工具写文件,以沙箱真相(podman exec)而非 AI 话术判定。
**步骤**: 让 AI 写 MARK.txt 内容 DOGFOOD_OK→podman exec cat。
**预期**: 文件首行 == DOGFOOD_OK。
