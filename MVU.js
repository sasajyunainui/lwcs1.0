import { registerMvuSchema } from './MVU_Zod_Bundle.js';

globalThis.__LWCS_MARK_MVU_LOAD_V1__?.('mvu-module:body-start');

globalThis.__LWCS_REGISTER_MVU_SCHEMA__ = registerMvuSchema;

const DEFAULT_NEW_GAME_TICK = 20000 * 51840;

try { if (globalThis.parent && globalThis.parent !== globalThis) { globalThis.parent.__LWCS_REGISTER_MVU_SCHEMA__ = registerMvuSchema; } } catch (错误) {}

try { if (globalThis.top && globalThis.top !== globalThis) { globalThis.top.__LWCS_REGISTER_MVU_SCHEMA__ = registerMvuSchema; } } catch (错误) {}

const WealthSchema = z
  .object({
    联邦币: z.coerce.number().prefault(0).describe('联邦币'),
    星罗币: z.coerce.number().prefault(0).describe('星罗币'),
    唐门积分: z.coerce.number().prefault(0).describe('唐门积分'),
    学院积分: z.coerce.number().prefault(0).describe('史莱克徽章/积分'),
    战功: z.coerce.number().prefault(0).describe('血神军团功勋'),
    金魂币: z.coerce.number().prefault(0).describe('斗一/斗二金魂币'),
    银魂币: z.coerce.number().prefault(0).describe('斗一/斗二银魂币'),
    铜魂币: z.coerce.number().prefault(0).describe('斗一/斗二铜魂币'),
    龙马币: z.coerce.number().prefault(0).describe('斗四龙马币'),
    天龙晶币: z.coerce.number().prefault(0).describe('斗四天龙晶币'),
    白级徽章: z.coerce.number().prefault(0).describe('斗四学院白级徽章积分'),
    黄级徽章: z.coerce.number().prefault(0).describe('斗四学院黄级徽章积分'),
    紫级徽章: z.coerce.number().prefault(0).describe('斗四学院紫级徽章积分'),
    斗天者积分: z.coerce.number().prefault(0).describe('斗四斗天者军功积分'),
  })
  .prefault({});

const 原著事件状态串Schema_V1 = z
  .string()
  .transform(值 => String(值 || '').trim())
  .refine(文本 => !文本 || /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(文本), {
    message: '原著事件状态必须是合法Base64字符串',
  })
  .prefault('');

const 原著事件状态Schema_V1 = z
  .object({
    版本: z.literal(1).prefault(1),
    数据: z
      .object({
        dldl: 原著事件状态串Schema_V1,
        jueshitangmen: 原著事件状态串Schema_V1,
        current: 原著事件状态串Schema_V1,
        zjdl: 原著事件状态串Schema_V1,
      })
      .prefault({}),
  })
  .prefault({ 版本: 1, 数据: {} })
  .describe('四时代原著事件四态位图；仅由TimelineRuntime读写');

  const BodyPartSchema = z
  .object({
    外观特征: z.string().prefault('待补全(请描写该部位的静态外观与天生敏感特征，如：粉嫩/修长/天生敏感)'),
    敏感度加成: z.coerce.number().prefault(0),
    开发度: z.coerce.number().prefault(0).describe('该部位的独立开发度(0-100)'),
    状态描述: z.string().prefault('正常').describe('当前动态状态，日常请保持"正常"'),
    体液残留: z.string().prefault('无'),
  })
  .prefault({});
const AppearanceSchema = z
  .object({
    发色: z.string().prefault('待补全(根据角色外貌补全发色)'),
    发型: z.string().prefault('待补全(根据角色发质与气质补全发型)'),
    瞳色: z.string().prefault('待补全(根据角色外貌补全瞳色)'),
    身高: z.string().prefault('待补全(根据角色设定补全身高)'),
    体型: z.string().prefault('待补全(根据角色体态补全体型)'),
    长相描述: z.string().prefault('待补全(根据角色面部特征补全长相描述)'),
    特殊特征: z
      .array(z.string())
      .prefault([])
      .describe('角色的独特之处，如伤疤、胎记、特殊神态等'),
  })
  .prefault({
    发色: '待补全(根据角色外貌补全发色)',
    发型: '待补全(根据角色发质与气质补全发型)',
    瞳色: '待补全(根据角色外貌补全瞳色)',
    身高: '待补全(根据角色设定补全身高)',
    体型: '待补全(根据角色体态补全体型)',
    长相描述: '待补全(根据角色面部特征补全长相描述)',
    特殊特征: [],
  });

const ClothingSchema = z
  .object({
    上装: z.string().prefault(角色穿搭上装待补全文案_V1),
    下装: z.string().prefault(角色穿搭下装待补全文案_V1),
    鞋子: z.string().prefault(角色穿搭鞋子待补全文案_V1),
    描述: z.string().prefault(角色穿搭描述待补全文案_V1),
  })
  .prefault({
    上装: 角色穿搭上装待补全文案_V1,
    下装: 角色穿搭下装待补全文案_V1,
    鞋子: 角色穿搭鞋子待补全文案_V1,
    描述: 角色穿搭描述待补全文案_V1,
  });
const EquipmentSchema = z
  .object({
    _温养目标: z.enum(['无', '斗铠', '机甲']).prefault('无'),
    武器: z
      .object({
        名称: z.string().prefault('无'),
        材质: z.string().prefault('无').describe('武器实际材质，用于装备兼容性判定'),
        品阶: z.string().prefault('无').describe('品阶如: 魂导器/神器/超神器'),
        特性: z
          .record(z.string(), z.object({ 描述: z.string().prefault('无'), 限定来源: z.string().optional() }).prefault({}))
          .prefault({})
          .describe('附带的绝对特性，如:无视防御/吞噬/绝对禁锢'),
        属性加成: z
          .object({
            魂力上限: z.union([z.coerce.number(), z.string()]).prefault(0),
            精神力上限: z.union([z.coerce.number(), z.string()]).prefault(0),
            力量: z.union([z.coerce.number(), z.string()]).prefault(0),
            防御: z.union([z.coerce.number(), z.string()]).prefault(0),
            敏捷: z.union([z.coerce.number(), z.string()]).prefault(0),
            体力上限: z.union([z.coerce.number(), z.string()]).prefault(0),
          })
          .prefault({}),
        加成方向: z.array(z.enum(['魂力上限', '精神力上限', '力量', '防御', '敏捷', '体力上限', '全属性'])).prefault([]),
      })
      .prefault({}),
    防具: z
      .object({
        名称: z.string().prefault('无'),
        品阶: z.string().prefault('无').describe('普通防具、防护装备或魂导护具品阶'),
        装备状态: z.string().prefault('未装备'),
        特性: z
          .record(z.string(), z.object({ 描述: z.string().prefault('无'), 限定来源: z.string().optional() }).prefault({}))
          .prefault({})
          .describe('附带的防护特性，如:抗冲击/减伤/元素抗性'),
        属性加成: z
          .object({
            魂力上限: z.union([z.coerce.number(), z.string()]).prefault(0),
            精神力上限: z.union([z.coerce.number(), z.string()]).prefault(0),
            力量: z.union([z.coerce.number(), z.string()]).prefault(0),
            防御: z.union([z.coerce.number(), z.string()]).prefault(0),
            敏捷: z.union([z.coerce.number(), z.string()]).prefault(0),
            体力上限: z.union([z.coerce.number(), z.string()]).prefault(0),
          })
          .prefault({}),
        加成方向: z.array(z.enum(['魂力上限', '精神力上限', '力量', '防御', '敏捷', '体力上限', '全属性'])).prefault([]),
      })
      .prefault({}),
    斗铠: z
      .object({
        等级: z.coerce.number().prefault(0),
        // 耐久（接入方案 S80-A）：释放后吸收的伤害按绝对值扣；缺省 = 等效等级基础体力上限 × 字数 × 品质系数。耗尽 装备状态 记「损毁」。
        耐久: z.coerce.number().optional(),
        耐久上限: z.coerce.number().optional(),
        名称: z.string().prefault('无'),
        领域: z.string().prefault('无'),
        材质: z.string().prefault('无').describe('锻造金属材质'),
        装备状态: z.string().prefault('未装备'),
        部件: z
          .record(
            z.string(),
            z
              .object({
                状态: z.string().prefault('未打造'),
                品质系数: z.coerce.number().prefault(1.0),
              })
              .prefault({}),
          )
          .prefault({}),
        _属性加成: z
          .object({
            等效等级: z.coerce.number().prefault(0),
            魂力上限: z.coerce.number().prefault(0),
            精神力上限: z.coerce.number().prefault(0),
            力量: z.coerce.number().prefault(0),
            防御: z.coerce.number().prefault(0),
            敏捷: z.coerce.number().prefault(0),
            体力上限: z.coerce.number().prefault(0),
          })
          .prefault({}),
        _已排异: z.boolean().prefault(false),
        _温养进度tick: z.coerce.number().prefault(0),
      })
      .prefault({}),
    机甲: z
      .object({
        等级: z.string().prefault('无'),
        名称: z.string().prefault('无').describe('机甲名称'),
        型号: z.string().prefault('无').describe('机甲定位：近战/远程/均衡/重装/高速/支援'),
        材质: z.string().prefault('无').describe('机甲金属材质'),
        状态: z.string().prefault('无'),
        装备状态: z.string().prefault('未装备'),
        武装: z.string().prefault('无'),
        品质系数: z.coerce.number().prefault(1.0).describe('0.8为劣质，1.0为标准，1.5以上为极品，最高可达2.0'),
        // 耐久（S80-A）：缺省 = 穿戴者等级基础体力上限 × 品级系数（黄1 紫2 黑3 红4 神5）× 品质系数。
        耐久: z.coerce.number().optional(),
        耐久上限: z.coerce.number().optional(),
        _属性加成: z
          .object({
            魂力上限: z.coerce.number().prefault(0),
            精神力上限: z.coerce.number().prefault(0),
            力量: z.coerce.number().prefault(0),
            防御: z.coerce.number().prefault(0),
            敏捷: z.coerce.number().prefault(0),
            体力上限: z.coerce.number().prefault(0),
          })
          .prefault({}),
        _温养进度tick: z.coerce.number().prefault(0),
      })
      .prefault({}),
    魂导器: z
      .object({
        装配: z
          .record(
            z.string(),
            z
              .object({
                名称: z.string().prefault('无'),
                魂导等级: z.coerce.number().optional(),
                装备技能: z.record(z.string(), z.any()).prefault({}),
              })
              .catchall(z.any())
              .prefault({}),
          )
          .prefault(创建空魂导器装配表_V1()),
      })
      .prefault({ 装配: 创建空魂导器装配表_V1() }),
  })
  .prefault({})
  .transform(规范化装备Schema_V1);
const SkillStructSchema = z
  .object({
    魂技名: z.string().prefault(AI_TODO_SKILL_NAME),
    画面描述: z.string().prefault(AI_TODO_SKILL_VISUAL),
    效果描述: z.string().prefault(AI_TODO_SKILL_EFFECT),
    产物描述: z.string().optional().describe('造物承载、召唤物或场地实体的外观与用途描述；普通魂技不落盘'),
    承载方式: z.string().prefault('直接生效'),
    消耗: z.any().prefault('无'),
    前摇: z.coerce.number().prefault(0),
    场外冷却至tick: z.coerce.number().optional(),
    剩余次数: z.coerce.number().optional().describe('只有带每日次数上限的技能才写（技能「使用限制：每日 N 次」、时窗修正「单日使用次数上限」）：战斗外还能放几次'),
    次数恢复至tick: z.coerce.number().optional().describe('剩余次数恢复满的时间（第一次用掉后一天）；到时补满，与物品的使用次数恢复同一做法'),
    计价版本: z.coerce.number().optional().describe('技能预算计价版本；新生成与设计台保存的技能写入，读档收敛据此选计价口径'),
    _锚定消耗: z.any().optional().describe('魂技消耗成长：获得该魂技时的总消耗 {魂力, 精神力, 体力}；COST 预算与设计台校验按它算，结算时效果随实际消耗放大'),
    附带属性: z.array(z.string()).prefault([]),
    使用条件: z
      .object({
        最低等级: z.coerce.number().prefault(0),
        最低魂力: z.coerce.number().prefault(0),
        最低精神力: z.coerce.number().prefault(0),
      })
      .optional(),
    触发方式: z
      .enum(['战斗开始', '回合开始', '受击前', '致命前', '受击后', '濒死时', '被控制时', '命中后'])
      .optional(),
    技能掌控度: z
      .object({
        中心等级: z.coerce.number().prefault(1),
        圆满等级: z.coerce.number().prefault(99),
      })
      .optional(),
    触发限制: z
      .object({
        周期: z.enum(['每战', '每日', '每回合']),
        次数: z.coerce.number().int().min(1).prefault(1),
      })
      .optional(),
    装备要求: z.record(z.string(), z.any()).optional().describe('技能根层装备要求；效果级装备要求位于对应_效果数组条目'),
    限定来源: z.string().optional().describe('技能生效所限定的来源身份或装备来源；无值表示无来源限制'),
    领域: z
      .object({
        等级: z.coerce.number().min(1).max(5).prefault(1).describe('领域等级 1～5：同场敌对领域按 精神力上限×(1+0.25×(等级−1)) 比强弱，弱者效果减半'),
        范围: z.string().prefault('全场').describe('全场/己方/敌方：领域状态落在谁身上（效果数组的目标照此写）'),
        来源: z.string().optional().describe('按描述生成的领域技的出处：精神领域 / 斗铠（MVU_Skill_Runtime 生成角色领域技_V1）'),
        描述哈希: z.coerce.number().optional().describe('生成时领域名与描述的哈希；描述改了就重新生成'),
      })
      .optional()
      .describe('领域技：展开后这一招挂的状态都属于施法者的领域；一人一领域，展开新领域撤掉旧的'),
    _效果数组: z.array(z.any()).prefault([]).describe('打包后的_效果数组，供前端显示和后续战斗模块解析'),
    副作用列表: z.array(z.any()).optional(),
  })
  .strict()
  .transform(规范化技能结构Schema_V1)
  .prefault({});

const SoulBoneSchema = z
  .record(
    z.string(),
    z
      .object({
        名称: z.string().prefault(''),
        表象名称: z.string().prefault('无'),
        年限: z.coerce.number().prefault(0),
        来源: z.string().prefault(''),
        品质: z.string().prefault('无'),
        品阶: z.string().prefault('无'),
        描述: z.string().prefault('无'),
        附带技能: z.record(z.string(), SkillStructSchema).prefault({}),
        属性加成: z
          .object({
            力量: z.coerce.number().prefault(0),
            防御: z.coerce.number().prefault(0),
            敏捷: z.coerce.number().prefault(0),
            体力上限: z.coerce.number().prefault(0),
            精神力上限: z.coerce.number().prefault(0),
            魂力上限: z.coerce.number().prefault(0),
          })
          .prefault({}),
        属性倍率: z
          .object({
            力量: z.coerce.number().prefault(0),
            防御: z.coerce.number().prefault(0),
            敏捷: z.coerce.number().prefault(0),
            体力上限: z.coerce.number().prefault(0),
            精神力上限: z.coerce.number().prefault(0),
            魂力上限: z.coerce.number().prefault(0),
          })
          .prefault({}),
      })
      .prefault({}),
  )
  .transform(规范化魂骨Schema_V1)
  .prefault({});
const AdditiveStatBonusSchema = z
  .object({
    力量: z.coerce.number().prefault(0),
    防御: z.coerce.number().prefault(0),
    敏捷: z.coerce.number().prefault(0),
    体力上限: z.coerce.number().prefault(0),
    精神力上限: z.coerce.number().prefault(0),
    魂力上限: z.coerce.number().prefault(0),
  })
  .prefault({});
const BloodlinePermanentBonusSchema = z
  .object({
    来源层级: z.coerce.number().prefault(0),
    效果描述: z.string().prefault('无'),
    属性加成: AdditiveStatBonusSchema,
  })
  .prefault({});
const SoulRingSchema = z
  .looseObject({
    年限: z.coerce.number().prefault(0),
    颜色: z.string().prefault('无'),
    来源: z.string().prefault('无'),
    炸环恢复tick: z.coerce.number().optional(),
    炸环恢复时间: z.string().optional(),
  })
  .transform(规范化魂环Schema_V1)
  .prefault({});
const SoulSpiritSchema = z
  .looseObject({
    表象名称: z.string().prefault(AI_TODO_SOUL_SPIRIT_NAME).describe('魂灵物种名'),
    描述: z.string().prefault(AI_TODO_SOUL_SPIRIT_DESC).describe('魂灵描述，由 AI 维护'),
    年限: z.coerce.number().prefault(0),
    品质: z.string().prefault(AI_TODO_SOUL_SPIRIT_QUALITY).describe('魂灵品质：F/D/C/B/A/S/S+'),
    契合度: z.coerce.number().prefault(60).describe('与武魂的契合度(0-100)，影响融合难度与发挥'),
    状态: z.string().prefault('沉睡'),
    战力面板: z
      .object({
        对标等级: z.coerce.number().prefault(0),
        str: z.coerce.number().prefault(0),
        def: z.coerce.number().prefault(0),
        agi: z.coerce.number().prefault(0),
        vit_max: z.coerce.number().prefault(0),
        men_max: z.coerce.number().prefault(0),
        sp_max: z.coerce.number().prefault(0),
      })
      .optional()
      .describe('魂灵战力面板'),
  })
  .transform(规范化魂灵Schema_V1)
  .prefault({});
const MartialSoulSchema = z
  .looseObject({
    表象名称: z.string().prefault(AI_TODO_SPIRIT_NAME).describe('武魂名'),
    描述: z.string().prefault(AI_TODO_SPIRIT_DESC).describe('武魂的具体形态与能力描述'),
    系别: z.string().prefault(武魂系别待补全文案_V1),
    属性倾向: z.string().prefault(武魂属性倾向待补全文案_V1).describe('武魂属性倾向：均衡/偏攻击/偏防御/偏速度/偏精神/偏控制'),
    属性体系: z.string().prefault(AI_TODO_ATTRIBUTE_SYSTEM).describe('武魂属性体系：无/元素/五行'),
    可调用元素: z.array(z.string()).prefault([AI_TODO_CALLABLE_ELEMENTS]).describe('武魂当前可调用的元素列表'),
  })
  .transform(规范化武魂Schema_V1)
  .prefault({});
const BloodlineRingSchema = z
  .looseObject({
    颜色: z.string().prefault('无'),
    炸环恢复tick: z.coerce.number().optional(),
    炸环恢复时间: z.string().optional(),
  })
  .transform(规范化血脉魂环Schema_V1)
  .prefault({});
const BloodlinePowerSchema = z
  .looseObject({
    血脉: z.string().prefault('无').describe('血脉名称'),
    解封层数: z.coerce.number().prefault(0).describe('血脉封印解除层数'),
    核心: z.string().prefault('未凝聚').describe('气血魂核状态'),
    生命之火: z.boolean().prefault(false).describe('生命之火状态'),
    // 战斗里点燃的生命之火战后熄灭（BattlePreview igniteLifeFire）：战斗写回此标记，MVU_Schema_Runtime 按熄灭规则扣级后清除。
    生命之火熄灭结算: z.boolean().optional().describe('战斗中点燃的生命之火待熄灭结算（系统自动维护）'),
    技能: z.record(z.string(), SkillStructSchema).prefault({}).describe('血脉主动散技(无魂环)'),
    被动: z.record(z.string(), SkillStructSchema).prefault({}).describe('血脉被动特性'),
    永久加成: z
      .record(z.string(), BloodlinePermanentBonusSchema)
      .prefault({})
      .describe('血脉永久成长节点，按解封时当前属性固化为固定数值'),
  })
  .transform(规范化血脉之力Schema_V1)
  .prefault({});

const ItemLibrarySchema = z.looseObject({}).transform(规范化物品分类表_V1).prefault({});

const 赛事权限非负整数Schema_V1 = (默认值 = 0) =>
  z.coerce.number().int().transform(值 => Math.max(0, 值)).catch(默认值);
const 赛事权限正整数Schema_V1 = (默认值 = 1) =>
  z.coerce.number().int().transform(值 => Math.max(1, 值)).catch(默认值);
const 赛事权限比例Schema_V1 = (默认值 = 0) =>
  z.coerce.number().transform(值 => Math.min(99, Math.max(0, 值))).catch(默认值);
const 赛事权限文本Schema_V1 = (默认值 = '') =>
  z.string().transform(值 => 值.trim()).catch(默认值);

const 权限使用配额Schema_V1 = z
  .object({
    上限: 赛事权限正整数Schema_V1(),
    剩余: 赛事权限非负整数Schema_V1(),
    重置周期: 赛事权限文本Schema_V1().optional(),
    下次重置tick: 赛事权限非负整数Schema_V1().optional(),
  })
  .strict()
  .transform(配额 => ({
    ...配额,
    剩余: Math.min(配额.上限, 配额.剩余),
    ...(!配额.重置周期 ? { 下次重置tick: undefined } : {}),
  }));

const 资格权限Schema_V1 = z
  .object({
    类型: z.literal('资格'),
    项目: 赛事权限文本Schema_V1(),
  })
  .strict();

const 折扣权限Schema_V1 = z
  .object({
    类型: z.literal('折扣'),
    地点: 赛事权限文本Schema_V1().optional(),
    商店: 赛事权限文本Schema_V1().optional(),
    物品分类: 赛事权限文本Schema_V1().optional(),
    物品: 赛事权限文本Schema_V1().optional(),
    支付比例: 赛事权限比例Schema_V1(),
  })
  .strict();

const 物品选择权限Schema_V1 = z
  .object({
    类型: z.literal('物品选择'),
    来源: 赛事权限文本Schema_V1(),
    数量: 赛事权限正整数Schema_V1(),
    品质: z.enum(['普通', '优秀', '稀有', '史诗', '传说', '神器', '超神器']).optional(),
    分类: 赛事权限文本Schema_V1().optional(),
  })
  .strict();

const 奖励加成权限Schema_V1 = z
  .object({
    类型: z.literal('奖励加成'),
    来源: 赛事权限文本Schema_V1(),
    倍率: z.coerce.number().transform(值 => Math.max(0, 值)).catch(1),
  })
  .strict();

const 特殊权限Schema_V1 = z
  .object({
    名称: 赛事权限文本Schema_V1(),
    持有人: 赛事权限文本Schema_V1(),
    权限: z.discriminatedUnion('类型', [
      资格权限Schema_V1,
      折扣权限Schema_V1,
      物品选择权限Schema_V1,
      奖励加成权限Schema_V1,
    ]),
    使用配额: 权限使用配额Schema_V1.optional(),
    到期tick: 赛事权限非负整数Schema_V1().optional(),
  })
  .strict();

const 赛事项目流程Schema_V1 = z.enum(['单场', '循环', '淘汰', '循环后淘汰']);
const 赛事参赛者Schema_V1 = z
  .object({
    名称: 赛事权限文本Schema_V1(),
    成员: z.array(赛事权限文本Schema_V1()).transform(值 => Array.from(new Set(值.filter(Boolean)))).prefault([]),
    状态: z.enum(['参赛', '退赛', '取消资格']).prefault('参赛'),
  })
  .strict();
const 赛事参赛限制Schema_V1 = z
  .object({
    队伍人数上限: 赛事权限正整数Schema_V1().optional(),
    年龄上限: 赛事权限非负整数Schema_V1().optional(),
    等级上限: 赛事权限非负整数Schema_V1().optional(),
    允许身份: z.array(赛事权限文本Schema_V1()).prefault([]).optional(),
    必需装备: z.array(赛事权限文本Schema_V1()).prefault([]).optional(),
    禁止装备: z.array(赛事权限文本Schema_V1()).prefault([]).optional(),
    报名费用: z.object({
      货币: 赛事权限文本Schema_V1(),
      金额: z.coerce.number().transform(值 => Math.max(0, 值)).catch(0),
    }).strict().optional(),
  })
  .strict()
  .prefault({});
const 赛事项目Schema_V1 = z
  .object({
    流程: 赛事项目流程Schema_V1,
    // 团体赛一个对局怎么打（不写为团战）：团战／擂台（一对一车轮）／擂台团战积分（先擂台再团战）／单双团积分（三场一对一、两场二对二再团战）。
    // 每队上场人数：团战与擂台每队各上几人（最多 7，省略 7）；两段各自挑人，不一定是同一批。
    对局赛制: z.enum(['团战', '擂台', '擂台团战积分', '单双团积分']).optional(),
    每队上场人数: 赛事权限正整数Schema_V1().optional(),
    参赛总数: 赛事权限正整数Schema_V1(),
    参赛者: z.record(z.string(), 赛事参赛者Schema_V1).prefault({}),
    参赛限制: 赛事参赛限制Schema_V1.optional(),
  })
  .strict();
const 赛事私有项目进度Schema_V1 = z
  .object({
    状态: z.enum(['进行中', '已完成']).prefault('进行中'),
    当前环节: 赛事权限文本Schema_V1().optional(),
    当前轮次: 赛事权限非负整数Schema_V1().prefault(1),
    分组结果: z.record(z.string(), z.any()).prefault({}),
    对局: z.record(z.string(), z.any()).prefault({}),
    系列比分: z.record(z.string(), z.any()).prefault({}),
    开始tick: 赛事权限非负整数Schema_V1(),
    结束tick: 赛事权限非负整数Schema_V1(),
    下一场tick: 赛事权限非负整数Schema_V1().optional(),
    生成种子: 赛事权限文本Schema_V1(),
    模拟数量: 赛事权限非负整数Schema_V1().prefault(0),
    // 启动赛事时补位的模拟参赛者与未知成员的登记参赛者（确保赛事参赛者实体_桥接 读它）；此前未登记，strict 校验整份失败。
    模拟参赛者: z.record(z.string(), z.any()).optional(),
    实体: z.record(z.string(), z.any()).prefault({}),
    实体代号: z.record(z.string(), 赛事权限文本Schema_V1()).prefault({}),
    代号映射: z.record(z.string(), 赛事权限文本Schema_V1()).prefault({}),
    实体绑定: z.record(z.string(), 赛事权限文本Schema_V1()).prefault({}),
  })
  .strict();
const 赛事私有进度Schema_V1 = z
  .object({
    个人赛: 赛事私有项目进度Schema_V1.optional(),
    团体赛: 赛事私有项目进度Schema_V1.optional(),
  })
  .strict()
  .optional();
const 赛事Schema_V1 = z
  .object({
    名称: 赛事权限文本Schema_V1(),
    状态: z.enum(['筹备', '进行中', '已完成']).prefault('筹备'),
    日程: z.object({
      开始tick: 赛事权限非负整数Schema_V1(),
      结束tick: 赛事权限非负整数Schema_V1(),
    }).strict(),
    项目: z.object({
      个人赛: 赛事项目Schema_V1.optional(),
      团体赛: 赛事项目Schema_V1.optional(),
    }).strict(),
    _进度: 赛事私有进度Schema_V1,
  })
  .strict();
const 赛事战斗上下文Schema_V1 = z
  .object({
    赛事ID: 赛事权限文本Schema_V1(),
    项目: z.enum(['个人赛', '团体赛']),
    对局ID: 赛事权限文本Schema_V1(),
    结算ID: 赛事权限文本Schema_V1(),
    子场序号: 赛事权限非负整数Schema_V1().optional(),
    准备tick: 赛事权限非负整数Schema_V1().optional(),
    代号绑定: z.record(z.string(), 赛事权限文本Schema_V1()).optional(),
    // 后续出场（BattlePreview matchFollowUp）：{ PLAYER|ENEMY: { 接续, 团战 } }
    后续: z.record(z.string(), z.any()).optional(),
    // 比赛规则禁止装备（赛事项目 参赛限制.禁止装备，S80-A）
    禁止装备: z.array(z.string()).optional(),
  })
  .strict();

const 交付需求Schema_V1 = z
  .object({
    类型: z.literal('物品').prefault('物品'),
    名称: z.string().min(1),
    数量: z.coerce.number().int().min(1).prefault(1),
    品质下限: z.enum(['普通', '优秀', '稀有', '史诗', '传说', '神器', '超神器']).optional(),
  })
  .optional();

const StatsSchema = z
  .object({
    年龄: z.coerce.number().prefault(0).describe('年龄(出场必填)'),
    生日: z.string().prefault('待生成').describe('生日，格式为X月X日或MM-DD，初始化后只读'),
    性别: z.string().optional().describe('性别'),
    等级: z
      .any()
      .transform(规范化等级输入Schema_V1)
      .prefault(1),
    上次灵物等级: z.coerce.number().prefault(-20).describe('上次吸收灵物的等级'),
    等级惩罚: z.coerce.number().prefault(0).describe('违规吸收导致的等级上限永久扣除'),
    天赋梯队: z.string().prefault('正常').describe('天赋梯队'),
    邪魂师: z.boolean().prefault(false).describe('是否为邪魂师'),
    底子波动: z.coerce.number().prefault(0).describe('先天底子波动值'),
    魂力: z.coerce.number().prefault(-1).describe('当前魂力'),
    魂力上限: z.coerce.number().prefault(10).describe('修为突破判定与当前资源共同使用的魂力上限，包含魂环、魂骨、血脉、灵物等永久来源，不包含装备与临时状态'),
    精神力: z.coerce.number().prefault(-1).describe('当前精神力'),
    精神力上限: z.coerce.number().prefault(10).describe('精神力上限'),
    精神境界: z.string().prefault('灵元境'),

    力量: z.coerce.number().prefault(10).describe('力量'),
    防御: z.coerce.number().prefault(10).describe('防御'),
    敏捷: z.coerce.number().prefault(10).describe('敏捷'),
    HP: z.coerce.number().prefault(-1).describe('当前生命值/伤势值'),
    HP上限: z.coerce.number().prefault(-1).describe('生命值上限'),
    体力: z.coerce.number().prefault(-1).describe('当前体力'),
    体力上限: z.coerce.number().prefault(10).describe('体力上限'),

    训练加成: z
      .object({
        力量: z.coerce.number().prefault(0),
        防御: z.coerce.number().prefault(0),
        敏捷: z.coerce.number().prefault(0),
        体力上限: z.coerce.number().prefault(0),
        精神力上限: z.coerce.number().prefault(0),
        魂力上限: z.coerce.number().prefault(0),
      })
      .prefault({}),

  })
  .catchall(z.any())
  .prefault({})
  .transform(规范化属性Schema_V1);

const CharacterSchema = z
  .object({
    属性: StatsSchema,
    装备: EquipmentSchema,
    外貌: AppearanceSchema,
    穿搭: ClothingSchema,
    性格: z.string().prefault(AI_TODO_PERSONALITY).describe('角色的性格特征，随经历可能发生改变'),
    // 种族（用户 11-19）：不写即魂师（斗罗大陆出生的人，先天零魂力也算）；写错的值按没写处理，存档不补空字段。
    种族: z.enum(['魂师', '魂兽', '深渊', '其他']).optional().catch(undefined)
      .describe('种族：魂师（斗罗大陆出生的人，含先天零魂力）／魂兽／深渊／其他（如外星、异界来客）；不写即魂师'),
    魂骨: SoulBoneSchema,
    血脉之力: BloodlinePowerSchema,
    魂核: z
      .object({
        核心: z
          .object({
            数量: z.coerce.number().prefault(0),
            进度: z.coerce.number().prefault(0).describe('凝聚进度(%)'),
          })
          .prefault({}),
      })
      .prefault({}),
    财富: WealthSchema,
私密档案: z
      .object({
        发情度: z.coerce.number().prefault(0).describe('当前发情度/催情值(0-100)'),
        敏感度: z.coerce.number().prefault(10).describe('身体整体敏感度基础值'),
        开发度: z.coerce.number().prefault(0).describe('身体整体开发度/调教进度(0-100)'),

        性癖: z.array(z.string()).prefault(['待补全(请根据角色经历，填写已觉醒的特殊性癖好标签)']),
        性幻想: z.array(z.string()).prefault(['待补全(请根据角色隐藏的性格，描写其内心深处渴望被对待的私密方式)']),

        受孕tick: z.coerce.number().prefault(-1).describe('受孕时的tick，-1表示未怀孕'),
        受孕对象: z.string().prefault('无').describe('孩子父亲'),

        _生理阶段: z.string().prefault('计算中...').describe('当前生理阶段(只读)'),
        _怀孕天数: z.coerce.number().prefault(0).describe('当前怀孕天数(只读)'),
         身材数据: z
          .object({
            胸围: z.coerce.number().prefault(0),
            腰围: z.coerce.number().prefault(0),
            臀围: z.coerce.number().prefault(0),
            罩杯: z.string().prefault('待补全(请根据角色体型填写，如A/B/C/D/E)'),
            身材描述: z.string().prefault('待补全(请描写其身材曲线与肉感)'),
          })
          .prefault({}),

        _已来初潮: z.boolean().prefault(false).describe('是否已来初潮(底层只读)'),
        生理期偏移: z.coerce.number().prefault(0).describe('生理周期偏移量(28天=4032tick，默认0)'),
        身体部位: z
          .object({
            胸部: BodyPartSchema,
            花穴: BodyPartSchema,
			菊穴: BodyPartSchema,
            屁股: BodyPartSchema,
            大腿: BodyPartSchema,
            嘴唇: BodyPartSchema,
            脚丫: BodyPartSchema,
            尾巴: BodyPartSchema,
            耳朵: BodyPartSchema,
            鼻子: BodyPartSchema,
            腋下: BodyPartSchema,
            脖颈: BodyPartSchema,
          })
          .prefault({}),
        贴身衣物: z
          .object({
            内衣: z.string().prefault('待补全(请根据当前情境描写具体内衣款式，如蕾丝胸罩/真空/拘束具)'),
            内裤: z.string().prefault('待补全(请描写具体内裤款式，如丁字裤/C字裤/真空/贞操带)'),
            特殊道具: z.array(z.string()).prefault(['待补全(若体内或体表佩戴了跳蛋/项圈等道具请在此列出)']),
          })
          .prefault({}),

        经历次数: z
          .object({
            自慰: z.coerce.number().prefault(0),
            性交: z.coerce.number().prefault(0),
            手交: z.coerce.number().prefault(0),
            足交: z.coerce.number().prefault(0),
            口交: z.coerce.number().prefault(0),
            素股: z.coerce.number().prefault(0),
            发交: z.coerce.number().prefault(0),
            SM: z.coerce.number().prefault(0),
            COSPLAY: z.coerce.number().prefault(0),
            高潮: z.coerce.number().prefault(0),
			内射: z.coerce.number().prefault(0),
			颜射: z.coerce.number().prefault(0),
			吞精: z.coerce.number().prefault(0),
			宠物扮演: z.coerce.number().prefault(0),
          })
          .prefault({}),

        _最近高潮tick: z.coerce.number().prefault(0).describe('最近一次高潮发生的tick'),
      })
      .prefault({}),

    状态: z
      .object({
        位置: z.string().prefault(AI_TODO_STATUS_LOC).describe('当前位置绝对路径'),
        横坐标: z.coerce.number().prefault(-1).describe('当前位置横坐标'),
        纵坐标: z.coerce.number().prefault(-1).describe('当前位置纵坐标'),
        存活: z.boolean().prefault(true),
        死亡tick: z.coerce.number().prefault(-1).describe('-1表示未死亡；非负数表示死亡发生tick'),
        死亡类型: z.enum(['无', '自然', '意外']).prefault('无').describe('死亡时由AI判断为自然或意外；复活只允许意外死亡'),
        受伤部位: z
          .record(
            z.string(),
            z
              .object({
                程度: z.enum(['轻', '中', '重']).prefault('轻'),
                描述: z.string().prefault(''),
              })
              .prefault({}),
          )
          .prefault({}),
        吸收灵物年限: z.coerce.number().prefault(0).describe('当前正在吸收的灵物年份(阅后即焚)'),
      })
      .catchall(z.any())
      .prefault({}),
    已掌握情报: z.array(z.string()).prefault([]).describe('该角色已解锁的核心情报列表'),
    复制效果: z
      .record(
        z.string(),
        z
          .object({
            到期tick: z.coerce.number().prefault(0),
            技能列表: z
              .record(
                z.string(),
                z
                  .object({
                    技能数据: SkillStructSchema.prefault({}),
                    剩余次数: z.coerce.number().optional(),
                  })
                  .prefault({}),
              )
              .prefault({})
              .transform(规范化复制技能列表Schema_V1),
            属性快照: z
              .record(z.string(), z.coerce.number())
              .prefault({})
              .transform(规范化属性快照Schema_V1),
          })
          .prefault({}),
      )
      .prefault({})
      .transform(规范化复制效果Schema_V1),

    魂灵塔记录: z
      .object({
        最高层: z.coerce.number().prefault(0).describe('魂灵塔最高通关/自动推进层数'),
        当前五折魂灵: z
          .object({
            层数: z.coerce.number().prefault(0).describe('五折资格来源层数'),
            名称: z.string().prefault('').describe('击败守塔魂灵名称'),
            标准物种: z.string().prefault('').describe('魂灵标准物种'),
            年限: z.coerce.number().prefault(0).describe('魂灵年限'),
            品质: z.string().prefault('').describe('魂灵品质'),
            已使用: z.boolean().prefault(false).describe('五折资格是否已使用'),
          })
          .prefault({}),
      })
      .catchall(z.any())
      .transform(规范化魂灵塔记录Schema_V1)
      .prefault({}),

    战斗历史: z
      .record(
        z.string(),
        z
          .object({
            次数: z.coerce.number().prefault(0),
            胜: z.coerce.number().prefault(0),
            负: z.coerce.number().prefault(0),
            平: z.coerce.number().prefault(0),
            最近结果: z.string().prefault('无'),
            最近tick: z.coerce.number().prefault(0),
          })
          .prefault({}),
      )
      .prefault({})
      .transform(规范化战斗历史Schema_V1),

    // 信息模型 0c（用户 2026-11-17）：在别人面前放过的魂技位图（base36）。位 1～10＝第1武魂第1～10魂环，11～20＝第2武魂，
    // 21～22＝两个武魂真身，其后＝自创魂技、融合技按名字排序。战斗系统战后自动写，只加不减；没放过的角色没有这个字段。
    战斗暴露: z.string().optional().describe('战斗中已暴露的魂技位图（系统自动维护）'),

    副职业: z
      .record(
        z.string(),
        z
          .object({
            等级: z.coerce.number().prefault(0),
            经验: z.coerce.number().prefault(0),
            称号: z.string().prefault('无'),
          })
          .prefault({}),
      )
      .prefault({})
      .transform(规范化副职业Schema_V1),

    第1武魂: MartialSoulSchema,
    第2武魂: MartialSoulSchema.optional(),

    功法: z
      .record(z.string(), z.looseObject({}).prefault({}))
      .prefault({})
      .transform(规范化功法Schema_V1),
    自创魂技: z
      .record(z.string().describe('能力名称'), SkillStructSchema)
      .prefault({})
      .describe('统一自创魂技容器，承载魂环、血脉与武魂融合技以外的原创技能'),
    武魂融合技: z
      .record(
        z.string().describe('融合技名称'),
        z
          .object({
            融合模式: z
              .enum(['partner', 'self'])
              .prefault('partner')
              .describe('融合模式：partner=普通武魂融合技；self=自体武魂融合技'),
            融合对象: z.string().prefault('无').describe('partner模式下的融合对象/羁绊队友姓名；self模式固定为"无"'),
            用法模式: z
              .enum(['一次性释放', '融合增幅'])
              .prefault('一次性释放')
              .describe('武魂融合技用法二选一：一次性释放=融合后打一招；融合增幅=持续融合态并共享双方魂技'),
            来源武魂: z
              .array(z.enum(['第1武魂', '第2武魂']))
              .prefault([])
              .describe('参与融合的武魂槽位。自体融合通常为[第1武魂, 第2武魂]'),
            融合参与者: z
              .array(
                z.object({
                  类型: z.string().prefault('搭档').describe('自身/搭档'),
                  角色键: z.string().prefault('无').describe('参与者在 char 表中的键名'),
                  角色名: z.string().prefault('无').describe('参与者显示名'),
                  武魂: z.string().prefault('第1武魂').describe('参与融合的武魂槽位或武魂名'),
                }),
              )
              .prefault([])
              .describe('武魂融合技实际参与者列表，用于跨角色属性继承与可用性判定'),
            技能数据: SkillStructSchema,
          })
          .prefault({}),
      )
      .prefault({})
      .describe('武魂融合技列表（统一区分自体融合与普通融合）'),
    // 融合技（非武魂融合，接入方案 S80-E，用户 2026-11-16「尽量简化」）：2～7 人各出自己的一个魂技合成一招（苍晖学院七位一体、
    // 海上生明月），弱于武魂融合技。技能数据由读档时按各参与者贡献的魂技合成（MVU_Schema_Runtime 合成魂技融合技能数据_V1）。
    融合技: z
      .record(
        z.string().describe('融合技名称'),
        z
          .object({
            融合类型: z.string().prefault('魂技融合').describe('魂技融合：参与者各贡献一个魂技合成一招，不是武魂融合'),
            融合模式: z.enum(['partner']).prefault('partner'),
            用法模式: z.enum(['一次性释放']).prefault('一次性释放'),
            融合参与者: z
              .array(
                z.object({
                  类型: z.string().prefault('搭档').describe('自身/搭档'),
                  角色键: z.string().prefault('无').describe('参与者在 char 表中的键名'),
                  角色名: z.string().prefault('无').describe('参与者显示名'),
                  魂技名: z.string().prefault('无').describe('该参与者贡献的魂技名'),
                }),
              )
              .prefault([])
              .describe('融合技参与者与各自贡献的魂技'),
            技能数据: SkillStructSchema,
          })
          .prefault({}),
      )
      .prefault({})
      .describe('融合技（非武魂融合）：参与者各贡献一个魂技合成一招，效果由贡献的魂技合并、按人数加成'),
    // 魂兽转化（魂兽转化与本命召唤兽设计，用户 2026-11-17）：剧情里魂兽成为本命召唤兽、魂灵，或献祭给此人时写一条；
    // 具体结构由读档代码按魂兽数据生成（MVU_Schema_Runtime 应用魂兽转化_V1），不写技能数据。
    转化记录: z
      .array(
        z.looseObject({
          类型: z.string().prefault('本命召唤兽').describe('本命召唤兽 / 魂灵 / 献祭'),
          来源: z.string().prefault('无').describe('魂兽在 char 中的键名或名字'),
          魂技名: z.string().optional().describe('本命召唤兽：召唤魂技的名字，缺省为「召唤＋魂兽名」'),
        }),
      )
      .prefault([])
      .describe('魂兽转化记录'),
    精神领域: z
      .object({
        名称: z.string().prefault('无').describe('精神领域名称，例如：时光回溯、情绪剥夺'),
        描述: z.string().prefault('无').describe('领域效果的具体描述，用自然语言描写'),
      })
      .catchall(z.any())
      .prefault({}),

    社交: z
      .object({
        声望: z.coerce.number().prefault(0),
        名望等级: z.string().prefault('籍籍无名'),
        主身份: z.string().prefault(AI_TODO_MAIN_IDENTITY).describe('当前主要公开身份'),
        家世描述: z.string().prefault(AI_TODO_FAMILY_BACKGROUND).describe('公开档案中的家世/出身描述'),
        势力: z
          .record(
            z.string(),
            z.object({ 身份: z.string().prefault('无'), 权限级: z.coerce.number().prefault(0) }).prefault({}),
          )
          .prefault({}),
        称号: z
          .record(
            z.string(),
            z.object({ 来源: z.string().prefault('无'), 声望加成: z.coerce.number().prefault(0) }).prefault({}),
          )
          .prefault({}),
        关系: z
          .record(
            z.string(),
            z
              .object({
                关系: z.string().prefault('陌生'),
                好感度: z.coerce.number().transform(值 => Math.max(-100, Math.min(100, 值))).prefault(0),
                对方身份: z.string().prefault('无'),
                武魂相关度基础: z
                  .union([z.coerce.number(), z.string()])
                  .prefault(武魂相关度基础待补全提示词)
                  .describe('武魂相关度基础分(0-100，待补全提示词表示待AI初始化)'),
              })
              .prefault({}),
          )
          .prefault({}),
      })
      .prefault({})
      .transform(规范化社交Schema_V1),

    背包: z
      .record(
        z.string(),
        z
          .object({
            数量: z.coerce.number().prefault(1),
            批次: z
              .array(
                z
                  .object({
                    数量: z.coerce.number().prefault(1),
                    品质: z.string().optional(),
                    品质系数: z.coerce.number().optional(),
                    阶位: z.coerce.number().optional(),
                    基础金属: z.string().optional(),
                    魂导等级: z.coerce.number().optional(),
                    副职业参数: z
                      .object({
                        融合参数: z
                          .object({
                            数量: z.coerce.number().optional(),
                            融合率: z.coerce.number().optional(),
                          })
                          .optional(),
                      })
                      .optional(),
                    耐久: z.coerce.number().optional(),
                    剩余使用次数: z.coerce.number().optional(),
                    使用次数恢复至tick: z.coerce.number().optional(),
                    绑定者: z.string().optional(),
                    有效期至tick: z.coerce.number().optional(),
                  })
                  .prefault({}),
              )
              .prefault([]),
          })
          .transform(规范化背包项Schema_V1)
          .prefault({}),
      )
      .prefault({}),

    我的任务: z
      .record(
        z.string(),
        z
          .object({
            任务线: z.string().prefault('支线'),
            状态: z.string().prefault('进行中'),
            当前进度: z.coerce.number().prefault(0),
            奖励币: z.coerce.number().prefault(0),
            奖励声望: z.coerce.number().prefault(0),
            描述: z.string().prefault('无'),
            最后更新时间tick: z.coerce.number().prefault(0).describe('最近一次进度更新tick'),
            交付需求: 交付需求Schema_V1.optional(),
            截止tick: z.coerce.number().optional(),
          })
          .prefault({}),
      )
      .prefault({}),

    __mvu_isPlayer: z.boolean().optional().prefault(false),
    __mvu_显式天赋梯队: z.string().optional(),
  })
  .prefault({})
  .transform(规范化角色Schema_V1);

const FactionSchema = z
  .object({
    类型: z.string().describe('势力静态身份类型'),
    别名: z.array(z.string()).optional(),
    关键词: z.array(z.string()).optional(),
    描述: z.string().describe('势力静态身份描述'),
    现状描述: z.string().optional().describe('本档动态摘要，汇总当前多个方向的变化'),
    影响力: z.coerce.number(),
    规模: z.coerce.number(),
    状态: z.enum(['正常', '鼎盛', '衰落', '隐世', '蛰伏', '戒备', '濒危']),
    上级势力: z.string().describe('上级势力/从属关系，如：斗罗联邦'),
    关系: z.record(z.string(), z.object({ 态度: z.string() }).strict()),
    战力统计: z
      .object({
        极限斗罗: z.coerce.number().describe('极限斗罗数量'),
        超级斗罗: z.coerce.number().describe('超级斗罗数量'),
        封号斗罗: z.coerce.number().describe('普通封号斗罗数量'),
      })
      .strict(),
  })
  .strict();

const LocationShopSchema_V1 = z.record(
  z.string().describe('商店名，如：传灵塔分店'),
  z
    .object({
      库存: z
        .record(
          z.string().describe('商品ID或名称'),
          z
            .object({
              库存: z.coerce.number().prefault(0).describe('库存'),
              价格倍率: z.coerce.number().prefault(1),
              折扣: z.coerce.number().prefault(0),
              需求声望: z.coerce.number().prefault(0).describe('声望要求'),
              需求: z.record(z.string(), z.any()).prefault({}).describe('额外兑换条件'),
              批次: z.array(z.any()).prefault([]),
            })
            .transform(规范化商店库存项Schema_V1)
            .prefault({}),
        )
        .prefault({})
        .describe('商品库存列表'),
      _下次刷新tick: z.coerce.number().prefault(0).describe('下次刷新时间'),
    }),
);

const LocationNodeSchema_V1 = z.lazy(() => z
  .object({
    类型: z.string(),
    别名: z.array(z.string()).optional(),
    关键词: z.array(z.string()).optional(),
    描述: z.string(),
    现状描述: z.string().optional(),
    掌控势力: z.string(),
    状态: z.string(),
    人口: z.coerce.number().optional(),
    守护军团: z.string().optional(),
    经济状况: z.enum(['繁荣', '普通', '萧条', '未知']).optional(),
    x: z.coerce.number().optional(),
    y: z.coerce.number().optional(),
    商店: LocationShopSchema_V1.optional(),
    子节点: z.record(z.string(), LocationNodeSchema_V1).optional(),
  })
  .strict());

const SchemaRootObject = z
  .object({
    sys: z
      .object({
        玩家名: z.string().prefault('无名氏').describe('当前玩家角色姓名'),
        系统播报: z.string().prefault('初始化').describe('最近一次系统广播、突破提示或结算摘要'),
      })
      .prefault({}),
    char: z.record(z.string(), CharacterSchema).prefault({}),
    物品: ItemLibrarySchema,
    org: z.record(z.string(), FactionSchema).prefault({}),
    world: z
      .object({
        时间: z
          .object({
            tick: z.coerce.number().prefault(DEFAULT_NEW_GAME_TICK),
            _上次结算tick: z.coerce.number().optional(),
            _calendar: z.string().prefault('斗罗历X年X月X日 HH:MM'),
          })
          .prefault({}),
        时间线: z
          .record(
            z.string().describe('未来事件名'),
            z
              .object({
                事件: z.string().prefault('无'),
                触发tick: z.coerce.number().prefault(0),
                地点: z.string().prefault('无'),
                状态: z.string().prefault('pending'),
                后续: z.string().prefault(''),
              })
              .prefault({}),
          )
          .prefault({})
          .describe('未来事件备忘录，记录明确的未来约定、限时任务、定时危机'),
        原著事件状态: 原著事件状态Schema_V1,
        偏差值: z.coerce.number().prefault(0).describe('世界线偏差值(0-100)'),
        偏差倍率: z.coerce.number().prefault(1.0).describe('偏差值累计倍率'),
        累计击杀年限: z.coerce.number().prefault(0).describe('星斗大森林累计被杀魂兽年限'),
        兽潮已触发: z.boolean().prefault(false),
        机密情报: z
          .record(
            z.string(),
            z
              .object({
                内容: z.string().prefault('无'),
                知情规则: z.array(z.string()).prefault([]),
              })
              .prefault({}),
          )
          .prefault({}),
        拍卖: z
          .object({
            状态: z.string().prefault('休市'),
            下次刷新tick: z.coerce.number().prefault(7),
            地点: z.string().prefault('无'),
            拍品: z
              .record(
                z.string(),
                z
                  .object({
                    分类: z.string().prefault('剧情杂物'),
                    品级: z.string().prefault('低阶'),
                    背景: z.string().prefault('无'),
                    价格: z.coerce.number().prefault(0),
                  })
                  .prefault({}),
              )
              .prefault({}),
          })
          .prefault({}),
        委托板: z
          .record(
            z.string(),
            z
              .object({
                标题: z.string().prefault('无'),
                描述: z.string().prefault('无'),
                框架描述: z.string().prefault('无'),
                发布者: z.string().prefault('系统'),
                面向: z.string().prefault('公开'),
                指定对象: z.string().prefault('无'),
                状态: z.string().prefault('待接取'),
                难度: z.string().prefault('中'),
                资源级别: z.string().prefault('无'),
                奖励币: z.coerce.number().prefault(0),
                奖励声望: z.coerce.number().prefault(0),
                承接者: z.string().prefault('无'),
                生成tick: z.coerce.number().prefault(0),
                交付需求: 交付需求Schema_V1.optional(),
                截止tick: z.coerce.number().optional(),
              })
              .prefault({}),
          )
          .prefault({}),
        特殊权限: z.record(z.string(), 特殊权限Schema_V1).prefault({}),
        赛事: z.record(z.string(), 赛事Schema_V1).prefault({}),
        地点: z
          .record(z.string().describe('地点名称'), LocationNodeSchema_V1)
          .prefault({})
          .describe('世界主要地点的数据化索引'),

        动态地点: z
          .record(
            z.string().describe('动态生成的具体地点名称，如：东海学院旁小吃街'),
            z
              .object({
                归属父节点: z.string().describe('归属父节点名称'),
                类型: z.string().optional(),
                描述: z.string().prefault('无'),
                现状描述: z.string().optional(),
                x: z.coerce.number().prefault(-1).describe('地图坐标X'),
                y: z.coerce.number().prefault(-1).describe('地图坐标Y'),
                势力: z.string().prefault('未知'),
                状态: z.string().prefault('intact'),
                商店: LocationShopSchema_V1.optional(),
              })
              .prefault({}),
          )
          .prefault({})
          .transform(规范化动态地点Schema_V1)
          .describe('随剧情动态拓展的子地图节点'),
        图鉴: z
          .record(
            z.string().describe('魂兽或深渊生物图鉴键，如：万年暗金恐爪熊、六爪魔'),
            z
              .object({
                类型: z.string().prefault('怪物'),
                名称: z.string().prefault('未知'),
                具体物种: z.string().optional(),
                标准物种: z.string().optional(),
                物种品质: z.string().optional(),
                年限档: z.string().optional(),
                年限下限: z.coerce.number().optional(),
                年限上限: z.coerce.number().optional(),
                标准种族: z.string().optional(),
                常见级别: z.string().optional(),
                对标等级: z.coerce.number().prefault(0),
                常见系别: z.string().prefault('未知系'),
                标准技能: z.record(z.string(), z.any()).prefault({}),
              })
              .catchall(z.any())
              .prefault({}),
          )
          .prefault({})
          .describe('怪物图鉴，记录已遭遇怪物的标准数据'),
        战斗: z
          .object({
            进行中: z.boolean().prefault(false).describe('是否处于战斗中'),
            战斗类型: z.string().prefault('未知').describe('战斗烈度，决定是否触发锁血保护与死亡结算'),
            先攻: z
              .string()
              .prefault('无')
              .describe('掌握先手权的角色名。若为"无"则代表公平开局；若有名字则代表突发偷袭，防守方首回合反应率减半'),
            允许撤离: z.boolean().prefault(true).describe('是否允许逃跑。若为false则代表背水一战，触发困兽机制'),
            回合: z.coerce.number().prefault(0).describe('当前回合数'),
            环境: z
              .object({
                地点: z.string().prefault('正常'),
                临时规则ID: z.array(z.string()).prefault([]),
              })
              .strict()
              .prefault({})
              .describe('战场地点与临时规则ID；规则内容由地点/运行时解析'),
            战斗意图: z
              .enum(['点到为止', '尽量生擒', '重伤压制', '必杀'])
              .prefault('点到为止')
              .describe('本次战斗的主观意图，决定是否允许致死与前端建议结局'),
            裁断结果: z.string().prefault(''),
            赛事上下文: 赛事战斗上下文Schema_V1.optional(),
            // 中途罢手（战斗系统维护）：进行中的提议 { 状态 待回应/成立, 提议方, 提议者, 回合 } 与各方的提议次数、上次被拒回合。
            罢手: z.any().optional().describe('进行中的罢手提议（系统自动维护）'),
            罢手记录: z.any().optional().describe('各方罢手提议次数与被拒回合（系统自动维护）'),
            // 交手约定（试招、赌约）：{ 不还手: [名字], 只硬接: [名字], 压制修为: { 名字: 等级 } }；胜负条件可配 接满攻击次数 / 逼出武魂 / 单次伤害门槛。
            交手约定: z.any().optional().describe('交手约定：不还手、只硬接、压制修为（按参战者名字）'),
            攻击记录: z.any().optional().describe('各参战者出手次数与单次最大伤害占比（系统自动维护）'),
            佯装记录: z.any().optional().describe('本场各参战者佯装蓄力的次数（系统自动维护）'),
            站位: z.any().optional().describe('两档距离：各参战者在前或在后 { 名字: 前|后 }（系统自动维护）'),
            战前已开武魂: z.any().optional().describe('开战前已放出武魂的参战者名字（推进预设填写）'),
            参战者: z
              .record(z.string().describe('参战槽位或参战者姓名'), z.any())
              .prefault({})
              .describe('当前战场所有参战单位的实时状态'),
          })
          .prefault({}),
      })
      .prefault({}),
  })
  .prefault({});

export const Schema = z
  .preprocess(markPlayerCharacterInSchemaInput, SchemaRootObject)
  .transform(规范化Schema根转换_V1);

globalThis.__LWCS_MARK_MVU_LOAD_V1__?.('mvu-module:schema-ready');

globalThis.__LWCS_MVU_SCHEMA__ = Schema;

globalThis.__LWCS_MVU_SCHEMA_PARTS__ = { CharacterSchema, SkillStructSchema, SoulRingSchema, SoulSpiritSchema, BloodlineRingSchema };

try { if (globalThis.parent && globalThis.parent !== globalThis) { globalThis.parent.__LWCS_MVU_SCHEMA__ = Schema; globalThis.parent.__LWCS_MVU_SCHEMA_PARTS__ = globalThis.__LWCS_MVU_SCHEMA_PARTS__; } } catch (错误) {}

try { if (globalThis.top && globalThis.top !== globalThis) { globalThis.top.__LWCS_MVU_SCHEMA__ = Schema; globalThis.top.__LWCS_MVU_SCHEMA_PARTS__ = globalThis.__LWCS_MVU_SCHEMA_PARTS__; } } catch (错误) {}

try {
  globalThis.__LWCS_MARK_MVU_LOAD_V1__?.('mvu-module:register-start');
  registerMvuSchema(Schema);
  globalThis.__LWCS_MARK_MVU_LOAD_V1__?.('mvu-module:register-resolved');
  globalThis.__LWCS_MVU变量结构已注册__ = true;
  if (globalThis.parent && globalThis.parent !== globalThis) globalThis.parent.__LWCS_MVU变量结构已注册__ = true;
  if (globalThis.top && globalThis.top !== globalThis) globalThis.top.__LWCS_MVU变量结构已注册__ = true;
} catch (错误) {
  globalThis.__LWCS_MARK_MVU_LOAD_V1__?.('mvu-module:register-failed', { 错误: 错误?.message || String(错误 || 'unknown_error') });
  console.warn('LWCS MVU变量结构注册失败', 错误);
}
