# Dialogue Map Canvas Lab

V5 数据编辑器，提供对话、判断、选项和事件四类独立卡片。旧版数据不再读取；village_gate 使用新示例。

- 对话节点保存对白；判断节点保存共享内存比较及 all/any/not 条件；选项节点每个出口保存一个选项文本。
- 事件节点支持发送或等待模式，保存事件名称、版本及参数值引用。等待模式的参数是匹配条件，可只指定部分参数。
- 拖动输出端口到输入端口或目标卡片可追加连线；同一出口允许多个目标、自环和重复连线。Inspector 可逐条删除。
- 保存全部草稿只校验数据形状，允许规则未完成及流程未接完。
- 检查／编译集中报告语义问题，点击诊断定位；多目标出口等歧义报错，未连接出口、不可达节点及无结束出口的流程警告。未接出口编译为结束分支。
- 编译成功可导出独立 instructions JSON；修改草稿或切换检查入口后需要重新编译。
- 保留撤销重做、文字换行省略及鼠标中心缩放。编辑器不执行事件、不分配 Lab 共享内存。

验证入口：npm run test:dialogue-map、npm run typecheck:dialogue-map、python -m unittest discover -s python -p test_dialogue_map_v5.py -v。
