import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { TextDecoder } from 'node:util';
import { fileURLToPath } from 'node:url';

const EXPECTED_HEAD = 'a4fd078d485904ac322a40fd02dbc8366d04f39b';
const scriptPath = fileURLToPath(import.meta.url);
const defaultRepoRoot = path.resolve(path.dirname(scriptPath), '..', '..', '..');
const defaultContractNames = [
  'tools/rc6/contracts/ExecutionContractV31.json',
  'tools/rc6/contracts/execution-contract-v31.json',
  'tools/rc6/contracts/ExecutionContractV3.1.json',
];
const defaultClosureNames = [
  'tools/rc6/evidence/m0/M0ClosureBundle.json',
  'tools/rc6/evidence/m0/m0-closure-bundle.json',
  'tools/rc6/evidence/M0ClosureBundle.json',
];
const relativePath = (root, value) => path.relative(root, value).replaceAll(path.sep, '/');
const samePath = (left, right) => path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
const inside = (root, value) => {
  const relative = path.relative(root, value);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const utf8 = new TextDecoder('utf-8', { fatal: true });
const mojibakePattern = /(?:\uFFFD|锟|Ã.|Â.|â.|ð.|ï»¿|[äåæèéç][\u0080-\u00BF])/u;
const unresolved = new Set([
  '', 'PENDING', 'TODO', 'TBD', 'UNKNOWN', 'UNRESOLVED', 'UNDECIDED',
  'OPEN', 'MISSING', 'REQUIRED', 'UNACCOUNTED', 'NEEDS_DECISION',
]);
const normalizeKey = value => String(value).replace(/[^a-z0-9]/giu, '').toLowerCase();
const normalizeToken = value => String(value).trim().replace(/[\s-]+/gu, '_').toUpperCase();
const errorText = error => String(error?.message || error).split('\n', 1)[0];

const readUtf8 = filePath => {
  const text = utf8.decode(fs.readFileSync(filePath));
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
};
const readJson = filePath => JSON.parse(readUtf8(filePath));
const runGit = (cwd, args) => execFileSync('git', args, {
  cwd,
  encoding: 'utf8',
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
}).trim();
const displayPath = (root, value) => inside(root, value) ? relativePath(root, value) : path.resolve(value);
const resolveInputPath = (root, value) => {
  if (path.isAbsolute(value)) return path.resolve(value);
  const fromRoot = path.resolve(root, value);
  return fs.existsSync(fromRoot) || value.replaceAll('\\', '/').startsWith('tools/')
    ? fromRoot
    : path.resolve(process.cwd(), value);
};
const chooseDefault = (root, names) => {
  const existing = names.map(name => path.resolve(root, name)).find(fs.existsSync);
  return existing || path.resolve(root, names[0]);
};

const parseArgs = args => {
  const values = { repoRoot: '', contract: '', closure: '' };
  const positional = [];
  const aliases = new Map([
    ['--repo-root', 'repoRoot'], ['--repo', 'repoRoot'],
    ['--contract', 'contract'], ['--contract-path', 'contract'],
    ['--closure', 'closure'], ['--closure-path', 'closure'],
  ]);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const equalIndex = arg.indexOf('=');
    const option = equalIndex >= 0 ? arg.slice(0, equalIndex) : arg;
    const key = aliases.get(option);
    if (key) {
      const value = equalIndex >= 0 ? arg.slice(equalIndex + 1) : args[++index];
      if (!value) throw new Error(`ARGUMENT_VALUE_MISSING:${option}`);
      values[key] = value;
    } else if (arg.startsWith('-')) {
      throw new Error(`ARGUMENT_UNKNOWN:${arg}`);
    } else {
      positional.push(arg);
    }
  }
  if (positional.length > 3) throw new Error('ARGUMENT_TOO_MANY_POSITIONAL_VALUES');
  if (positional[0] && !values.repoRoot) values.repoRoot = positional[0];
  if (positional[1] && !values.contract) values.contract = positional[1];
  if (positional[2] && !values.closure) values.closure = positional[2];
  return values;
};

const pick = (object, names) => {
  if (!object || typeof object !== 'object' || Array.isArray(object)) return undefined;
  for (const name of names) {
    const key = Object.keys(object).find(candidate => normalizeKey(candidate) === normalizeKey(name));
    if (key !== undefined) return object[key];
  }
  return undefined;
};
const walk = (value, visit, location = '$') => {
  visit(value, location);
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, `${location}[${index}]`));
    return;
  }
  Object.entries(value).forEach(([key, child]) => walk(child, visit, `${location}.${key}`));
};
const stringsIn = value => {
  const result = [];
  walk(value, child => {
    if (typeof child === 'string') result.push(child);
  });
  return result;
};
const hasUnresolved = value => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return unresolved.has(normalizeToken(value));
  if (Array.isArray(value)) return value.length === 0 || value.some(hasUnresolved);
  if (typeof value === 'object') {
    const decision = pick(value, ['decision', 'resolution', 'answer', 'selected', 'value']);
    if (decision !== undefined && hasUnresolved(decision)) return true;
    const status = pick(value, ['decisionStatus', 'resolutionStatus', 'status']);
    if (status !== undefined && unresolved.has(normalizeToken(status))) return true;
  }
  return false;
};
const resolvedDecisionCount = value => {
  if (Array.isArray(value)) return value.reduce((count, item) => count + resolvedDecisionCount(item), 0);
  if (!value || typeof value !== 'object') return hasUnresolved(value) ? 0 : 1;
  const decision = pick(value, ['decision', 'resolution', 'answer', 'selected', 'value']);
  if (decision !== undefined) return hasUnresolved(decision) ? 0 : 1;
  const status = pick(value, ['decisionStatus', 'resolutionStatus', 'status']);
  if (status !== undefined) return hasUnresolved(status) ? 0 : 1;
  return Object.values(value).reduce((count, item) => count + resolvedDecisionCount(item), 0);
};

const decisionCheck = contract => {
  if (!contract || typeof contract !== 'object' || Array.isArray(contract)) throw new Error('CONTRACT_NOT_OBJECT');
  if (contract.schemaVersion !== 'ExecutionContractV31') throw new Error('CONTRACT_SCHEMA_VERSION_INVALID');
  const declaredHead = pick(contract, ['expectedHead'])
    || pick(contract.repository, ['expectedHead', 'head'])
    || pick(contract.baseline, ['expectedHead', 'head']);
  if (String(declaredHead || '').toLowerCase() !== EXPECTED_HEAD) throw new Error('CONTRACT_EXPECTED_HEAD_INVALID');
  const required = pick(contract, ['requiredDecisions', 'requiredDecisionSet']);
  if (required === undefined) throw new Error('CONTRACT_REQUIRED_DECISIONS_MISSING');
  if (hasUnresolved(required)) throw new Error('CONTRACT_REQUIRED_DECISION_UNRESOLVED');
  const count = resolvedDecisionCount(required);
  if (!count) throw new Error('CONTRACT_REQUIRED_DECISIONS_EMPTY');
  return {
    schemaVersion: contract.schemaVersion,
    declaredHead,
    requiredDecisionCount: count,
  };
};

const hashEntries = value => {
  if (Array.isArray(value)) {
    return value.map(item => ({
      path: pick(item, ['path', 'file', 'filePath', 'source']),
      hash: pick(item, ['sha256', 'hash', 'sourceHash']),
    }));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).map(([source, raw]) => ({
    path: source,
    hash: typeof raw === 'string' ? raw : pick(raw, ['sha256', 'hash', 'sourceHash']),
  }));
};
const closureCheck = (root, closure) => {
  if (!closure || typeof closure !== 'object' || Array.isArray(closure)) throw new Error('CLOSURE_NOT_OBJECT');
  if (!/^M0ClosureBundle(?:V[0-9]+)?$/u.test(String(closure.schemaVersion || ''))) {
    throw new Error('CLOSURE_SCHEMA_VERSION_INVALID');
  }
  const entries = hashEntries(pick(closure, ['sourceHashes']));
  if (!entries.length) throw new Error('CLOSURE_SOURCE_HASHES_MISSING');
  const mismatches = [];
  const missing = [];
  for (const entry of entries) {
    const source = String(entry.path || '').replaceAll('\\', '/');
    const declared = String(entry.hash || '').toLowerCase();
    if (!source || !/^[a-f0-9]{64}$/u.test(declared)) {
      mismatches.push({ path: source, reason: 'HASH_FORMAT_INVALID' });
      continue;
    }
    const sourcePath = resolveInputPath(root, source);
    if (!inside(root, sourcePath)) {
      mismatches.push({ path: source, reason: 'SOURCE_OUTSIDE_REPO' });
      continue;
    }
    if (!fs.existsSync(sourcePath)) {
      missing.push(source);
      continue;
    }
    const actual = sha256(fs.readFileSync(sourcePath));
    if (actual !== declared) mismatches.push({ path: source, expected: declared, actual });
  }
  if (missing.length || mismatches.length) throw new Error(`CLOSURE_SOURCE_HASH_MISMATCH:${JSON.stringify({ missing, mismatches })}`);
  const declaredHead = pick(closure, ['expectedHead'])
    || pick(closure.repository, ['expectedHead', 'head'])
    || pick(closure.baseline, ['expectedHead', 'head']);
  if (declaredHead !== undefined && String(declaredHead).toLowerCase() !== EXPECTED_HEAD) {
    throw new Error('CLOSURE_EXPECTED_HEAD_INVALID');
  }
  return {
    schemaVersion: closure.schemaVersion,
    sourceHashCount: entries.length,
    sourceHashes: Object.fromEntries(entries.map(entry => [String(entry.path).replaceAll('\\', '/'), String(entry.hash).toLowerCase()])),
  };
};

const dispositionSections = new Set([
  'dirtypathdisposition', 'dirtypathdispositions', 'worktreedisposition',
  'worktreedispositions', 'currentdirtypathdisposition', 'currentdirtypathdispositions',
  'pathdisposition', 'pathdispositions', 'dirtyinventory', 'worktreeinventory',
  'currentdirtyinventory', 'currentdirtypathinventory', 'dirtypaths', 'currentdirtypaths',
]);
const pathFields = ['path', 'file', 'filePath', 'relativePath', 'pattern'];
const dispositionFields = ['disposition', 'handling', 'action', 'classification', 'decision'];
const pathLike = value => typeof value === 'string' && (/[*/?]/u.test(value) || /\.[a-z0-9]+$/iu.test(value) || value.includes('/') || value.includes('\\'));
const dispositionValue = value => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  return pick(value, dispositionFields);
};
const collectDispositions = contract => {
  const entries = [];
  const add = (rawPath, rawDisposition, location) => {
    if (rawPath === undefined || rawDisposition === undefined) return;
    const paths = Array.isArray(rawPath) ? rawPath : [rawPath];
    const disposition = dispositionValue(rawDisposition);
    paths.forEach(value => {
      if (typeof value === 'string' && value.trim()) entries.push({ path: value, disposition, location });
    });
  };
  const parseSection = (value, location) => {
    if (Array.isArray(value)) {
      value.forEach((item, index) => {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          add(pick(item, pathFields), pick(item, dispositionFields), `${location}[${index}]`);
        }
      });
      return;
    }
    if (!value || typeof value !== 'object') return;
    add(pick(value, pathFields), pick(value, dispositionFields), location);
    Object.entries(value).forEach(([key, item]) => {
      if (!pathLike(key)) return;
      add(key, item, `${location}.${key}`);
    });
  };
  walk(contract, (value, location) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const directPath = pick(value, pathFields);
    const directDisposition = pick(value, dispositionFields);
    add(directPath, directDisposition, location);
    Object.entries(value).forEach(([key, child]) => {
      if (dispositionSections.has(normalizeKey(key))) parseSection(child, `${location}.${key}`);
    });
  });
  return entries;
};
const globRegex = pattern => {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*' && pattern[index + 1] === '*') {
      source += '.*';
      index += 1;
    } else if (character === '*') source += '[^/]*';
    else if (character === '?') source += '[^/]';
    else source += character.replace(/[.+^${}()|[\]\\]/gu, '\\$&');
  }
  return new RegExp(`${source}$`, 'u');
};
const dispositionIsUnresolved = value => {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value)) return value.length === 0 || value.some(dispositionIsUnresolved);
  if (typeof value === 'object') return dispositionIsUnresolved(dispositionValue(value));
  return unresolved.has(normalizeToken(value));
};
const parseDirtyPaths = output => {
  const parts = output.split('\0').filter(Boolean);
  const paths = [];
  for (let index = 0; index < parts.length; index += 1) {
    const record = parts[index];
    const status = record.slice(0, 2);
    const value = record.slice(3).replaceAll('\\', '/');
    if (value) paths.push({ path: value, status });
    if (status.includes('R') || status.includes('C')) {
      const original = parts[++index]?.replaceAll('\\', '/');
      if (original) paths.push({ path: original, status: `${status}:ORIGINAL` });
    }
  }
  return paths;
};
const dirtyCheck = (root, contract) => {
  const dirty = parseDirtyPaths(runGit(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']));
  const declarations = collectDispositions(contract).map(entry => ({
    ...entry,
    path: String(entry.path).replaceAll('\\', '/').replace(/^\.\//u, ''),
  }));
  if (!declarations.length) throw new Error('DIRTY_DISPOSITIONS_MISSING');
  const rows = dirty.map(item => {
    const exact = declarations.filter(entry => entry.path === item.path);
    const matches = exact.length ? exact : declarations.filter(entry => globRegex(entry.path).test(item.path));
    const selected = matches[0];
    return {
      path: item.path,
      gitStatus: item.status,
      disposition: selected?.disposition ?? null,
      declaration: selected?.location ?? null,
      resolved: Boolean(selected) && !dispositionIsUnresolved(selected.disposition),
    };
  });
  const undispositioned = rows.filter(row => !row.resolved);
  if (undispositioned.length) throw new Error(`DIRTY_PATHS_UNDISPOSITIONED:${JSON.stringify(undispositioned)}`);
  return {
    dirtyPathCount: dirty.length,
    declarationCount: declarations.length,
    paths: rows,
  };
};

const walkSourceFiles = directory => {
  const files = [];
  const skip = new Set(['evidence', 'artifacts', 'generated', 'node_modules', 'tmp', '_backup', 'backups']);
  const visit = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && /\.(?:mjs|js)$/u.test(entry.name)) files.push(absolute);
    }
  };
  visit(directory);
  return files.sort();
};
const sourceWritesTarget = (source, target) => {
  const writeApis = '(?:writeFileSync|appendFileSync|renameSync|rmSync|mkdirSync|openSync|createWriteStream)';
  if (!new RegExp(`${writeApis}\\s*\\(`, 'u').test(source)) return false;
  if (target === 'events') {
    return /path\.join\([\s\S]{0,240}(?:eventDir|evidence[\\/]events|append\.lock)/u.test(source)
      || /(?:outputPath|temporaryPath)\s*=\s*[^;]*(?:eventDir|evidence[\\/]events)/u.test(source);
  }
  return /path\.join\([\s\S]{0,240}generated[\\/]?['"` ,]+current-task-status/u.test(source)
    || /(?:outputPath|temporaryPath)\s*=\s*[^;]*(?:generated[\\/]?[^;]*current-task-status|current-task-status\.json)/u.test(source)
    || /tools[\\/]rc6[\\/]generated[\\/]current-task-status\.json/u.test(source);
};
const authorityCheck = root => {
  const toolsRoot = path.join(root, 'tools');
  const eventWriter = 'tools/rc6/record-evidence-event.mjs';
  const reducer = 'tools/rc6/reduce-status.mjs';
  const excluded = new Set(['tools/rc6/audit-control-writers.mjs', relativePath(root, scriptPath)]);
  const reports = [];
  for (const filePath of walkSourceFiles(toolsRoot)) {
    const relative = relativePath(root, filePath);
    if (excluded.has(relative)) continue;
    const source = readUtf8(filePath);
    reports.push({
      file: relative,
      writesEventEvidence: sourceWritesTarget(source, 'events'),
      writesReducedStatus: sourceWritesTarget(source, 'status'),
    });
  }
  const eventWriters = reports.filter(row => row.writesEventEvidence).map(row => row.file);
  const stateWriters = reports.filter(row => row.writesReducedStatus).map(row => row.file);
  const eventSourcePath = path.join(root, eventWriter);
  const reducerPath = path.join(root, reducer);
  if (!fs.existsSync(eventSourcePath) || !fs.existsSync(reducerPath)) throw new Error('AUTHORITY_SOURCE_MISSING');
  const eventSource = readUtf8(eventSourcePath);
  const reducerSource = readUtf8(reducerPath);
  if (!sourceWritesTarget(eventSource, 'events')) throw new Error('EVENT_WRITER_NOT_AUTHORITY');
  if (sourceWritesTarget(eventSource, 'status')) throw new Error('EVENT_WRITER_WRITES_REDUCED_STATUS');
  if (!sourceWritesTarget(reducerSource, 'status')) throw new Error('REDUCER_NOT_AUTHORITY');
  if (sourceWritesTarget(reducerSource, 'events')) throw new Error('REDUCER_WRITES_EVENT_EVIDENCE');
  const unauthorizedEventWriters = eventWriters.filter(file => file !== eventWriter);
  const unauthorizedStateWriters = stateWriters.filter(file => file !== reducer);
  if (unauthorizedEventWriters.length || unauthorizedStateWriters.length) {
    throw new Error(`AUTHORITY_SEPARATION_VIOLATION:${JSON.stringify({ unauthorizedEventWriters, unauthorizedStateWriters })}`);
  }
  return {
    eventWriter,
    reducer,
    eventWriters,
    stateWriters,
    scannedSourceCount: reports.length,
  };
};

const providerBoundaryCheck = (contract, closure) => {
  const candidates = [];
  for (const [name, document] of [['contract', contract], ['closure', closure]]) {
    walk(document, (value, location) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return;
      const keys = Object.keys(value).map(normalizeKey);
      const providerShape = keys.some(key => key.includes('provider'))
        && keys.some(key => key.includes('fact') || key.includes('current') || key.includes('boundary') || key.includes('registration'));
      if (!keys.some(key => key.includes('providerboundary')) && !providerShape) return;
      const factKey = Object.keys(value).find(key => /^(?:current|provider|observed|reported)?facts?$/iu.test(normalizeKey(key))
        || /current.*facts|facts.*reported/iu.test(normalizeKey(key)));
      if (factKey === undefined) return;
      const factValue = value[factKey];
      const factCount = Array.isArray(factValue) ? factValue.length : factValue && typeof factValue === 'object' ? Object.keys(factValue).length : 0;
      if (!factCount) return;
      const text = stringsIn(value).map(normalizeToken);
      const preM1 = text.some(item => item.includes('PRE_M1') || item.includes('PREM1'));
      const acceptedFinalState = Object.entries(value).some(([key, child]) => {
        const normalized = normalizeKey(key);
        if (normalized === 'acceptedfinalstate' || normalized === 'finalstate' || normalized === 'accepted') {
          return child === true || ['ACCEPTED', 'FINAL', 'CLOSED', 'FROZEN'].includes(normalizeToken(child));
        }
        return ['status', 'classification', 'acceptance', 'phase', 'state'].includes(normalized)
          && ['ACCEPTED', 'FINAL', 'ACCEPTED_FINAL', 'FINAL_STATE', 'CLOSED', 'FROZEN'].includes(normalizeToken(child));
      });
      candidates.push({ document: name, location, factKey, factCount, preM1, acceptedFinalState });
    });
  }
  if (!candidates.length) throw new Error('PROVIDER_BOUNDARY_FACTS_MISSING');
  const invalid = candidates.filter(candidate => !candidate.preM1 || candidate.acceptedFinalState);
  if (invalid.length) throw new Error(`PROVIDER_BOUNDARY_NOT_PRE_M1:${JSON.stringify(invalid)}`);
  return {
    reportStatus: 'PRE_M1_FACTS',
    acceptedFinalState: false,
    candidates,
  };
};

const eventChainCheck = root => {
  const eventRoot = path.join(root, 'tools', 'rc6', 'evidence', 'events');
  if (!fs.existsSync(eventRoot)) return { eventCount: 0, latestEventHash: null, empty: true };
  const names = fs.readdirSync(eventRoot);
  const invalidNames = names.filter(name => name.endsWith('.json') && !/^\d{6}-[a-f0-9]{64}\.json$/u.test(name));
  if (invalidNames.length) throw new Error(`EVENT_FILE_NAMES_INVALID:${JSON.stringify(invalidNames)}`);
  const files = names.filter(name => /^\d{6}-[a-f0-9]{64}\.json$/u.test(name)).sort();
  let previousHash = null;
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const event = readJson(path.join(eventRoot, file));
    if (event.sequence !== index + 1 || event.previousEventHash !== previousHash) {
      throw new Error(`EVENT_CHAIN_LINK_INVALID:${file}`);
    }
    const { eventHash, ...eventCore } = event;
    const actualHash = sha256(JSON.stringify(eventCore));
    if (eventHash !== actualHash || file !== `${String(event.sequence).padStart(6, '0')}-${eventHash}.json`) {
      throw new Error(`EVENT_HASH_INVALID:${file}`);
    }
    previousHash = eventHash;
  }
  return {
    eventCount: files.length,
    firstEvent: files[0] || null,
    latestEvent: files.at(-1) || null,
    latestEventHash: previousHash,
    empty: files.length === 0,
  };
};

const noOverwriteCheck = () => {
  const source = readUtf8(scriptPath);
  const writeApis = [
    ['write', 'File', 'Sync'], ['append', 'File', 'Sync'], ['rename', 'Sync'],
    ['rm', 'Sync'], ['unlink', 'Sync'], ['mkdir', 'Sync'], ['truncate', 'Sync'],
    ['create', 'Write', 'Stream'],
  ].map(parts => parts.join(''));
  const calls = writeApis.filter(api => new RegExp(`${api}\\s*\\(`, 'u').test(source));
  const mutatingGitCommands = ['add', 'commit', 'reset', 'checkout', 'restore', 'stash', 'clean', 'rm', 'mv'];
  const gitMutations = mutatingGitCommands.filter(command => new RegExp(`['"]${command}(?:['"]|,)`, 'u').test(source));
  if (calls.length || gitMutations.length) throw new Error(`HARNESS_WRITE_OPERATION_PRESENT:${JSON.stringify({ calls, gitMutations })}`);
  return {
    readOnly: true,
    writeCalls: calls,
    mutatingGitCommands: gitMutations,
    fixedEvidenceWriteTargets: [],
  };
};

const run = () => {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(args.repoRoot || defaultRepoRoot);
  const contractPath = args.contract
    ? resolveInputPath(repoRoot, args.contract)
    : chooseDefault(repoRoot, defaultContractNames);
  const closurePath = args.closure
    ? resolveInputPath(repoRoot, args.closure)
    : chooseDefault(repoRoot, defaultClosureNames);
  const checks = {};
  const failures = [];
  const check = (name, fn) => {
    try {
      checks[name] = { status: 'PASSED', ...fn() };
    } catch (error) {
      checks[name] = { status: 'FAILED', error: errorText(error) };
      failures.push({ check: name, error: errorText(error) });
    }
  };

  let actualGitRoot = null;
  let actualHead = null;
  check('repository', () => {
    actualGitRoot = path.resolve(runGit(repoRoot, ['rev-parse', '--show-toplevel']));
    actualHead = runGit(repoRoot, ['rev-parse', 'HEAD']).toLowerCase();
    if (!samePath(actualGitRoot, repoRoot)) throw new Error('LWCS_GIT_ROOT_MISMATCH');
    if (path.basename(actualGitRoot).toLowerCase() !== 'lwcs') throw new Error('LWCS_GIT_ROOT_NOT_LWCS');
    if (actualHead !== EXPECTED_HEAD) throw new Error(`HEAD_MISMATCH:${actualHead}`);
    return { repoRoot: actualGitRoot, head: actualHead, expectedHead: EXPECTED_HEAD };
  });
  check('contractEncodingAndParse', () => {
    if (!fs.existsSync(contractPath)) throw new Error(`CONTRACT_NOT_FOUND:${displayPath(repoRoot, contractPath)}`);
    const text = readUtf8(contractPath);
    if (mojibakePattern.test(text)) throw new Error('CONTRACT_MOJIBAKE');
    const contract = JSON.parse(text);
    checks.__contract = contract;
    return { path: displayPath(repoRoot, contractPath), utf8: true, json: true };
  });
  check('closureEncodingAndParse', () => {
    if (!fs.existsSync(closurePath)) throw new Error(`CLOSURE_NOT_FOUND:${displayPath(repoRoot, closurePath)}`);
    const text = readUtf8(closurePath);
    if (mojibakePattern.test(text)) throw new Error('CLOSURE_MOJIBAKE');
    const closure = JSON.parse(text);
    checks.__closure = closure;
    return { path: displayPath(repoRoot, closurePath), utf8: true, json: true };
  });
  const contract = checks.__contract;
  const closure = checks.__closure;
  delete checks.__contract;
  delete checks.__closure;
  check('executionContractV31', () => decisionCheck(contract));
  check('m0ClosureBundle', () => closureCheck(repoRoot, closure));
  check('dirtyPathDisposition', () => dirtyCheck(repoRoot, contract));
  check('eventChain', () => eventChainCheck(repoRoot));
  check('authoritySeparation', () => authorityCheck(repoRoot));
  check('providerBoundary', () => providerBoundaryCheck(contract, closure));
  check('harnessReadOnly', noOverwriteCheck);

  const result = {
    schemaVersion: 'M0V31PreflightResultV1',
    status: failures.length ? 'FAILED' : 'PASSED',
    verdict: failures.length ? 'M0_V31_PREFLIGHT_FAILED' : 'M0_V31_PREFLIGHT_PASSED',
    expectedHead: EXPECTED_HEAD,
    inputs: {
      repoRoot: repoRoot,
      contractPath: displayPath(repoRoot, contractPath),
      closurePath: displayPath(repoRoot, closurePath),
      actualGitRoot,
      actualHead,
    },
    checks,
    failures,
    unresolvedQuestions: failures.map(item => `${item.check}:${item.error}`),
  };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = failures.length ? 1 : 0;
};

try {
  run();
} catch (error) {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 'M0V31PreflightResultV1',
    status: 'FAILED',
    verdict: 'M0_V31_PREFLIGHT_FAILED',
    failures: [{ check: 'argumentsOrHarness', error: errorText(error) }],
    unresolvedQuestions: [errorText(error)],
  }, null, 2)}\n`);
  process.exitCode = 1;
}
