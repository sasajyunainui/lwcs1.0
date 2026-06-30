const 仓库名 = 'sasajyunainui/lwcs1.0';
const 分支名 = 'master';
const CDN地址列表 = Object.freeze([
  'https://testingcf.jsdelivr.net',
  'https://cdn.jsdelivr.net',
  'https://gcore.jsdelivr.net',
  'https://fastly.jsdelivr.net',
]);
const 请求超时毫秒 = 15000;
const 入口文件名 = 'MVU_ZOD_Entry.js';
const 启动预取资源列表 = Object.freeze([
  'MVU_Skill_Runtime.js',
  'MVU_Schema_Runtime.js',
  'MVU_Runtime_View.js',
  'MVU.js',
  'MVU_Hooks.js',
  'timeline.js',
  'IntelEvents.js',
]);

async function 取最新提交哈希() {
  const 接口地址 = `https://api.github.com/repos/${仓库名}/git/ref/heads/${分支名}?t=${Date.now()}`;
  const 响应 = await fetch(接口地址, {
    cache: 'no-store',
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!响应.ok) throw new Error(`GitHub 最新提交读取失败: ${响应.status}`);
  const 数据 = await 响应.json();
  const 提交哈希 = String(数据 && 数据.object && 数据.object.sha ? 数据.object.sha : '').trim();
  if (!/^[0-9a-f]{40}$/i.test(提交哈希)) throw new Error('GitHub 最新提交格式异常');
  return 提交哈希;
}

function 预取关键资源(资源基础地址) {
  启动预取资源列表.forEach(文件名 => {
    fetch(`${资源基础地址}${文件名}`, { cache: 'force-cache' }).catch(() => {});
  });
}

function withTimeout(承诺, 标签) {
  return new Promise((resolve, reject) => {
    const 超时器 = setTimeout(() => reject(new Error(`${标签} 超时:${请求超时毫秒}ms`)), 请求超时毫秒);
    Promise.resolve(承诺).then(
      值 => {
        clearTimeout(超时器);
        resolve(值);
      },
      错误 => {
        clearTimeout(超时器);
        reject(错误);
      },
    );
  });
}

const 最新提交哈希 = await 取最新提交哈希();
const 错误列表 = [];
let 已加载 = false;

for (const CDN地址 of CDN地址列表) {
  const 资源基础地址 = `${CDN地址}/gh/${仓库名}@${最新提交哈希}/`;
  try {
    globalThis.__LWCS_MVU_资源基础地址__ = 资源基础地址;
    globalThis.__LWCS_MVU_资源基础地址候选列表__ = CDN地址列表.map(候选CDN地址 => `${候选CDN地址}/gh/${仓库名}@${最新提交哈希}/`);
    globalThis.__LWCS_MVU_当前远程提交__ = 最新提交哈希;
    try {
      if (globalThis.parent && globalThis.parent !== globalThis) {
        globalThis.parent.__LWCS_MVU_资源基础地址__ = 资源基础地址;
        globalThis.parent.__LWCS_MVU_资源基础地址候选列表__ = globalThis.__LWCS_MVU_资源基础地址候选列表__;
        globalThis.parent.__LWCS_MVU_当前远程提交__ = 最新提交哈希;
      }
    } catch (错误) {}
    try {
      if (globalThis.top && globalThis.top !== globalThis) {
        globalThis.top.__LWCS_MVU_资源基础地址__ = 资源基础地址;
        globalThis.top.__LWCS_MVU_资源基础地址候选列表__ = globalThis.__LWCS_MVU_资源基础地址候选列表__;
        globalThis.top.__LWCS_MVU_当前远程提交__ = 最新提交哈希;
      }
    } catch (错误) {}

    await withTimeout(import(`${资源基础地址}${入口文件名}`), `导入 ${资源基础地址}${入口文件名}`);
    预取关键资源(资源基础地址);
    已加载 = true;
    break;
  } catch (错误) {
    错误列表.push(`${CDN地址}: ${错误 && 错误.message ? 错误.message : String(错误 || 'unknown_error')}`);
  }
}
if (!已加载) {
  throw new Error(`LWCS MVU 入口 CDN 全部失败: ${错误列表.join(' | ')}`);
}
