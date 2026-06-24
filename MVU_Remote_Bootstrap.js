const 仓库名 = 'sasajyunainui/lwcs1.0';
const 分支名 = 'master';
const CDN地址 = 'https://testingcf.jsdelivr.net';
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

const 最新提交哈希 = await 取最新提交哈希();
const 资源基础地址 = `${CDN地址}/gh/${仓库名}@${最新提交哈希}/`;

globalThis.__LWCS_MVU_资源基础地址__ = 资源基础地址;
globalThis.__LWCS_MVU_当前远程提交__ = 最新提交哈希;
try {
  if (globalThis.parent && globalThis.parent !== globalThis) {
    globalThis.parent.__LWCS_MVU_资源基础地址__ = 资源基础地址;
    globalThis.parent.__LWCS_MVU_当前远程提交__ = 最新提交哈希;
  }
} catch (错误) {}
try {
  if (globalThis.top && globalThis.top !== globalThis) {
    globalThis.top.__LWCS_MVU_资源基础地址__ = 资源基础地址;
    globalThis.top.__LWCS_MVU_当前远程提交__ = 最新提交哈希;
  }
} catch (错误) {}

预取关键资源(资源基础地址);
await import(`${资源基础地址}${入口文件名}`);
