!(function () {
  'use strict';

  const 货币种类 = Object.freeze({
    法币: '法币',
    组织积分: '组织积分',
    军功: '军功',
    身份物品排除: '身份物品排除',
  });

  const 时代顺序 = Object.freeze(['dldl', 'jueshitangmen', 'current', 'zjdl']);

  const 时代定义 = {
    dldl: {
      名称: '斗一',
      时代: 'dldl',
      默认法币: '金魂币',
      货币: {
        金魂币: { 名称: '金魂币', 种类: 货币种类.法币, 最小单位价值: 100, 最小单位: '铜魂币' },
        银魂币: { 名称: '银魂币', 种类: 货币种类.法币, 最小单位价值: 10, 最小单位: '铜魂币' },
        铜魂币: { 名称: '铜魂币', 种类: 货币种类.法币, 最小单位价值: 1, 最小单位: '铜魂币' },
      },
      身份物品排除: ['魂师徽章', '铁斗魂徽章', '斗魂场入场铜牌'],
    },
    jueshitangmen: {
      名称: '斗二',
      时代: 'jueshitangmen',
      默认法币: '金魂币',
      货币: {
        金魂币: { 名称: '金魂币', 种类: 货币种类.法币, 最小单位价值: 100, 最小单位: '铜魂币' },
        银魂币: { 名称: '银魂币', 种类: 货币种类.法币, 最小单位价值: 10, 最小单位: '铜魂币' },
        铜魂币: { 名称: '铜魂币', 种类: 货币种类.法币, 最小单位价值: 1, 最小单位: '铜魂币' },
      },
      身份物品排除: ['二级魂导师徽章', '史莱克学院白色新生徽章'],
    },
    current: {
      名称: '斗三',
      时代: 'current',
      默认法币: '联邦币',
      货币: {
        联邦币: { 名称: '联邦币', 种类: 货币种类.法币, 最小单位价值: 1, 最小单位: '联邦币' },
        星罗币: { 名称: '星罗币', 种类: 货币种类.法币, 精确换算: false },
        唐门积分: { 名称: '唐门积分', 种类: 货币种类.组织积分, 精确换算: false },
        学院积分: { 名称: '学院积分', 显示名: '史莱克学院积分', 种类: 货币种类.组织积分, 精确换算: false },
        战功: { 名称: '战功', 显示名: '血神功勋', 种类: 货币种类.军功, 精确换算: false },
      },
      身份物品排除: ['锻造师协会徽章', '白级斗士徽章', '黄级斗者徽章'],
    },
    zjdl: {
      名称: '斗四',
      时代: 'zjdl',
      默认法币: '联邦币',
      货币: {
        联邦币: { 名称: '联邦币', 种类: 货币种类.法币, 最小单位价值: 1, 最小单位: '联邦币' },
        龙马币: { 名称: '龙马币', 种类: 货币种类.法币, 最小单位价值: 1000, 最小单位: '联邦币' },
        天龙晶币: { 名称: '天龙晶币', 种类: 货币种类.法币, 最小单位价值: 2000000, 最小单位: '联邦币' },
        白级徽章: { 名称: '白级徽章', 种类: 货币种类.组织积分, 精确换算: false },
        黄级徽章: { 名称: '黄级徽章', 种类: 货币种类.组织积分, 精确换算: false },
        紫级徽章: { 名称: '紫级徽章', 种类: 货币种类.组织积分, 精确换算: false },
        斗天者积分: { 名称: '斗天者积分', 种类: 货币种类.军功, 精确换算: false },
      },
      身份物品排除: [
        '红级徽章(蓝轩宇)',
        '黑级徽章(蓝轩宇)',
        '八级斗天者徽章',
        '天龙会徽章(蓝轩宇)',
        '天龙会徽章(白秀秀)',
        '族长会徽章(蓝轩宇)',
        '黑级徽章(唐震华所借)',
      ],
    },
  };

  const 跨时代映射 = [
    {
      id: 'current:学院积分->zjdl:学院徽章体系',
      类型: '概念映射',
      来源: { 时代: 'current', 货币: '学院积分' },
      目标: { 时代: 'zjdl', 概念: '学院徽章体系', 货币: ['白级徽章', '黄级徽章', '紫级徽章'] },
      精确汇率: null,
      说明: '斗三史莱克学院积分对应斗四学院徽章兑换体系；未提供等级或数量汇率。',
    },
    {
      id: 'current:唐门积分->zjdl:学院徽章体系',
      类型: '概念映射',
      来源: { 时代: 'current', 货币: '唐门积分' },
      目标: { 时代: 'zjdl', 概念: '学院徽章体系', 货币: ['白级徽章', '黄级徽章', '紫级徽章'] },
      精确汇率: null,
      说明: '斗三唐门积分对应斗四学院徽章兑换体系；未提供等级或数量汇率。',
    },
    {
      id: 'current:战功->zjdl:斗天者积分',
      类型: '概念映射',
      来源: { 时代: 'current', 货币: '战功' },
      目标: { 时代: 'zjdl', 概念: '斗天者积分', 货币: ['斗天者积分'] },
      精确汇率: null,
      说明: '斗三军功对应斗四斗天者积分；未提供军功数量汇率。',
    },
  ];

  const 身份排除集合 = Object.fromEntries(
    时代顺序.map(时代 => [时代, new Set(时代定义[时代].身份物品排除)]),
  );

  function 失败结果(原因, 额外 = {}) {
    return Object.freeze({ status: 'unresolved', reason: 原因, ...额外 });
  }

  function 解析时代(时代) {
    if (typeof 时代 !== 'string' || !Object.prototype.hasOwnProperty.call(时代定义, 时代)) {
      return 失败结果('unknown-era', { era: 时代 ?? null });
    }
    return { status: 'resolved', era: 时代, definition: 时代定义[时代] };
  }

  function 解析货币(时代, 货币) {
    const 时代结果 = 解析时代(时代);
    if (时代结果.status !== 'resolved') return 时代结果;
    if (typeof 货币 !== 'string' || !货币) return 失败结果('unknown-currency', { era: 时代, currency: 货币 ?? null });
    const 定义 = 时代结果.definition.货币[货币];
    if (定义) return { status: 'resolved', era: 时代, currency: 货币, definition: 定义 };
    if (身份排除集合[时代].has(货币)) {
      return 失败结果('identity-item-excluded', { era: 时代, currency: 货币, kind: 货币种类.身份物品排除 });
    }
    return 失败结果('unknown-currency', { era: 时代, currency: 货币 });
  }

  function 解析整数金额(金额) {
    if (typeof 金额 === 'bigint') {
      return 金额 >= 0n ? { status: 'resolved', value: 金额 } : 失败结果('amount-must-be-nonnegative-integer');
    }
    if (typeof 金额 === 'number') {
      if (!Number.isSafeInteger(金额) || 金额 < 0) return 失败结果('amount-must-be-nonnegative-safe-integer');
      return { status: 'resolved', value: BigInt(金额) };
    }
    if (typeof 金额 === 'string' && /^[0-9]+$/.test(金额)) return { status: 'resolved', value: BigInt(金额) };
    return 失败结果('amount-must-be-nonnegative-integer');
  }

  function 查询跨时代映射(来源, 目标) {
    const 来源时代 = 来源?.era;
    const 来源货币 = 来源?.currency;
    const 目标时代 = 目标?.era;
    const 目标货币 = 目标?.currency;
    const 目标概念 = 目标?.concept;
    const 候选 = 跨时代映射.find(映射 => {
      if (映射.来源.时代 !== 来源时代 || 映射.来源.货币 !== 来源货币 || 映射.目标.时代 !== 目标时代) return false;
      if (目标货币) return 映射.目标.货币.includes(目标货币);
      if (目标概念) return 映射.目标.概念 === 目标概念;
      return true;
    });
    return 候选
      ? { status: 'resolved', mapping: 候选 }
      : 失败结果('no-explicit-cross-era-mapping', { from: 来源 ?? null, to: 目标 ?? null });
  }

  function 查询货币(时代, 货币) {
    return 解析货币(时代, 货币);
  }

  function 解析交易货币(时代, 显式货币 = '', 上下文 = '') {
    const 时代结果 = 解析时代(时代);
    if (时代结果.status !== 'resolved') return 时代结果;
    const 显式名称 = String(显式货币 || '').trim();
    if (显式名称) {
      const 显式结果 = 解析货币(时代, 显式名称);
      if (显式结果.status === 'resolved' || 显式结果.reason === 'identity-item-excluded') return 显式结果;
    }
    const 文本 = String(上下文 || '');
    let 货币 = 时代结果.definition.默认法币;
    if (时代 === 'current') {
      if (/血神军团战备|战功商店|军需处/.test(文本)) 货币 = '战功';
      else if (/唐门/.test(文本)) 货币 = '唐门积分';
      else if (/史莱克|海神阁|内院|外院/.test(文本)) 货币 = '学院积分';
      else if (/星罗/.test(文本)) 货币 = '星罗币';
    } else if (时代 === 'zjdl') {
      if (/斗天者|斗天|军功|功勋/.test(文本)) 货币 = '斗天者积分';
      else if (/天龙/.test(文本)) 货币 = '天龙晶币';
      else if (/龙马/.test(文本)) 货币 = '龙马币';
    }
    return 解析货币(时代, 货币);
  }

  function 可直接消费(时代, 货币) {
    const 结果 = 获取货币种类(时代, 货币);
    return 结果.status === 'resolved' && 结果.kind !== 货币种类.军功;
  }

  function 获取货币种类(时代, 货币) {
    const 结果 = 解析货币(时代, 货币);
    return 结果.status === 'resolved'
      ? { status: 'resolved', era: 时代, currency: 货币, kind: 结果.definition.种类 }
      : 结果;
  }

  function 列出货币(时代) {
    const 时代结果 = 解析时代(时代);
    if (时代结果.status !== 'resolved') return 时代结果;
    return {
      status: 'resolved',
      era: 时代,
      currencies: Object.freeze(Object.values(时代结果.definition.货币).map(定义 => Object.freeze({ ...定义 }))),
    };
  }

  function 整数换算({ amount, from, to } = {}) {
    const 金额结果 = 解析整数金额(amount);
    if (金额结果.status !== 'resolved') return 金额结果;
    const 来源结果 = 解析货币(from?.era, from?.currency);
    if (来源结果.status !== 'resolved') return 来源结果;
    const 目标结果 = 解析货币(to?.era, to?.currency);
    if (目标结果.status !== 'resolved') return 目标结果;

    if (from.era !== to.era) {
      const 映射结果 = 查询跨时代映射(from, to);
      if (映射结果.status !== 'resolved') return 映射结果;
      const 映射 = 映射结果.mapping;
      if (!映射.精确汇率) {
        return 失败结果('no-exact-rate', { mappingId: 映射.id, from, to });
      }
      const 分子 = 金额结果.value * BigInt(映射.精确汇率.分子);
      const 分母 = BigInt(映射.精确汇率.分母);
      if (分母 <= 0n || 分子 % 分母 !== 0n) return 失败结果('non-integral-result', { from, to });
      return { status: 'resolved', amount: (分子 / 分母).toString(), currency: to.currency, mappingId: 映射.id };
    }

    const 来源单位 = 来源结果.definition.最小单位价值;
    const 目标单位 = 目标结果.definition.最小单位价值;
    if (来源单位 == null || 目标单位 == null) {
      return 失败结果('no-exact-rate', { from, to });
    }
    const 分子 = 金额结果.value * BigInt(来源单位);
    const 分母 = BigInt(目标单位);
    if (分子 % 分母 !== 0n) return 失败结果('non-integral-result', { from, to });
    return { status: 'resolved', amount: (分子 / 分母).toString(), currency: to.currency };
  }

  function 深冻结(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(深冻结);
    return Object.freeze(value);
  }

  const 注册表 = {
    version: '20260819.v1',
    currencyKinds: 货币种类,
    eraOrder: 时代顺序,
    eras: 时代定义,
    crossEraMappings: 跨时代映射,
    resolveCurrency: 查询货币,
    resolveTradeCurrency: 解析交易货币,
    isDirectlySpendable: 可直接消费,
    getCurrencyKind: 获取货币种类,
    listCurrencies: 列出货币,
    getCrossEraMapping: 查询跨时代映射,
    convertInteger: 整数换算,
  };
  深冻结(注册表);

  const 全局名称 = '__LWCS_ERA_CURRENCY_REGISTRY_V1__';
  if (!Object.prototype.hasOwnProperty.call(globalThis, 全局名称)) {
    Object.defineProperty(globalThis, 全局名称, {
      value: 注册表,
      configurable: false,
      enumerable: false,
      writable: false,
    });
  }
})();
