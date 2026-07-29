import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './r83_rc6_battle_harness.mjs';

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolDir, '..');

const exactRules = Object.freeze({
  'BattleReport_Module.js': ['REPORT_PROJECTION', 'REPORT_AUDIT'],
  'BattleUI_Module.js': ['REPORT_UI_RENDER'],
  'mvu_logic_bridge.js': ['FORMAL_TRANSACTION', 'AI_STRUCTURED_SUMMARY'],
  'BattleDecision_Module.js': [
    'DECISION_REPLAY',
    'BEHAVIOR_ORACLE',
    'AFFECTED_FULL_BATTLES',
  ],
  'BattlePreview_Module.js': [
    'PREVIEW_ORACLE',
    'DECISION_REPLAY',
    'AFFECTED_FULL_BATTLES',
    'FULL_CHAIN_HASH',
  ],
  'BattleRuntime_Module.js': [
    'RUNTIME_ORACLE',
    'DECISION_REPLAY',
    'AFFECTED_FULL_BATTLES',
    'FULL_CHAIN_HASH',
  ],
});

export function classifyChangeImpact(paths, diffText = '') {
  const normalizedPaths = [...new Set(paths.map(value =>
    String(value || '').replaceAll('\\', '/').trim()
  ).filter(Boolean))].sort();
  const scopes = new Set();
  const classified = [];
  const unknownPaths = [];
  normalizedPaths.forEach(relativePath => {
    let pathScopes = exactRules[relativePath];
    if (!pathScopes && /^tools\/.*oracle.*\.mjs$/iu.test(relativePath)) {
      pathScopes = ['BEHAVIOR_ORACLE', 'ORACLE_TOOL_SELF_TEST'];
    }
    if (!pathScopes && /^tools\/.*report.*\.mjs$/iu.test(relativePath)) {
      pathScopes = ['REPORT_PROJECTION', 'REPORT_AUDIT'];
    }
    if (!pathScopes && /^tools\/.*replay.*\.mjs$/iu.test(relativePath)) {
      pathScopes = ['DECISION_REPLAY'];
    }
    if (
      !pathScopes &&
      /^tools\/(?:build_|audit_)?r83_rc6_.*\.mjs$/u.test(relativePath)
    ) {
      pathScopes = ['AUDIT_TOOL_SELF_TEST'];
    }
    if (!pathScopes && /^tools\/evidence\//u.test(relativePath)) {
      pathScopes = ['EVIDENCE_ARTIFACT_ONLY'];
    }
    if (!pathScopes) {
      unknownPaths.push(relativePath);
      return;
    }
    pathScopes.forEach(scope => scopes.add(scope));
    classified.push({ path: relativePath, scopes: pathScopes });
  });
  const probabilityOrTerminalChanged =
    /probability|概率|terminal|终局|FIRST_TERMINAL/iu.test(diffText);
  if (probabilityOrTerminalChanged) {
    [
      'PROBABILITY_GATES',
      'DETERMINISM_GATES',
      'AFFECTED_FULL_BATTLES',
      'FULL_CHAIN_HASH',
    ].forEach(scope => scopes.add(scope));
  }
  if (unknownPaths.length) scopes.add('FULL_REGRESSION');
  return {
    schemaVersion: 'ChangeImpactManifestV1',
    changedPaths: normalizedPaths,
    classified,
    unknownPaths,
    requiredScopes: [...scopes].sort(),
    failClosed: unknownPaths.length > 0,
    fatalCodes: unknownPaths.length ? ['CHANGE_IMPACT_UNSCOPED'] : [],
  };
}

function argValue(name, fallback = '') {
  const exactIndex = process.argv.indexOf(`--${name}`);
  if (exactIndex >= 0) return String(process.argv[exactIndex + 1] || '').trim();
  return fallback;
}

function argValues(name) {
  return process.argv.flatMap((value, index) =>
    value === `--${name}`
      ? [String(process.argv[index + 1] || '').trim()]
      : value.startsWith(`--${name}=`)
        ? [value.slice(name.length + 3).trim()]
        : []
  ).filter(Boolean);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = argValue('base', 'HEAD');
  const cached = process.argv.includes('--cached');
  const excludedPaths = new Set(
    argValues('exclude').map(value =>
      value.replaceAll('\\', '/').trim()
    ),
  );
  const outputPath = path.resolve(
    repoRoot,
    argValue(
      'output',
      'tools/evidence/r8/r83_rc6_change_impact_current.json',
    ),
  );
  const allPaths = execFileSync(
    'git',
    [
      '-c',
      'core.quotePath=false',
      'diff',
      ...(cached ? ['--cached'] : []),
      '--name-only',
      base,
      '--',
    ],
    { cwd: repoRoot, encoding: 'utf8', windowsHide: true },
  ).split(/\r?\n/u).filter(Boolean);
  const paths = allPaths.filter(relativePath =>
    !excludedPaths.has(relativePath.replaceAll('\\', '/'))
  );
  const diff = paths.length
    ? execFileSync(
        'git',
        [
          '-c',
          'core.quotePath=false',
          'diff',
          ...(cached ? ['--cached'] : []),
          '--no-ext-diff',
          '--unified=0',
          base,
          '--',
          ...paths,
        ],
        { cwd: repoRoot, encoding: 'utf8', windowsHide: true },
      )
    : '';
  const semanticPaths = paths.filter(relativePath =>
    [
      'BattleDecision_Module.js',
      'BattlePreview_Module.js',
      'BattleRuntime_Module.js',
    ].includes(relativePath)
  );
  const semanticDiff = semanticPaths.length
    ? execFileSync(
        'git',
        [
          '-c',
          'core.quotePath=false',
          'diff',
          ...(cached ? ['--cached'] : []),
          '--no-ext-diff',
          '--unified=0',
          base,
          '--',
          ...semanticPaths,
        ],
        { cwd: repoRoot, encoding: 'utf8', windowsHide: true },
      )
    : '';
  const manifest = {
    ...classifyChangeImpact(paths, semanticDiff),
    base,
    cached,
    excludedPaths: allPaths
      .filter(relativePath =>
        excludedPaths.has(relativePath.replaceAll('\\', '/'))
      )
      .sort(),
    diffHash: sha256(diff),
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}
