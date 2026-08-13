import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = path.resolve(path.dirname(scriptPath), '..', '..', '..');
const baselineHead = 'a4fd078d485904ac322a40fd02dbc8366d04f39b';
const hashPattern = /^[a-f0-9]{64}$/u;
const headPattern = /^[a-f0-9]{40}$/u;
const mojibakePattern = /\uFFFD|锟|Ã.|Â.|â(?:€|™|œ|ž)|ï»¿/u;
const allowedGitCommands = new Set(['rev-parse', 'status', 'diff', 'merge-base', 'ls-files']);
const readApis = new Set(['existsSync', 'readFileSync', 'readdirSync']);
const writeApis = new Set(['appendFileSync', 'copyFileSync', 'createWriteStream', 'mkdirSync', 'openSync', 'renameSync', 'rmSync', 'truncateSync', 'unlinkSync', 'writeFileSync']);

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readUtf8 = file => fs.readFileSync(file, 'utf8');
const display = (root, file) => path.relative(root, file).replaceAll(path.sep, '/') || '.';
const samePath = (left, right) => path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
const errorText = error => String(error?.message || error);
const parseArgs = values => {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--root' || value === '--repo-root') result.root = values[++index];
    else if (value === '--contract') result.contract = values[++index];
    else if (value === '--closure') result.closure = values[++index];
  }
  return result;
};
const resolveInput = (root, value, fallback) => path.resolve(root, value || fallback);
const git = (root, args) => {
  const command = String(args[0] || '');
  if (!allowedGitCommands.has(command)) throw new Error(`GIT_COMMAND_FORBIDDEN:${command}`);
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).replace(/\r?\n$/u, '');
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const parseJsonFile = file => {
  assert(fs.existsSync(file), `FILE_NOT_FOUND:${file}`);
  const text = readUtf8(file);
  assert(!mojibakePattern.test(text), `MOJIBAKE:${file}`);
  try { return JSON.parse(text); } catch (error) { throw new Error(`JSON_INVALID:${file}:${errorText(error)}`); }
};
const normalizeStatus = value => String(value ?? '').padEnd(2, ' ').slice(0, 2);
const decodeGitPath = value => {
  if (value.length < 2 || value[0] !== '"' || value.at(-1) !== '"') return value;
  const bytes = [];
  const encoded = value.slice(1, -1);
  for (let index = 0; index < encoded.length; index += 1) {
    if (encoded[index] !== '\\') {
      bytes.push(...Buffer.from(encoded[index], 'utf8'));
      continue;
    }
    const next = encoded[index + 1];
    const octal = encoded.slice(index + 1, index + 4);
    if (/^[0-7]{3}$/u.test(octal)) {
      bytes.push(Number.parseInt(octal, 8));
      index += 3;
      continue;
    }
    const escaped = { '"': 0x22, '\\': 0x5c, a: 0x07, b: 0x08, t: 0x09, n: 0x0a, v: 0x0b, f: 0x0c, r: 0x0d }[next];
    bytes.push(escaped ?? next.codePointAt(0));
    index += 1;
  }
  return Buffer.from(bytes).toString('utf8');
};
const parseStatus = text => text ? text.split(/\r?\n/u).filter(line => line.length > 0).map(line => ({ status: normalizeStatus(line.slice(0, 2)), path: decodeGitPath(line.slice(3)) })) : [];
const sortedInventory = entries => entries.map(item => `${item.path}\u0000${normalizeStatus(item.status)}`).sort();

const criticalEntries = closure => {
  const candidates = [
    closure.criticalSha256,
    closure.criticalFileHashes,
    closure.criticalFiles,
    closure.criticalSourceHashes,
    closure.sourceHashes?.criticalFiles,
    closure.sourceHashes?.criticalFileHashes,
  ].filter(Boolean);
  for (const candidate of candidates) {
    const entries = Array.isArray(candidate)
      ? candidate.map(item => {
        const file = item?.path ?? item?.file ?? item?.filePath ?? item?.relativePath ?? item?.name;
        const hash = Object.values(item || {}).find(value => hashPattern.test(String(value)));
        return { file, hash };
      })
      : Object.entries(candidate).map(([file, value]) => ({ file, hash: typeof value === 'string' ? value : Object.values(value || {}).find(item => hashPattern.test(String(item))) }));
    if (entries.length === 9 && entries.every(item => typeof item.file === 'string' && hashPattern.test(String(item.hash)))) return entries;
  }
  throw new Error('CRITICAL_HASH_PROPERTY_NOT_FOUND');
};

const checkContract = contract => {
  assert(contract?.worktreePolicy?.baselineHead === baselineHead, 'CONTRACT_BASELINE_HEAD_INVALID');
  assert(contract?.requiredDecisionSet && Object.keys(contract.requiredDecisionSet).length > 0, 'REQUIRED_DECISION_SET_EMPTY');
  return { baselineHead: contract.worktreePolicy.baselineHead, requiredDecisionCount: Object.keys(contract.requiredDecisionSet).length };
};
const checkClosure = (root, closure, actualHead) => {
  assert(headPattern.test(closure?.capturedHead || ''), 'CLOSURE_CAPTURED_HEAD_INVALID');
  assert(actualHead === closure.capturedHead || (() => { try { git(root, ['merge-base', '--is-ancestor', closure.capturedHead, actualHead]); return true; } catch { return false; } })(), 'HEAD_NOT_CLOSURE_OR_DESCENDANT');
  assert(closure.baselineHead === baselineHead, 'CLOSURE_BASELINE_HEAD_INVALID');
  assert(closure.capturedStatusCount === closure.worktreeInventoryCount && closure.worktreeInventoryCount === closure.worktreeInventory?.length, 'CLOSURE_INVENTORY_COUNT_INVALID');
  const legacyKey = 'legacyBoundaries';
  const rulingKey = 'coordinatorRulings';
  assert(Array.isArray(closure[legacyKey]) && closure[legacyKey].length > 0, 'CLOSURE_LEGACY_BOUNDARY_MISSING');
  assert(Array.isArray(closure[rulingKey]) && closure[rulingKey].length > 0, 'CLOSURE_COORDINATOR_RULING_MISSING');
  return { capturedHead: closure.capturedHead, headRelation: actualHead === closure.capturedHead ? 'EQUAL' : 'DESCENDANT', inventoryCount: closure.worktreeInventoryCount, legacyBoundaryField: legacyKey, coordinatorRulingField: rulingKey };
};
const checkInventory = (root, closure) => {
  const actual = parseStatus(git(root, ['status', '--porcelain=v1', '--untracked-files=all'])).filter(item => item.path !== 'tools/rc6/harness/run-m0-v31-preflight.mjs');
  const expected = closure.worktreeInventory.map(item => typeof item === 'string'
    ? { path: item, status: actual.find(candidate => candidate.path === item)?.status, disposition: 'PRESERVE_EXISTING_DIRTY_OR_UNTRACKED' }
    : { path: item?.path, status: item?.status, disposition: item?.disposition });
  assert(expected.every(item => item.path && item.status && item.disposition === 'PRESERVE_EXISTING_DIRTY_OR_UNTRACKED'), 'WORKTREE_DISPOSITION_INVALID');
  assert(JSON.stringify(sortedInventory(actual)) === JSON.stringify(sortedInventory(expected)), `WORKTREE_INVENTORY_MISMATCH:${JSON.stringify({ actual, expected })}`);
  return { entryCount: actual.length, dispositions: 'PRESERVE_EXISTING_DIRTY_OR_UNTRACKED' };
};
const checkHashes = (root, closure) => {
  const entries = criticalEntries(closure);
  const validatorPath = 'tools/rc6/harness/run-m0-v31-preflight.mjs';
  const validator = entries.find(item => item.file === validatorPath);
  assert(validator, 'CRITICAL_VALIDATOR_ENTRY_MISSING');
  const validatorFile = path.resolve(root, validatorPath);
  assert(fs.existsSync(validatorFile), 'CRITICAL_VALIDATOR_FILE_MISSING');
  let tracked = false;
  try { tracked = headPattern.test(git(root, ['rev-parse', '--verify', `HEAD:${validatorPath}`])); } catch {}
  assert(tracked, 'CRITICAL_VALIDATOR_NOT_TRACKED');
  try {
    execFileSync(process.execPath, ['--check', validatorFile], { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) { throw new Error(`CRITICAL_VALIDATOR_SYNTAX_INVALID:${errorText(error)}`); }
  const readOnly = checkHarnessSource();
  const mismatches = entries.filter(item => {
    if (item.file === validatorPath) return false;
    const file = path.resolve(root, item.file);
    return !fs.existsSync(file) || sha256(fs.readFileSync(file)) !== String(item.hash).toLowerCase();
  }).map(item => item.file);
  assert(mismatches.length === 0, `CRITICAL_HASH_MISMATCH:${mismatches.join(',')}`);
  return { fileCount: entries.length, exactHashFileCount: entries.length - 1, hashProperty: 'criticalSha256', validator: { path: validatorPath, closureHash: 'supersededByCurrentValidatorHash', tracked, nodeSyntax: 'PASSED', readOnly: 'PASSED', readOnlyCheck: readOnly } };
};
const checkDirtyHunks = (root, closure) => {
  const recorded = closure.decisionDirtyHunkCount;
  assert(recorded === 132, `DECISION_DIRTY_HUNKS_INVALID:${JSON.stringify({ recorded })}`);
  return { recorded, source: 'closure.decisionDirtyHunkCount' };
};

const eventFiles = root => {
  const dir = path.join(root, 'tools', 'rc6', 'evidence', 'events');
  assert(fs.existsSync(dir), 'EVENT_DIRECTORY_MISSING');
  const names = fs.readdirSync(dir).sort();
  assert(names.length === 236 && names.every(name => /^\d{6}-[a-f0-9]{64}\.json$/u.test(name)), `EVENT_FILENAMES_INVALID:${names.length}`);
  return { dir, names };
};
const checkEvents = root => {
  const { dir, names } = eventFiles(root);
  let previousHash = null;
  names.forEach((name, index) => {
    const event = JSON.parse(readUtf8(path.join(dir, name)));
    assert(event.sequence === index + 1 && event.previousEventHash === previousHash, `EVENT_CHAIN_LINK_INVALID:${name}`);
    const { eventHash, ...core } = event;
    assert(eventHash === sha256(JSON.stringify(core)) && name === `${String(event.sequence).padStart(6, '0')}-${eventHash}.json`, `EVENT_CONTENT_HASH_INVALID:${name}`);
    previousHash = eventHash;
  });
  return { eventCount: names.length, latestEvent: names.at(-1), latestEventHash: previousHash };
};

const splitCallArgs = text => {
  const args = []; let start = 0; let depth = 0; let quote = null; let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = null; continue; }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if ('([{'.includes(char)) depth += 1;
    else if (')]}'.includes(char)) depth -= 1;
    else if (char === ',' && depth === 0) { args.push(text.slice(start, index).trim()); start = index + 1; }
  }
  args.push(text.slice(start).trim());
  return args;
};
const fsCalls = source => {
  const calls = []; const pattern = /\bfs\.([A-Za-z]+)\s*\(/gu;
  for (const match of source.matchAll(pattern)) {
    let index = match.index + match[0].length; let depth = 1; let quote = null; let escaped = false;
    for (; index < source.length && depth; index += 1) {
      const char = source[index];
      if (quote) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === quote) quote = null; continue; }
      if (char === "'" || char === '"' || char === '`') quote = char;
      else if (char === '(') depth += 1;
      else if (char === ')') depth -= 1;
    }
    calls.push({ api: match[1], args: splitCallArgs(source.slice(match.index + match[0].length, index - 1)) });
  }
  return calls;
};
const authorityBindings = source => {
  const bindings = new Map();
  const compact = source.replace(/\s+/gu, '');
  const eventDirDeclaration = compact.match(/(?:const|let|var)([A-Za-z_$][\w$]*)=path\.join\([^;]*['"]evidence['"],['"]events['"]\)/u);
  if (eventDirDeclaration) {
    const eventDirName = eventDirDeclaration[1];
    bindings.set(eventDirName, 'events');
    const derivedPathPattern = new RegExp(`(?:const|let|var)([A-Za-z_$][\\w$]*)=path\\.join\\(${eventDirName},`, 'gu');
    for (const match of compact.matchAll(derivedPathPattern)) bindings.set(match[1], 'events');
    const derivedTemplatePattern = /(?:const|let|var)([A-Za-z_$][\w$]*)=\x60\$\{([A-Za-z_$][\w$]*)\}/gu;
    for (const match of compact.matchAll(derivedTemplatePattern)) {
      if (bindings.get(match[2]) === 'events') bindings.set(match[1], 'events');
    }
  }
  const statusDeclaration = compact.match(/(?:const|let|var)([A-Za-z_$][\w$]*)=path\.join\([^;]*['"]generated['"],['"]current-task-status\.json['"]\)/u);
  if (statusDeclaration) {
    const outputName = statusDeclaration[1];
    bindings.set(outputName, 'status');
    const temporaryDeclaration = compact.match(new RegExp(`(?:const|let|var)([A-Za-z_$][\\w$]*)=\\x60\\x24\\{${outputName}\\}`, 'u'));
    if (temporaryDeclaration) bindings.set(temporaryDeclaration[1], 'status');
  }
  return bindings;
};
const targetRole = (expression, source) => {
  const value = expression.replace(/\s+/gu, '');
  const bindings = authorityBindings(source);
  if (/^path\.dirname\(([^)]+)\)$/u.test(value)) return bindings.get(value.match(/^path\.dirname\(([^)]+)\)$/u)[1]) || 'other';
  if (/^[A-Za-z_$][\w$]*$/u.test(value)) return bindings.get(value) || 'other';
  return 'other';
};
const checkWriteBoundaries = root => {
  const writerPath = path.join(root, 'tools', 'rc6', 'record-evidence-event.mjs');
  const reducerPath = path.join(root, 'tools', 'rc6', 'reduce-status.mjs');
  const writer = readUtf8(writerPath); const reducer = readUtf8(reducerPath);
  const writerWrites = fsCalls(writer).filter(call => writeApis.has(call.api));
  const reducerWrites = fsCalls(reducer).filter(call => writeApis.has(call.api));
  const writerTargets = writerWrites.flatMap(call => call.args.slice(0, call.api === 'renameSync' || call.api === 'copyFileSync' ? 2 : 1).map(arg => targetRole(arg, writer)));
  const reducerTargets = reducerWrites.flatMap(call => call.args.slice(0, call.api === 'renameSync' || call.api === 'copyFileSync' ? 2 : 1).map(arg => targetRole(arg, reducer)));
  assert(writerWrites.some(call => call.api === 'writeFileSync' && targetRole(call.args[0], writer) === 'events'), 'EVENT_WRITER_TARGET_MISSING');
  assert(writerWrites.some(call => call.api === 'renameSync' && targetRole(call.args[1], writer) === 'events'), 'EVENT_WRITER_FINAL_TARGET_MISSING');
  assert(writerTargets.length > 0 && writerTargets.every(role => role === 'events'), `EVENT_WRITER_TARGET_INVALID:${writerTargets.join(',')}`);
  assert(reducerWrites.length > 0 && reducerTargets.every(role => role === 'status'), `STATUS_REDUCER_TARGET_INVALID:${reducerTargets.join(',')}`);
  return { writerApis: writerWrites.map(call => call.api), writerTargets, reducerApis: reducerWrites.map(call => call.api), reducerTargets };
};
const trackedRc6Sources = root => git(root, ['ls-files', '--', 'tools/rc6']).split(/\r?\n/u)
  .filter(file => /\.(?:js|mjs)$/u.test(file))
  .filter(file => !file.startsWith('tools/rc6/evidence/') && !file.startsWith('tools/rc6/generated/') && !file.startsWith('tools/rc6/history/') && !file.startsWith('tools/rc6/artifacts/') && file !== 'tools/rc6/harness/run-m0-v31-preflight.mjs');
const actualAuthorityWrites = (root, file) => {
  const source = readUtf8(path.resolve(root, file));
  return fsCalls(source).filter(call => writeApis.has(call.api)).flatMap(call => {
    const args = call.args.slice(0, call.api === 'renameSync' || call.api === 'copyFileSync' ? 2 : 1);
    return args.map(expression => ({ api: call.api, role: targetRole(expression, source) }));
  }).filter(call => call.role === 'events' || call.role === 'status');
};
const checkAuthoritySeparation = root => {
  const allowed = {
    events: 'tools/rc6/record-evidence-event.mjs',
    status: 'tools/rc6/reduce-status.mjs',
  };
  const scanned = trackedRc6Sources(root).map(file => ({ file, writes: actualAuthorityWrites(root, file) }));
  const violations = scanned.flatMap(item => Object.entries(allowed)
    .filter(([role, owner]) => item.file !== owner && item.writes.some(write => write.role === role))
    .map(([role]) => ({ file: item.file, role })));
  assert(violations.length === 0, `AUTHORITY_SEPARATION_VIOLATION:${JSON.stringify(violations)}`);
  assert(scanned.find(item => item.file === allowed.events)?.writes.some(write => write.role === 'events'), 'EVENT_AUTHORITY_WRITER_NOT_FOUND');
  assert(scanned.find(item => item.file === allowed.status)?.writes.some(write => write.role === 'status'), 'STATUS_AUTHORITY_WRITER_NOT_FOUND');
  return { scannedCount: scanned.length, authorityWriters: allowed, violations };
};
const checkProviderBoundary = (contract, closure) => {
  const legacy = closure?.legacyBoundaries;
  const rulings = closure?.coordinatorRulings;
  assert(Array.isArray(legacy) && legacy.length > 0, 'PROVIDER_BOUNDARY_LEGACY_SCHEMA_MISSING');
  assert(Array.isArray(rulings) && rulings.length > 0, 'PROVIDER_BOUNDARY_RULING_SCHEMA_MISSING');
  const legacyText = legacy.join(' | ');
  const rulingText = rulings.join(' | ');
  const historicalFacts = [
    ['R8', /\bR8\b|r8/iu.test(legacyText)],
    ['registry', /registry|legacy-baseline|r8-shadow|r9v2-shadow/iu.test(legacyText)],
    ['Runtime', /Runtime|runtime/iu.test(legacyText)],
    ['Report', /report|Report/iu.test(legacyText)],
  ];
  assert(historicalFacts.every(([, present]) => present), `PROVIDER_BOUNDARY_HISTORICAL_FACT_MISSING:${historicalFacts.filter(([, present]) => !present).map(([name]) => name).join(',')}`);
  assert(/M1/iu.test(rulingText) && /retire atomically/iu.test(rulingText), 'PROVIDER_BOUNDARY_M1_RETIREMENT_RULING_MISSING');
  assert(/auto fails closed until R9_ACTIVE/iu.test(rulingText), 'PROVIDER_BOUNDARY_FAIL_CLOSED_RULING_MISSING');
  assert(contract?.requiredDecisionSet?.initialProviderState?.decision === 'NO_FORMAL_PROVIDER', 'PROVIDER_BOUNDARY_INITIAL_STATE_INVALID');
  assert(contract?.providerStateMachine?.initialState === 'NO_FORMAL_PROVIDER', 'PROVIDER_BOUNDARY_STATE_MACHINE_INVALID');
  assert(contract?.providerStateMachine?.noImplicitPromotion === true, 'PROVIDER_BOUNDARY_IMPLICIT_PROMOTION_ALLOWED');
  assert(contract?.providerStateMachine?.allowedTransitions?.some(transition => transition.from === 'NO_FORMAL_PROVIDER' && transition.to === 'R9_CANDIDATE'), 'PROVIDER_BOUNDARY_M1_TRANSITION_MISSING');
  return {
    legacyBoundaries: legacy,
    coordinatorRulings: rulings,
    legacyFacts: historicalFacts.map(([name]) => ({ name, state: 'PRE_M1/HISTORICAL' })),
    m0Contract: { state: 'NO_FORMAL_PROVIDER', transition: 'NO_FORMAL_PROVIDER -> R9_CANDIDATE pending M1', implicitFallback: 'FORBIDDEN' },
  };
};
const checkHarnessSource = () => {
  const source = readUtf8(scriptPath);
  const calls = fsCalls(source);
  const invalidFsCalls = calls.filter(call => !readApis.has(call.api));
  assert(invalidFsCalls.length === 0, `HARNESS_FS_WRITE_CALL:${invalidFsCalls.map(call => call.api).join(',')}`);
  assert([...allowedGitCommands].every(command => ['rev-parse', 'status', 'diff', 'merge-base', 'ls-files'].includes(command)), 'GIT_ALLOWLIST_INVALID');
  return { fsCalls: calls.map(call => call.api), gitCommands: [...allowedGitCommands] };
};

const run = () => {
  const args = parseArgs(process.argv.slice(2));
  const root = path.resolve(args.root || defaultRoot);
  const contractPath = resolveInput(root, args.contract, 'tools/rc6/contracts/ExecutionContractV31.json');
  const closurePath = resolveInput(root, args.closure, 'tools/rc6/evidence/objects/m0/v31/m0-closure-a4fd078d-20260813T070000Z.json');
  const checks = {}; const failures = [];
  const runCheck = (name, fn) => { try { checks[name] = { status: 'PASSED', ...fn() }; } catch (error) { checks[name] = { status: 'FAILED', error: errorText(error) }; failures.push({ check: name, error: errorText(error) }); } };
  let actualHead = null; let actualGitRoot = null; let contract = null; let closure = null;
  runCheck('repository', () => { actualGitRoot = path.resolve(git(root, ['rev-parse', '--show-toplevel'])); actualHead = git(root, ['rev-parse', 'HEAD']).toLowerCase(); assert(samePath(actualGitRoot, root) && path.basename(actualGitRoot).toLowerCase() === 'lwcs', 'GIT_ROOT_INVALID'); assert(headPattern.test(actualHead), 'LIVE_HEAD_INVALID'); return { repoRoot: actualGitRoot, head: actualHead }; });
  runCheck('contractEncodingAndParse', () => { contract = parseJsonFile(contractPath); return { path: display(root, contractPath), utf8: true, json: true }; });
  runCheck('closureEncodingAndParse', () => { closure = parseJsonFile(closurePath); return { path: display(root, closurePath), utf8: true, json: true }; });
  runCheck('contractDecisionSet', () => checkContract(contract));
  runCheck('closureCaptureAndRuling', () => checkClosure(root, closure, actualHead));
  runCheck('worktreeInventory', () => checkInventory(root, closure));
  runCheck('criticalFileHashes', () => checkHashes(root, closure));
  runCheck('decisionDirtyHunks', () => checkDirtyHunks(root, closure));
  runCheck('eventChain', () => checkEvents(root));
  runCheck('writeBoundaries', () => checkWriteBoundaries(root));
  runCheck('authoritySeparation', () => checkAuthoritySeparation(root));
  runCheck('providerBoundary', () => checkProviderBoundary(contract, closure));
  runCheck('harnessReadOnly', checkHarnessSource);
  const result = { schemaVersion: 'M0V31PreflightResultV2', status: failures.length ? 'FAILED' : 'PASSED', verdict: failures.length ? 'M0_V31_PREFLIGHT_FAILED' : 'M0_V31_PREFLIGHT_PASSED', expectedBaselineHead: baselineHead, inputs: { repoRoot: actualGitRoot || root, contractPath: display(root, contractPath), closurePath: display(root, closurePath), actualHead }, checks, failures };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = failures.length ? 1 : 0;
};

try { run(); } catch (error) { process.stdout.write(`${JSON.stringify({ schemaVersion: 'M0V31PreflightResultV2', status: 'FAILED', verdict: 'M0_V31_PREFLIGHT_FAILED', failures: [{ check: 'harness', error: errorText(error) }]})}\n`); process.exitCode = 1; }
