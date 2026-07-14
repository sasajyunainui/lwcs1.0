import assert from 'node:assert/strict';

const clone = value => JSON.parse(JSON.stringify(value));

function participant(name, type, stats, extra = {}) {
  const data = clone(extra || {});
  const attributes = data.属性 && typeof data.属性 === 'object' ? data.属性 : {};
  const state = data.状态 && typeof data.状态 === 'object' ? data.状态 : {};
  delete data.属性;
  delete data.状态;
  return {
    ...data,
    name,
    名称: name,
    type,
    系别: type,
    属性: {
      ...attributes,
      等级: Number(stats.level || 21),
      系别: type,
      HP: Number(stats.hp || 2000),
      HP上限: Number(stats.hp || 2000),
      体力: Number(stats.vit || 9000),
      体力上限: Number(stats.vit || 9000),
      魂力: Number(stats.sp || 12000),
      魂力上限: Number(stats.sp || 12000),
      精神力: Number(stats.men || 5000),
      精神力上限: Number(stats.men || 5000),
      力量: Number(stats.str || 220),
      防御: Number(stats.def || 150),
      敏捷: Number(stats.agi || 150),
      状态效果: {},
    },
    状态: { ...state, 存活: true, 位置: '东海学院切磋场', 行动: '战斗' },
    状态效果: {},
    持续效果: {},
    背包: {},
  };
}

export function buildWeixiaofengFormalCase(characterLibrary) {
  const snapshot = clone(characterLibrary?.角色?.韦小枫?.快照?.[0]?.角色 || {});
  assert.ok(snapshot?.第1武魂?.第1魂灵?.第1魂环?.第1魂技, '韦小枫正式第一魂技缺失');
  assert.ok(snapshot?.第1武魂?.第1魂灵?.第2魂环?.第2魂技, '韦小枫正式第二魂技缺失');

  const tang = participant('唐凌雪', '食物系', {
    level: 18, hp: 565, vit: 565, sp: 2166, men: 21, str: 565, def: 565, agi: 282,
  }, {
    第1武魂: {
      表象名称: '牛肉干',
      系别: '食物系',
      第1魂灵: {
        表象名称: '百年美味蚕',
        年限: 400,
        第1魂环: {
          年限: 400,
          第1魂技: {
            魂技名: '香喷喷牛肉干',
            画面描述: '魂环闪烁，一块温热的牛肉干在掌心凝聚。',
            效果描述: '消耗魂力542。制造一块香喷喷牛肉干；制作者自用后在2回合内恢复300点魂力。',
            产物描述: '一块蕴含食物系魂力的牛肉干。',
            承载方式: '造物承载',
            消耗: { 魂力: 542 },
            前摇: 20,
            _效果数组: [{
              数量: 1,
              使用效果: [{
                原型: '资源变化',
                目标: '自身',
                持续回合: 2,
                资源: '魂力',
                数值: '+21.13%',
                生效方式: '独立生效',
                条件分支: [{
                  条件: [{ 类型: '使用者', 对象: '使用者', 比较: '==', 值: '制作者' }],
                  处理: '替换效果',
                  替换效果: [{ 原型: '资源变化', 目标: '自身', 持续回合: 2, 资源: '魂力', 数值: 300, 生效方式: '独立生效' }],
                }],
              }],
              有效期tick: 127,
            }],
          },
        },
      },
    },
    第2武魂: { 表象名称: '五行麒麟', 系别: '强攻系', 属性体系: '无', 可调用元素: ['无'] },
  });
  const wei = participant('韦小枫', '敏攻系', {
    level: 21, hp: 538, vit: 538, sp: 2039, men: 33, str: 538, def: 474, agi: 522,
  }, snapshot);

  return {
    回合: 0,
    战斗类型: '普通战斗',
    战斗意图: '点到为止',
    进行中: true,
    参战者: { team_player: [tang], team_enemy: [wei] },
  };
}
