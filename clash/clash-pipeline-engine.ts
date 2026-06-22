import type { 
  ClashPayload, 
  CombatPhase, 
  UnitConfig, 
  DiceRollResult, 
  HitPayload, 
  DamagePayload, 
  DeathPayload,
  DiceConfig,
  SkillData
} from './types.ts';

/**
 * 战斗插件接口
 */
export interface CombatPlugin {
  name: string;
  install: (engine: ClashPipelineEngine) => void;
}

type EffectHandler = (payload: ClashPayload) => void;

interface RegisteredEffect {
  name: string;
  fn: EffectHandler;
  priority: number;
}

/**
 * 管道模式战斗引擎
 * 将拼点、命中、伤害、死亡所有逻辑整合在一个流式管道中
 */
export class ClashPipelineEngine {
  private hooks: Record<CombatPhase, RegisteredEffect[]> = {
    onTurnStart: [],
    onBeforeClash: [],
    onClashEnd: [],
    onBeforeHit: [],
    onHit: [],
    onBeforeDamage: [],
    onDamage: [],
    onAfterDamage: [],
    onBeforeDeath: [],
    onDeath: [],
    onAfterDeath: [],
    onAfterHit: [],
    onTurnEnd: [],
  };

  private registeredPlugins: Set<string> = new Set();

  /**
   * 注册插件
   */
  use(plugin: CombatPlugin): this {
    if (this.registeredPlugins.has(plugin.name)) {
      console.warn(`[ClashEngine] 插件 [${plugin.name}] 已注册`);
      return this;
    }
    plugin.install(this);
    this.registeredPlugins.add(plugin.name);
    return this;
  }

  /**
   * 注册钩子函数
   */
  on(phase: CombatPhase, name: string, fn: EffectHandler, priority = 50): void {
    this.hooks[phase] = this.hooks[phase].filter(e => e.name !== name);
    this.hooks[phase].push({ name, fn, priority });
    this.hooks[phase].sort((a, b) => b.priority - a.priority);
  }

  /**
   * 触发阶段管道 (公开接口，允许外部手动触发特定阶段)
   */
  public trigger(phase: CombatPhase, payload: ClashPayload): void {
    payload.currentPhase = phase;
    const effects = this.hooks[phase];
    for (const effect of effects) {
      try {
        effect.fn(payload);
      } catch (e) {
        const errorMsg = `[ClashEngine] 插件 ${effect.name} 在 ${phase} 阶段执行失败: ${e}`;
        console.error(errorMsg);
        payload.logs.push(errorMsg);
      }
    }
  }

  /**
   * 执行完整的拼点战斗管道
   */
  run(payload: ClashPayload): ClashPayload {
    this.log(payload, `=== 拼点开始 (第 ${payload.turnCount} 回合) ===`);
    
    // 1. 回合开始
    this.trigger('onTurnStart', payload);

    // 2. 拼点计算阶段
    this.executeClashPhase(payload);

    // 3. 结果判定与伤害阶段
    if (payload.winnerId && payload.loserId) {
      this.executeHitAndDamagePhase(payload);
    } else {
      this.log(payload, '⚖️ 最终结果：平局，无伤害发生');
    }

    // 4. 回合结束
    this.trigger('onTurnEnd', payload);
    payload.isFinished = true;
    this.log(payload, `=== 拼点结束 ===`);
    
    return payload;
  }

  /**
   * 拼点阶段：计算双方骰子点数
   */
  private executeClashPhase(payload: ClashPayload): void {
    const rollA = this.rollDice(payload.UnitA_selectedForClash, payload.DicesA_selectedForClash);
    const rollB = this.rollDice(payload.UnitB_selectedForClash, payload.DicesB_selectedForClash);

    this.log(payload, `[${payload.UnitA_selectedForClash.name}] 投掷结果: ${rollA.map(r => r.roll).join(', ')}`);
    this.log(payload, `[${payload.UnitB_selectedForClash.name}] 投掷结果: ${rollB.map(r => r.roll).join(', ')}`);

    // 触发拼点前钩子（插件可以在这里修改骰子点数）
    // 注意：这里为了简化，我们将双方骰子放入 metadata 供插件访问
    payload.metadata = { ...payload.metadata, rollA, rollB };
    this.trigger('onBeforeClash', payload);

    const finalSumA = rollA.reduce((sum, r) => sum + (r.finalRoll ?? r.roll), 0);
    const finalSumB = rollB.reduce((sum, r) => sum + (r.finalRoll ?? r.roll), 0);

    this.log(payload, `最终点数比较: ${payload.UnitA_selectedForClash.name}(${finalSumA}) vs ${payload.UnitB_selectedForClash.name}(${finalSumB})`);

    if (finalSumA > finalSumB) {
      payload.winnerId = payload.UnitA_selectedForClash.id;
      payload.loserId = payload.UnitB_selectedForClash.id;
      payload.metadata.winningRolls = rollA;
      this.log(payload, `🎉 胜者: ${payload.UnitA_selectedForClash.name}`);
    } else if (finalSumB > finalSumA) {
      payload.winnerId = payload.UnitB_selectedForClash.id;
      payload.loserId = payload.UnitA_selectedForClash.id;
      payload.metadata.winningRolls = rollB;
      this.log(payload, `🎉 胜者: ${payload.UnitB_selectedForClash.name}`);
    }

    this.trigger('onClashEnd', payload);
  }

  /**
   * 命中与伤害阶段
   */
  private executeHitAndDamagePhase(payload: ClashPayload): void {
    const winningRolls = payload.metadata.winningRolls as DiceRollResult[];
    const attackerId = payload.winnerId!;
    const targetId = payload.loserId!;

    winningRolls.forEach((roll) => {
      // 初始化命中数据
      const hit: HitPayload = {
        attackerId,
        targetIds: [targetId],
        skillId: attackerId === payload.UnitA_selectedForClash.id ? payload.SkillA_selectedForClash.skillId : payload.SkillB_selectedForClash.skillId,
        dice: roll.die,
        diceRollResult: roll,
        damagePayloads: []
      };
      payload.currentHit = hit;
      payload.hitPayloads.push(hit);

      this.trigger('onBeforeHit', payload);
      this.trigger('onHit', payload);

      // 默认生成一个基础伤害（如果插件没生成的话）
      if (hit.damagePayloads.length === 0) {
        const damage: DamagePayload = {
          attackerId,
          targetId,
          skillId: hit.skillId,
          tags: [...roll.die.tags],
          baseDamage: roll.finalRoll ?? roll.roll,
          capDamage: 999,
          modifierFlat: 0,
          multiplier: 1.0,
          finalDamage: 0,
          timing: 'onHit'
        };
        hit.damagePayloads.push(damage);
      }

      // 处理该命中下的所有伤害
      hit.damagePayloads.forEach(damage => {
        payload.currentDamage = damage;
        payload.damagePayloads.push(damage);

        this.trigger('onBeforeDamage', payload);
        
        // 1. 计算初步最终伤害
        damage.finalDamage = Math.floor((damage.baseDamage + damage.modifierFlat) * damage.multiplier);
        
        // 2. 护盾抵扣逻辑 (核心规则)
        const target = payload.AllUnit.find(u => u.id === targetId);
        if (target && !damage.tags.includes('true_damage')) {
          let remaining = damage.finalDamage;
          
          // 优先扣除临时护盾
          if (target.tempShield > 0) {
            const absorbed = Math.min(target.tempShield, remaining);
            target.tempShield -= absorbed;
            remaining -= absorbed;
            this.log(payload, `🛡️ 临时护盾吸收了 ${absorbed} 点伤害`);
          }
          
          // 其次扣除普通护盾
          if (remaining > 0 && target.shield > 0) {
            const absorbed = Math.min(target.shield, remaining);
            target.shield -= absorbed;
            remaining -= absorbed;
            this.log(payload, `🛡️ 护盾吸收了 ${absorbed} 点伤害`);
          }
          
          damage.finalDamage = remaining;
        }

        // 3. 扣除实际 HP
        if (target && damage.finalDamage > 0) {
          target.hp = Math.max(0, target.hp - damage.finalDamage);
          this.log(payload, `💥 ${target.name} 受到 ${damage.finalDamage} 点实际伤害 (剩余 HP: ${target.hp})`);
        }

        this.trigger('onDamage', payload);

        // 检查死亡
        this.checkDeath(payload, targetId);

        this.trigger('onAfterDamage', payload);
      });

      this.trigger('onAfterHit', payload);
    });
  }

  /**
   * 死亡检查逻辑
   */
  private checkDeath(payload: ClashPayload, targetId: string): void {
    const target = payload.AllUnit.find(u => u.id === targetId);
    if (target && target.hp <= 0) {
      const death: DeathPayload = {
        deathId: targetId,
        reason: 'damage',
        deathPrevented: false,
        reviveHp: 0
      };
      payload.currentDeath = death;
      payload.deathPayloads.push(death);

      this.trigger('onBeforeDeath', payload);
      
      if (death.deathPrevented) {
        target.hp = death.reviveHp;
        this.log(payload, `🛡️ ${target.name} 触发免死，回复 ${death.reviveHp} HP`);
      } else {
        this.trigger('onDeath', payload);
        this.log(payload, `💀 ${target.name} 已阵亡`);
        this.trigger('onAfterDeath', payload);
      }
    }
  }

  /**
   * 辅助方法：投骰子
   */
  private rollDice(_unit: UnitConfig, dices: DiceConfig[]): DiceRollResult[] {
    return dices.map(die => {
      const roll = Math.floor(Math.random() * (die.max - die.min + 1)) + die.min;
      return { die, roll, finalRoll: roll };
    });
  }

  /**
   * 辅助方法：记录日志
   */
  private log(payload: ClashPayload, message: string): void {
    payload.logs.push(message);
    // 同时输出到控制台方便调试
    console.log(`[ClashPipeline] ${message}`);
    // 兼容旧的 window.log
    if (typeof window !== 'undefined' && (window as unknown as Record<string, (msg: string) => void>).log) {
      (window as unknown as Record<string, (msg: string) => void>).log(message);
    }
  }

  /**
   * 静态工厂方法：创建一个空的战斗 Payload
   */
  static createDefaultPayload(): ClashPayload {
    return {
      currentPhase: 'onTurnStart',
      AllUnit: [],
      LeftUnit: [],
      RightUnit: [],
      turnCount: 1,
      UnitA_selectedForClash: {} as UnitConfig,
      UnitB_selectedForClash: {} as UnitConfig,
      SkillA_selectedForClash: {} as SkillData,
      SkillB_selectedForClash: {} as SkillData,
      DicesA_selectedForClash: [],
      DicesB_selectedForClash: [],
      clashCount: 0,
      clashCountMax: 99,
      winnerId: null,
      loserId: null,
      isFinished: false,
      hitPayloads: [],
      damagePayloads: [],
      deathPayloads: [],
      logs: [],
      currentHit: null,
      currentDamage: null,
      currentDeath: null,
      metadata: {}
    };
  }
}

// 导出单例
export const clashPipelineEngine = new ClashPipelineEngine();
