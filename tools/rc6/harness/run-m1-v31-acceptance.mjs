import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(scriptPath), '../../..');
const sourceFiles = [
  'LibraryData_Runtime.js',
  'CharacterLibrary.js',
  'MVU_Skill_Runtime.js',
  'BattlePreview_Module.js',
  'BattleDecisionR9v2Kernel_Module.js',
  'BattleDecision_Module.js',
  'BattleRuntime_Module.js',
  'BattleReport_Module.js',
  'BattleUI_Module.js',
  'mvu_logic_bridge.js',
  'ST_UI_Entry.js',
];
const legacyProviderIds = [
  'legacy-baseline', 'r74-next-baseline', 'r8-shadow', 'r8',
  'r9', 'r9v2-shadow', 'r9v2',
];
const mojibakePattern = new RegExp('\\uFFFD|\\u951F|\\u00C3.|\\u00C2.|\\u00E2.|\\u00EF\\u00BB\\u00BF', 'u');

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

const EMBEDDED_DUEL_FIXTURE = JSON.parse(
  '{"caseId":"duel_overmatch_nonlethal","seed":632550,"rounds":4,"intent":"点到为止","initialBelief":{},"combatData":{"回合":0,"战斗类型":"普通战斗","战斗意图":"点到为止","时间段":"白天","进行中":true,"参战者":{"team_player":[{"属性":{"性别":"男","年龄":31,"等级":71,"天赋梯队":"顶级天才","精神境界":"灵海境","系别":"强攻系","HP":7200,"HP上限":7200,"体力":7200,"体力上限":7200,"魂力":56120,"魂力上限":56120,"精神力":960,"精神力上限":960,"力量":7200,"防御":7200,"敏捷":3600,"状态效果":{}},"装备":{"斗铠":{"等级":2,"名称":"天冰","装备状态":"已装备"},"武器":{"名称":"无","品阶":"无"},"机甲":{"等级":"无","状态":"无"}},"魂核":{"核心":{"数量":1}},"状态":{"位置":"M1本地验收场","存活":true,"行动":"战斗"},"财富":{"联邦币":800000,"唐门积分":15000,"学院积分":5000},"社交":{"声望":3000,"主身份":"史莱克外院教师","势力":{"史莱克学院":{"身份":"外院教师","权限级":5},"唐门":{"身份":"执事","权限级":4}}},"第1武魂":{"表象名称":"天霜剑","系别":"强攻系","第1魂灵":{"年限":157,"契合度":60,"状态":"活跃","第1魂环":{"颜色":"黄","第1魂技":{"魂技名":"霜痕","画面描述":"天霜剑挑出纤细剑丝，可粘取远处目标，也可交织成蓝色剑幕与剑丝风暴。","效果描述":"以冰寒剑丝切割、防御与控场，能在持续压制中留下锋锐霜痕。实际效果：群体1%远程攻击，群体[迟缓]持续1回合(强度-5%)，群体反应-5%持续1回合。消耗：魂力900。","承载方式":"直接生效","附带属性":["冰"],"消耗":{"魂力":900},"前摇":16,"_效果数组":[{"原型":"伤害结算","目标":"群体","生效方式":"独立生效","威力倍率":1,"伤害类型":"远程攻击","攻击段数":1,"结算标签":"标准伤害","抗性类型":"元素抗性"},{"原型":"状态施加","目标":"群体","持续回合":1,"生效方式":"跟随主原型","状态":"迟缓","驱动属性":"魂力上限","影响方向":"效果强度","触发方式":"立即触发","数值":"-5%","副数值":"-5%"},{"原型":"判定修正","目标":"群体","持续回合":1,"生效方式":"跟随主原型","判定":"反应","数值":"-5%","驱动属性":"魂力上限","影响方向":"成功率"}],"命中后追击":true},"年限":157},"第2魂环":{"颜色":"黄","第2魂技":{"魂技名":"霜雾","画面描述":"白色霜雾以自身为中心迅速扩散，大片冰雾充满战场并遮蔽感知。","效果描述":"以低温霜雾冻结、侵蚀接触区域，同时干扰敌方视野与探查。实际效果：群体[迟缓]持续1回合(强度-5%)，群体索敌干扰5%持续1回合，自身移除[中毒]。消耗：魂力1400。","承载方式":"直接生效","附带属性":["冰"],"消耗":{"魂力":1400},"前摇":9,"_效果数组":[{"原型":"状态施加","目标":"群体","持续回合":1,"生效方式":"独立生效","状态":"迟缓","数值":"-5%","副数值":"-5%","驱动属性":"魂力上限","影响方向":"效果强度","触发方式":"立即触发"},{"原型":"决策干扰","目标":"群体","持续回合":1,"生效方式":"独立生效","干扰":"索敌干扰","数值":"3%","驱动属性":"魂力上限","影响方向":"成功率"},{"原型":"状态移除","目标":"自身","生效方式":"独立生效","状态":"中毒"}]},"年限":157}},"第2魂灵":{"年限":3103,"契合度":60,"状态":"活跃","第3魂环":{"颜色":"紫","第3魂技":{"魂技名":"天霜斩","画面描述":"压缩后的天蓝色剑芒自天霜剑横斩而出，剑势凝练而锋锐。","效果描述":"以高密度冰属性斩击正面破开护罩与防御，直取目标本体。实际效果：单体114.85%远程攻击，防穿20，单体反应-6.38%持续1回合。消耗：魂力2600。","承载方式":"直接生效","附带属性":["冰"],"消耗":{"魂力":2600},"前摇":10,"_效果数组":[{"原型":"伤害结算","目标":"单体","生效方式":"独立生效","威力倍率":95,"伤害类型":"远程攻击","防御穿透":20,"攻击段数":1,"结算标签":"标准伤害","抗性类型":"元素抗性"},{"原型":"判定修正","目标":"单体","持续回合":1,"生效方式":"跟随主原型","判定":"反应","数值":"-5.5%","驱动属性":"魂力上限","影响方向":"成功率"}],"命中后追击":true},"年限":3103},"第4魂环":{"颜色":"紫","第4魂技":{"魂技名":"霜冰语","画面描述":"天霜剑骤然放大为蓝色寒冰巨剑，沿既有创口贯穿目标并将其钉杀。","效果描述":"将冰属性与巨剑形态集中爆发，形成强力贯穿与定身压制。实际效果：单体15.16%近身攻击，防穿30，单体[迟缓]持续1回合(强度-5%)，单体[僵直]持续1回合(强度-5%)。消耗：魂力3600。","承载方式":"直接生效","附带属性":["冰"],"消耗":{"魂力":3600},"前摇":12,"_效果数组":[{"原型":"伤害结算","目标":"单体","生效方式":"独立生效","威力倍率":15.16,"伤害类型":"近身攻击","防御穿透":30,"攻击段数":1,"结算标签":"标准伤害","抗性类型":"物理抗性"},{"原型":"状态施加","目标":"单体","持续回合":1,"生效方式":"跟随主原型","状态":"迟缓","驱动属性":"魂力上限","影响方向":"效果强度","触发方式":"立即触发","数值":"-5%","副数值":"-5%"},{"原型":"状态施加","目标":"单体","持续回合":1,"生效方式":"跟随主原型","状态":"僵直","驱动属性":"魂力上限","影响方向":"效果强度","触发方式":"立即触发","数值":"-5%","副数值":"-5%"}]},"年限":3103}},"第3魂灵":{"年限":10000,"契合度":60,"状态":"活跃","第5魂环":{"颜色":"黑","第5魂技":{"魂技名":"霜语冰轮","画面描述":"九柄巨大的天霜剑如冰轮般轮转斩落，连续九次重击同一目标。","效果描述":"以连续重斩叠加冰寒伤害和破坏力，短时间内集中压垮强敌。实际效果：单体3.36%近身攻击(9段)，防穿15，单体[僵直]持续1回合(强度-5%)，单体防御剥夺+5%持续1回合。消耗：魂力5200。","承载方式":"直接生效","附带属性":["冰"],"消耗":{"魂力":5200},"前摇":16,"_效果数组":[{"原型":"伤害结算","目标":"单体","生效方式":"独立生效","威力倍率":3.36,"攻击段数":9,"伤害类型":"近身攻击","防御穿透":15,"结算标签":"标准伤害","抗性类型":"物理抗性"},{"原型":"状态施加","目标":"单体","持续回合":1,"生效方式":"跟随主原型","状态":"僵直","驱动属性":"魂力上限","影响方向":"效果强度","触发方式":"立即触发","数值":"-5%","副数值":"-5%"},{"原型":"结算修正","目标":"单体","持续回合":1,"生效方式":"跟随主原型","结算":"消耗","数值":"+5%","驱动属性":"魂力上限","影响方向":"效果强度"}]},"年限":10000},"第6魂环":{"颜色":"黑","第6魂技":{"魂技名":"凝霜","画面描述":"第六魂环亮起后，周围空气急剧降温，天霜剑剑芒更清澈纯粹，冰雪气息全面扩散。","效果描述":"维持并加深既有冻结状态，释放超低温迟滞目标，同时强化天霜剑与冰系压制力。实际效果：群体[迟缓]持续2回合(强度-30%)，自身技能效果+5%(限定冰)持续1回合。消耗：魂力4704。","承载方式":"直接生效","附带属性":["冰"],"消耗":{"魂力":4704},"前摇":30,"_效果数组":[{"原型":"状态施加","目标":"群体","持续回合":2,"生效方式":"独立生效","状态":"迟缓","数值":"-8%","副数值":"-8%","驱动属性":"魂力上限","影响方向":"效果强度","触发方式":"立即触发"},{"原型":"结算修正","目标":"自身","持续回合":1,"生效方式":"独立生效","结算":"消耗","数值":"+5%","限定元素":"冰"}]},"年限":10000},"第7魂环":{"颜色":"黑","年限":10000}}},"外貌":{"发色":"蓝发","发型":"长发飘飘","瞳色":"蓝眸","身高":"","体型":"","长相描述":"白衣胜雪，相貌极其英俊，气质冰冷如霜，被誉为“冷傲男神”","特殊特征":["气质冰冷如霜"]},"性格":"人前永远是淡漠的脸，训人句句扎心，练功时苛刻得让弟子叫苦；可弟子真受了欺负，他二话不说站到前面，事却一件件给办了。心里的痛从不与人言，深夜独自对着旧物出神，第二天依旧冷着脸上课，把温柔都藏在冰冷下面。","功法":{"玄天功":{"境界":"熟练","lv":4,"exp":16000,"描述":"唐门核心内功，稳固魂力运转并提升恢复与精纯度。"},"紫极魔瞳":{"境界":"熟练","lv":4,"exp":16000,"描述":"唐门瞳术，强化精神洞察、动态视觉与远距锁定。"},"玄玉手":{"境界":"熟练","lv":4,"exp":16000,"描述":"唐门手法，淬炼双手抗性与近身控拿能力。"},"鬼影迷踪步":{"境界":"熟练","lv":4,"exp":16000,"描述":"唐门身法，强化步法变化、闪避与近身切位。"},"控鹤擒龙":{"境界":"熟练","lv":4,"exp":16000,"描述":"唐门擒拿控劲绝学，可隔空牵引、卸力与夺势。"},"暗器百解":{"境界":"熟练","lv":4,"exp":16000,"描述":"唐门暗器总纲，记录暗器制作、投掷手法与机关变化。"}},"id":"舞长空","name":"舞长空","名称":"舞长空","type":"强攻系","系别":"强攻系","hp":7200,"HP":7200,"hp_max":7200,"sp":56120,"men":960,"vit":7200,"sta":7200,"sp_max":56120,"men_max":960,"vit_max":7200,"str":7200,"def":7200,"agi":3600,"状态效果":{},"持续效果":{},"背包":{}}],"team_enemy":[{"属性":{"性别":"男","年龄":9,"等级":21,"天赋梯队":"天才","系别":"敏攻系","HP":645,"HP上限":645,"体力":645,"体力上限":645,"魂力":2070,"魂力上限":2070,"精神力":32,"精神力上限":32,"力量":645,"防御":645,"敏捷":322,"状态效果":{}},"第1武魂":{"表象名称":"青影蛇","系别":"敏攻系","描述":"蛇类兽武魂，释放时带青色鳞片和竖瞳气息，身体柔韧，适合缠绕、突袭与近身骚扰。","第1魂灵":{"年限":167,"契合度":60,"状态":"活跃","第1魂环":{"年限":167,"颜色":"黄","第1魂技":{"魂技名":"青影叠","画面描述":"第一魂环闪耀后，身形骤然虚化，身后拖出一连串青色残影绕身游走，令本体真假难辨。","效果描述":"通过残影与高速错位扰乱锁定和判断，显著强化近身闪转与诱骗能力。实际效果：单体[迟缓]持续1回合(强度-5%)，单体[中毒]持续1回合(强度-5%)。消耗：魂力:420。","承载方式":"直接生效","附带属性":[],"消耗":"魂力:420","前摇":18,"_效果数组":[{"原型":"状态施加","目标":"单体","持续回合":1,"生效方式":"独立生效","状态":"迟缓","驱动属性":"魂力上限","影响方向":"效果强度","触发方式":"立即触发","数值":"-5%","副数值":"-5%"},{"原型":"状态施加","目标":"单体","持续回合":1,"生效方式":"独立生效","状态":"中毒","数值":"-5%","驱动属性":"魂力上限","影响方向":"效果强度","触发方式":"立即触发","副数值":"-5%"}]}},"第2魂环":{"年限":167,"颜色":"黄","第2魂技":{"魂技名":"青影蛇群","画面描述":"第二魂技发动时，六道青色大蛇身影自周身窜出，绕过正面阻挡直扑后方目标。","效果描述":"以多道青影蛇影进行追咬与缠扰，适合绕过前排压向后排目标。实际效果：召唤1个青影蛇影持续1回合，单体[迟缓]持续1回合(强度-5%)。消耗：魂力620。","承载方式":"直接生效","附带属性":[],"消耗":{"魂力":620},"前摇":18,"_效果数组":[{"原型":"召唤生成","目标":"自身","持续回合":1,"生效方式":"独立生效","召唤单位类型":"其他召唤生物","召唤物名称":"青影蛇影","数量":1,"行动模式":"协同攻击","强度":0.11},{"原型":"状态施加","目标":"单体","持续回合":1,"生效方式":"独立生效","状态":"迟缓","触发方式":"立即触发","数值":"-7%","副数值":"-7%","驱动属性":"魂力上限","影响方向":"效果强度"}]}}}},"性格":"性格极其嚣张跋扈，恃强凌弱，但在遇到真正的硬茬和挫折时又容易变得懦弱退缩","状态":{"位置":"M1本地验收场","存活":true,"行动":"战斗"},"社交":{"声望":800,"主身份":"东海学院一年级一班学生","势力":{"东海学院":{"身份":"一年级一班学生","权限级":2}}},"外貌":{"发色":"黑发","发型":"长碎发","瞳色":"阴狠眸","身高":"","体型":"","长相描述":"相貌清秀，但眼神中总带着几分阴狠与傲慢，气质犹如一条盘绕的青蛇","特殊特征":["但眼神中总带着几分阴狠与傲慢","气质犹如一条盘绕的青蛇"]},"id":"韦小枫","name":"韦小枫","名称":"韦小枫","type":"敏攻系","系别":"敏攻系","hp":645,"HP":645,"hp_max":645,"sp":2070,"men":32,"vit":645,"sta":645,"sp_max":2070,"men_max":32,"vit_max":645,"str":645,"def":645,"agi":322,"状态效果":{},"持续效果":{},"背包":{}}]},"胜负条件":{"version":1,"explicit":true,"startRound":0,"maxRounds":4,"resolutionPriority":"DEFEAT_FIRST","victory":{"logic":"ANY","conditions":[{"type":"HP_RATIO_AT_OR_BELOW","side":"ENEMY","targetIds":["韦小枫"],"threshold":0.01,"scope":"ALL"}]},"defeat":{"logic":"ANY","conditions":[{"type":"TEAM_INCAPACITATED","side":"PLAYER","scope":"ALL"}]}}}}'
);
const EMBEDDED_FIXTURE_HASH = '0b838398b46fcf4bad96eaa83f9d1847f66fa47c8938cd5f25190b1b418359eb';
const EMBEDDED_FIXTURE_BYTES = 13359;

function buildDuelFixture() {
  const serialized = JSON.stringify(EMBEDDED_DUEL_FIXTURE);
  if (sha256(serialized) !== EMBEDDED_FIXTURE_HASH) {
    throw new Error(`m1_fixture_embedded_hash_changed:expected=${EMBEDDED_FIXTURE_HASH}:actual=${sha256(serialized)}`);
  }
  if (Buffer.byteLength(serialized, 'utf8') !== EMBEDDED_FIXTURE_BYTES) {
    throw new Error(`m1_fixture_embedded_bytes_changed:expected=${EMBEDDED_FIXTURE_BYTES}:actual=${Buffer.byteLength(serialized, "utf8")}`);
  }
  return clone(EMBEDDED_DUEL_FIXTURE);
}

function canonicalSkill(fixture, slot) {
  const actor = fixture.combatData.参战者.team_player[0];
  const skill = slot === 'ring3'
    ? actor.第1武魂?.第2魂灵?.第3魂环?.第3魂技
    : actor.第1武魂?.第1魂灵?.第1魂环?.第1魂技;
  return clone(skill);
}

function setEnemyHp(combatData, hp) {
  const enemy = combatData.参战者.team_enemy[0];
  const value = Math.max(1, Math.floor(Number(hp)));
  enemy.hp = value;
  enemy.HP = value;
  enemy.属性.HP = value;
  enemy.属性.HP上限 = value;
  enemy.属性.体力 = value;
  enemy.属性.体力上限 = value;
}

function setVictoryThreshold(combatData, threshold) {
  combatData.胜负条件.victory.conditions[0].threshold = Number(threshold);
}

function basicAttackDeclaration(actorId, targetId) {
  return { actorId, actionKind: 'BASIC_ATTACK', targetIds: [targetId] };
}

function skillDeclaration(actorId, targetId, skill) {
  return { actorId, actionKind: 'RELEASE_SKILL', targetIds: [targetId], skill };
}

function parseArgs(argv) {
  const args = { repoRoot: defaultRepoRoot, expectedHead: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index] || '');
    if (arg === '--repo-root') args.repoRoot = path.resolve(String(argv[++index] || ''));
    else if (arg.startsWith('--repo-root=')) args.repoRoot = path.resolve(arg.slice(12));
    else if (arg === '--expected-head') args.expectedHead = String(argv[++index] || '');
    else if (arg.startsWith('--expected-head=')) args.expectedHead = arg.slice(15);
  }
  return args;
}

function errorInfo(error) {
  return {
    name: String(error?.name || 'Error'),
    message: String(error?.message || error || 'unknown error'),
  };
}

function makeNode() {
  return {
    style: {},
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    appendChild() {},
    remove() {},
    addEventListener() {},
    removeEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() {
      return { top: 0, right: 1280, width: 960, height: 720 };
    },
  };
}

function wrapApi(sandbox, name, methods, calls) {
  const original = sandbox[name];
  if (!original || typeof original !== 'object') return false;
  const shadow = {};
  Reflect.ownKeys(original).forEach(property => {
    const descriptor = Object.getOwnPropertyDescriptor(original, property);
    if (!descriptor) return;
    if (typeof property === 'string' && methods.includes(property) && typeof descriptor.value === 'function') {
      const value = descriptor.value;
      descriptor.value = (...args) => {
        calls[property] = (calls[property] || 0) + 1;
        return value(...args);
      };
    }
    descriptor.configurable = true;
    Object.defineProperty(shadow, property, descriptor);
  });
  sandbox[name] = shadow;
  return true;
}

function makeSandbox(repoRoot, calls) {
  const silentConsole = { log() {}, info() {}, warn() {}, error() {}, debug() {} };
  const sandbox = {
    console: silentConsole,
    structuredClone,
    performance,
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    WeakMap,
    WeakSet,
    Symbol,
    Intl,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    process: { env: process.env },
    navigator: { userAgent: 'node' },
    location: { href: 'http://localhost/' },
    innerWidth: 1280,
    innerHeight: 720,
    getComputedStyle: () => ({ getPropertyValue() { return ''; }, zIndex: '1' }),
    ResizeObserver: function ResizeObserver() {
      this.observe = () => {};
      this.disconnect = () => {};
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    dispatchEvent() {},
    addEventListener() {},
    CustomEvent: function CustomEvent(type, init) {
      this.type = type;
      this.detail = init?.detail;
    },
  };
  sandbox.document = {
    documentElement: { clientWidth: 1280, clientHeight: 720 },
    createElement: () => makeNode(),
    getElementById: () => null,
    body: { appendChild() {} },
    head: { appendChild() {} },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.__M1_CALL_COUNTS__ = calls;
  sandbox.__MVU_APPLY_PATCHES__ = () => {
    calls.patch = (calls.patch || 0) + 1;
    throw new Error('M1_PATCH_SENTINEL');
  };
  vm.createContext(sandbox);

  const load = fileName => {
    const filePath = path.join(repoRoot, fileName);
    if (!fs.existsSync(filePath)) return false;
    vm.runInContext(readUtf8(filePath), sandbox, { filename: fileName });
    return true;
  };
  ['LibraryData_Runtime.js', 'CharacterLibrary.js', 'MVU_Skill_Runtime.js', 'BattlePreview_Module.js']
    .forEach(load);
  load('BattleDecisionR9v2Kernel_Module.js');
  load('BattleDecision_Module.js');
  wrapApi(sandbox, '__LWCS_BATTLE_DECISION__', [
    'runProvider', 'decide', 'decideNext', 'prepareDecisionRequest', 'enumerateCandidates',
  ], calls.decision);
  load('BattleRuntime_Module.js');
  wrapApi(sandbox, '__LWCS_BATTLE_RUNTIME__', [
    'executeBattleDraft', 'executePlayerLockedBattleSettlement', 'sealBattleResult',
    'verifySealedBattlePackage', 'executeBattleDraftR8',
  ], calls.runtime);
  load('BattleReport_Module.js');
  wrapApi(sandbox, '__LWCS_BATTLE_REPORT__', ['build', 'auditProjection'], calls.report);
  return sandbox;
}

function snapshotCalls(calls) {
  return clone(calls);
}

function callDelta(before, after) {
  const delta = {};
  for (const key of new Set([...Object.keys(before || {}), ...Object.keys(after || {})])) {
    if (key === 'decision' || key === 'runtime' || key === 'report') {
      delta[key] = callDelta(before?.[key] || {}, after?.[key] || {});
    } else {
      delta[key] = Number(after?.[key] || 0) - Number(before?.[key] || 0);
    }
  }
  return delta;
}

async function invoke(fn) {
  try {
    return { ok: true, value: await fn() };
  } catch (error) {
    return { ok: false, value: null, error: errorInfo(error) };
  }
}

function artifactSummary(value) {
  const candidates = [value, value?.settlement, value?.result, value?.draft, value?.reportDto, value?.sealedPackage]
    .filter(item => item && typeof item === 'object');
  const draft = candidates.find(item => item.status === 'DRAFT' && item.draftHash) || null;
  const sealed = candidates.find(item => item.sealStatus === 'SEALED') || null;
  const report = candidates.find(item => typeof item.schemaVersion === 'string' && /report/i.test(item.schemaVersion)) || null;
  const ledger = draft?.ledger || value?.ledger || [];
  return {
    hasDraft: Boolean(draft),
    hasReport: Boolean(report),
    hasSealed: Boolean(sealed),
    draftSchema: draft?.schemaVersion || null,
    reportSchema: report?.schemaVersion || null,
    sealedSchema: sealed?.schemaVersion || null,
    actualRoundCount: Number(draft?.actualRoundCount || value?.actualRoundCount || 0),
    ledgerCount: Array.isArray(ledger) ? ledger.length : 0,
    runtimeFatalCount: Number(draft?.runtimeAudit?.fatalCount || draft?.audit?.fatalCount || 0),
    runtimeFatalCodes: (draft?.runtimeAudit?.fatals || draft?.audit?.fatals || []).map(item => String(item?.code || item || '')).filter(Boolean),
    draft,
    report,
    sealed,
  };
}

function lineHits(text, patterns) {
  const hits = [];
  String(text).split(/\r?\n/u).forEach((line, index) => {
    if (patterns.some(pattern => pattern.test(line))) hits.push({ line: index + 1, text: line.trim().slice(0, 220) });
    patterns.forEach(pattern => { pattern.lastIndex = 0; });
  });
  return hits;
}

function maskJavaScript(source) {
  const chars = [...String(source)];
  const masked = [...chars];
  const blank = index => {
    if (masked[index] !== '\n' && masked[index] !== '\r') masked[index] = ' ';
  };
  const regexCanStart = index => {
    let cursor = index - 1;
    while (cursor >= 0 && /\s/u.test(chars[cursor])) cursor -= 1;
    if (cursor < 0 || /[({[,:;=!?&|+\-*%^~<>]/u.test(chars[cursor])) return true;
    const prefix = chars.slice(0, cursor + 1).join('');
    return /(?:^|\W)(?:return|throw|case|delete|void|typeof|instanceof|in|new|yield|await)\s*$/u.test(prefix);
  };
  const maskQuoted = (start, quote) => {
    let index = start;
    blank(index++);
    while (index < chars.length) {
      const current = chars[index];
      blank(index++);
      if (current === '\\' && index < chars.length) {
        blank(index++);
        continue;
      }
      if (current === quote) break;
    }
    return index;
  };
  const maskTemplate = start => {
    let index = start;
    let expressionDepth = 0;
    blank(index++);
    while (index < chars.length) {
      const current = chars[index];
      const next = chars[index + 1];
      if (current === '\\') {
        blank(index++);
        if (index < chars.length) blank(index++);
        continue;
      }
      if (current === '`' && expressionDepth === 0) {
        blank(index++);
        break;
      }
      if (current === '$' && next === '{') {
        blank(index++);
        blank(index++);
        expressionDepth += 1;
        continue;
      }
      if (expressionDepth > 0 && (current === '\'' || current === '"')) {
        index = maskQuoted(index, current);
        continue;
      }
      if (expressionDepth > 0 && current === '`') {
        index = maskTemplate(index);
        continue;
      }
      if (expressionDepth > 0 && current === '/' && next === '/') {
        blank(index++);
        blank(index++);
        while (index < chars.length && chars[index] !== '\n') blank(index++);
        continue;
      }
      if (expressionDepth > 0 && current === '/' && next === '*') {
        blank(index++);
        blank(index++);
        while (index < chars.length) {
          if (chars[index] === '*' && chars[index + 1] === '/') {
            blank(index++);
            blank(index++);
            break;
          }
          blank(index++);
        }
        continue;
      }
      if (expressionDepth > 0 && current === '{') expressionDepth += 1;
      else if (expressionDepth > 0 && current === '}') expressionDepth -= 1;
      blank(index++);
    }
    return index;
  };
  for (let index = 0; index < chars.length;) {
    const char = chars[index];
    const next = chars[index + 1];
    if (char === '/' && next === '/') {
      blank(index++);
      blank(index++);
      while (index < chars.length && chars[index] !== '\n') blank(index++);
      continue;
    }
    if (char === '/' && next === '*') {
      blank(index++);
      blank(index++);
      while (index < chars.length) {
        if (chars[index] === '*' && chars[index + 1] === '/') {
          blank(index++);
          blank(index++);
          break;
        }
        blank(index++);
      }
      continue;
    }
    if (char === '\'' || char === '"') {
      index = maskQuoted(index, char);
      continue;
    }
    if (char === '`') {
      index = maskTemplate(index);
      continue;
    }
    if (char === '/' && regexCanStart(index)) {
      let inClass = false;
      blank(index++);
      while (index < chars.length) {
        const current = chars[index];
        blank(index++);
        if (current === '\\' && index < chars.length) {
          blank(index++);
          continue;
        }
        if (current === '[') inClass = true;
        else if (current === ']') inClass = false;
        else if (current === '/' && !inClass) break;
      }
      while (index < chars.length && /[a-z]/iu.test(chars[index])) blank(index++);
      continue;
    }
    index += 1;
  }
  return masked.join('');
}

function findBalancedEnd(maskedSource, startIndex, open, close) {
  let depth = 0;
  for (let index = startIndex; index < maskedSource.length; index += 1) {
    if (maskedSource[index] === open) depth += 1;
    else if (maskedSource[index] === close && --depth === 0) return index;
  }
  return -1;
}

function extractStringLiterals(source) {
  const values = [];
  const text = String(source);
  for (let index = 0; index < text.length;) {
    if (text[index] === '/' && text[index + 1] === '/') {
      index += 2;
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    }
    if (text[index] === '/' && text[index + 1] === '*') {
      index += 2;
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) index += 1;
      index += 2;
      continue;
    }
    if (text[index] !== '\'' && text[index] !== '"' && text[index] !== '`') {
      index += 1;
      continue;
    }
    const quote = text[index++];
    let value = '';
    while (index < text.length) {
      const current = text[index++];
      if (current === '\\' && index < text.length) {
        value += text[index++];
        continue;
      }
      if (current === quote) break;
      value += current;
    }
    values.push(value);
  }
  return values;
}

function extractFunctionNodes(moduleName, source) {
  const masked = maskJavaScript(source);
  const identifier = '[$_\\p{ID_Start}][$_\\u200C\\u200D\\p{ID_Continue}]*';
  const nodes = new Map();
  const addNode = (name, openBrace, kind) => {
    if (nodes.has(name) || openBrace < 0 || masked[openBrace] !== '{') return;
    const closeBrace = findBalancedEnd(masked, openBrace, '{', '}');
    if (closeBrace < 0) return;
    nodes.set(name, {
      id: `${moduleName}:${name}`,
      moduleName,
      name,
      kind,
      line: source.slice(0, openBrace).split(/\r?\n/u).length,
      bodyStart: openBrace + 1,
      bodyEnd: closeBrace,
      body: source.slice(openBrace + 1, closeBrace),
      maskedBody: masked.slice(openBrace + 1, closeBrace),
    });
  };
  const declarations = new RegExp(`\\b(?:async\\s+)?function\\s+(${identifier})\\s*\\(`, 'gu');
  for (const match of masked.matchAll(declarations)) {
    const openParen = masked.indexOf('(', match.index);
    const closeParen = findBalancedEnd(masked, openParen, '(', ')');
    const openBrace = closeParen < 0 ? -1 : masked.indexOf('{', closeParen + 1);
    addNode(match[1], openBrace, 'declaration');
  }
  const assignments = new RegExp(`\\b(?:const|let|var)\\s+(${identifier})\\s*=`, 'gu');
  for (const match of masked.matchAll(assignments)) {
    const tail = masked.slice(match.index + match[0].length, match.index + match[0].length + 1200);
    const arrow = new RegExp(`^\\s*(?:async\\s*)?(?:\\([^)]*\\)|${identifier})\\s*=>\\s*\\{`, 'u').exec(tail);
    if (!arrow) continue;
    addNode(match[1], match.index + match[0].length + arrow[0].lastIndexOf('{'), 'arrow');
  }
  const properties = new RegExp(`(${identifier})\\s*:\s*(?:async\\s*)?(?:\\([^)]*\\)|${identifier})\\s*=>\\s*\\{`, 'gu');
  for (const match of masked.matchAll(properties)) {
    addNode(match[1], match.index + match[0].lastIndexOf('{'), 'property-arrow');
  }
  nodes.forEach(node => {
    const ownBody = [...node.body];
    const ownMaskedBody = [...node.maskedBody];
    nodes.forEach(child => {
      if (child.id === node.id || child.bodyStart <= node.bodyStart || child.bodyEnd >= node.bodyEnd) return;
      const start = child.bodyStart - node.bodyStart;
      const end = child.bodyEnd - node.bodyStart;
      for (let index = start; index < end; index += 1) {
        if (ownBody[index] !== '\n' && ownBody[index] !== '\r') ownBody[index] = ' ';
        if (ownMaskedBody[index] !== '\n' && ownMaskedBody[index] !== '\r') ownMaskedBody[index] = ' ';
      }
    });
    node.ownBody = ownBody.join('');
    node.ownMaskedBody = ownMaskedBody.join('');
  });
  return nodes;
}

function buildProductionClosure(sourceTexts) {
  const moduleSources = {
    Bridge: sourceTexts['mvu_logic_bridge.js'] || '',
    Runtime: sourceTexts['BattleRuntime_Module.js'] || '',
    Report: sourceTexts['BattleReport_Module.js'] || '',
    Decision: sourceTexts['BattleDecision_Module.js'] || '',
    Preview: sourceTexts['BattlePreview_Module.js'] || '',
    Kernel: sourceTexts['BattleDecisionR9v2Kernel_Module.js'] || '',
  };
  const nodes = new Map();
  const moduleNodes = {};
  Object.entries(moduleSources).forEach(([moduleName, source]) => {
    moduleNodes[moduleName] = extractFunctionNodes(moduleName, source);
    moduleNodes[moduleName].forEach(node => nodes.set(node.id, node));
  });
  const bridgeMasked = maskJavaScript(moduleSources.Bridge);
  const bridgePublicMatch = /\bexecuteBattleTransaction\s*\([^)]*\)\s*\{/u.exec(bridgeMasked);
  if (bridgePublicMatch) {
    const openBrace = bridgePublicMatch.index + bridgePublicMatch[0].lastIndexOf('{');
    const closeBrace = findBalancedEnd(bridgeMasked, openBrace, '{', '}');
    if (closeBrace >= 0) {
      const name = 'BattleUIBridge.executeBattleTransaction';
      const node = {
        id: `Bridge:${name}`,
        moduleName: 'Bridge',
        name,
        kind: 'public-method',
        line: moduleSources.Bridge.slice(0, openBrace).split(/\r?\n/u).length,
        bodyStart: openBrace + 1,
        bodyEnd: closeBrace,
        body: moduleSources.Bridge.slice(openBrace + 1, closeBrace),
        maskedBody: bridgeMasked.slice(openBrace + 1, closeBrace),
      };
      node.ownBody = node.body;
      node.ownMaskedBody = node.maskedBody;
      moduleNodes.Bridge.set(name, node);
      nodes.set(node.id, node);
    }
  }
  const aliases = {
    Bridge: { runtime: 'Runtime', report: 'Report' },
    Runtime: { decisionRuntime: 'Decision', previewRuntime: 'Preview', reportRuntime: 'Report' },
    Report: { runtime: 'Runtime' },
    Decision: { preview: 'Preview', targetKernel: 'Kernel' },
  };
  const edges = new Map();
  const identifierPattern = /[$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}]*/gu;
  const directCallPattern = /\b([$_\p{ID_Start}][$_\u200C\u200D\p{ID_Continue}]*)\s*\(/gu;
  nodes.forEach(node => {
    const targets = new Set();
    const ownMaskedBody = node.ownMaskedBody || node.maskedBody;
    for (const call of ownMaskedBody.matchAll(directCallPattern)) {
      if (/\bfunction\s*$/u.test(ownMaskedBody.slice(Math.max(0, call.index - 20), call.index))) continue;
      const local = moduleNodes[node.moduleName]?.get(call[1]);
      if (local && local.id !== node.id) targets.add(local.id);
    }
    Object.entries(aliases[node.moduleName] || {}).forEach(([alias, targetModule]) => {
      const memberPattern = new RegExp(`\\b${alias}\\s*\\.\\s*([$_\\p{ID_Start}][$_\\u200C\\u200D\\p{ID_Continue}]*)\\s*\\(`, 'gu');
      for (const match of ownMaskedBody.matchAll(memberPattern)) {
        const target = moduleNodes[targetModule]?.get(match[1]);
        if (target) targets.add(target.id);
      }
    });
    edges.set(node.id, targets);
  });

  const roots = [
    'Bridge:BattleUIBridge.executeBattleTransaction',
    'Bridge:执行战斗事务',
    'Bridge:构建战斗提交包',
    'Runtime:executeBattleDraft',
    'Runtime:executePlayerLockedBattleSettlement',
  ];
  const reachable = new Set();
  const parent = new Map();
  const queue = roots.filter(root => nodes.has(root));
  queue.forEach(root => parent.set(root, null));
  while (queue.length) {
    const current = queue.shift();
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const target of edges.get(current) || []) {
      if (!parent.has(target)) parent.set(target, current);
      if (!reachable.has(target)) queue.push(target);
    }
  }
  const pathTo = nodeId => {
    const path = [];
    for (let current = nodeId; current; current = parent.get(current)) path.unshift(current);
    return path;
  };
  const forbidden = [];
  reachable.forEach(nodeId => {
    const node = nodes.get(nodeId);
    const identifiers = new Set((node.ownMaskedBody || node.maskedBody).match(identifierPattern) || []);
    ['executeBattleDraftR8', 'runProvider', 'decide', 'decideNext'].forEach(symbol => {
      if (identifiers.has(symbol)) forbidden.push({ node: nodeId, symbol, kind: 'forbidden-call-edge', path: pathTo(nodeId) });
    });
    [...identifiers]
      .filter(symbol => /future_?route/iu.test(symbol))
      .forEach(symbol => forbidden.push({ node: nodeId, symbol, kind: 'future-route-edge', path: pathTo(nodeId) }));
    const stringLiterals = extractStringLiterals(node.ownBody || node.body);
    stringLiterals
      .filter(value => legacyProviderIds.includes(value.trim()))
      .forEach(value => forbidden.push({ node: nodeId, symbol: value.trim(), kind: 'provider-id-edge', path: pathTo(nodeId) }));
    stringLiterals
      .filter(value => /future[-_ ]?route/iu.test(value))
      .forEach(value => forbidden.push({ node: nodeId, symbol: value.trim(), kind: 'future-route-edge', path: pathTo(nodeId) }));
  });
  const reachableEdges = [...reachable].flatMap(from => [...(edges.get(from) || [])]
    .filter(to => reachable.has(to))
    .map(to => `${from}->${to}`)).sort();
  const crossModuleEdges = reachableEdges.filter(edge => {
    const [from, to] = edge.split('->');
    return from.split(':')[0] !== to.split(':')[0];
  });
  const sortedReachable = [...reachable].sort();
  return {
    schemaVersion: 'M1ProductionClosureV1',
    roots,
    missingRoots: roots.filter(root => !nodes.has(root)),
    functionCounts: Object.fromEntries(Object.entries(moduleNodes).map(([name, map]) => [name, map.size])),
    reachableNodeCount: sortedReachable.length,
    reachableEdgeCount: reachableEdges.length,
    reachableModules: [...new Set(sortedReachable.map(id => id.split(':')[0]))].sort(),
    crossModuleEdges,
    graphHash: sha256(JSON.stringify(reachableEdges)),
    closureHash: sha256(JSON.stringify(sortedReachable)),
    forbidden,
  };
}

function sourcePath(repoRoot, fileName) {
  return path.join(repoRoot, fileName);
}

function buildInput(caseDefinition, executionMode, selectedAction = null) {
  const objectives = clone(caseDefinition.combatData?.胜负条件 || {});
  return {
    caseId: `${caseDefinition.caseId}:${executionMode}`,
    seed: caseDefinition.seed,
    mode: executionMode === 'PLAYER_LOCKED' ? 'single_round' : executionMode,
    executionMode,
    rounds: 1,
    combatData: clone(caseDefinition.combatData),
    initialBelief: clone(caseDefinition.initialBelief || {}),
    battleIntent: { mode: caseDefinition.intent, objectives },
    objectiveContract: objectives,
    actionDeclaration: clone(selectedAction),
    selectedAction: clone(selectedAction),
    playerLockedAction: clone(selectedAction),
    settings: { executionMode, decisionOnly: false },
  };
}

async function settleManual(sandbox, input) {
  const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
  const report = sandbox.__LWCS_BATTLE_REPORT__;
  const result = await invoke(() => runtime.executePlayerLockedBattleSettlement(input));
  let value = result.value;
  let summary = artifactSummary(value);
  let reportAudit = null;
  let verify = null;
  if (result.ok && summary.draft && !summary.sealed && typeof report?.build === 'function') {
    const reportResult = await invoke(() => report.build({ draft: summary.draft, visibilityMode: 'PLAYER' }));
    if (reportResult.ok) {
      value = { settlement: value, reportDto: reportResult.value };
      summary = artifactSummary(value);
      if (typeof report.auditProjection === 'function') {
        const auditResult = await invoke(() => report.auditProjection(reportResult.value));
        reportAudit = auditResult.value;
        if (auditResult.ok && typeof runtime.sealBattleResult === 'function') {
          const sealResult = await invoke(() => runtime.sealBattleResult({ draft: summary.draft, reportAudit: reportAudit }));
          if (sealResult.ok) {
            value = { ...value, reportAudit, sealedPackage: sealResult.value };
            summary = artifactSummary(value);
          }
        }
      }
    }
  }
  summary = artifactSummary(value);
  if (result.ok && summary.sealed && typeof runtime.verifySealedBattlePackage === 'function') {
    verify = await invoke(() => runtime.verifySealedBattlePackage(summary.sealed));
  }
  return { result, value, summary, reportAudit, verify };
}

function checkDynamicRoute(value) {
  let serialized = '';
  try { serialized = JSON.stringify(value); } catch { return ['unserializable']; }
  const hits = serialized.match(/future[-_ ]?route|futureRoute|r9v2TargetFutureRoute/giu);
  return hits ? [...new Set(hits)] : [];
}

function checkSyntax(filePath) {
  const result = spawnSync(process.execPath, ['--check', filePath], { encoding: 'utf8' });
  return result.status === 0 ? null : String(result.stderr || result.stdout || `exit=${result.status}`).trim();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = args.repoRoot;
  const failures = [];
  const checks = [];
  const addCheck = (id, passed, detail = {}) => {
    const check = { id, passed: Boolean(passed), detail };
    checks.push(check);
    if (!passed) failures.push({ checkId: id, detail });
  };
  const sourceHashes = {};
  const sourceTexts = {};
  let actualHead = null;
  try {
    actualHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
    addCheck('expected_head', !args.expectedHead || actualHead === args.expectedHead, {
      expected: args.expectedHead || actualHead, actual: actualHead,
    });
  } catch (error) {
    failures.push({ checkId: 'expected_head', detail: errorInfo(error) });
    checks.push({ id: 'expected_head', passed: false, detail: errorInfo(error) });
  }

  for (const fileName of sourceFiles) {
    const filePath = sourcePath(repoRoot, fileName);
    if (!fs.existsSync(filePath)) continue;
    try {
      const text = readUtf8(filePath);
      sourceTexts[fileName] = text;
      sourceHashes[fileName] = sha256(text);
    } catch (error) {
      failures.push({ checkId: 'utf8_read', detail: { fileName, ...errorInfo(error) } });
    }
  }
  const missingSourceFiles = sourceFiles.filter(fileName => !Object.hasOwn(sourceTexts, fileName));
  addCheck('source_chain_files_present', missingSourceFiles.length === 0, { missingSourceFiles });
  const relativeScriptPath = path.relative(repoRoot, scriptPath);
  const harnessText = fs.existsSync(scriptPath) ? readUtf8(scriptPath) : '';
  if (harnessText) sourceHashes[relativeScriptPath] = sha256(harnessText);
  const syntaxFailures = [];
  for (const fileName of [...Object.keys(sourceTexts), relativeScriptPath]) {
    const error = checkSyntax(sourcePath(repoRoot, fileName));
    if (error) syntaxFailures.push({ fileName, error });
  }
  const utf8Texts = { ...sourceTexts, [relativeScriptPath]: harnessText };
  addCheck('syntax_utf8_mojibake_fatal', syntaxFailures.length === 0 &&
    Object.entries(utf8Texts).every(([, text]) => !mojibakePattern.test(text)), {
    syntaxFailures,
    mojibakeFiles: Object.entries(utf8Texts).filter(([, text]) => mojibakePattern.test(text)).map(([name]) => name),
    fatalCount: syntaxFailures.length,
  });
  const productionClosure = buildProductionClosure(sourceTexts);
  const legacyClosureEdges = productionClosure.forbidden.filter(edge => edge.kind !== 'future-route-edge');
  const futureRouteClosureEdges = productionClosure.forbidden.filter(edge => edge.kind === 'future-route-edge');
  const closureDetail = {
    schemaVersion: productionClosure.schemaVersion,
    roots: productionClosure.roots,
    missingRoots: productionClosure.missingRoots,
    functionCounts: productionClosure.functionCounts,
    reachableNodeCount: productionClosure.reachableNodeCount,
    reachableEdgeCount: productionClosure.reachableEdgeCount,
    reachableModules: productionClosure.reachableModules,
    crossModuleEdges: productionClosure.crossModuleEdges,
    graphHash: productionClosure.graphHash,
    closureHash: productionClosure.closureHash,
  };
  addCheck('static_legacy_provider_edges_zero',
    productionClosure.missingRoots.length === 0 && legacyClosureEdges.length === 0, {
      ...closureDetail,
      forbiddenEdges: legacyClosureEdges,
    });
  addCheck('static_future_route_edges_zero',
    productionClosure.missingRoots.length === 0 && futureRouteClosureEdges.length === 0, {
      ...closureDetail,
      forbiddenEdges: futureRouteClosureEdges,
    });
  const v3ImportHits = {};
  for (const [fileName, text] of Object.entries(sourceTexts)) {
    const hits = lineHits(text, [/\bimport\b[^;\n]*(?:V3|v3)/u, /\brequire\b[^;\n]*(?:V3|v3)/u]);
    if (hits.length) v3ImportHits[fileName] = hits;
  }
  addCheck('static_v3_import_edges_zero', Object.keys(v3ImportHits).length === 0, v3ImportHits);
  const bridgeHits = lineHits(sourceTexts['mvu_logic_bridge.js'] || '', [
    /executeBattleDraftR8/u, /providerId\s*:\s*['"]r8['"]/u, /['"]r8['"]/u,
  ]);
  addCheck('bridge_no_hardcoded_r8', bridgeHits.length === 0, bridgeHits);

  const forbiddenHarnessTokens = [
    ['battle_r63', 'manual_cases'].join('_'),
    ['battle_r63', 'manual_manifest'].join('_'),
    ['__LWCS_', '内置角色库', '__'].join(''),
    ['__LWCS_', 'GET_BASE_STATS', '__'].join(''),
    ['e3413bf949e60df5', '6dfe9d1bd51abe9719ce02b613dc9ef6c3ad7ae54506190f'].join(''),
    ['e5ada7ecb2d36c90', '13f4810282c60ed01e7a12a19134ae23ecbe657717f352f4'].join(''),
  ];
  const harnessSelfContained = forbiddenHarnessTokens.every(token => !harnessText.includes(token)) &&
    /function buildDuelFixture\s*\(\s*\)/u.test(harnessText);
  addCheck('harness_self_contained', harnessSelfContained, {
    forbiddenTokenHits: forbiddenHarnessTokens.filter(token => harnessText.includes(token)),
    embeddedFixtureHash: EMBEDDED_FIXTURE_HASH,
  });

  const calls = {
    decision: { runProvider: 0, decide: 0, decideNext: 0, prepareDecisionRequest: 0, enumerateCandidates: 0 },
    runtime: { executeBattleDraft: 0, executePlayerLockedBattleSettlement: 0, sealBattleResult: 0, verifySealedBattlePackage: 0, executeBattleDraftR8: 0 },
    report: { build: 0, auditProjection: 0 },
    patch: 0,
  };
  let sandbox = null;
  let caseDefinition = null;
  let loadError = null;
  let protectionGateResults = [];
  try {
    sandbox = makeSandbox(repoRoot, calls);
    const decision = sandbox.__LWCS_BATTLE_DECISION__;
    const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
    addCheck('decision_formal_provider_state', decision?.formalProviderState === 'NO_FORMAL_PROVIDER', {
      formalProviderState: decision?.formalProviderState || null,
    });
    const providerIds = Array.isArray(decision?.providerIds) ? [...decision.providerIds] : [];
    addCheck('decision_provider_ids_empty', providerIds.length === 0, { providerIds, required: [] });
    addCheck('runtime_provider_neutral_exports', typeof runtime?.executeBattleDraft === 'function' && typeof runtime?.executePlayerLockedBattleSettlement === 'function', {
      executeBattleDraft: typeof runtime?.executeBattleDraft,
      executePlayerLockedBattleSettlement: typeof runtime?.executePlayerLockedBattleSettlement,
    });
    addCheck('runtime_no_legacy_r8_export', typeof runtime?.executeBattleDraftR8 !== 'function', { executeBattleDraftR8: typeof runtime?.executeBattleDraftR8 });
    caseDefinition = buildDuelFixture();
    const fixtureSerialized = JSON.stringify(caseDefinition);
    const fixtureCloneStable = JSON.stringify(buildDuelFixture()) === fixtureSerialized;
    addCheck('fixture_duel_overmatch_nonlethal',
      caseDefinition?.caseId === 'duel_overmatch_nonlethal' &&
      !caseDefinition?.sourceDataHashes && fixtureCloneStable &&
      sha256(fixtureSerialized) === EMBEDDED_FIXTURE_HASH, {
      caseId: caseDefinition?.caseId || null,
      embeddedFixtureHash: sha256(fixtureSerialized),
      embeddedFixtureBytes: Buffer.byteLength(fixtureSerialized, 'utf8'),
      embeddedFixtureCloneStable: fixtureCloneStable,
      selfContained: true,
      sourceDataHashes: caseDefinition?.sourceDataHashes || null,
    });
  } catch (error) {
    loadError = errorInfo(error);
    failures.push({ checkId: 'vm_source_chain_load', detail: loadError });
    checks.push({ id: 'vm_source_chain_load', passed: false, detail: loadError });
  }

  if (sandbox && caseDefinition) {
    const decision = sandbox.__LWCS_BATTLE_DECISION__;
    const runtime = sandbox.__LWCS_BATTLE_RUNTIME__;
    const actor = caseDefinition.combatData.参战者.team_player[0];
    const target = caseDefinition.combatData.参战者.team_enemy[0];
    const actorId = actor?.id || actor?.name || actor?.名称;
    const targetId = target?.id || target?.name || target?.名称;
    let selectedAction = { actorId, actionKind: 'BASIC_ATTACK', targetIds: [targetId] };
    try {
      const candidates = decision.enumerateCandidates({
        worldSnapshot: caseDefinition.combatData,
        actorId,
        actionOpportunity: { role: 'ACTIVE' },
        beliefState: {},
        battleIntent: { mode: caseDefinition.intent, objectives: caseDefinition.combatData.胜负条件 },
      });
      const basic = (Array.isArray(candidates) ? candidates : [])
        .map(item => item?.declaration)
        .find(item => item?.actionKind === 'BASIC_ATTACK' && item?.targetIds?.includes(targetId));
      if (basic) selectedAction = clone(basic);
    } catch { /* the runtime check below reports an unimplemented candidate contract */ }

    const beforeAuto = snapshotCalls(calls);
    const auto = await invoke(() => runtime.executeBattleDraft(buildInput(caseDefinition, 'auto')));
    const autoDelta = callDelta(beforeAuto, calls);
    const autoSummary = artifactSummary(auto.value);
    addCheck('auto_no_formal_provider_before_artifacts', !auto.ok && /NO_FORMAL_PROVIDER|NO_ACTIVE_FORMAL_PROVIDER/u.test(auto.error?.message || '') &&
      !autoSummary.hasDraft && !autoSummary.hasReport && !autoSummary.hasSealed &&
      autoDelta.decision.runProvider === 0 && autoDelta.decision.decide === 0 && autoDelta.decision.decideNext === 0 &&
      autoDelta.report.build === 0 && autoDelta.report.auditProjection === 0 &&
      autoDelta.runtime.sealBattleResult === 0 && autoDelta.runtime.verifySealedBattlePackage === 0 && autoDelta.patch === 0, {
      result: auto.error || autoSummary, calls: autoDelta,
    });

    const beforeManual = snapshotCalls(calls);
    const manual = await settleManual(sandbox, buildInput(caseDefinition, 'PLAYER_LOCKED', selectedAction));
    const manualDelta = callDelta(beforeManual, calls);
    const manualLedger = manual.summary.draft?.ledger || [];
    const manualMechanics = manual.summary.actualRoundCount === 1 && manual.summary.ledgerCount > 0;
    addCheck('legal_player_locked_settles_one_round', manual.result.ok && manual.summary.hasDraft && manualMechanics &&
      manual.summary.hasReport && manual.summary.hasSealed && manual.verify?.ok === true &&
      manual.summary.runtimeFatalCount === 0 && manual.reportAudit?.passed === true && Number(manual.reportAudit?.fatalCount || 0) === 0 &&
      manualDelta.decision.runProvider === 0 && manualDelta.decision.decide === 0 && manualDelta.decision.decideNext === 0 &&
      manualDelta.runtime.executeBattleDraftR8 === 0, {
      result: manual.result.error || {
        hasDraft: manual.summary.hasDraft,
        hasReport: manual.summary.hasReport,
        hasSealed: manual.summary.hasSealed,
        draftSchema: manual.summary.draftSchema,
        reportSchema: manual.summary.reportSchema,
        sealedSchema: manual.summary.sealedSchema,
        runtimeFatalCount: manual.summary.runtimeFatalCount,
      },
      reportAudit: manual.reportAudit ? { passed: manual.reportAudit.passed, fatalCount: manual.reportAudit.fatalCount } : null,
      verify: manual.verify ? {
        ok: manual.verify.ok,
        error: manual.verify.error || null,
        schemaVersion: manual.verify.value?.schemaVersion || null,
        sealStatus: manual.verify.value?.sealStatus || null,
        draftHash: manual.verify.value?.draftHash || null,
        reportHash: manual.verify.value?.reportHash || null,
      } : null,
      mechanics: { actualRoundCount: manual.summary.actualRoundCount, ledgerCount: manual.summary.ledgerCount, eventKinds: manualLedger.slice(0, 6).map(item => item?.eventKind) },
      runtimeFatalCodes: manual.summary.runtimeFatalCodes,
      calls: manualDelta,
    });

    const beforeIllegal = snapshotCalls(calls);
    const illegalAction = { ...selectedAction, targetIds: ['M1_ILLEGAL_TARGET'] };
    const illegal = await settleManual(sandbox, buildInput(caseDefinition, 'PLAYER_LOCKED', illegalAction));
    const illegalDelta = callDelta(beforeIllegal, calls);
    addCheck('illegal_player_locked_no_artifacts', !illegal.summary.hasDraft && !illegal.summary.hasReport && !illegal.summary.hasSealed &&
      illegalDelta.decision.runProvider === 0 && illegalDelta.decision.decide === 0 && illegalDelta.decision.decideNext === 0, {
      result: illegal.result.error || illegal.summary, calls: illegalDelta,
    });

    const beforeFree = snapshotCalls(calls);
    const free = await invoke(() => runtime.executeBattleDraft(buildInput(caseDefinition, 'free_narrative')));
    const freeDelta = callDelta(beforeFree, calls);
    const freeSummary = artifactSummary(free.value);
    addCheck('free_narrative_no_artifacts', !freeSummary.hasDraft && !freeSummary.hasReport && !freeSummary.hasSealed &&
      freeDelta.decision.runProvider === 0 && freeDelta.decision.decide === 0 && freeDelta.decision.decideNext === 0 &&
      freeDelta.report.build === 0 && freeDelta.report.auditProjection === 0 && freeDelta.runtime.sealBattleResult === 0 && freeDelta.patch === 0, {
      result: free.error || freeSummary, calls: freeDelta,
    });
    const auditEntriesOf = draftValue => Array.isArray(draftValue?.decisionAudit) ? draftValue.decisionAudit : [];
    const ledgerEventsOf = draftValue => Array.isArray(draftValue?.ledger) ? draftValue.ledger : [];
    const followUpAuditEntries = draftValue => auditEntriesOf(draftValue)
      .filter(entry => entry?.continuation === true || /follow_up/u.test(String(entry?.grantId || entry?.opportunityId || '')));
    const followUpLedgerActions = draftValue => ledgerEventsOf(draftValue)
      .filter(event => String(event?.meta?.chainType || '').trim() === 'FOLLOW_UP');
    const declaredTargetIdsOf = declaration => (Array.isArray(declaration?.targetIds) ? declaration.targetIds : [])
      .map(value => String(value || '').trim()).filter(Boolean);
    const recordProtection = (id, passed, detail) => {
      protectionGateResults.push({ id, passed: Boolean(passed) });
      addCheck(id, passed, detail);
    };

    const providerCleanDraft = manual.summary.draft;
    const providerCleanParams = [{ where: 'draft', value: providerCleanDraft }]
      .concat(auditEntriesOf(providerCleanDraft).map((entry, index) => ({ where: `decisionAudit[${index}]`, value: entry })));
    const providerCleanViolations = [];
    providerCleanParams.forEach(param => {
      const value = param.value;
      if (!value || typeof value !== 'object') {
        providerCleanViolations.push({ ...param, issue: 'artifact_missing' });
        return;
      }
      const providerId = value.providerId;
      if (providerId !== undefined && providerId !== null && providerId !== '') {
        providerCleanViolations.push({ ...param, issue: 'provider_id_not_empty', providerId });
      }
      if (Object.prototype.hasOwnProperty.call(value, 'formalProviderState') && value.formalProviderState !== 'NO_FORMAL_PROVIDER') {
        providerCleanViolations.push({ ...param, issue: 'formal_provider_state_wrong', formalProviderState: value.formalProviderState });
      }
    });
    recordProtection('protection_provider_metadata_clean', providerCleanViolations.length === 0, {
      parameters: providerCleanParams.length,
      violations: providerCleanViolations,
    });

    const providerCallParams = [];
    ['executeBattleDraft', 'executePlayerLockedBattleSettlement'].forEach(entry => {
      ['settings.providerId', 'input.providerId'].forEach(placement => providerCallParams.push({ entry, placement }));
    });
    const providerCallResults = [];
    for (const param of providerCallParams) {
      const injected = param.entry === 'executePlayerLockedBattleSettlement'
        ? buildInput(caseDefinition, 'PLAYER_LOCKED', selectedAction)
        : buildInput(caseDefinition, 'auto');
      if (param.placement === 'settings.providerId') {
        injected.settings = { ...(injected.settings || {}), providerId: 'NO_FORMAL_PROVIDER' };
      } else {
        injected.providerId = 'NO_FORMAL_PROVIDER';
      }
      const result = await invoke(() => runtime[param.entry](injected));
      const summary = artifactSummary(result.value);
      providerCallResults.push({
        ...param,
        rejected: !result.ok && /NO_FORMAL_PROVIDER/u.test(result.error?.message || ''),
        noArtifacts: !summary.hasDraft && !summary.hasReport && !summary.hasSealed,
        error: result.error?.message || null,
      });
    }
    recordProtection('protection_provider_id_call_rejected',
      providerCallResults.every(result => result.rejected && result.noArtifacts),
      { parameters: providerCallResults });

    const determinismRuns = [];
    for (let run = 1; run <= 3; run += 1) {
      determinismRuns.push(await settleManual(sandbox, buildInput(caseDefinition, 'PLAYER_LOCKED', selectedAction)));
    }
    const determinismHashes = determinismRuns.map(run => run.summary.draft?.draftHash || null);
    const determinismDrafts = determinismRuns.map(run => run.summary.draft ? JSON.stringify(run.summary.draft) : null);
    const determinismEqual = determinismDrafts.every((value, index) => value !== null && value === determinismDrafts[0]);
    recordProtection('protection_draft_hash_deterministic',
      determinismHashes.every(hash => hash !== null && hash === determinismHashes[0]) && determinismEqual,
      { runs: determinismHashes, draftsEqual: determinismEqual });

   const optionalRoles = ['REACTION', 'COUNTER', 'ASSIST'];
    const canonicalPassReason = 'NO_FORMAL_PROVIDER_OPTIONAL_OPPORTUNITY_PASSED';
    const noFormalProviderPassText = value => /NO_FORMAL_PROVIDER/u.test(String(value || '')) &&
      /PASS|让过|放弃|跳过|OPTIONAL_OPPORTUNITY/u.test(String(value || ''));
    const optionalParams = optionalRoles.map(role => {
      const entries = auditEntriesOf(providerCleanDraft)
        .filter(entry => String(entry?.actionRole || '').trim() === role);
      const violations = entries.map((entry, index) => {
        const actionKind = String(entry?.selected?.declaration?.actionKind || entry?.selected?.actionKind || '').trim();
        const passFormA = actionKind === 'PASS_OPPORTUNITY' &&
          String(entry?.decisionProfile?.passReason || '').trim() === canonicalPassReason;
        const lost = entry?.lostOpportunity || {};
        const passFormB = entry?.selected == null &&
          (noFormalProviderPassText(lost.reasonCode) ||
            noFormalProviderPassText(lost.reasonText) ||
            noFormalProviderPassText(lost.reason));
        const selectedValue = entry?.selected;
        const profile = entry?.decisionProfile || {};
        const forcedFollowupBinding = Boolean(selectedValue && typeof selectedValue === 'object') &&
          (selectedValue.playerLocked === true ||
            String(profile.selectionMode || '').trim() === 'PLAYER_LOCKED' ||
            String(selectedValue.selectionMode || '').trim() === 'PLAYER_LOCKED') &&
          Number(entry?.candidateCount ?? 1) === 1 &&
          declaredTargetIdsOf(selectedValue?.declaration).length === 1 &&
          (/follow_up|FOLLOW_UP|granted|grant/u.test(String(entry?.grantId || entry?.opportunityId || '')) ||
            Boolean(entry?.sourceActorId || entry?.sourceActionId));
        const legal = passFormA || passFormB || forcedFollowupBinding;
        return {
          index,
          actionKind,
          selectedCandidateId: entry?.selected?.candidateId || null,
          hasReason: passFormA || passFormB,
          passFormA,
          passFormB,
          forcedFollowupBinding,
          voluntaryPassFlag: Boolean(entry?.candidateAudit?.[0]?.voluntaryOpportunityPass),
          autoSelectedSkill: !legal && /RELEASE_SKILL|BASIC_ATTACK|DEFEND|EVADE|COUNTER|OBSERVE|WITHDRAW|GUARD|USE_ITEM|EQUIP/u.test(actionKind),
          grantId: entry?.grantId || null,
          sourceActionId: entry?.sourceActionId || null,
          candidateCount: Number(entry?.candidateCount ?? 1),
          targetCount: declaredTargetIdsOf(selectedValue?.declaration).length,
        };
      }).filter(violation => !violation.passFormA && !violation.passFormB && !violation.forcedFollowupBinding);
      const roleActorIds = entries.map(entry => String(entry?.actorId || entry?.actorName || '').trim()).filter(Boolean);
      const ledgerPassRuleCodes = ledgerEventsOf(providerCleanDraft)
        .filter(event => roleActorIds.includes(String(event?.actorName || event?.actorId || '').trim()))
        .map(event => String(event?.ruleCode || '').trim())
        .filter(ruleCode => /PASS|让过|放弃/u.test(ruleCode));
      return { role, entryCount: entries.length, violations, ledgerPassRuleCodes };
    });
   const exercisedOptionalRoles = optionalParams.filter(param => param.entryCount > 0).map(param => param.role);
   recordProtection('protection_optional_opportunity_explicit_pass',
     exercisedOptionalRoles.length > 0 && optionalParams.every(param => param.violations.length === 0),
     { parameters: optionalParams, exercisedRoles: exercisedOptionalRoles });

    const declaredOnlyParams = [{
      declaration: 'plain_basic_attack',
      forcedFollowUps: followUpAuditEntries(providerCleanDraft).length + followUpLedgerActions(providerCleanDraft).length,
    }];
    const followupFixture = buildDuelFixture();
    setVictoryThreshold(followupFixture.combatData, 0.001);
    const followupDeclaration = skillDeclaration(actorId, targetId, canonicalSkill(followupFixture, 'ring1'));
    const followupSettle = await settleManual(sandbox, buildInput(followupFixture, 'PLAYER_LOCKED', followupDeclaration));
    const followupPrimaryActionId = ledgerEventsOf(followupSettle.summary.draft)
      .find(event => event?.eventKind === 'action_start' && String(event?.actorName || '').trim() === actorId && !String(event?.sourceActionId || '').trim())
      ?.actionId || '';
    const followupTraceViolations = [];
    followUpAuditEntries(followupSettle.summary.draft).forEach((entry, index) => {
      const sourceMatches = String(entry?.grantId || entry?.opportunityId || '').includes(followupPrimaryActionId);
      const declaredTargets = declaredTargetIdsOf(followupDeclaration);
      const targetsWithin = declaredTargetIdsOf(entry?.selected?.declaration).every(targetIdValue => declaredTargets.includes(targetIdValue));
      if (!sourceMatches || !targetsWithin) followupTraceViolations.push({ index, kind: 'audit', sourceMatches, targetsWithin });
    });
    followUpLedgerActions(followupSettle.summary.draft).forEach((event, index) => {
      const sourceMatches = String(event?.sourceActionId || '').trim() === followupPrimaryActionId;
      if (!sourceMatches) followupTraceViolations.push({ index, kind: 'ledger', sourceMatches });
    });
    declaredOnlyParams.push({
      declaration: 'declared_followup_trigger',
      settlementOk: followupSettle.result.ok,
      primaryActionId: followupPrimaryActionId,
      followUpAuditCount: followUpAuditEntries(followupSettle.summary.draft).length,
      followUpLedgerActionCount: followUpLedgerActions(followupSettle.summary.draft).length,
      traceViolations: followupTraceViolations,
    });
    recordProtection('protection_followup_only_declared',
      declaredOnlyParams[0].forcedFollowUps === 0 &&
      declaredOnlyParams[1].settlementOk &&
      declaredOnlyParams[1].traceViolations.length === 0,
      { parameters: declaredOnlyParams });

    const ghostFixture = buildDuelFixture();
    ghostFixture.combatData.战斗意图 = '死斗';
    setEnemyHp(ghostFixture.combatData, 400);
    setVictoryThreshold(ghostFixture.combatData, 0.001);
    const ghostDeclaration = skillDeclaration(actorId, targetId, canonicalSkill(ghostFixture, 'ring3'));
   const ghostSettle = await settleManual(sandbox, buildInput(ghostFixture, 'PLAYER_LOCKED', ghostDeclaration));
   const ghostFinalEnemy = ghostSettle.summary.draft?.finalSnapshot?.参战者?.team_enemy?.[0];
   const ghostIncapacitated = String(ghostFinalEnemy?.__战斗失能原因 || '').trim() !== '' ||
     String(ghostFinalEnemy?.状态?.行动 || '').trim() !== '战斗';
   const ghostFollowUpAudits = followUpAuditEntries(ghostSettle.summary.draft)
     .filter(entry => declaredTargetIdsOf(entry?.selected?.declaration).includes(targetId));
    const ghostEvents = ledgerEventsOf(ghostSettle.summary.draft);
    const ghostIncapacitationEvent = ghostEvents.find(event =>
      String(event?.targetId || event?.targetName || '').trim() === targetId &&
      /TRAUMA_|INCAPACITATED|失能|UNCONSCIOUS|DEAD/u.test(
        `${String(event?.ruleCode || '')} ${String(event?.primaryOutcome || event?.actionType || '')}`,
      ));
    const ghostFollowUpStartEvent = ghostEvents.find(event =>
      String(event?.meta?.chainType || '').trim() === 'FOLLOW_UP' &&
      /follow_up/u.test(String(event?.grantId || '')));
    const ghostDecisionTimeIncapacitated = Boolean(
      ghostIncapacitationEvent && ghostFollowUpStartEvent &&
      ghostEvents.indexOf(ghostIncapacitationEvent) < ghostEvents.indexOf(ghostFollowUpStartEvent));
   const ghostTargetLostEvents = ledgerEventsOf(ghostSettle.summary.draft)
     .filter(event => event?.eventKind === 'blocked_settlement' && String(event?.ruleCode || '').trim() === 'TARGET_LOST');
   recordProtection('protection_followup_no_ghost_without_survivor',
      ghostSettle.result.ok && ghostIncapacitated &&
      (!ghostDecisionTimeIncapacitated || ghostFollowUpAudits.length === 0),
     {
       scenario: { intent: '死斗', enemyHp: 400, threshold: 0.001, declaration: 'ring3_hit_followup' },
       targetIncapacitated: ghostIncapacitated,
        decisionTimeIncapacitated: ghostDecisionTimeIncapacitated,
       ghostFollowUpAudits: ghostFollowUpAudits.length,
       ghostTargetLostEvents: ghostTargetLostEvents.length,
     });

    const nonlethalIntents = ['点到为止', '切磋'];
    const nonlethalParams = [];
    for (const intent of nonlethalIntents) {
      const fixture = buildDuelFixture();
      fixture.combatData.战斗意图 = intent;
      setVictoryThreshold(fixture.combatData, 0.001);
      const declaration = skillDeclaration(actorId, targetId, canonicalSkill(fixture, 'ring1'));
      const settled = await settleManual(sandbox, buildInput(fixture, 'PLAYER_LOCKED', declaration));
      const finalEnemy = settled.summary.draft?.finalSnapshot?.参战者?.team_enemy?.[0];
      const enemyHp = Number(finalEnemy?.hp ?? finalEnemy?.HP ?? finalEnemy?.属性?.HP ?? 0);
      const enemyDead = String(finalEnemy?.__战斗失能原因 || '').trim() === 'DEAD';
      const deathLedgerEvents = ledgerEventsOf(settled.summary.draft)
        .filter(event => String(event?.targetName || event?.targetId || '').trim() === targetId)
        .filter(event => /死|DEAD/u.test(String(event?.ruleCode || event?.result || event?.meta?.reasonCode || '').trim()));
      const followUpActionCount = followUpAuditEntries(settled.summary.draft).length + followUpLedgerActions(settled.summary.draft).length;
      nonlethalParams.push({
        intent,
        settlementOk: settled.result.ok,
        enemyHp,
        enemyDead,
        deathLedgerEvents: deathLedgerEvents.length,
        followUpActionCount,
      });
    }
    recordProtection('protection_nonlethal_not_killed_by_followup',
      nonlethalParams.every(param => param.settlementOk && param.enemyHp > 0 && !param.enemyDead &&
        param.deathLedgerEvents === 0 && param.followUpActionCount > 0),
      { parameters: nonlethalParams });

    const protectionRouteValues = [auto.value, manual.value, illegal.value, free.value,
      determinismRuns.map(run => run.value), followupSettle.value, ghostSettle.value];
    const dynamicRouteHits = protectionRouteValues.flatMap(checkDynamicRoute);
    addCheck('dynamic_future_route_edges_zero', dynamicRouteHits.length === 0, dynamicRouteHits);
  }

  const fatalCount = failures.length;

  const status = fatalCount === 0 ? 'PASSED' : 'FAILED';
  const output = {
    schemaVersion: 'M1V31AcceptanceV1',
    status,
    verdict: status === 'PASSED' ? 'M1_V31_ACCEPTANCE_PASSED' : 'M1_V31_ACCEPTANCE_FAILED',
    taskId: 'M1-W-ACCEPT',
    repoRoot,
    expectedHead: args.expectedHead || actualHead,
    actualHead,
    fixture: 'duel_overmatch_nonlethal',
    embeddedFixture: {
      bytes: EMBEDDED_FIXTURE_BYTES,
      hash: EMBEDDED_FIXTURE_HASH,
      source: 'embedded_constant',
      productionLibraryDependent: false,
      ignoredFixtureDependent: false,
    },
    protectionGates: protectionGateResults,
    sourceHashes,
    checks,
    callCounts: calls,
    failures,
    fatalCount,
    agentWorkReceipt: {
      schemaVersion: 'AgentWorkReceiptV1',
      taskId: 'M1-W-ACCEPT',
      status,
      writeScope: { allowed: ['tools/rc6/harness/run-m1-v31-acceptance.mjs'], changed: ['tools/rc6/harness/run-m1-v31-acceptance.mjs'] },
      productionEdits: 0,
      evidenceWrites: 0,
      committed: false,
      staged: false,
    },
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = status === 'PASSED' ? 0 : 1;
}

main().catch(error => {
  const output = {
    schemaVersion: 'M1V31AcceptanceV1',
    status: 'FAILED',
    verdict: 'M1_V31_ACCEPTANCE_FAILED',
    taskId: 'M1-W-ACCEPT',
    failures: [{ checkId: 'harness_fatal', detail: errorInfo(error) }],
    fatalCount: 1,
    agentWorkReceipt: {
      schemaVersion: 'AgentWorkReceiptV1', taskId: 'M1-W-ACCEPT', status: 'FAILED',
      writeScope: { allowed: ['tools/rc6/harness/run-m1-v31-acceptance.mjs'], changed: ['tools/rc6/harness/run-m1-v31-acceptance.mjs'] },
      productionEdits: 0, evidenceWrites: 0, committed: false, staged: false,
    },
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = 1;
});
