# reply — AI replies in the chat UI

**目的**: 验证 create→boot→chat→真实回复 全链路在浏览器中渲染。
**步骤**: 新建 loop(roster1)→开终端起沙箱→发"回 PONGDOGFOOD"→等 assistant 消息。
**预期**: 聊天 UI 出现含 `PONGDOGFOOD` 的回复,无 ⚠️ 错误。
