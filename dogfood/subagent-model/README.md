# subagent-model — per-tier model regression

**目的**: 单模型 provider(idealab opus-4-6)下 Explore 等内置 subagent 不撞「模型不存在」。
**步骤**: provider 配 agent_model→发起 Explore→读 messages.jsonl。
**预期**: 全程 opus-4-6,无 haiku 档、无 400。
