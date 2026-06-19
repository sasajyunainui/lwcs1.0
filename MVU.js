import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

import { TimelineEvents } from './timeline.js';

import { IntelEvents } from './IntelEvents.js';

globalThis.__LWCS_REGISTER_MVU_SCHEMA__ = registerMvuSchema;

globalThis.TimelineEvents = TimelineEvents;

globalThis.IntelEvents = IntelEvents;

try { if (globalThis.parent && globalThis.parent !== globalThis) { globalThis.parent.TimelineEvents = TimelineEvents; globalThis.parent.IntelEvents = IntelEvents; globalThis.parent.__LWCS_REGISTER_MVU_SCHEMA__ = registerMvuSchema; } } catch (错误) {}

try { if (globalThis.top && globalThis.top !== globalThis) { globalThis.top.TimelineEvents = TimelineEvents; globalThis.top.IntelEvents = IntelEvents; globalThis.top.__LWCS_REGISTER_MVU_SCHEMA__ = registerMvuSchema; } } catch (错误) {}

const WealthSchema = z
  .object({
    联邦币: z.coerce.number().prefault(0).describe('联邦币'),
    星罗币: z.coerce.number().prefault(0).describe('星罗币'),
    唐门积分: z.coerce.number().prefault(0).describe('唐门积分'),
    学院积分: z.coerce.number().prefault(0).describe('史莱克徽章/积分'),
    战功: z.coerce.number().prefault(0).describe('血神军团功勋'),
  })
  .prefault({});
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
    武器: z
      .object({
        名称: z.string().prefault('无'),
        品阶: z.string().prefault('无').describe('品阶如: 魂导器/神器/超神器'),
        特性: z
          .record(z.string(), z.object({ 描述: z.string().prefault('无') }).prefault({}))
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
      })
      .prefault({}),
    防具: z
      .object({
        名称: z.string().prefault('无'),
        品阶: z.string().prefault('无').describe('普通防具、防护装备或魂导护具品阶'),
        装备状态: z.string().prefault('未装备'),
        特性: z
          .record(z.string(), z.object({ 描述: z.string().prefault('无') }).prefault({}))
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
      })
      .prefault({}),
    斗铠: z
      .object({
        等级: z.coerce.number().prefault(0),
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
    附带属性: z.array(z.string()).prefault([]),
    使用条件: z
      .object({
        最低等级: z.coerce.number().prefault(0),
        最低魂力: z.coerce.number().prefault(0),
        最低精神力: z.coerce.number().prefault(0),
      })
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

const 交付需求Schema_V1 = z
  .object({
    类型: z.literal('物品').optional(),
    名称: z.string().optional(),
    数量: z.coerce.number().optional(),
    分类: z.string().optional(),
    阶位下限: z.coerce.number().optional(),
    品质系数下限: z.coerce.number().optional(),
    基础金属: z.string().optional(),
    魂导等级下限: z.coerce.number().optional(),
    耐久下限: z.coerce.number().optional(),
    剩余使用次数下限: z.coerce.number().optional(),
  })
  .prefault({});

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

        癖好: z.array(z.string()).prefault(['待补全(请根据角色经历，填写已觉醒的特殊癖好标签)']),
        幻想: z.array(z.string()).prefault(['待补全(请根据角色隐藏的性格，描写其内心深处渴望被对待的私密方式)']),

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
        死亡类型: z.enum(['无', '自然', '意外']).prefault('无').describe('复活只允许意外死亡'),
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
        最高层: z.coerce.number().prefault(0).describe('历史最高通关层数'),
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
                好感度: z.coerce.number().prefault(0),
                关系路线: z.string().prefault('朋友线').describe('终极分支: 朋友线/恋人线'),
                对方身份: z.string().prefault('无'),
                _关系阶段: z.string().prefault('陌生').describe('结构化关系阶段，默认与关系称谓同步'),
                _下一阶段: z.string().prefault('认识').describe('下一阶段名称'),
                _下一阶段阈值: z.coerce.number().prefault(11).describe('达到下一阶段所需最低好感度'),
                _可切线: z.boolean().prefault(false).describe('当前是否允许切入恋人线等特殊路线'),
                _切线限制原因: z.string().prefault('好感度不足').describe('路线切换受限时的原因'),
                _推进提示: z.string().prefault('无').describe('当前关系推进提示'),
                _维护优先级: z.string().prefault('未知').describe('关系维护优先级：高风险/待接触/可接触/优先维护'),
                _当前关系加成: z.string().prefault('无').describe('当前已激活的关系加成说明'),
                _下档解锁加成: z.string().prefault('无').describe('下一档可解锁的羁绊加成说明'),
                _下档解锁阈值: z.coerce.number().prefault(30).describe('下一档羁绊加成所需好感度'),
                武魂相关度基础: z
                  .union([z.coerce.number(), z.string()])
                  .prefault(武魂相关度基础待补全提示词)
                  .describe('武魂相关度基础分(0-100，待补全提示词表示待AI初始化)'),
              })
              .prefault({}),
          )
          .prefault({}),
        关系分析: z
          .object({
            摘要: z.string().prefault('当前尚未积累足够的人物关系数据。'),
            关注对象: z.string().prefault('无'),
            重点对象: z
              .any()
              .transform(规范化关系分析重点对象Schema_V1)
              .prefault([]),
            恋爱候选: z.array(z.string()).prefault([]),
            信任对象: z.array(z.string()).prefault([]),
            风险对象: z.array(z.string()).prefault([]),
            受阻对象: z
              .array(
                z
                  .object({
                    对象: z.string().prefault('无'),
                    原因: z.string().prefault('无'),
                  })
                  .prefault({}),
              )
              .prefault([]),
            同地对象: z.array(z.string()).prefault([]),
            可联络对象: z.array(z.string()).prefault([]),
          })
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
    影响力: z.coerce.number().prefault(0),
    规模: z.coerce.number().prefault(0),
    状态: z.string().prefault('正常'),
    上级势力: z.string().prefault('无').describe('上级势力/从属关系，如：斗罗联邦'),
    关系: z.record(z.string(), z.object({ 态度: z.string().prefault('中立') }).prefault({})).prefault({}),
    成员: z.record(z.string(), z.object({ 职位: z.string().prefault('外围') }).prefault({})).prefault({}),
    战力统计: z
      .object({
        极限斗罗: z.coerce.number().prefault(0).describe('极限斗罗数量'),
        超级斗罗: z.coerce.number().prefault(0).describe('超级斗罗数量'),
        封号斗罗: z.coerce.number().prefault(0).describe('普通封号斗罗数量'),
      })
      .prefault({}),
  })
  .prefault({});

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
            tick: z.coerce.number().prefault(0),
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
        地点: z
          .record(
            z.string().describe('地点名称'),
            z
              .object({
                掌控势力: z.string().prefault('未知'),
                人口: z.coerce.number().prefault(0),
                守护军团: z.string().prefault('无'),
                经济状况: z.enum(['繁荣', '普通', '萧条', '未知']).prefault('未知'),
                x: z.coerce.number().prefault(-1),
                y: z.coerce.number().prefault(-1),
                类型: z.string().prefault('地图节点'),
                描述: z.string().prefault('无'),
                状态: z.string().prefault('intact'),
                子节点: z.record(z.string(), z.any()).prefault({}),
                商店: z
                  .record(
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
                      })
                      .prefault({}),
                  )
                  .prefault({})
                  .describe('该城市拥有的商店列表'),
              })
              .prefault({}),
          )
          .prefault({})
          .describe('世界主要地点的数据化索引'),

        动态地点: z
          .record(
            z.string().describe('动态生成的具体地点名称，如：东海学院旁小吃街'),
            z
              .object({
                归属父节点: z.string().describe('归属父节点名称'),
                层级: z.coerce
                  .number()
                  .prefault(4)
                  .describe('2=大地图主城/遗迹；3=城内大型设施/学院；4=街区/小店/营地'),
                描述: z.string().prefault('无'),
                x: z.coerce.number().prefault(-1).describe('地图坐标X'),
                y: z.coerce.number().prefault(-1).describe('地图坐标Y'),
                节点类型: z
                  .any()
                  .transform(规范化动态地点节点类型Schema_V1)
                  .prefault('未知')
                  .describe('地点类型'),
                势力: z.string().prefault('未知'),
                状态: z.string().prefault('intact'),
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
            环境: z.string().prefault('正常').describe('战场环境或全局领域法则'),
            战斗意图: z
              .enum(['点到为止', '尽量生擒', '重伤压制', '必杀'])
              .prefault('点到为止')
              .describe('本次战斗的主观意图，决定是否允许致死与前端建议结局'),
            裁断结果: z.string().prefault(''),
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

globalThis.__LWCS_MVU_SCHEMA__ = Schema;

globalThis.__LWCS_MVU_SCHEMA_PARTS__ = { CharacterSchema, SkillStructSchema, SoulRingSchema, SoulSpiritSchema, BloodlineRingSchema };

try { if (globalThis.parent && globalThis.parent !== globalThis) { globalThis.parent.__LWCS_MVU_SCHEMA__ = Schema; globalThis.parent.__LWCS_MVU_SCHEMA_PARTS__ = globalThis.__LWCS_MVU_SCHEMA_PARTS__; } } catch (错误) {}

try { if (globalThis.top && globalThis.top !== globalThis) { globalThis.top.__LWCS_MVU_SCHEMA__ = Schema; globalThis.top.__LWCS_MVU_SCHEMA_PARTS__ = globalThis.__LWCS_MVU_SCHEMA_PARTS__; } } catch (错误) {}

registerMvuSchema(Schema);
