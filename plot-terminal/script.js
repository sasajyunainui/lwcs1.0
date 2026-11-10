(()=>{
"use strict";
const mountScript=document.currentScript;
let bootAttempts=0;
const boot=()=>{
let app=mountScript?.previousElementSibling;
if(!app?.hasAttribute?.("data-pt-root")){const candidates=[...document.querySelectorAll('[data-pt-root="true"]:not([data-initialized="true"])')];app=candidates[candidates.length-1]||null}
if(!app){if(bootAttempts++<60)setTimeout(boot,50);return}
app.dataset.initialized="true";
const $=(s,r=app)=>r.querySelector(s);const queryAll=(s,r=app)=>[...r.querySelectorAll(s)];

/* ===== 数据源：用户楼层 qrf_plot_tasks 的各任务输出 ===== */
const TASKS={recall:["plotTask2"],clue:["plotTask2C"],routing:["lwcs_module_routing"],ruling:["lwcs_integrated_ruling"],character:["defaultPlotTask"]};
// 原著线索（plotTask2C）与独立模块路由是可选任务：旧楼层没有，缺了不算异常；模块路由旧版写在裁定任务里
const REQUIRED=["recall","ruling","character"];
const TASK_TAGS={recall:["time_jump","original_character_seed","recall","deviation_ledger_recall"],clue:["timeline_recall","npc_behavior_evidence"],routing:["module_routing","battle_adjudication"],ruling:["dm_set","scene_audit","scene_ruling","route_boundary","butterfly_analysis","module_routing","battle_adjudication"],character:["dm_set","file","inner","act","dm_track"]};
const PAGES={
 overview:{label:"本轮",icon:"compass"},people:{label:"人物",icon:"users"},ruling:{label:"裁定",icon:"scale-balanced"},intel:{label:"情报",icon:"book-open"},
 raw_recall:{label:"任务1原文",raw:"recall"},raw_clue:{label:"原著线索原文",raw:"clue"},raw_ruling:{label:"任务2原文",raw:"ruling"},raw_character:{label:"任务3原文",raw:"character"},raw_combined:{label:"汇总原文",raw:"combined"},raw_message:{label:"用户消息",raw:"message"},raw_diagnostics:{label:"解析诊断",raw:"diagnostics"}
};
const MAIN=["overview","people","ruling","intel"];
const state={page:"overview",lastMain:"overview",snapshot:null,game:null,hash:"",request:0,personKey:"",peopleView:"person",intelSection:"clue",rulingSection:"current",moduleSelected:0,expandedRecords:{AM:new Set(),DV:new Set()},recordIndex:new Map(),recordIndexReady:false,recordIndexError:"",floorKey:"",scroll:{},prefs:{font:1,density:"standard"},rendered:false};
const storageKey="plot-terminal-ui:v7";

/* ===== 小工具 ===== */
function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n}
function h(tag,cls,...kids){const n=document.createElement(tag);if(cls)n.className=cls;for(const k of kids.flat()){if(k===null||k===undefined||k===false||k==="")continue;n.append(k instanceof Node?k:String(k))}return n}
function icon(name){const i=document.createElement("i");i.className="fa-solid fa-"+name;i.setAttribute("aria-hidden","true");return i}
function btn(cls,data,...kids){const b=h("button",cls,...kids);b.type="button";for(const [k,v] of Object.entries(data||{}))b.dataset[k]=v;return b}
function chip(text,tone){const c=h("span","pt-chip",text);if(tone)c.dataset.tone=tone;return c}
function hexOf(content,kind,size){const x=h("span","pt-hex",content);x.dataset.kind=kind||"npc";if(size)x.style.setProperty("--s",size+"px");x.setAttribute("aria-hidden","true");return x}
function avatar(name,kind,size){return hexOf((clean(name)||"?").slice(0,1),kind,size)}
function hexIcon(name,size){return hexOf(icon(name),"icon",size)}
function hexNum(n,size){return hexOf(String(n),"num",size)}
function plateHead(ic,title,code,...extra){return h("h3","pt-plate-h",icon(ic),h("span","",title),...extra,code?h("small","pt-code",code):null)}
function plate(cls,...kids){return h("section",("pt-plate "+(cls||"")).trim(),...kids)}
function lbl(ic,text){return h("p","pt-lbl",ic?icon(ic):null,text)}
function prose(text,cls="pt-prose"){const el=h("p",cls),src=clean(text);let last=0;for(const m of src.matchAll(/\*\*([^*\n]+)\*\*/g)){el.append(src.slice(last,m.index),h("b","",m[1]));last=m.index+m[0].length}el.append(src.slice(last));return el}
function emptyState(ic,title,text){return h("div","pt-empty",hexIcon(ic,52),h("b","",title),text?h("p","",text):null)}
function clean(v){return String(v??"").replace(/\r\n?/g,"\n").trim()}
function escapeRe(v){return String(v).replace(/[.*+?^${}()|[\]\\]/g,ch=>"\\"+ch)}
function ptBlank(v){const s=clean(v).replace(/[。.]$/,"");return!s||/^(?:无|无相关.*|无新增.*|没有|未发现|—|-|暂无)$/.test(s)}
function getTag(text,tag){const src=String(text||""),low=src.toLowerCase(),t=String(tag).toLowerCase(),closeIdx=low.lastIndexOf("</"+t+">");if(closeIdx<0)return"";const openRe=new RegExp("<"+escapeRe(tag)+"(?:\\s[^>]*)?>","gi");let m,openEnd=-1;while((m=openRe.exec(src))!==null){if(m.index>=closeIdx)break;openEnd=m.index+m[0].length}return openEnd<0?"":clean(src.slice(openEnd,closeIdx))}
function taskLabel(task){return(TASKS[task]||[]).join(" + ")}
function hashText(text){let h=5381;for(let i=0;i<text.length;i++)h=((h<<5)+h)^text.charCodeAt(i);return(h>>>0).toString(36)}
function loadPrefs(){let p={};try{p=JSON.parse(localStorage.getItem(storageKey)||"{}")}catch(_){}state.prefs.font=[.9,1,1.12].includes(Number(p?.font))?Number(p.font):1;state.prefs.density=p?.density==="compact"?"compact":"standard";if(MAIN.includes(p?.page))state.page=state.lastMain=p.page}
function savePrefs(){try{localStorage.setItem(storageKey,JSON.stringify({font:state.prefs.font,density:state.prefs.density,page:state.lastMain}))}catch(_){}}
// 第一句：引号里的句号不算句末
function firstSentence(text,fallback=""){const src=clean(text).split("\n").map(clean).find(Boolean)||"";if(!src)return fallback;let depth=0;for(let i=0;i<src.length;i++){const ch=src[i];if("「“『（(".includes(ch))depth++;else if("」”』）)".includes(ch))depth=Math.max(0,depth-1);else if(depth===0&&"。！？!?".includes(ch)){let j=i+1;while(j<src.length&&"」”』）)…".includes(src[j]))j++;return src.slice(0,j)}}return src}

/* ===== 读取聊天楼层 ===== */
function getChatContext(){try{if(window.parent?.SillyTavern?.getContext)return window.parent.SillyTavern.getContext();if(typeof window.parent?.getContext==="function")return window.parent.getContext();if(window.SillyTavern?.getContext)return window.SillyTavern.getContext();if(typeof window.getContext==="function")return window.getContext()}catch(_){}return null}
function currentMessageIndex(chat){const checks=[];try{if(typeof getCurrentMessageId==="function")checks.push(Number(getCurrentMessageId()))}catch(_){}try{if(typeof getIframeName==="function"){const m=String(getIframeName()).match(/TH-message--(\d+)--/);if(m)checks.push(Number(m[1]))}}catch(_){}try{const name=String(window.frameElement?.name||window.frameElement?.id||"");const m=name.match(/TH-message--(\d+)--/);if(m)checks.push(Number(m[1]))}catch(_){}try{const frame=window.frameElement;const host=frame?.closest?.(".mes[mesid],[data-message-id]")||frame?.parentElement?.closest?.(".mes[mesid],[data-message-id]");checks.push(Number(host?.getAttribute?.("mesid")??host?.dataset?.messageId))}catch(_){}for(const value of checks)if(Number.isInteger(value)&& value>=0&& value<chat.length)return value;return-1}
function hasTaskData(message){return!!(message?.is_user&& message.qrf_plot_tasks&& typeof message.qrf_plot_tasks==="object")}
function findPlotMessage(chat){const terminalIndex=currentMessageIndex(chat);if(terminalIndex<0)return{error:"无法确定本终端所在楼层，已停止读取，未使用历史数据。",terminalIndex:-1};const current=chat[terminalIndex];if(hasTaskData(current))return{message:current,index:terminalIndex,terminalIndex};for(let i=Math.min(terminalIndex-1,chat.length-1);i>=0;i--){const message=chat[i];if(!message?.is_user)continue;if(!hasTaskData(message))return{error:"对应用户楼层尚未保存 qrf_plot_tasks。",terminalIndex,userIndex:i};return{message,index:i,terminalIndex}}return{error:"当前终端楼层之前没有可关联的用户消息。",terminalIndex}}
function readNearTimeline(){try{const fn=window.__LWCS_GET_STORY_MODULE_STAGING_STAT__||window.parent?.__LWCS_GET_STORY_MODULE_STAGING_STAT__;const mvu=window.Mvu||window.parent?.Mvu;const runtime=window.__LWCS_MVU_RUNTIME_VIEW__||window.parent?.__LWCS_MVU_RUNTIME_VIEW__;const staged=typeof fn==="function"?fn({userInput:""}):null;const current=staged||((mvu&& typeof mvu.getMvuData==="function")?mvu.getMvuData({type:"message",message_id:"latest"}):null);const data=current?.stat_data||current;const view=runtime&& typeof runtime.生成MVU剧情视图==="function"?runtime.生成MVU剧情视图(data||null,""):null;const value=view?.剧情钩子?._引导?.时间线预览??data?.剧情钩子?._引导?.时间线预览;return typeof value==="string"?clean(value):value&& typeof value==="object"?JSON.stringify(value,null,2):""}catch(_){return ""}}
function readCrossedTimeline(){try{const value=window.parent?.__LWCS_TIME_JUMP_RUNTIME__||window.__LWCS_TIME_JUMP_RUNTIME__;if(!value)return null;return{from:clean(value.旧时间),to:clean(value.新时间),summary:clean(value.跨越概览)}}catch(_){return null}}
function buildSnapshot(){
 const ctx=getChatContext(),chat=Array.isArray(ctx?.chat)?ctx.chat:[],persona=clean(ctx?.name1);
 const base={tasks:{},combined:"",message:"",swipes:[],nearTimeline:readNearTimeline(),crossedTimeline:readCrossedTimeline(),persona};
 if(!chat.length)return{...base,index:-1,terminalIndex:-1,floor:"#?",diagnostics:["无法读取当前聊天记录。"]};
 const found=findPlotMessage(chat);
 if(!found.message)return{...base,index:found.userIndex??-1,terminalIndex:found.terminalIndex??-1,floor:found.terminalIndex>=0?"#"+found.terminalIndex:"#?",message:found.userIndex>=0?clean(chat[found.userIndex]?.mes):"",diagnostics:[found.error]};
 const message=found.message,tasks={},diagnostics=[];
 for(const [key,ids] of Object.entries(TASKS)){
  const raw=ids.map(id=>clean(message.qrf_plot_tasks[id])).filter(Boolean).join("\n\n"),tags={};
  for(const tag of TASK_TAGS[key]||[])tags[tag]=getTag(raw,tag);
  tasks[key]={id:taskLabel(key),raw,tags};
  if(REQUIRED.includes(key))for(const id of ids)if(!clean(message.qrf_plot_tasks[id]))diagnostics.push("任务 "+id+" 无保存结果。");
 }
 return{...base,index:found.index,terminalIndex:found.terminalIndex,floor:"#"+found.terminalIndex,tasks,combined:clean(message.qrf_plot||message.extra?.qrf_plot),message:clean(message.mes),swipes:Array.isArray(message.swipes)?message.swipes:[],diagnostics}
}

/* ===== 文本解析（字段口径同原版） ===== */
const FIELD_ALIASES={"内在能力与筹码":"内在能力与筹码检验","能力与筹码检验":"内在能力与筹码检验","外在自然回响":"外在社会与自然回响","外在社会回响":"外在社会与自然回响","信息盲区与认知":"信息盲区与认知边界","认知盲区与信息边界":"信息盲区与认知边界","内心":"inner_voice","内心独白":"inner_voice","心声":"inner_voice","心里的话":"inner_voice","inner":"inner_voice","分心":"aside","我还分着心的":"aside","此刻":"now","当前":"now","我此刻的处境":"now","第一拍":"beat","起手":"beat","我起手怎么开口":"beat","主动推进":"initiative","后续动作":"then","接下来":"then","我不会做的":"底线","不会做的":"底线","我的底线":"底线","他们之间":"interplay","彼此之间":"interplay"};
const RULING_LABELS=["场域与生态构建","认知与权限边界","行动逻辑与等价交换检定","内在能力与筹码检验","外在社会与自然回响","信息盲区与认知边界"];
const ROUTE_LABELS=["世界进程与路线关系","本轮剧情推进","本轮落点与后续接力"];
const AUDIT_LABELS=["新登场原创角色核对","实力描述与评价","场景参照群体","参照年龄区间","环境实力坐标","常见区间","优秀区间","顶尖区间","观察NPC眼界","表象实力与相对评价"];
const BUTTERFLY_LABELS=["沿用的已有偏差","本轮已成立的变化","可能的传播路径"];
function normalizeHeading(raw){return clean(String(raw||"").replace(/^\s*(?:[-*+]\s*|\d+[.)、]\s*)+/u,"").replace(/^\*+|\*+$/gu,"").replace(/[：:]\s*$/u,"").replace(/^(?:【|\[)\s*|\s*(?:】|\])$/gu,""))}
function canonicalFieldKey(raw){const key=normalizeHeading(raw);const low=key.toLowerCase();if(FIELD_ALIASES[key])return FIELD_ALIASES[key];if(FIELD_ALIASES[low])return FIELD_ALIASES[low];return /^[a-z][a-z_ ]*$/i.test(key)?low.replace(/\s+/g,"_"):key}
function parseFields(text){const out=[];let cur=null;for(const raw of clean(text).split("\n")){const m=raw.match(/^\s*[-*+]?\s*(?:\d+[.)、]\s*)?([^：:\n]{1,40})[：:]\s*(.*)$/);if(m){cur={key:canonicalFieldKey(m[1]),value:clean(m[2])};out.push(cur)}else if(cur&& raw.trim())cur.value+=(cur.value?"\n":"")+raw.trim()}return out}
function splitSections(text,labels){const map={__unparsed:""};let current="";for(const raw of clean(text).split("\n")){const normalized=normalizeHeading(raw);const hit=labels.find(l=>{const candidate=canonicalFieldKey(normalized);return candidate===l||normalized===l||normalized.startsWith(l+"：")||normalized.startsWith(l+":")||candidate.startsWith(l+"：")||candidate.startsWith(l+":")});if(hit){current=hit;const offset=normalized.indexOf(hit);map[current]=(offset>=0?normalized.slice(offset+hit.length):"").replace(/^[：:】\]]\s*/,"").replace(/^[：:]\s*/,"")}else if(current)map[current]+=(map[current]?"\n":"")+raw.trim();else if(raw.trim())map.__unparsed+=(map.__unparsed?"\n":"")+raw.trim()}for(const k of Object.keys(map))map[k]=clean(map[k]);return map}
function splitSteps(text){const out=[];let cur=null;for(const raw of clean(text).split("\n")){const line=raw.trim();const m=line.match(/^step\s*(\d+)\s*([^：:\n]*)(?:[：:]|$)\s*(.*)$/i);if(m){if(cur)out.push(cur);cur={n:m[1],title:normalizeHeading(m[2])||"步骤 "+m[1],lines:m[3]?[m[3]]:[]}}else if(cur)cur.lines.push(raw);else if(line){cur={n:String(out.length+1),title:"前置说明",lines:[raw]}}}if(cur)out.push(cur);return out}
function parsePeopleBlocks(text){const blocks=[];const re=/^###?\s*(?:【([^】\n]+)】|\[?([^\]\n]+)\]?)\s*$/gm;let m;const hits=[];while((m=re.exec(clean(text))))hits.push({name:clean(m[1]||m[2]),start:m.index,end:re.lastIndex});if(!hits.length){const bracket=/^(?:【([^】\n]+)】|\[([^\]\n]+)\])\s*$/gm;while((m=bracket.exec(clean(text))))hits.push({name:clean(m[1]||m[2]),start:m.index,end:bracket.lastIndex})}hits.forEach((hh,i)=>blocks.push({name:hh.name,text:clean(text).slice(hh.end,hits[i+1]?.start??clean(text).length).trim()}));return blocks}
function parseSceneAnchor(text){const source=clean(text);const time=(source.match(/(?:时间(?:是|为|：|:)?|准确时间(?:是|：|:)?)\s*[^，。\n]*?(\d{1,2}:\d{2})/u)||source.match(/(\d{1,2}:\d{2})/))?.[1]||"";const location=clean(((source.match(/(?:地点(?:是|为|：|:)?|当前[^。\n，]*地点(?:是|：|:)?)\s*([^。\n，]+)/u)||[])[1]||"").replace(/^(?:位于|在|处于)/,""));const date=(source.match(/斗罗历[^，,。\s]*?日/)||[""])[0];return{time,location:location.replace(/^斗罗大陆[-—·\s]*/,"").replace(/\s*[-—>＞]\s*/g," · "),date}}
const MODULE_NAMES={battle:"战斗",trade:"交易",profession:"工坊",teaching:"传授",skill_gain:"技能获得",routine:"训练",trial_entry:"试炼入场",travel:"旅行",未命中:"未命中"};
const MODULE_ICONS={battle:"khanda",trade:"coins",profession:"hammer",teaching:"chalkboard-user",skill_gain:"wand-sparkles",routine:"dumbbell",trial_entry:"dungeon",travel:"route"};
const MODULE_REQUIRED={battle:["地点","战斗类型","允许撤离","胜利条件关系","胜利条件","失败条件关系","失败条件","最大回合","我方","敌方"],trade:["动作","地点","对象","物品","数量"],profession:["动作","地点","执行者类型","对象","目标","材料","数量","阶级","子类型"],teaching:["动作","老师","学生","内容类型","内容名称","结果","理由"],skill_gain:["角色","技能类型","技能名称","来源"],routine:["角色","动作","地点","耗时tick","启用地点拟态","理由"],trial_entry:["试炼类型"],travel:["角色","目标地点","归属父节点","描述","方位","移动方式","耗时tick"],未命中:["理由"]};
function parseModuleRouting(text){const source=clean(text);if(!source)return[];const lines=source.split("\n"),blocks=[];let current=[];for(const raw of lines){if(current.length&&/^\s*模块\s*[：:]/u.test(raw)){blocks.push(clean(current.join("\n")));current=[]}if(raw.trim()||current.length)current.push(raw)}if(current.length)blocks.push(clean(current.join("\n")));if(!blocks.length)return[{id:"",label:"模块结果",status:"无法解析",raw:source,error:true}];return blocks.map(raw=>{const fields=parseFields(raw),map=new Map(fields.map(item=>[item.key,item.value])),id=clean(map.get("模块"));if(!id)return{id:"",label:"模块结果",status:"无法解析",raw,error:true};return{id,label:MODULE_NAMES[id]||id,status:id==="未命中"?"未命中":"已命中",raw,fields,map,error:false}})}
function parseLanding(text){const s=clean(text);const land=(s.match(/本轮落点[：:]\s*([\s\S]*?)(?=\n\s*后续接力[^：:\n]*[：:]|$)/)||[])[1];const next=(s.match(/后续接力[^：:\n]*[：:]\s*([\s\S]*)$/)||[])[1];return{land:clean(land!==undefined?land:next?"":s),next:clean(next)}}
// 原著行为依据：空行分块。首行是人名，写法有「林茂」「人物：刘语心（高级部学生/志愿者）」「龙恒旭（教导处主任）」；
// 字段行有「场合｜…」「场合：…」「- 对待新生登记：…」。同一人可有多块（不同场合）
function parseEvidence(text){const out=[];const src=clean(text);if(ptBlank(src))return out;for(const block of src.split(/\n\s*\n/)){const lines=block.split("\n").map(clean).filter(Boolean);if(lines.length<2)continue;const head=lines[0].replace(/^#+\s*/,"").replace(/[【】\[\]]/g,"").replace(/^人物\s*[：:]\s*/,"").trim();if(/[｜|]/.test(head))continue;const m=head.match(/^([^（(]+?)\s*[（(]([^）)]*)[）)]\s*$/);out.push({name:clean(m?m[1]:head),role:clean(m?m[2]:""),fields:lines.slice(1).map(line=>{const s=line.replace(/^[-*•]\s*/,""),f=s.match(/^([^｜|：:]{1,16})[｜|：:]\s*(.*)$/);return f?[clean(f[1]),clean(f[2])]:["",s]})})}return out}
function evidenceOf(name){return(state.game?.evidence||[]).filter(e=>e.name===name)}
// 原著时间线召回：「序号｜时间｜事件｜命中依据」「时间｜事件｜依据」「ch0057_01｜原本世界线于2天后发生｜事件｜依据」
function parseTimelineRecall(text){const src=clean(text);if(ptBlank(src))return[];return src.split("\n").map(clean).filter(Boolean).map(line=>{const p=line.split(/\s*[｜|]\s*/);if(p.length<3)return{event:line,hits:[]};const [id,when,event,...rest]=p.length>=4?p:["",...p];const code=/^\d+$/.test(id)?"":clean(id).replace(/_\d+$/,"");return{code,when:clean(when),future:/原本世界线|后发生/.test(when),event:clean(event).replace(/[。.]$/,""),hits:rest.join("｜").replace(/^命中原因\s*[：:]\s*/,"").split(/[；;]/).map(x=>clean(x).replace(/[。.]$/,"")).filter(Boolean)}})}
function parseList(text){const items=[];for(const raw of clean(text).split("\n")){const line=clean(raw);if(!line)continue;const m=line.match(/^(?:\d+[.、)）]|[-*•])\s*(.*)$/);if(m||!items.length)items.push(m?m[1]:line);else items[items.length-1]+="\n"+line}return items.filter(x=>!ptBlank(x))}
// 认知边界：「X当前掌握信息：……」按人分行，其余是关系说明
function parseKnowledge(text){const rows=[],notes=[];for(const raw of clean(text).split("\n")){const line=clean(raw);if(!line)continue;const m=line.match(/^(.{1,14}?)当前掌握(?:的)?信息[：:]\s*(.*)$/);if(m)rows.push({name:clean(m[1]),items:m[2].split(/[；;]/).map(clean).filter(Boolean).map(item=>{const s=item.match(/^(.*?)[（(]([^（()）]{1,12})[）)][。.]?$/);return s?{text:clean(s[1]),src:clean(s[2])}:{text:item.replace(/[。.]$/,""),src:""}})});else notes.push(...line.split(/(?<=。)(?![”」』])/).map(clean).filter(Boolean))}return{rows,notes}}
// 实力标尺：常见 / 优秀 / 顶尖三段区间 + 场景参照里点名的代表人物
function parseLadder(audit){const rng=t=>{const s=clean(t);let m=s.match(/(\d+)\s*级?\s*(?:至|到|~|～|—|-)\s*(\d+)\s*级/);if(m)return[+m[1],+m[2]];m=s.match(/从\s*(\d+)\s*级开始[\s\S]*?(?:最高|到)[^\d]{0,6}(\d+)\s*级/);if(m)return[+m[1],+m[2]];m=s.match(/(\d+)\s*级/);return m?[+m[1],+m[1]]:null};const tiers=[["常见","常见区间","common"],["优秀","优秀区间","excellent"],["顶尖","顶尖区间","top"]].map(([label,key,id])=>({label,id,range:rng(audit[key])})).filter(t=>t.range&& t.range[1]>=t.range[0]);if(tiers.length<2)return null;let lo=Math.min(...tiers.map(t=>t.range[0])),hi=Math.max(...tiers.map(t=>t.range[1]));// 人名：先认已知人物（「由唐凌雪（21级）」取唐凌雪），认不出再去掉开头的介词
 const known=[...allPeople().map(p=>p.name),...(state.game?.evidence||[]).map(e=>e.name),state.snapshot?.persona].filter(Boolean).sort((x,y)=>y.length-x.length);
 const nameOf=raw=>known.find(n=>raw.endsWith(n))||raw.replace(/^(?:由|是|为|如|和|与|及|被|让|将|对|向|比|像)+/,"");
 const marks=[];const text=AUDIT_LABELS.map(k=>audit[k]||"").join("\n");for(const m of text.matchAll(/([一-龥·]{2,7})[（(]\s*(\d+)\s*级/g)){const level=+m[2],name=nameOf(m[1]);if(name.length<2||marks.some(x=>x.name===name)||level<lo-3||level>hi+3)continue;marks.push({name,level})}for(const x of marks){lo=Math.min(lo,x.level);hi=Math.max(hi,x.level)}return{tiers,marks,lo:lo-1,hi:hi+2}}

/* ===== 人物模型 ===== */
function characterFieldMap(text){return Object.fromEntries(parseFields(text).map(field=>[field.key,field.value]))}
function characterName(raw){return clean(raw).replace(/^(?:玩家|NPC)\s*[｜|]\s*/i,"")}
function characterBlocks(text,label,diagnostics){const source=clean(text);if(ptBlank(source))return[];const blocks=parsePeopleBlocks(source).map(block=>({...block,name:characterName(block.name)})).filter(block=>block.name);if(!blocks.length)diagnostics.push(label+"缺少可识别的角色标题。");return blocks}
function characterTags(){return state.snapshot?.tasks?.character?.tags||{}}
function splitCharacterInterplay(text){const source=clean(text);const match=source.match(/(?:^|\n)[\s>*+-]*(?:【\s*)?(?:interplay|他们之间|彼此之间)(?:\s*】)?[：:]\s*([\s\S]*)$/i);if(!match||match.index===undefined)return{body:source,interplay:""};return{body:clean(source.slice(0,match.index)),interplay:clean(match[1])}}
function buildCharacterModel(){const tags=characterTags(),diagnostics=[],people=new Map(),activeOrder=[],awayOrder=[];
 const touch=name=>{const key=characterName(name);if(!key)return null;if(!people.has(key))people.set(key,{key:"npc:"+key,name:key,file:{},inner:{},act:{},track:{},hasAct:false,hasTrack:false});return people.get(key)};
 for(const block of characterBlocks(tags.file,"关系摘要",diagnostics)){const person=touch(block.name);if(person)person.file=characterFieldMap(block.text)}
 for(const block of characterBlocks(tags.inner,"人物内心",diagnostics)){const person=touch(block.name);if(person)person.inner=characterFieldMap(block.text)}
 const act=splitCharacterInterplay(tags.act);
 for(const block of characterBlocks(act.body,"人物演出底稿",diagnostics)){const person=touch(block.name);if(!person)continue;person.act=characterFieldMap(block.text);person.hasAct=true;if(!activeOrder.includes(person.name))activeOrder.push(person.name)}
 const trackSource=getTag(tags.dm_track,"npc_track")||tags.dm_track;
 for(const block of characterBlocks(trackSource,"离场人物追踪",diagnostics)){const person=touch(block.name);if(!person)continue;person.track=characterFieldMap(block.text);person.hasTrack=true;if(!awayOrder.includes(person.name))awayOrder.push(person.name)}
 const active=[],away=[],unassigned=[];
 for(const name of activeOrder){const person=people.get(name);if(!person)continue;if(person.hasTrack)diagnostics.push(name+"同时出现在人物演出与离场追踪中，已按在场显示。");active.push({...person,kind:"active"})}
 for(const name of awayOrder){const person=people.get(name);if(person&&!person.hasAct)away.push({...person,kind:"away"})}
 for(const person of people.values())if(!person.hasAct&&!person.hasTrack){if(isPlayer(person.name))continue;diagnostics.push(person.name+"只有关系或内心资料，缺少在场或离场依据。");unassigned.push(person)}
 return{active,away,interplay:ptBlank(act.interplay)?"":act.interplay,dmSet:clean(tags.dm_set),unassigned,diagnostics}}

function buildGameModel(){const T=k=>state.snapshot?.tasks?.[k]?.tags||{};const recall=T("recall"),clue=T("clue"),routingTags=T("routing"),ruling=T("ruling");
 const routing={module_routing:clean(routingTags.module_routing)||clean(ruling.module_routing),battle_adjudication:clean(routingTags.battle_adjudication)||clean(ruling.battle_adjudication)};
 const audit=splitSections(ruling.scene_audit||"",AUDIT_LABELS),scene=splitSections(ruling.scene_ruling||"",RULING_LABELS),route=splitSections(ruling.route_boundary||"",ROUTE_LABELS),butterfly=splitSections(ruling.butterfly_analysis||"",BUTTERFLY_LABELS);
 const anchor=parseSceneAnchor(scene["场域与生态构建"]),landing=parseLanding(route["本轮落点与后续接力"]),progress=clean(route["本轮剧情推进"]);
 const modules=parseModuleRouting(routing.module_routing),moduleHits=modules.filter(item=>item.id&& item.id!=="未命中");
 let characters={active:[],away:[],interplay:"",dmSet:"",unassigned:[],diagnostics:[]};try{characters=buildCharacterModel()}catch(error){characters.diagnostics=[String(error?.message||error)]}
 const people=characters.active;
 return{recall,clue,routing,ruling,audit,scene,route,butterfly,anchor,landing,progress,current:firstSentence(landing.land,firstSentence(progress,"")),modules,moduleHits,characters,people,evidence:parseEvidence(clue.npc_behavior_evidence),timeline:parseTimelineRecall(clue.timeline_recall)}}
function allPeople(){const m=state.game?.characters;return m?[...m.active,...m.away]:[]}
// 玩家不进人物名单，只在认知边界、原著依据、实力标尺里按酒馆人设名标金色
function isPlayer(name){return!!name&& name===state.snapshot?.persona}
function kindOf(name){return isPlayer(name)?"player":"npc"}
function jumpText(){const j=clean(state.game?.recall?.time_jump);return!j||/^(?:0\s*分|无|0)$/.test(j)?"":"+"+j}
function taskHealth(task){const raw=clean(state.snapshot?.tasks?.[task]?.raw);if(!raw)return"waiting";const ids=TASKS[task]||[];return(state.snapshot?.diagnostics||[]).some(item=>ids.some(id=>item.includes("任务 "+id)))?"error":"ready"}
function pageStatus(id){if(id==="overview"||id==="ruling")return taskHealth("ruling");if(id==="people")return taskHealth("character");if(id==="intel")return taskHealth("recall");return"ready"}
function statusCopy(status){return status==="ready"?"已读取":status==="error"?"数据异常":"等待中"}
function coreTasksReady(){return REQUIRED.every(key=>taskHealth(key)==="ready")}
// 没找到关联楼层（不会再有数据）与任务还没写回（等一等就有）要分开说
function noTaskData(){return!!state.snapshot&&!Object.keys(state.snapshot.tasks||{}).length}

/* ===== 指挥栏 ===== */
function renderBar(){const g=state.game,facts=$("[data-role=bar-facts]");facts.replaceChildren();
 if(g){const add=(ic,text,cls)=>{if(clean(text))facts.append(h("span","pt-fact"+(cls?" "+cls:""),icon(ic),h("b","",text)))};add("location-dot",g.anchor.location);add("clock",g.anchor.time,"pt-fact-time");const jump=jumpText();if(jump)facts.append(h("span","pt-fact-jump",jump));add("users",g.people.length?"在场 "+g.people.length:"")}
 const current=$("[data-role=bar-current]");current.textContent=g?.current||(noTaskData()?state.snapshot.diagnostics?.[0]||"没有可读取的推进数据":state.snapshot&&!coreTasksReady()?"等待本轮推进任务完成…":"等待读取本轮剧情");current.title=g?.current||"";
 const cast=$("[data-role=bar-cast]"),people=g?.people||[];cast.replaceChildren(...people.slice(0,5).map(p=>avatar(p.name,"npc")));if(people.length>5)cast.append(h("span","pt-more","+"+(people.length-5)));
 const badge=$("[data-role=bar-module]"),hits=g?.moduleHits||[];badge.hidden=!hits.length;badge.replaceChildren(...(hits.length?[icon(MODULE_ICONS[hits[0].id]||"puzzle-piece"),hits.map(x=>x.label).join("、")]:[]));
 for(const t of queryAll("[data-role=floor]"))t.textContent=state.snapshot?.floor||"#?"}
function renderTabs(){const f=document.createDocumentFragment(),people=allPeople().length;for(const id of MAIN){const p=PAGES[id],st=pageStatus(id),b=btn("pt-tab",{page:id},icon(p.icon),h("span","",p.label));b.setAttribute("aria-current",state.lastMain===id&&!PAGES[state.page].raw?"page":"false");if(id==="people"&& people)b.append(h("em","",String(people)));if(st!=="ready"){const pip=h("span","pt-pip");pip.dataset.status=st;pip.title=statusCopy(st);b.append(pip)}f.append(b)}$("[data-role=tabs]").replaceChildren(f)}

/* ===== 本轮总览 ===== */
function personSub(p){if(p.kind==="away")return firstSentence(p.track["当前动向"],"离场");return firstSentence(p.act.now,"在场")}
function personToken(p,current){const b=btn("pt-token",{person:p.key},avatar(p.name,p.kind==="away"?"away":"npc"),h("span","pt-token-txt",h("b","",p.name),h("small","",personSub(p))));const mood=clean(p.file?.["好感"]);if(!ptBlank(mood))b.append(chip(mood.replace(/[。.]$/,""),"blue"));if(current!==undefined)b.setAttribute("aria-current",current?"true":"false");return b}
function moduleCard(m){const map=m.map||new Map(),f=k=>clean(map.get(k)),card=btn("pt-mod-card",{goto:"ruling:modules",moduleIndex:String(state.game.modules.indexOf(m))});card.append(h("div","pt-mod-title",icon(MODULE_ICONS[m.id]||"puzzle-piece"),h("span","",m.label),h("small","",m.id.toUpperCase())));
 if(m.id==="battle"){card.append(h("div","pt-vs",h("div","pt-vs-side",h("small","","我方"),f("我方")||"—"),h("span","pt-vs-x","VS"),h("div","pt-vs-side",h("small","","敌方"),f("敌方")||"—")));card.lastChild.lastChild.dataset.side="foe";card.append(h("div","pt-mod-meta",[f("地点")&& chip(f("地点")),f("战斗类型")&& chip(f("战斗类型"),"red"),f("最大回合")&& chip("最多 "+f("最大回合")+" 回合")]))}
 else if(m.id==="travel")card.append(h("div","pt-path",f("角色")||"—",icon("arrow-right-long"),f("目标地点")||"—"),h("div","pt-mod-meta",[f("移动方式")&& chip(f("移动方式")),f("耗时tick")&& chip(f("耗时tick")+" tick")]));
 else if(m.id==="trade")card.append(h("div","pt-path",(f("动作")||"交易")+" · "+(f("物品")||"—")+" × "+(f("数量")||"?")),h("div","pt-mod-meta",[f("对象")&& chip(f("对象")),f("地点")&& chip(f("地点"))]));
 else if(m.id==="teaching")card.append(h("div","pt-path",f("老师")||"—",icon("arrow-right-long"),f("学生")||"—"),h("div","pt-mod-meta",[f("内容名称")&& chip(f("内容名称"),"gold"),f("结果")&& chip(f("结果"))]));
 else{const keys=(m.fields||[]).map(x=>x.key).filter(k=>k!=="模块"&& k!=="理由").slice(0,4);card.append(h("div","pt-mod-meta",keys.map(k=>f(k)&& chip(k+" · "+f(k)))))}
 return card}
function statBtn(ic,label,n,go){const b=btn("pt-stat",{goto:go},icon(ic),h("span","",label),h("b","",String(n)));b.dataset.empty=n?"false":"true";return b}
function renderOverview(){const g=state.game,root=h("div","pt-scroll pt-ov");root.dataset.scroll="overview";
 if(!g||!clean(state.snapshot?.tasks?.ruling?.raw)&&!clean(state.snapshot?.tasks?.character?.raw)){root.append(noTaskData()?emptyState("circle-info","没有可读取的推进数据",state.snapshot.diagnostics?.[0]):emptyState("hourglass-half","等待本轮推进任务完成","推进任务写回后，这里会显示本轮的场景、推进与在场人物。"));return root}
 const a=g.anchor,clock=h("div","pt-clock",a.time?h("b","",a.time):null,jumpText()?chip(jumpText()+" 本轮耗时","gold"):null);
 root.append(plate("pt-scene",hexIcon("location-dot",50),h("div","",h("h2","",a.location||"地点待确认"),h("p","",[a.date,g.recall.time_jump&&!jumpText()?"本轮未推进时间":""].filter(Boolean).join(" · ")||"场景")),clock));
 // 推进轨道 + 落点 + 等你决定
 const route=plate("pt-route",plateHead("route","本轮推进","ROUTE"));const track=h("div","pt-track");
 // 落点节点只留标签：落点全文就在轨道下方
 for(const [label,text] of [["世界进程",g.route["世界进程与路线关系"]],["本轮推进",g.progress],["本轮落点",""]]){const n=btn("pt-track-node",{goto:"ruling:route"},h("b","",label),text?h("span","",firstSentence(text,"—")):null);if(text)n.title=clean(text);track.append(n)}
 route.append(track);if(g.landing.land)route.append(prose(g.landing.land,"pt-landing"));
 if(g.landing.next)route.append(h("div","pt-next",icon("hand-pointer"),h("b","","接下来由你决定"),h("p","",g.landing.next)));
 const m=g.characters,cast=plate("pt-cast",plateHead("users","在场人物","CAST",chip(String(g.people.length),"blue")));const list=h("div","pt-cast-list");for(const p of g.people)list.append(personToken(p));if(!g.people.length)list.append(h("p","pt-empty-inline","本轮没有人物演出资料"));cast.append(list);
 if(m.away.length){cast.append(lbl("person-walking-arrow-right","离场 "+m.away.length),h("div","pt-cast-list",m.away.map(p=>personToken(p))));cast.lastChild.previousSibling.classList.add("pt-cast-sep")}
 root.append(h("div","pt-ov-grid",route,cast));
 // 模块 + 情报
 const mod=plate("pt-mod",plateHead("puzzle-piece","触发模块","MODULE"));
 if(g.moduleHits.length)mod.append(h("div","pt-mod-cards",g.moduleHits.map(moduleCard)));else{const reason=clean(g.modules[0]?.map?.get("理由"));mod.append(h("div","pt-mod-none",hexIcon("circle-minus",30),h("span","",reason?"本轮未触发特殊模块。"+firstSentence(reason):"本轮未触发特殊模块")))}
 const changes=parseList(g.butterfly["本轮已成立的变化"]).length,am=recordCodes(g.recall.recall,"AM").length,dv=recordCodes(g.recall.deviation_ledger_recall,"DV").length;
 const intel=plate("pt-intel",plateHead("book-open","本轮情报","INTEL"),h("div","pt-stats",statBtn("timeline","原著线索",g.timeline.length,"intel:clue"),statBtn("scroll","事件纪要",am,"intel:am"),statBtn("code-branch","偏差档案",dv,"intel:dv"),statBtn("wind","蝴蝶效应",changes,"ruling:butterfly")));
 root.append(h("div","pt-ov-foot",mod,intel));
 const diags=[...(state.snapshot?.diagnostics||[]),...(m.diagnostics||[])];for(const d of diags)root.append(h("div","pt-diagnostic",d));
 return root}

/* ===== 人物 ===== */
function relBlock(file){const rows=[["关系",file?.["关系"]],["态度",file?.["态度"]],["交际",file?.["交际"]]].filter(([,v])=>!ptBlank(v));if(!rows.length)return null;return h("dl","pt-rel",rows.flatMap(([k,v])=>[h("dt","",k),h("dd","",clean(v))]))}
// 演出：台词用「」，弯引号多是行文里的拟声 / 引用（“滴”的一声），有「」时只拆「」；没有「」才把较长的弯引号段当台词
function beatBlock(text){const src=clean(text);if(ptBlank(src))return null;const box=h("div","pt-beat"),re=/「[^」]*」/.test(src)?/(「[^」]*」)/:/(“[^”]{6,}”)/;for(const part of src.split(re)){const s=clean(part).replace(/^[，,]\s*/,"");if(!s)continue;if(re.test(s)&&/^[「“]/.test(s))box.append(h("p","pt-say",s.slice(1,-1)));else box.append(h("p","pt-stage",s))}return box}
function thinkBlock(text,variant){if(ptBlank(text))return null;const t=h("p","pt-think",icon(variant==="aside"?"feather":"cloud"),clean(text));if(variant)t.dataset.variant=variant;return t}
function miniBlock(ic,title,text){return ptBlank(text)?null:h("div","pt-mini",lbl(ic,title),h("p","",clean(text)))}
function evidenceBody(e){return h("dl","pt-kv",[e.role?[h("dt","","身份"),h("dd","",e.role)]:[],...e.fields.map(([k,v])=>[h("dt","",k||"·"),h("dd","",v)])].flat())}
function evidenceFold(name){const list=evidenceOf(name);if(!list.length)return null;return h("details","pt-fold",h("summary","",icon("book-bookmark"),"原著行为依据",list.length>1?chip(list.length+" 条"):null),h("div","pt-fold-body pt-ev",list.map(evidenceBody)))}
function dossier(p){const kind=p.kind==="away"?"离场":"在场",tone=p.kind==="away"?"red":"green";const tags=h("div","pt-dos-tags",chip(kind,tone));const mood=clean(p.file?.["好感"]);if(!ptBlank(mood))tags.append(chip("好感 · "+mood.replace(/[。.]$/,""),"blue"));
 const root=h("article","pt-dos",h("header","pt-dos-head",avatar(p.name,p.kind==="away"?"away":"npc",60),h("div","",h("h2","",p.name),tags)));
 const add=(...els)=>root.append(...els.filter(Boolean));
 if(p.kind==="away"){const t=p.track;add(!ptBlank(t["当前动向"])&& h("div","",lbl("person-walking","当前动向"),h("p","pt-stage",clean(t["当前动向"]))),h("div","pt-duo",miniBlock("list-check","近期打算",t["近期打算"]),miniBlock("brain","当前认知",t["当前认知"])),miniBlock("code-merge","与玩家路线的交汇条件",t["与玩家路线的交汇条件"]),relBlock(p.file),evidenceFold(p.name));if(root.querySelector(".pt-duo")&&!root.querySelector(".pt-duo").childElementCount)root.querySelector(".pt-duo").remove();return root}
 const a=p.act,inner=p.inner;add(!ptBlank(a.now)&& h("div","",lbl("eye","此刻"),h("p","pt-stage",clean(a.now))));const beat=beatBlock(a.beat);if(beat)add(h("div","",lbl("comment-dots","演出"),beat));
 const thoughts=[thinkBlock(inner.inner_voice),thinkBlock(inner.aside,"aside")].filter(Boolean);if(thoughts.length)add(h("div","pt-beat",lbl("cloud","心声"),...thoughts));
 const duo=h("div","pt-duo",miniBlock("flag","主动推进",a.initiative),miniBlock("forward","接下来",a.then));if(duo.childElementCount)add(duo);
 add(relBlock(p.file),!ptBlank(a["底线"])&& h("p","pt-limit",icon("shield-halved"),h("span","",h("b","","底线 "),clean(a["底线"]))),evidenceFold(p.name));return root}
function stepsList(text){const steps=splitSteps(text);if(!steps.length)return emptyState("chess","本轮没有推演内容");return h("ol","pt-steps",steps.map(s=>h("li","pt-step",hexNum(s.n,30),h("div","",h("b","",s.title),prose(s.lines.join("\n")||"无补充内容")))))}
function renderPeople(){const m=state.game?.characters,all=allPeople();if(!all.length)return h("div","pt-scroll",emptyState("users","当前没有人物追踪资料",clean(state.snapshot?.tasks?.character?.raw)?"人物任务的输出无法识别，可在设置 › 开发记录里查看原文。":"人物任务写回后会显示在这里。"));
 if(!all.some(p=>p.key===state.personKey))state.personKey=(m.active[0]||all[0]).key;
 const side=h("nav","pt-side pt-scroll");side.dataset.scroll="people-side";const cur=p=>state.peopleView==="person"&& p.key===state.personKey;
 if(m.active.length)side.append(h("p","pt-side-title","ON STAGE · "+m.active.length),...m.active.map(p=>personToken(p,cur(p))));
 if(m.away.length)side.append(h("p","pt-side-title","OFF STAGE · "+m.away.length),...m.away.map(p=>personToken(p,cur(p))));
 const extra=[];if(m.interplay)extra.push(["interplay","masks-theater","场上互动"]);if(m.dmSet)extra.push(["plan","chess","人物推演"]);if(m.unassigned.length)extra.push(["unassigned","triangle-exclamation","未归档 "+m.unassigned.length]);
 if(extra.length){side.append(h("p","pt-side-title","NOTES"));for(const [id,ic,label] of extra){const b=btn("pt-nav-btn",{peopleView:id},hexIcon(ic,28),h("span","",label));b.setAttribute("aria-current",state.peopleView===id?"true":"false");side.append(b)}}
 const main=h("section","pt-main pt-scroll");main.dataset.scroll="people:"+state.peopleView+":"+state.personKey;
 if(state.peopleView==="interplay")main.append(h("header","pt-dh",hexIcon("masks-theater"),h("h2","","场上互动"),h("small","pt-code","INTERPLAY")),prose(m.interplay));
 else if(state.peopleView==="plan")main.append(h("header","pt-dh",hexIcon("chess"),h("h2","","人物推演"),h("small","pt-code","DM · SET")),stepsList(m.dmSet));
 else if(state.peopleView==="unassigned")main.append(h("header","pt-dh",hexIcon("triangle-exclamation"),h("h2","","未归档人物资料"),h("small","pt-code","UNSORTED")),h("div","pt-stack",m.unassigned.map(p=>plate("",plateHead("user",p.name,""),h("dl","pt-kv",[...Object.entries(p.file||{}),...Object.entries(p.inner||{})].filter(([,v])=>!ptBlank(v)).flatMap(([k,v])=>[h("dt","",k),h("dd","",v)]))))));
 else main.append(dossier(all.find(p=>p.key===state.personKey)));
 return h("div","pt-split",side,main)}

/* ===== 分栏页通用：左侧目录 + 右侧详情 ===== */
function splitPage(items,selected,type,content,key){const side=h("nav","pt-side pt-scroll");side.dataset.scroll=key+"-side";side.append(h("p","pt-side-title",type==="intel"?"ARCHIVE":"RULING"));for(const item of items){const b=btn("pt-nav-btn",{[type+"Section"]:item.id},hexIcon(item.icon,28),h("span","",item.label));if(item.count)b.append(h("em","",String(item.count)));b.setAttribute("aria-current",item.id===selected?"true":"false");side.append(b)}const main=h("section","pt-main pt-scroll");main.dataset.scroll=key+":"+selected;main.append(content);return h("div","pt-split",side,main)}
function detailHead(ic,title,code,tools){return h("header","pt-dh",hexIcon(ic),h("h2","",title),tools?h("div","pt-dh-tools",tools):h("small","pt-code",code||""))}
function readout(ic,title,code,text){if(ptBlank(text))return null;const lead=firstSentence(text),rest=clean(clean(text).slice(lead.length));return plate("pt-readout",plateHead(ic,title,code),prose(lead,"pt-prose pt-lead"),rest?prose(rest):null)}
function frag(...els){const f=document.createDocumentFragment();f.append(...els.filter(Boolean));return f}

/* ===== 裁定 ===== */
function rulingItems(){const g=state.game,items=[{id:"current",icon:"location-crosshairs",label:"当前裁定"},{id:"knowledge",icon:"eye",label:"认知边界"},{id:"route",icon:"route",label:"路线推进"}];const changes=parseList(g.butterfly["本轮已成立的变化"]).length;if(clean(g.ruling.butterfly_analysis))items.push({id:"butterfly",icon:"wind",label:"蝴蝶效应",count:changes||undefined});items.push({id:"audit",icon:"ruler-combined",label:"场景参照"},{id:"modules",icon:"puzzle-piece",label:"模块结果",count:g.moduleHits.length||undefined});if(clean(g.routing.battle_adjudication))items.push({id:"battle",icon:"khanda",label:"战斗裁断"});if(clean(g.ruling.dm_set))items.push({id:"plan",icon:"chess",label:"后台推演"});return items}
function renderCurrentRuling(){const s=state.game.scene,list=[readout("mountain-city","场域与生态","FIELD",s["场域与生态构建"]),readout("bullseye","能力与筹码检验","CHECK",s["内在能力与筹码检验"]),readout("earth-asia","社会与自然回响","ECHO",s["外在社会与自然回响"])].filter(Boolean);if(clean(s.__unparsed))list.push(plate("",plateHead("circle-question","未归类内容",""),prose(s.__unparsed)));return frag(detailHead("location-crosshairs","当前裁定","RULING"),list.length?h("div","pt-stack",list):emptyState("location-crosshairs","当前没有可显示的客观裁定"))}
function renderKnowledge(){const s=state.game.scene,k=parseKnowledge(s["认知与权限边界"]),list=[];
 if(k.notes.length)list.push(plate("",plateHead("handshake","关系与权限","BOND"),h("ul","pt-notes",k.notes.map(n=>h("li","",n)))));
 if(k.rows.length){list.push(plate("",plateHead("eye","各方掌握的信息","INTEL"),h("div","pt-know",k.rows.map(r=>h("div","pt-know-row",avatar(r.name,kindOf(r.name),32),h("div","",h("b","",r.name),h("ul","pt-know-items",r.items.map(it=>h("li","",it.text,it.src?chip(it.src,"violet"):null)))))))))}
 const blind=readout("eye-slash","信息盲区","BLIND",s["信息盲区与认知边界"]);if(blind)list.push(blind);
 return frag(detailHead("eye","认知边界","KNOW"),list.length?h("div","pt-stack",list):emptyState("eye","本轮没有认知边界资料"))}
function renderRouteDetail(){const g=state.game,track=h("div","pt-vtrack");for(const [label,text,end] of [["世界进程与路线关系",g.route["世界进程与路线关系"]],["本轮剧情推进",g.progress],["本轮落点",g.landing.land,true]]){const n=h("div","pt-vnode",lbl("",label),prose(clean(text)||"暂无"));if(end)n.dataset.end="true";track.append(n)}
 const out=[detailHead("route","路线推进","ROUTE"),track];if(g.landing.next)out.push(h("div","pt-next",icon("hand-pointer"),h("b","","接下来由你决定"),h("p","",g.landing.next)));if(clean(g.route.__unparsed))out.push(plate("",plateHead("circle-question","未归类内容",""),prose(g.route.__unparsed)));return frag(...out)}
function renderButterfly(){const b=state.game.butterfly,list=[],ol=items=>h("ol","pt-ol",items.map((x,i)=>h("li","",hexNum(i+1,24),h("span","",x))));
 const kept=parseList(b["沿用的已有偏差"]);list.push(plate("",plateHead("clock-rotate-left","沿用的已有偏差","KEPT"),kept.length?ol(kept):h("p","pt-empty-inline","无")));
 const now=parseList(b["本轮已成立的变化"]);if(now.length)list.push(plate("",plateHead("bolt","本轮已成立的变化","CHANGED"),ol(now)));
 const spread=parseList(b["可能的传播路径"]);if(spread.length)list.push(plate("",plateHead("diagram-project","可能的传播路径","SPREAD"),ol(spread)));
 if(clean(b.__unparsed))list.push(plate("",plateHead("circle-question","未归类内容",""),prose(b.__unparsed)));
 return frag(detailHead("wind","蝴蝶效应","BUTTERFLY"),h("div","pt-stack",list))}
function ladderWidget(lad){const span=lad.hi-lad.lo,pos=v=>((v-lad.lo)/span*100).toFixed(2)+"%";const bar=h("div","pt-ladder-bar");
 for(const t of lad.tiers){const seg=h("div","pt-ladder-seg",h("span","",t.label+" ",h("i","",t.range[0]===t.range[1]?t.range[0]+"级":t.range[0]+"–"+t.range[1])));seg.dataset.tier=t.id;seg.style.left=pos(t.range[0]);seg.style.width=((t.range[1]+1-t.range[0])/span*100).toFixed(2)+"%";bar.append(seg)}
 // 代表人物按等级钉在尺上；靠得太近的错开高度
 const rows=[];const marks=[...lad.marks].sort((x,y)=>x.level-y.level);for(const mk of marks){const x=(mk.level+.5-lad.lo)/span;let row=0;while(rows[row]!==undefined&& x-rows[row]<.14)row++;rows[row]=x;const pin=h("div","pt-ladder-pin",h("b","",mk.name,h("i","",mk.level+"级")));pin.style.left=(x*100).toFixed(2)+"%";pin.style.setProperty("--stem",(8+row*24)+"px");if(isPlayer(mk.name))pin.dataset.kind="player";bar.append(pin)}
 const box=h("div","pt-ladder",bar);box.style.setProperty("--pin-pad",(34+Math.max(0,rows.length-1)*24)+"px");return box}
function renderAuditDetail(){const a=state.game.audit,list=[];const grp=!ptBlank(a["场景参照群体"]),age=!ptBlank(a["参照年龄区间"]);
 if(grp||age)list.push(plate("",plateHead("people-group","参照群体","GROUP"),grp?prose(a["场景参照群体"]):null,age?h("div",grp?"pt-sub":"",lbl("cake-candles","年龄区间"),prose(a["参照年龄区间"])):null));
 const lad=parseLadder(a);if(lad)list.push(plate("",plateHead("chart-simple","环境实力坐标","SCALE"),ladderWidget(lad),h("details","pt-fold",h("summary","",icon("align-left"),"区间原文"),h("div","pt-fold-body",h("dl","pt-kv",["常见区间","优秀区间","顶尖区间"].filter(k=>!ptBlank(a[k])).flatMap(k=>[h("dt","",k),h("dd","",a[k])]))))));
 else{const t=["常见区间","优秀区间","顶尖区间"].filter(k=>!ptBlank(a[k]));if(t.length)list.push(plate("",plateHead("chart-simple","环境实力坐标","SCALE"),h("dl","pt-kv",t.flatMap(k=>[h("dt","",k),h("dd","",a[k])]))))}
 for(const [ic,label,key,code] of [["binoculars","NPC 观察眼界","观察NPC眼界","VIEW"],["star","表象实力与相对评价","表象实力与相对评价","VERDICT"],["dna","新登场原创角色核对","新登场原创角色核对","ORIGIN"],["scale-balanced","实力描述与评价","实力描述与评价","POWER"]]){const r=readout(ic,label,code,a[key]);if(r)list.push(r)}
 if(clean(a.__unparsed))list.push(plate("",plateHead("circle-question","未归类内容",""),prose(a.__unparsed)));
 return frag(detailHead("ruler-combined","场景参照","AUDIT"),list.length?h("div","pt-stack",list):emptyState("ruler-combined","本轮没有场景参照资料"))}
function band(title,text,cls=""){const s=node("section","pt-band "+cls);s.append(node("h3","",title),node("p","pt-text",clean(text)||"无"));return s}
function keyValue(key,value,cls=""){const d=node("div",("pt-band "+cls).trim());d.append(node("div","pt-key",key),node("div","pt-value",clean(value)||"无"));return d}
function rawBlock(text){const pre=node("pre","pt-raw");const code=node("code","",clean(text)||"无");code.setAttribute("translate","no");pre.append(code);return pre}
function parseError(message,text){return frag(h("div","pt-diagnostic",String(message||"内容无法解析。")),rawBlock(text))}
function parseBattleConditionBlocks(text,key){const lines=clean(text).split("\n"),start=lines.findIndex(raw=>new RegExp("^\\s*"+key+"\\s*[：:]\\s*$","u").test(raw));if(start<0)return[];const blocks=[];let current=null;for(let i=start+1;i<lines.length;i++){const raw=lines[i],item=raw.match(/^\s*[-*+]\s*([^：:\n]+)[：:]\s*(.*)$/u),child=raw.match(/^\s+([^：:\n]+)[：:]\s*(.*)$/u);if(item){current=[[canonicalFieldKey(item[1]),clean(item[2])]];blocks.push(current);continue}if(child&& current){current.push([canonicalFieldKey(child[1]),clean(child[2])]);continue}if(/^\S[^：:\n]{0,40}[：:]/u.test(raw))break}return blocks}
function moduleGrid(map,keys,columns="pt-grid"){const grid=node("div",columns);keys.forEach(k=>grid.append(keyValue(k,map.get(k)||"无")));return grid}
function renderModule(text){const fields=parseFields(text);if(!fields.length)return parseError("模块路由无法解析，已保留完整原文。",text);const map=new Map(fields.map(x=>[x.key,x.value]));const mod=map.get("模块")||"未知";if(!Object.prototype.hasOwnProperty.call(MODULE_REQUIRED,mod))return parseError("模块路由名称无效，已保留完整原文。",text);const required=[...MODULE_REQUIRED[mod]];if(mod==="trial_entry"&& map.get("试炼类型")==="魂灵塔")required.push("层数");const missing=required.filter(key=>!map.has(key));if(missing.length)return parseError("模块路由缺少字段："+missing.join("、")+"。已保留完整原文。",text);const f=document.createDocumentFragment();f.append(h("section","pt-route-head",h("div","pt-route-name",MODULE_NAMES[mod]),h("div","pt-muted",mod==="未命中"?"本轮无特殊模块":"已命中 "+mod)));if(mod==="未命中"){f.append(band("未命中理由",map.get("理由")||"未命中特殊模块"));return f}
 if(mod==="battle"){f.append(moduleGrid(map,["地点","战斗类型","允许撤离","最大回合"]));const teams=node("div","pt-grid");teams.append(keyValue("我方",map.get("我方")),keyValue("敌方",map.get("敌方")));f.append(teams);for(const key of ["胜利条件","失败条件"]){const relation=map.get(key+"关系")||"OR",b=band(key+" · "+relation,"");b.querySelector(".pt-text").remove();const conditions=parseBattleConditionBlocks(text,key);if(!conditions.length)b.append(node("div","pt-condition",clean(map.get(key))||"未填写"));else for(const fields of conditions)b.append(node("div","pt-condition",fields.map(([field,value])=>field+"："+value).join(" · ")));f.append(b)}return f}
 if(mod==="trade"){f.append(band("交易单",(map.get("动作")||"交易")+" · "+(map.get("物品")||"未填写物品")+" × "+(map.get("数量")||"?")),moduleGrid(map,["地点","对象"]));return f}
 if(mod==="profession"){f.append(band("工坊目标",(map.get("动作")||"制作")+" · "+(map.get("目标")||"未填写目标")));const materials=node("section","pt-band");materials.append(node("h3","","材料"));for(const material of clean(map.get("材料")).split(/[、,，]/).filter(Boolean))materials.append(node("span","pt-chip-plain",material));f.append(materials,moduleGrid(map,["地点","执行者类型","对象","数量","阶级","子类型"]));return f}
 if(mod==="teaching"){const flow=node("section","pt-band");flow.append(node("h3","","传授关系"));const row=node("div","pt-flow");[map.get("老师")||"未知传授方",(map.get("内容类型")||"内容")+" · "+(map.get("内容名称")||"未命名"),map.get("学生")||"未知接受方"].forEach(x=>row.append(node("div","pt-flow-item",x)));flow.append(row);f.append(flow,moduleGrid(map,["动作","结果","理由"]));return f}
 if(mod==="skill_gain"){f.append(band("技能获得",(map.get("角色")||"未知角色")+" · "+(map.get("技能名称")||"待命名技能")),moduleGrid(map,["技能类型","来源"]));return f}
 if(mod==="routine"){f.append(band("训练结算",(map.get("角色")||"未知角色")+" · "+(map.get("动作")||"训练")),moduleGrid(map,["地点","耗时tick","启用地点拟态","理由"]));return f}
 if(mod==="trial_entry"){f.append(band("试炼入场",map.get("试炼类型")||"未知试炼"),moduleGrid(map,["层数"]));return f}
 if(mod==="travel"){const flow=node("section","pt-band");flow.append(node("h3","","移动路线"));const row=node("div","pt-flow");[map.get("角色")||"未知角色",(map.get("移动方式")||"移动")+" · "+(map.get("耗时tick")||"?")+" tick",map.get("目标地点")||"未知地点"].forEach(x=>row.append(node("div","pt-flow-item",x)));flow.append(row);f.append(flow,moduleGrid(map,["归属父节点","描述","方位"]));return f}
 f.append(moduleGrid(map,fields.filter(x=>x.key!=="模块").map(x=>x.key)));return f}
function renderModulesDetail(){const modules=state.game.modules,f=frag(detailHead("puzzle-piece","模块结果","MODULE"));if(!modules.length){f.append(emptyState("puzzle-piece","本轮没有模块路由输出"));return f}state.moduleSelected=Math.min(Math.max(0,state.moduleSelected),modules.length-1);if(modules.length>1){const choices=h("div","pt-module-choices");modules.forEach((item,index)=>{const b=btn("pt-module-choice",{moduleIndex:String(index)},item.label+(item.id&& item.id!=="未命中"?" · "+item.id:""));b.setAttribute("aria-pressed",index===state.moduleSelected?"true":"false");choices.append(b)});f.append(choices)}const selected=modules[state.moduleSelected];f.append(selected.error?parseError("模块路由无法结构化，已保留完整原文。",selected.raw):renderModule(selected.raw));return f}
function battleError(message,text){return frag(h("div","pt-diagnostic",message),rawBlock(text))}
function renderBattle(text){if(!text)return emptyState("khanda","本轮没有战斗裁断任务");let parsed;try{parsed=JSON.parse(text)}catch(e){return battleError("战斗裁断不是有效JSON："+e.message,text)}const s=parsed?.模块结算;if(!s||Array.isArray(s)||typeof s.是否结束!=="boolean")return battleError("战斗裁断缺少 模块结算.是否结束 布尔值。",text);const keys=Object.keys(s);if(s.是否结束===false){if(keys.length!==1||keys[0]!=="是否结束")return battleError("未结束裁断只能包含 是否结束 字段。",text);const box=h("div","pt-battle-status",h("strong","","裁断声明：战斗继续"),h("span","pt-muted","结构校验通过；实际战斗状态由运行时执行层复核"));box.dataset.finished="false";return box}const required=["是否结束","胜方","败方","败方剩余HP比例"];if(keys.length!==required.length||required.some(k=>!Object.prototype.hasOwnProperty.call(s,k)))return battleError("已结束裁断必须且只能包含规定的4个字段。",text);const winner=clean(s.胜方),loser=clean(s.败方),hp=Number(s.败方剩余HP比例);if(!winner||!loser||winner===loser)return battleError("胜方与败方必须是两个不同的非空角色名。",text);if(!Number.isFinite(hp)||hp<0||hp>100)return battleError("败方剩余HP比例必须是0到100之间的数字。",text);const box=h("div","pt-battle-status",h("strong","","裁断声明：战斗结束"),h("span","pt-muted",winner+" 战胜 "+loser+"；参与者归属与实际写入由运行时执行层复核"));box.dataset.finished="true";const grid=node("div","pt-grid-3");grid.append(keyValue("胜方",winner),keyValue("败方",loser),keyValue("败方剩余HP比例",String(hp)+"%"));return frag(box,grid)}
function rulingDetail(section){const g=state.game;if(section==="knowledge")return renderKnowledge();if(section==="route")return renderRouteDetail();if(section==="butterfly")return renderButterfly();if(section==="audit")return renderAuditDetail();if(section==="modules")return renderModulesDetail();if(section==="battle")return frag(detailHead("khanda","战斗裁断","BATTLE"),renderBattle(g.routing.battle_adjudication));if(section==="plan")return frag(detailHead("chess","后台推演","DM · SET"),stepsList(g.ruling.dm_set));return renderCurrentRuling()}
function renderRuling(){if(!clean(state.snapshot?.tasks?.ruling?.raw))return h("div","pt-scroll",emptyState("scale-balanced","当前没有剧情裁定资料","裁定任务写回后会显示在这里。"));const items=rulingItems();if(!items.some(i=>i.id===state.rulingSection))state.rulingSection="current";return splitPage(items,state.rulingSection,"ruling",rulingDetail(state.rulingSection),"ruling")}

/* ===== 情报 ===== */
function recordCodes(text,prefix){const matches=clean(text).match(new RegExp("\\b"+prefix+"\\d+\\b","gi"))||[];return[...new Set(matches.map(code=>code.toUpperCase()))]}
function getDatabaseApi(){try{return window.parent?.AutoCardUpdaterAPI||window.top?.AutoCardUpdaterAPI||window.AutoCardUpdaterAPI||null}catch(_){return null}}
function pickRecordValue(record,aliases){for(const key of aliases){const value=record?.[key];if(value!==undefined&& value!==null&& String(value).trim())return String(value).trim()}return""}
function appendRecordField(target,key,value){const text=clean(value);if(!text)return;target.append(h("div","pt-record-field",h("div","pt-record-key",key),h("div","pt-record-value",text)))}
function renderRecordDetails(code,record){const box=document.createDocumentFragment();if(code.startsWith("AM")){appendRecordField(box,"时间跨度",pickRecordValue(record,["时间跨度","time_span"]));appendRecordField(box,"地点",pickRecordValue(record,["地点","location"]));appendRecordField(box,"概要",pickRecordValue(record,["概要","概览","summary"]));appendRecordField(box,"纪要",pickRecordValue(record,["纪要","chronicle_text","chronicle_entry"]));appendRecordField(box,"关键对话",pickRecordValue(record,["关键对话","key_dialogue"]))}else{appendRecordField(box,"状态",pickRecordValue(record,["状态","status"]));appendRecordField(box,"偏差类型",pickRecordValue(record,["偏差类型","deviation_type"]));appendRecordField(box,"偏差等级",pickRecordValue(record,["偏差等级","deviation_level"]));appendRecordField(box,"偏差纪要",pickRecordValue(record,["偏差纪要","deviation_note"]));appendRecordField(box,"蝴蝶推演",pickRecordValue(record,["蝴蝶推演","butterfly_projection"]))}return box}
function buildRecordIndex(){state.recordIndex=new Map();state.recordIndexReady=false;state.recordIndexError="";const api=getDatabaseApi();if(!api||typeof api.exportTableAsJson!=="function"){state.recordIndexError="数据库查询接口尚未就绪。";return}try{const data=api.exportTableAsJson()||{};for(const sheet of Object.values(data)){if(!sheet||!["纪要表","总结表","偏差表"].includes(clean(sheet.name))||!Array.isArray(sheet.content)||sheet.content.length<2)continue;const headers=Array.isArray(sheet.content[0])?sheet.content[0].map(clean):[];const codeIndex=headers.findIndex(header=>["编码索引","code_index","编码","code"].includes(header));if(codeIndex<0)continue;for(const row of sheet.content.slice(1)){if(!Array.isArray(row))continue;const code=clean(row[codeIndex]).toUpperCase();if(!/^(?:AM|DV)\d+$/.test(code))continue;state.recordIndex.set(code,Object.fromEntries(headers.map((header,index)=>[header,row[index]])))}}state.recordIndexReady=true}catch(error){state.recordIndexError="数据库读取失败："+clean(error?.message||"未知错误")}}
function recordTitle(code){const record=state.recordIndex.get(code);if(!record)return"";const value=code.startsWith("AM")?pickRecordValue(record,["概要","概览","summary","纪要","chronicle_text","chronicle_entry"]):pickRecordValue(record,["偏差纪要","deviation_note","蝴蝶推演","butterfly_projection"]);return firstSentence(value,"")}
function updateRecordSummary(prefix){const count=state.expandedRecords[prefix]?.size||0;for(const button of queryAll('[data-action="collapse-records"][data-prefix="'+prefix+'"]'))button.hidden=count===0}
function toggleRecordPreview(button){const item=button.closest(".pt-record-item"),preview=item?.querySelector(".pt-record-preview"),code=clean(button.dataset.recordCode).toUpperCase(),prefix=code.slice(0,2),set=state.expandedRecords[prefix];if(!item||!preview||!set)return;const opening=!set.has(code);if(opening)set.add(code);else set.delete(code);item.dataset.open=opening?"true":"false";button.setAttribute("aria-expanded",opening?"true":"false");preview.replaceChildren();if(opening){if(!state.recordIndexReady)buildRecordIndex();const record=state.recordIndex.get(code);preview.append(record?renderRecordDetails(code,record):h("div","pt-record-error",state.recordIndexError||"数据库中未找到 "+code+"。"))}updateRecordSummary(prefix)}
function collapseRecords(prefix){state.expandedRecords[prefix]?.clear();for(const item of queryAll('.pt-record-item[data-prefix="'+prefix+'"]')){item.dataset.open="false";item.querySelector(".pt-record-toggle")?.setAttribute("aria-expanded","false");item.querySelector(".pt-record-preview")?.replaceChildren()}updateRecordSummary(prefix)}
function renderArchiveDetail(prefix,text,label,ic){const codes=recordCodes(text,prefix);if(codes.length&&!state.recordIndexReady)buildRecordIndex();const collapse=btn("pt-text-btn",{action:"collapse-records",prefix},"全部收起");collapse.hidden=state.expandedRecords[prefix].size===0;const head=detailHead(ic,label,"",frag(h("span","",codes.length+" 条"),collapse));
 if(!codes.length){const src=clean(text);return frag(head,src&&!ptBlank(src)&&!/^无/.test(src)?parseError("未识别到有效"+prefix+"编码，已保留完整原文。",src):emptyState(ic,"本轮未调取"+label))}
 const list=h("div","pt-record-list");for(const code of codes){const open=state.expandedRecords[prefix].has(code),toggle=btn("pt-record-toggle",{recordCode:code},h("span","pt-record-code",code),h("span","pt-record-title",recordTitle(code)||"展开查看数据库记录"),h("span","pt-record-arrow",icon(open?"chevron-up":"chevron-down"))),preview=h("div","pt-record-preview"),item=h("article","pt-record-item",toggle,preview);toggle.setAttribute("aria-expanded",open?"true":"false");item.dataset.open=open?"true":"false";item.dataset.prefix=prefix;if(open){const record=state.recordIndex.get(code);preview.append(record?renderRecordDetails(code,record):h("div","pt-record-error",state.recordIndexError||"数据库中未找到 "+code+"。"))}list.append(item)}return frag(head,list)}
function renderClueDetail(){const g=state.game,list=[];
 // 时间线：本档时间点在前，「原本世界线于 X 后发生」的未来节点标金色
 if(g.timeline.length)list.push(plate("",plateHead("timeline","原著时间线","CANON"),h("ol","pt-tl",g.timeline.map((t,i)=>h("li","",hexNum(i+1,28),h("div","",h("small","",t.when?chip(t.when,t.future?"gold":"blue"):null,t.code?" "+t.code:""),h("strong","",t.event),t.hits?.length?h("div","pt-hits",t.hits.map(x=>chip(x))):null))))));
 if(g.evidence.length)list.push(plate("",plateHead("book-bookmark","人物原著行为依据","EVIDENCE"),h("div","pt-ev",g.evidence.map(e=>h("details","pt-fold",h("summary","",avatar(e.name,kindOf(e.name),26),e.name,e.role?chip(e.role):null),h("div","pt-fold-body",evidenceBody(e)))))));
 return frag(detailHead("timeline","原著线索","CANON"),list.length?h("div","pt-stack",list):emptyState("timeline","本轮没有原著线索",clean(state.snapshot?.tasks?.clue?.raw)?"":"这一楼没有运行原著线索任务。"))}
function renderTimeDetail(){const g=state.game,list=[],jump=clean(g.recall.time_jump);
 if(jump)list.push(plate("",plateHead("stopwatch","本轮耗时","TIME"),h("div","pt-big",h("b","",jump),h("span","",g.anchor.date?g.anchor.date+(g.anchor.time?" "+g.anchor.time:""):""))));
 const cross=state.snapshot?.crossedTimeline;if(cross&&(cross.from||cross.to||cross.summary))list.push(plate("",plateHead("forward-fast","跨越区间","JUMP"),h("div","pt-path",cross.from||"—",icon("arrow-right-long"),cross.to||"—"),cross.summary?prose(cross.summary):null));
 const near=clean(state.snapshot?.nearTimeline),events=[];const stamp=/^(?:(斗罗历[^|｜]+?)\s+)?(\d{1,2}:\d{2})(?:\s*[（(]([^）)]+)[）)])?\s*[|｜]\s*(.*)$/;let date="";for(const line of near.split("\n").map(clean).filter(Boolean)){const m=line.match(stamp);if(m){date=clean(m[1]||date);events.push({date,time:m[2],rel:clean(m[3]||""),body:clean(m[4]||"")})}else if(events.length)events[events.length-1].body+="\n"+line}
 const nearPlate=plate("",plateHead("clock-rotate-left","本档近端经历","RECENT"));if(events.length)nearPlate.append(h("ol","pt-near",events.map(e=>h("li","",h("time","",e.time,h("small","",[e.date,e.rel].filter(Boolean).join(" · "))),h("p","",e.body||"无事件正文")))));else nearPlate.append(near?parseError("近端时间线格式无法识别，已保留完整原文。",near):h("p","pt-empty-inline","当前楼层没有近端时间线输入"));list.push(nearPlate);
 return frag(detailHead("clock","时间定位","TIME"),h("div","pt-stack",list))}
function renderSeedDetail(){const src=clean(state.game.recall.original_character_seed);if(ptBlank(src))return frag(detailHead("id-card","必要负责人","SEED"),emptyState("id-card","本轮无需新增负责人"));const cards=[];for(const line of src.split("\n").map(clean).filter(Boolean)){const p=line.split(/\s*[｜|]\s*/);if(p.length>=4){const duty=p.length>4?p[p.length-1]:"";cards.push(plate("pt-idcard",avatar(p[0],"npc",54),h("div","",h("h3","",p[0]),h("div","pt-dos-tags",(duty?p.slice(1,-1):p.slice(1)).map((x,i)=>chip(x,i===0?"blue":""))),duty?h("p","",duty):null)))}else cards.push(plate("",prose(line)))}return frag(detailHead("id-card","必要负责人","SEED"),h("div","pt-stack",cards))}
function intelItems(){const g=state.game,r=g.recall;return[{id:"clue",icon:"timeline",label:"原著线索",count:g.timeline.length||undefined},{id:"am",icon:"scroll",label:"事件纪要",count:recordCodes(r.recall,"AM").length||undefined},{id:"dv",icon:"code-branch",label:"偏差档案",count:recordCodes(r.deviation_ledger_recall,"DV").length||undefined},{id:"time",icon:"clock",label:"时间定位"},{id:"seed",icon:"id-card",label:"必要负责人",count:ptBlank(r.original_character_seed)?undefined:clean(r.original_character_seed).split("\n").filter(Boolean).length}]}
function intelDetail(section){const r=state.game.recall;if(section==="am")return renderArchiveDetail("AM",r.recall,"事件纪要","scroll");if(section==="dv")return renderArchiveDetail("DV",r.deviation_ledger_recall,"偏差档案","code-branch");if(section==="time")return renderTimeDetail();if(section==="seed")return renderSeedDetail();return renderClueDetail()}
function renderIntel(){if(!state.game||noTaskData())return h("div","pt-scroll",emptyState("book-open","当前没有情报资料"));const items=intelItems();if(!items.some(i=>i.id===state.intelSection))state.intelSection="clue";return splitPage(items,state.intelSection,"intel",intelDetail(state.intelSection),"intel")}

/* ===== 开发记录（原文） ===== */
function renderRaw(){const p=PAGES[state.page],root=h("div","pt-scroll pt-main");root.dataset.scroll="raw:"+state.page;const back=btn("pt-text-btn",{page:state.lastMain},icon("arrow-left")," 返回"+PAGES[state.lastMain].label);root.append(detailHead("file-code",p.label,"",back));
 if(p.raw==="diagnostics"){const d=[...(state.snapshot?.diagnostics||[]),...(state.game?.characters?.diagnostics||[])];if(!d.length)root.append(emptyState("circle-check","当前没有解析诊断"));for(const x of d)root.append(h("div","pt-diagnostic",x));return root}
 let text="";if(TASKS[p.raw])text=state.snapshot?.tasks?.[p.raw]?.raw||"";else if(p.raw==="combined")text=state.snapshot?.combined||"";else if(p.raw==="message")text=state.snapshot?.message||"";
 root.append(h("p","pt-lbl",(TASKS[p.raw]?taskLabel(p.raw)+" · ":"")+text.length+" 字符"),rawBlock(text||"无"));if(p.raw==="message"&& state.snapshot?.swipes?.length)root.append(h("p","pt-lbl","swipes · "+state.snapshot.swipes.length+" 个候选版本"),rawBlock(JSON.stringify(state.snapshot.swipes,null,2)));return root}

/* ===== 渲染与交互 ===== */
function saveScroll(){for(const el of queryAll("[data-scroll]"))state.scroll[el.dataset.scroll]=el.scrollTop}
function restoreScroll(){for(const el of queryAll("[data-scroll]"))el.scrollTop=state.scroll[el.dataset.scroll]||0}
function renderPage(animate=true){const content=$("[data-role=content]");saveScroll();let view;
 if(state.page==="overview")view=renderOverview();else if(state.page==="people")view=renderPeople();else if(state.page==="ruling")view=renderRuling();else if(state.page==="intel")view=renderIntel();else view=renderRaw();
 app.dataset.page=state.page;content.replaceChildren(view);if(animate){content.classList.remove("pt-enter");void content.offsetWidth;content.classList.add("pt-enter")}renderTabs();restoreScroll();savePrefs()}
function openPage(id,patch){if(!PAGES[id])return;saveScroll();state.page=id;if(MAIN.includes(id))state.lastMain=id;Object.assign(state,patch||{});closeSettings();if(app.dataset.collapsed==="true")setCollapsed(false);renderPage(true)}
function closeSettings(){const box=$("[data-role=settings]");if(box?.dataset.open==="true"){box.dataset.open="false";box.querySelector("[data-action=settings]")?.setAttribute("aria-expanded","false")}}
function applyPrefs(){app.dataset.density=state.prefs.density;app.style.setProperty("--pt-font",String(state.prefs.font))}
function setCollapsed(collapsed){app.dataset.collapsed=collapsed?"true":"false";const bar=$("[data-collapse-surface]");if(bar){bar.setAttribute("aria-expanded",collapsed?"false":"true");bar.setAttribute("aria-label",collapsed?"展开剧情推进":"收起剧情推进")}if(collapsed)closeSettings()}
function detectLayout(){const width=app.getBoundingClientRect().width<720?"compact":"wide";if(app.dataset.width===width)return;app.dataset.width=width;if(state.rendered)renderPage(false)}
const handleClick=e=>{const t=e.target;
 if(!t.closest("[data-role=settings]"))closeSettings();
 const page=t.closest("[data-page]");if(page&& app.contains(page)&& page!==app){openPage(page.dataset.page);return}
 const go=t.closest("[data-goto]");if(go){const [p,s]=go.dataset.goto.split(":"),patch={};if(p==="ruling")patch.rulingSection=s;if(p==="intel")patch.intelSection=s;if(go.dataset.moduleIndex!==undefined)patch.moduleSelected=Number(go.dataset.moduleIndex)||0;openPage(p,patch);return}
 const person=t.closest("[data-person]");if(person){openPage("people",{personKey:person.dataset.person,peopleView:"person"});return}
 const pv=t.closest("[data-people-view]");if(pv){openPage("people",{peopleView:pv.dataset.peopleView});return}
 const intel=t.closest("[data-intel-section]");if(intel){openPage("intel",{intelSection:intel.dataset.intelSection});return}
 const ruling=t.closest("[data-ruling-section]");if(ruling){openPage("ruling",{rulingSection:ruling.dataset.rulingSection});return}
 const choice=t.closest("[data-module-index]");if(choice){state.moduleSelected=Number(choice.dataset.moduleIndex)||0;renderPage(false);return}
 const record=t.closest("[data-record-code]");if(record){toggleRecordPreview(record);const arrow=record.querySelector(".pt-record-arrow");if(arrow)arrow.replaceChildren(icon(record.getAttribute("aria-expanded")==="true"?"chevron-up":"chevron-down"));return}
 const raw=t.closest("[data-open-page]");if(raw){openPage(raw.dataset.openPage);return}
 const action=t.closest("[data-action]");
 if(!action){if(t.closest("[data-collapse-surface]")&&!t.closest(".pt-settings-panel"))setCollapsed(app.dataset.collapsed!=="true");return}
 const name=action.dataset.action;
 if(name==="settings"){const box=action.closest("[data-role=settings]"),open=box.dataset.open!=="true";box.dataset.open=open?"true":"false";action.setAttribute("aria-expanded",open?"true":"false");return}
 if(name==="font"){const values=[.9,1,1.12];state.prefs.font=values[(values.indexOf(Number(state.prefs.font))+1)%values.length];applyPrefs();savePrefs();return}
 if(name==="density"){state.prefs.density=state.prefs.density==="compact"?"standard":"compact";applyPrefs();savePrefs();return}
 if(name==="collapse-records"){collapseRecords(action.dataset.prefix);for(const a of queryAll(".pt-record-arrow"))a.replaceChildren(icon("chevron-down"));return}};
const handleKeydown=e=>{if(e.key==="Escape"){closeSettings();return}if(e.target.matches("[data-collapse-surface]")&&["Enter"," "].includes(e.key)){e.preventDefault();setCollapsed(app.dataset.collapsed!=="true")}};
app.addEventListener("click",handleClick);app.addEventListener("keydown",handleKeydown);
let resizeTimer=0;const onResize=()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(detectLayout,80)};
const ptResizeObserver=typeof ResizeObserver==="function"?new ResizeObserver(onResize):null;ptResizeObserver?.observe(app);

/* ===== 读取轮询：任务陆续写回时自动刷新，2 分钟后停 ===== */
let refreshRetryTimer=0,refreshStartedAt=0,refreshTaskState="";
function taskProgressState(){const ctx=getChatContext(),chat=Array.isArray(ctx?.chat)?ctx.chat:[];if(!chat.length)return"chat:none";const found=findPlotMessage(chat);if(!found.message)return"missing|"+String(found.terminalIndex??-1)+"|"+String(found.userIndex??-1);const states=[];for(const ids of Object.values(TASKS))for(const id of ids)states.push(id+":"+(clean(found.message.qrf_plot_tasks[id])?"1":"0"));return String(found.index)+"|"+String(found.terminalIndex)+"|"+states.join(",")}
function scheduleRefresh(force){if(performance.now()-refreshStartedAt>=120000)return;clearTimeout(refreshRetryTimer);refreshRetryTimer=setTimeout(()=>runRefresh(force),250)}
function runRefresh(force=true){if(!refreshStartedAt)refreshStartedAt=performance.now();const progress=taskProgressState();if(!force&& progress===refreshTaskState){scheduleRefresh(false);return}refreshTaskState=progress;refresh().then(()=>{if(coreTasksReady()){refreshStartedAt=0;clearTimeout(refreshRetryTimer);return}scheduleRefresh(false)}).catch(error=>{const message=clean(error?.message||error||"未知错误");announce("读取失败");$("[data-role=bar-current]").textContent="剧情数据读取失败："+message;try{console.error("[剧情推进终端] 读取失败",error)}catch(_){}scheduleRefresh(true)})}
function announce(text){$("[data-role=live]").textContent=text}
async function refresh(){const request=++state.request;announce("正在读取…");await Promise.resolve();const next=buildSnapshot();if(request!==state.request)return;const floorKey=String(next.index)+"|"+String(next.terminalIndex);if(state.floorKey&& state.floorKey!==floorKey){state.expandedRecords.AM.clear();state.expandedRecords.DV.clear();state.recordIndex=new Map();state.recordIndexReady=false;state.recordIndexError="";state.moduleSelected=0;state.personKey="";state.scroll={}}state.floorKey=floorKey;const hash=hashText(JSON.stringify({index:next.index,terminalIndex:next.terminalIndex,tasks:next.tasks,nearTimeline:next.nearTimeline,crossedTimeline:next.crossedTimeline,combined:next.combined,message:next.message,swipes:next.swipes,diagnostics:next.diagnostics})),changed=hash!==state.hash;state.snapshot=next;state.game=buildGameModel();state.hash=hash;announce(next.terminalIndex>=0?(changed?"读取完成":"数据未变化"):"未找到任务数据");renderBar();if(!changed&& state.rendered)return;const first=!state.rendered;state.rendered=true;renderPage(first)}
window.addEventListener("pagehide",()=>{clearTimeout(resizeTimer);clearTimeout(refreshRetryTimer);try{ptResizeObserver?.disconnect()}catch(_){}},{once:true});
try{loadPrefs();applyPrefs();detectLayout();renderTabs();runRefresh()}catch(error){const message=clean(error?.message||error||"未知错误");try{announce("初始化失败");$("[data-role=bar-current]").textContent="剧情终端初始化失败："+message}catch(_){}try{console.error("[剧情推进终端] 初始化失败",error)}catch(_){}}
};
if(document.readyState==="loading")setTimeout(boot,0);else boot();
})();
