# 伤害与治疗记录

`combatRecord.ts` 定义 `EffectSource`、`DamageRecord`、`HealingRecord` 及联合类型 `CombatRecord`。每个数据字段均有中文注释，可从 `core/combat_v1/index.ts` 导入。

这里只定义最终结算记录，不修改现有伤害算法，也不自动产生记录或累加战绩。由用户编写的战斗流程在成功提交后保存记录，保留不可变的历史快照，避免后续修改技能或归属影响历史数据。

来源区分直接角色、战绩归属角色及用户。召唤物攻击可归属主人；无角色来源的环境效果使用 null，不伪造角色 ID。持续状态应在施加时保存来源，每次跳伤继承，并使用不同记录 ID；同一状态实例通过 instanceId 关联。actionId 关联同次发动的多段/多目标记录，parentEventId 关联反伤等触发链。

所有伤害、治疗数量均为非负数。最终伤害满足 `resolvedDamage = shieldDamage + hpDamage + overkill`；防御、减伤、免疫等均先反映到 resolvedDamage。最终治疗满足 `resolvedHealing = hpRestored + overheal`；治疗抑制先反映到 resolvedHealing。未命中或免疫的伤害可记录为结算伤害 0。

按 `(battleId, id)` 去重后，按 `source.userId` 汇总：生命伤害累加 hpDamage，护盾伤害累加 shieldDamage，有效总伤害为两者之和，有效治疗累加 hpRestored。过量伤害与过量治疗单独统计；无 userId 的记录不自动归给任何用户。友伤、自伤及对敌伤害的筛选由统计方依据战斗当时的阵营信息决定，本结构暂不保存阵营快照。
