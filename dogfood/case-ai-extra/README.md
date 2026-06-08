# ai-extra — chat-history + restart

**目的**: 一轮真实对话覆盖 chat-history 导出 + restart-session。
**步骤**: 发一轮→GET chat-history→POST restart-session。
**预期**: history 非空,restart <400。
