/* BattleRuntime_Module.js - Battle runtime boundary and shared contracts. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const sharedRegistry = root.__LWCS_SKILL_MECHANISM_REGISTRY__;
  const prototypeRegistry = sharedRegistry?.原型定义;
  if (!prototypeRegistry || typeof prototypeRegistry !== 'object') {
    throw new Error('battle_runtime_shared_prototype_registry_missing');
  }

  const actionKinds = Object.freeze([
    'BASIC_ATTACK', 'DEFEND', 'EVADE', 'COUNTER', 'OBSERVE',
    'GUARD', 'WITHDRAW', 'RELEASE_SKILL', 'USE_ITEM', 'EQUIP',
  ]);
  const actionRoles = Object.freeze(['ACTIVE', 'REACTION', 'COUNTER', 'ASSIST', 'STATE_TICK']);
  const reportBlockTypes = Object.freeze([
    'ACTION_DECLARED', 'ACTION_RESOLVED', 'REACTION_RESOLVED', 'STATE_TICK',
    'SUMMON_ACTION', 'RESOURCE_CHANGE', 'ROUND_SUMMARY', 'FINAL_SUMMARY',
  ]);
  const prototypeManifest = Object.freeze(
    Object.values(prototypeRegistry)
      .filter(definition => String(definition?.类别 || '').trim() !== '战斗外')
      .map(definition => Object.freeze({
        name: String(definition?.原型 || '').trim(),
        runtimeScope: 'BATTLE',
        fields: Object.freeze([...(definition?.允许字段 || [])]),
        requiredFields: Object.freeze([...(definition?.必填字段 || [])]),
        fieldOptions: Object.freeze(Object.fromEntries(
          Object.entries(definition?.字段定义 || {})
            .filter(([, field]) => Array.isArray(field?.选项))
            .map(([fieldName, field]) => [fieldName, Object.freeze([...field.选项])]),
        )),
      }))
      .filter(entry => entry.name),
  );
  const prototypeOptionMatrix = Object.freeze(
    prototypeManifest.flatMap(entry => Object.entries(entry.fieldOptions).flatMap(([field, options]) =>
      options
        .filter(option => field !== '原型' || option === entry.name)
        .map(option => Object.freeze({
        prototype: entry.name,
        field,
        option,
        optionKey: `${entry.name}:${field}:${String(option)}`,
        })),
    )),
  );
  const nestedEffectFields = Object.freeze([...(sharedRegistry?.嵌套效果数组字段 || [])]);
  const conditionalEffectFields = Object.freeze([...(sharedRegistry?.条件分支效果数组字段 || [])]);
  const engineState = { implementation: null };

  function cloneValue(value) {
    if (typeof structuredClone === 'function') return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function findFirstDifference(before, after, path = '$') {
    if (Object.is(before, after)) return '';
    if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return path;
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(before, key) || !Object.prototype.hasOwnProperty.call(after, key)) return `${path}.${key}`;
      const difference = findFirstDifference(before[key], after[key], `${path}.${key}`);
      if (difference) return difference;
    }
    return path;
  }

  function assertEffectList(effectList, path = '_效果数组') {
    if (!Array.isArray(effectList)) throw new TypeError(`battle_effect_list_invalid:${path}`);
    effectList.forEach((effect, index) => {
      const effectPath = `${path}[${index}]`;
      if (!effect || typeof effect !== 'object' || Array.isArray(effect)) {
        throw new TypeError(`battle_effect_invalid:${effectPath}`);
      }
      const prototype = String(effect.原型 || '').trim();
      if (!prototype) {
        const creationEffects = Array.isArray(effect.使用效果) ? effect.使用效果 : [];
        if (!creationEffects.length) throw new Error(`battle_effect_prototype_missing:${effectPath}`);
        assertEffectList(creationEffects, `${effectPath}.使用效果`);
        return;
      }
      const definition = prototypeRegistry[prototype];
      if (!definition) throw new Error(`battle_effect_prototype_unknown:${effectPath}:${prototype}`);
      (definition.必填字段 || []).forEach(field => {
        const value = effect[field];
        if (value === undefined || value === null || (typeof value === 'string' && !value.trim()) || (Array.isArray(value) && !value.length)) {
          throw new Error(`battle_effect_required_field_missing:${effectPath}:${field}`);
        }
      });
      Object.entries(definition.字段定义 || {}).forEach(([field, fieldDefinition]) => {
        const options = Array.isArray(fieldDefinition?.选项) ? fieldDefinition.选项 : [];
        if (!options.length || effect[field] === undefined || effect[field] === null) return;
        const values = Array.isArray(effect[field]) ? effect[field] : [effect[field]];
        values.forEach(value => {
          if (!options.includes(String(value).trim())) {
            throw new Error(`battle_effect_enum_unknown:${effectPath}:${field}:${String(value)}`);
          }
        });
      });
      nestedEffectFields.forEach(field => {
        if (effect[field] !== undefined) assertEffectList(effect[field], `${effectPath}.${field}`);
      });
      (Array.isArray(effect.条件分支) ? effect.条件分支 : []).forEach((branch, branchIndex) => {
        conditionalEffectFields.forEach(field => {
          if (branch?.[field] !== undefined) assertEffectList(branch[field], `${effectPath}.条件分支[${branchIndex}].${field}`);
        });
      });
    });
    return true;
  }

  function assertSkillEffects(skill = {}) {
    const effects = Array.isArray(skill?._效果数组) ? skill._效果数组 : [];
    return assertEffectList(effects, '_效果数组');
  }

  function bindEngine(implementation) {
    if (
      !implementation ||
      typeof implementation.runBattleCase !== 'function' ||
      typeof implementation.auditFacts !== 'function' ||
      typeof implementation.previewSkill !== 'function' ||
      typeof implementation.auditPrototypeCoverage !== 'function'
    ) {
      throw new TypeError('battle_runtime_engine_contract_invalid');
    }
    engineState.implementation = implementation;
  }

  function requireEngine() {
    if (!engineState.implementation) throw new Error('battle_runtime_engine_not_bound');
    return engineState.implementation;
  }

  function runBattleCase(options = {}) {
    const input = options && typeof options === 'object' ? cloneValue(options) : {};
    return requireEngine().runBattleCase(input);
  }

  function auditFacts(payload = {}) {
    const input = payload && typeof payload === 'object' ? cloneValue(payload) : {};
    return requireEngine().auditFacts(input);
  }

  function previewSkill(payload = {}) {
    const input = payload && typeof payload === 'object' ? cloneValue(payload) : {};
    if (!input.skill || typeof input.skill !== 'object') throw new TypeError('battle_preview_skill_missing');
    assertSkillEffects(input.skill);
    const before = cloneValue(input);
    const result = requireEngine().previewSkill(input);
    if (JSON.stringify(input) !== JSON.stringify(before)) {
      throw new Error(`battle_preview_mutated_input:${findFirstDifference(before, input)}`);
    }
    if (!result || typeof result !== 'object' || !Array.isArray(result.contributions)) {
      throw new TypeError('battle_preview_result_invalid');
    }
    const valueKeys = result.contributions.map(item => String(item?.valueKey || '').trim()).filter(Boolean);
    if (valueKeys.length !== result.contributions.length || new Set(valueKeys).size !== valueKeys.length) {
      throw new Error('battle_preview_value_key_invalid');
    }
    return cloneValue(result);
  }

  function auditPrototypeCoverage() {
    const result = requireEngine().auditPrototypeCoverage({
      prototypeManifest: cloneValue(prototypeManifest),
      prototypeOptionMatrix: cloneValue(prototypeOptionMatrix),
    });
    const rows = Array.isArray(result?.prototypes) ? result.prototypes : [];
    const expected = new Set(prototypeManifest.map(entry => entry.name));
    const actual = new Set(rows.map(row => String(row?.prototype || '').trim()).filter(Boolean));
    const missing = [...expected].filter(name => !actual.has(name));
    const unknown = [...actual].filter(name => !expected.has(name));
    if (missing.length || unknown.length) {
      throw new Error(`battle_prototype_coverage_mismatch:missing=${missing.join(',')}:unknown=${unknown.join(',')}`);
    }
    const requiredStages = ['legality', 'preview', 'scoring', 'settlement', 'ledger', 'report'];
    rows.forEach(row => {
      const incomplete = requiredStages.filter(stage => row?.stages?.[stage] !== true);
      if (incomplete.length) throw new Error(`battle_prototype_stage_missing:${row.prototype}:${incomplete.join(',')}`);
    });
    const coveredOptionKeys = new Set(Array.isArray(result?.coveredOptionKeys) ? result.coveredOptionKeys : []);
    const missingOptionKeys = prototypeOptionMatrix
      .map(entry => entry.optionKey)
      .filter(optionKey => !coveredOptionKeys.has(optionKey));
    if (missingOptionKeys.length) throw new Error(`battle_prototype_option_coverage_missing:${missingOptionKeys.join(',')}`);
    return cloneValue({ ...result, prototypeCount: rows.length, optionCount: coveredOptionKeys.size });
  }

  const api = Object.freeze({
    version: '7.3-R5',
    actionKinds,
    actionRoles,
    reportBlockTypes,
    prototypeRegistry,
    prototypeManifest,
    prototypeOptionMatrix,
    cloneValue,
    assertEffectList,
    assertSkillEffects,
    bindEngine,
    runBattleCase,
    auditFacts,
    previewSkill,
    auditPrototypeCoverage,
  });

  root.__LWCS_BATTLE_RUNTIME__ = api;
  root.__LWCS_BATTLE_RUNTIME_REGISTRY_SOURCE__ = 'shared';
  root.__LWCS_BATTLE_RUNTIME_REGISTRY_SIZE__ = prototypeManifest.length;
})();
