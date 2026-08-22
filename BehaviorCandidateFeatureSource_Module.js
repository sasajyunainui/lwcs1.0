(function (root) {
  'use strict';

  var RESOURCES = ['sp', 'men', 'vit', 'hp'];
  var RESOURCE_FIELDS = { sp: 'sp', men: 'men', vit: 'vit', hp: 'hp' };
  var RESOURCE_LABEL_KEYS = { 魂力: 'sp', 精神力: 'men', 体力: 'vit', 生命: 'hp' };
  var TARGET_CODES = { 自身: 'SELF', 单体: 'SINGLE', 群体: 'GROUP', 全场: 'FIELD', 召唤物: 'SUMMON' };
  var CARRIER_CODES = { 直接生效: 'DIRECT', 物品使用: 'ITEM_USE', 造物承载: 'CREATION', 持续生效: 'SUSTAINED', 被动: 'PASSIVE' };
  var PROJECTORS = {
    TEAM_EFFECT: 'BRF_TEAM_EFFECT_V1',
    RESOURCE_SUPPLY: 'BRF_RESOURCE_SUPPLY_V1',
    FOLLOW_UP: 'BRF_EXPLICIT_FOLLOW_UP_V1',
    NOT_RELATIONAL: 'BRF_NOT_RELATIONAL_V1',
  };
  var REGISTRY_HASH = '85016b9198590c5deb6ac4675c4f95dd7fbae164692720a087af6188e4ff6586';
  var REGISTRY_ROWS = [
    ['伤害结算', 'BATTLE', 'NOT_RELATIONAL', ''], ['位移执行', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['修炼增益', 'OUT_OF_BATTLE_SCOPE', 'NOT_RELATIONAL', ''], ['决策干扰', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['判定修正', 'BATTLE', 'TEAM_EFFECT', 'JUDGMENT'], ['召唤生成', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['复制执行', 'BATTLE', 'NOT_RELATIONAL', ''], ['天赋提升', 'OUT_OF_BATTLE_SCOPE', 'NOT_RELATIONAL', ''],
    ['属性修正', 'BATTLE', 'TEAM_EFFECT', 'ATTRIBUTE'], ['战斗外复活', 'OUT_OF_BATTLE_SCOPE', 'NOT_RELATIONAL', ''],
    ['护盾变化', 'BATTLE', 'NOT_RELATIONAL', ''], ['时光回溯', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['时窗修正', 'BATTLE', 'NOT_RELATIONAL', ''], ['机制抹消', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['机制授予', 'BATTLE', 'NOT_RELATIONAL', ''], ['永久属性提升', 'OUT_OF_BATTLE_SCOPE', 'NOT_RELATIONAL', ''],
    ['炸环', 'BATTLE', 'NOT_RELATIONAL', ''], ['状态交换', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['状态施加', 'BATTLE', 'TEAM_EFFECT', 'STATE_APPLY'], ['状态移除', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['状态转移', 'BATTLE', 'NOT_RELATIONAL', ''], ['结算修正', 'BATTLE', 'TEAM_EFFECT', 'SETTLEMENT'],
    ['规则改写', 'BATTLE', 'NOT_RELATIONAL', ''], ['规则防御', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['资源变化', 'BATTLE', 'RESOURCE_SUPPLY', ''], ['资源转移', 'BATTLE', 'NOT_RELATIONAL', ''],
    ['资源锁定', 'BATTLE', 'NOT_RELATIONAL', ''],
  ];
  var REGISTRY = Object.create(null);
  REGISTRY_ROWS.forEach(function (row) {
    REGISTRY[row[0]] = {
      prototypeKind: row[0], scope: row[1], capabilityKind: row[2],
      projectorId: PROJECTORS[row[2]], effectAxis: row[3],
    };
  });

  function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
  function isPlainObject(value) {
    if (!isObject(value)) return false;
    var proto = Object.getPrototypeOf(value);
    return proto === null || (Object.getPrototypeOf(proto) === null &&
      Object.prototype.hasOwnProperty.call(proto, 'constructor') && proto.constructor && proto.constructor.name === 'Object');
  }
  function own(value, key) { return isObject(value) && Object.prototype.hasOwnProperty.call(value, key); }
  function validId(value) {
    return typeof value === 'string' && value.length > 0 && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value);
  }
  function canonicalActionId(candidate) {
    var declaration = candidate && candidate.declaration;
    if (declaration === undefined) return candidate && candidate.candidateId || '';
    if (!isPlainObject(declaration)) fail('SOURCE_ACTION_ID_INVALID', candidate && candidate.candidateId);
    if (!own(declaration, 'actionId')) return candidate && candidate.candidateId || '';
    if (!validId(declaration.actionId)) fail('SOURCE_ACTION_ID_INVALID', candidate && candidate.candidateId);
    return declaration.actionId;
  }
  function canonicalEffectId(effect, rootActionId, index) {
    if (effect === undefined) return rootActionId + ':effect:' + index;
    if (!isPlainObject(effect)) fail('SOURCE_EFFECT_ID_INVALID', rootActionId + ':effect:' + index);
    var hasEffectId = own(effect, 'effectId'), hasChineseId = own(effect, '效果ID');
    var effectId = hasEffectId ? effect.effectId : null;
    var chineseId = hasChineseId ? effect['效果ID'] : null;
    if ((hasEffectId && !validId(effectId)) || (hasChineseId && !validId(chineseId))) {
      fail('SOURCE_EFFECT_ID_INVALID', rootActionId + ':effect:' + index);
    }
    if (hasEffectId && hasChineseId && effectId !== chineseId) {
      fail('SOURCE_EFFECT_ID_CONFLICT', rootActionId + ':effect:' + index);
    }
    return hasEffectId ? effectId : hasChineseId ? chineseId : rootActionId + ':effect:' + index;
  }
  function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
  function uniqueIds(values) {
    var result = [], seen = Object.create(null);
    (Array.isArray(values) ? values : []).forEach(function (value) {
      if (!validId(value) || seen[value]) return;
      seen[value] = true; result.push(value);
    });
    return result.sort();
  }
  function uniqueArrayIsValid(values) {
    if (!Array.isArray(values)) return false;
    var seen = Object.create(null), valid = true;
    values.forEach(function (value) { if (!validId(value) || seen[value]) valid = false; seen[value] = true; });
    return valid;
  }
  function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function sortObjects(values) {
    return values.slice().sort(function (a, b) { return compare(JSON.stringify(a), JSON.stringify(b)); });
  }
  function normalizeCosts(costs) {
    var values = {}, complete = isObject(costs);
    if (!complete) return { values: values, complete: false };
    Object.keys(costs).sort().forEach(function (rawKey) {
      var key = canonicalResourceKey(rawKey), amount = finite(costs[rawKey]);
      if (!key || amount === null || amount <= 0 || own(values, key)) { complete = false; return; }
      values[key] = amount;
    });
    return { values: values, complete: complete };
  }
  function mechanicalTargetModes(skill) {
    var effects = skill && skill._效果数组, raw = [], modes = [];
    if (!Array.isArray(effects)) return null;
    if (own(skill, 'targetMode')) raw.push(skill.targetMode);
    effects.forEach(function (effect) { if (own(effect, '目标')) raw.push(effect['目标']); });
    raw.forEach(function (value) {
      var mode = TARGET_CODES[value] || (['SELF', 'SINGLE', 'GROUP', 'FIELD', 'SUMMON'].indexOf(value) >= 0 ? value : '');
      if (!mode) modes = null; else if (modes && modes.indexOf(mode) < 0) modes.push(mode);
    });
    return modes && modes.length ? modes.sort() : null;
  }
  function mechanicalPrototypeKinds(skill) {
    var effects = skill && skill._效果数组, kinds = [], seen = Object.create(null);
    if (!Array.isArray(effects)) return null;
    effects.forEach(function (effect) {
      var kind = effect && effect['原型'];
      if (!isObject(effect) || !validId(kind)) { kinds = null; return; }
      if (kinds && !seen[kind]) { seen[kind] = true; kinds.push(kind); }
    });
    return kinds && kinds.sort();
  }
  function mechanicalFingerprint(skill, costs, previewApi) {
    var normalized = normalizeCosts(costs), prototypeKinds = mechanicalPrototypeKinds(skill);
    var targetModes = mechanicalTargetModes(skill), carrier = skill && CARRIER_CODES[skill['承载方式']];
    if (!normalized.complete || !prototypeKinds || !targetModes || !carrier) return '';
    var payload = {
      actionKind: 'RELEASE_SKILL', resourceCosts: normalized.values,
      prototypeKinds: prototypeKinds, targetModes: targetModes, carrierMode: carrier,
    };
    var hash = '';
    try { hash = previewApi.stableHash(payload); } catch (error) { return ''; }
    return validId(hash) ? 'public-action:' + hash : '';
  }
  function fail(code, detail) { throw new Error(code + (detail ? ':' + detail : '')); }
  function requireFunction(value, name) { if (typeof value !== 'function') fail('SOURCE_API_REQUIRED', name); }
  function requireFormalApi(value, formal, name) {
    if (!isObject(formal) || value !== formal) fail('SOURCE_FORMAL_API_REQUIRED', name);
  }
  function freeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.keys(value).forEach(function (key) { freeze(value[key]); });
    return Object.freeze(value);
  }
  function addIds(set, values) {
    (Array.isArray(values) ? values : []).forEach(function (value) {
      if (validId(value)) set.add(value);
    });
  }
  function addVerified(set, value) {
    if (validId(value)) set.add(value);
  }
  function addVerifiedArray(set, value) {
    if (Array.isArray(value)) value.forEach(function (item) { addVerified(set, item); });
  }
  function linkVerified(verified, values, ownerId, actionId) {
    (Array.isArray(values) ? values : []).forEach(function (value) {
      if (!validId(value)) return;
      var link = verified.links[value] || { owners: new Set(), actions: new Set() };
      if (validId(ownerId)) link.owners.add(ownerId);
      if (validId(actionId)) link.actions.add(actionId);
      verified.links[value] = link;
    });
  }
  function sourceValues(row, scalarKeys, arrayKeys) {
    var values = [];
    scalarKeys.forEach(function (key) { if (own(row, key)) values.push(row[key]); });
    arrayKeys.forEach(function (key) {
      if (own(row, key)) values = values.concat(Array.isArray(row[key]) ? row[key] : [row[key]]);
    });
    return values;
  }
  function pdaRefs(row, verified) {
    return refs({
      sourceFactIds: sourceValues(row, ['sourceEffectId'], ['sourceFactIds']),
      sourceEventIds: sourceValues(row, ['sourceActionId', 'entryId'], ['sourceEventIds']),
    }, verified);
  }
  function previewRefs(row, verified) {
    return refs({
      sourceFactIds: sourceValues(row, ['semanticKey', 'effectInstanceId', 'rootCauseId'], ['sourceFactIds']),
      sourceEventIds: sourceValues(row, ['sourceActionId'], ['sourceEventIds']),
    }, verified);
  }
  function refs(value, verified) {
    var facts = [], events = [], ok = true;
    var seenFacts = Object.create(null), seenEvents = Object.create(null);
    function read(key, target, known) {
      if (!own(value, key)) return;
      if (!Array.isArray(value[key])) { ok = false; return; }
      value[key].forEach(function (item) {
        var seen = target === facts ? seenFacts : seenEvents;
        var invalid = !validId(item) || !known.has(item) || seen[item];
        seen[item] = true;
        if (invalid) ok = false;
        else target.push(item);
      });
    }
    read('sourceFactIds', facts, verified.facts); read('sourceEventIds', events, verified.events);
    facts = uniqueIds(facts); events = uniqueIds(events);
    if (facts.length + events.length === 0) ok = false;
    return { facts: facts, events: events, ok: ok };
  }
  function indexRefs(closure, pair) {
    addIds(closure.facts, pair.facts); addIds(closure.events, pair.events);
  }
  function isFollowUpRow(row) { return isObject(row) && row.grantType === 'FOLLOW_UP'; }
  function grantFields(row, visibleUnitIndex) {
    var ownerId = validId(row && row.ownerId) ? row.ownerId : '';
    var followUpKey = validId(row && row.followUpKey) ? row.followUpKey : '';
    var entryId = validId(row && row.entryId) ? row.entryId : '';
    var ownerVisible = !!visibleUnitIndex
      && Object.prototype.hasOwnProperty.call(visibleUnitIndex, ownerId);
    var rowProofsValid = !own(row, 'grantProofIds')
      || (uniqueArrayIsValid(row.grantProofIds)
        && JSON.stringify(uniqueIds(row.grantProofIds)) === JSON.stringify([entryId]));
    if (!ownerId || !ownerVisible || !followUpKey || !entryId || !rowProofsValid) return null;
    return { ownerId: ownerId, followUpKey: followUpKey, entryId: entryId, proofs: [entryId] };
  }
  function grantAdmission(row, verified, visibleUnitIndex) {
    var admission = grantFields(row, visibleUnitIndex), pair = pdaRefs(row, verified);
    var entryInPair = admission && (pair.events.indexOf(admission.entryId) >= 0 || pair.facts.indexOf(admission.entryId) >= 0);
    if (!admission || !verified.authenticated.has(admission.entryId) || !entryInPair) return null;
    return admission;
  }
  function authenticatePdaRow(verified, row) {
    addIds(verified.authenticated, sourceValues(row,
      ['sourceEffectId'], ['sourceFactIds', 'sourceEventIds', 'sourceActionIds']));
    addIds(verified.authenticated, sourceValues(row,
      ['sourceActionId', 'entryId'], []));
  }
  function authenticatePreviewRow(verified, row) {
    addIds(verified.authenticated, sourceValues(row,
      ['semanticKey', 'effectInstanceId', 'rootCauseId'], ['sourceFactIds', 'sourceEventIds']));
    addIds(verified.authenticated, sourceValues(row, ['sourceActionId'], []));
  }
  function indexPdaRow(verified, row, grantReady) {
    if (isFollowUpRow(row) && grantReady !== true) return false;
    var factIds = sourceValues(row, ['sourceEffectId'], ['sourceFactIds']);
    var eventIds = sourceValues(row, ['sourceActionId', 'entryId'], ['sourceEventIds']);
    addVerifiedArray(verified.facts, factIds); addVerifiedArray(verified.events, eventIds);
    linkVerified(verified, factIds.concat(eventIds), row && (row.sourceActorId || row.ownerId), row && row.sourceActionId);
    if (Array.isArray(row && row.payloadDirectFacts)) row.payloadDirectFacts.forEach(function (fact) {
      indexPdaRow(verified, fact, false);
    });
    return true;
  }
  function indexPreviewRow(verified, row, grantReady) {
    if (isFollowUpRow(row) && grantReady !== true) return false;
    var factIds = sourceValues(row, ['semanticKey', 'effectInstanceId', 'rootCauseId'], ['sourceFactIds']);
    var eventIds = sourceValues(row, ['sourceActionId'], ['sourceEventIds']);
    addVerifiedArray(verified.facts, factIds); addVerifiedArray(verified.events, eventIds);
    linkVerified(verified, factIds.concat(eventIds), row && row.sourceActorId, row && row.sourceActionId);
    return true;
  }
  function targetIds(fact) {
    return uniqueArrayIsValid(fact && fact.targetIds) ? uniqueIds(fact.targetIds) : [];
  }
  function durationBand(fact) {
    var turns = finite(fact && fact.durationTurns);
    if (turns === null || !Number.isInteger(turns) || turns < 0) return '';
    return turns === 0 ? 'INSTANT' : turns === 1 ? 'SHORT' : turns <= 3 ? 'MEDIUM' : 'LONG';
  }
  function typedEffectKey(fact) {
    var amount = finite(fact && fact.amount);
    var direction = amount === null ? '' : amount > 0 ? 'POSITIVE' : amount < 0 ? 'NEGATIVE' : 'NEUTRAL';
    if (!validId(fact && fact.factType) || !validId(fact && fact.key) || !validId(fact && fact.unit) || !direction) return '';
    return JSON.stringify([fact.factType, fact.key, fact.unit, direction]);
  }
  function entryKey(entry) {
    return entry.capabilityKind === 'TEAM_EFFECT'
      ? JSON.stringify([entry.targetId, entry.effectAxis, entry.effectKey, entry.timeBand])
      : entry.capabilityKind === 'RESOURCE_SUPPLY'
        ? JSON.stringify([entry.targetId, entry.resourceKey, entry.timeBand])
        : JSON.stringify([entry.ownerId, entry.followUpKey]);
  }
  function addEntry(entries, identities, entry) {
    var key = entryKey(entry);
    if (identities[key]) {
      var existing = identities[key];
      if (existing.capabilityKind !== entry.capabilityKind || existing.ownerId !== entry.ownerId) return false;
      if (entry.capabilityKind === 'TEAM_EFFECT' && existing.durationBand !== entry.durationBand) return false;
      if (entry.capabilityKind === 'RESOURCE_SUPPLY') {
        if (existing.publicMaxAmount !== entry.publicMaxAmount) return false;
        existing.supplyAmount += entry.supplyAmount;
      }
      existing.sourceFactIds = uniqueIds(existing.sourceFactIds.concat(entry.sourceFactIds));
      existing.sourceEventIds = uniqueIds(existing.sourceEventIds.concat(entry.sourceEventIds));
      return true;
    }
    identities[key] = entry; entries.push(entry); return true;
  }
  function verifyRegistryAuthority() {
    var keys = REGISTRY_ROWS.map(function (row) { return row[0]; });
    if (REGISTRY_ROWS.length !== 27 || new Set(keys).size !== 27 || REGISTRY_HASH.length !== 64) fail('SOURCE_REGISTRY_AUTHORITY_FATAL');
    var battleCount = 0;
    REGISTRY_ROWS.forEach(function (row) {
      var expected = REGISTRY[row[0]];
      if (!expected || expected.prototypeKind !== row[0] || expected.scope !== row[1]
        || expected.capabilityKind !== row[2] || expected.projectorId !== PROJECTORS[row[2]]
        || expected.effectAxis !== row[3]) fail('SOURCE_REGISTRY_AUTHORITY_FATAL', row[0]);
      if (row[1] === 'BATTLE') battleCount += 1;
    });
    if (battleCount !== 23) fail('SOURCE_REGISTRY_AUTHORITY_FATAL');
  }
  function registryAttestation(pdaApi) {
    verifyRegistryAuthority();
    var actual = pdaApi.registry();
    var actualRows = actual && actual.registry;
    if (!isObject(actualRows)) fail('SOURCE_REGISTRY_ATTESTATION_MISMATCH');
    var expectedKeys = REGISTRY_ROWS.map(function (row) { return row[0]; }).sort();
    var actualKeys = Object.keys(actualRows).sort();
    if (JSON.stringify(expectedKeys) !== JSON.stringify(actualKeys)) fail('SOURCE_REGISTRY_ATTESTATION_MISMATCH');
    var actualBattleCount = 0;
    REGISTRY_ROWS.forEach(function (row) {
      var actualRow = actualRows[row[0]] || {}, expected = REGISTRY[row[0]];
      var scope = own(actualRow, 'scope') ? actualRow.scope : actualRow.category === '战斗外' ? 'OUT_OF_BATTLE_SCOPE' : actualRow.category ? 'BATTLE' : '';
      if (scope !== expected.scope) fail('SOURCE_REGISTRY_SCOPE_MISMATCH', row[0]);
      if (scope === 'BATTLE') actualBattleCount += 1;
    });
    if (actualBattleCount !== 23) fail('SOURCE_REGISTRY_BATTLE_COVERAGE_MISMATCH');
    return {
      registryVersion: 'BehaviorRelationalProjectorRegistryV1',
      registryHash: REGISTRY_HASH,
      mappedCount: 27, battleScopeCount: 23, exactMapping: true,
      projectorIds: [PROJECTORS.FOLLOW_UP, PROJECTORS.NOT_RELATIONAL, PROJECTORS.RESOURCE_SUPPLY, PROJECTORS.TEAM_EFFECT].sort(),
    };
  }
  function visibleUnits(request, verified, closure, candidateIds) {
    var world = request.visibleWorld, participants = world && world.参战者;
    var entries = [], byId = Object.create(null), complete = true;
    if (!isObject(participants)) return { entries: entries, byId: byId, complete: false };
    Object.keys(participants).sort().forEach(function (side) {
      var list = participants[side];
      if (!Array.isArray(list)) { complete = false; return; }
      list.forEach(function (unit, index) {
        var unitId = unit && unit.id;
        if (!validId(unitId)) { complete = false; return; }
        if ((candidateIds && candidateIds.has(unitId)) || byId[unitId]) { complete = false; return; }
        addVerified(verified.facts, unitId); closure.facts.add(unitId);
        byId[unitId] = unit;
        entries.push({
          id: unitId, side: side, unit: unit,
          path: 'request.visibleWorld.参战者.' + side + '[' + index + ']',
        });
      });
    });
    entries.sort(function (a, b) { return compare(a.id, b.id) || compare(a.side, b.side); });
    return { entries: entries, byId: byId, complete: complete };
  }
  function initializeClosure(request, verified, closure) {
    var context = request && request.evaluationContext;
    var requestHash = request && request.requestHash;
    var opportunityId = request && request.actionOpportunity && request.actionOpportunity.opportunityId;
    var visibleRevision = context && context.visibleWorldRevision;
    var scheduleRevision = context && context.scheduleRevision;
    if ((!validId(requestHash) && !validId(opportunityId)) || !validId(visibleRevision) || !validId(scheduleRevision)) {
      fail('SOURCE_CLOSURE_ROOT_REQUIRED');
    }
    if (validId(requestHash)) { addVerified(verified.events, requestHash); closure.events.add(requestHash); }
    if (validId(opportunityId)) { addVerified(verified.events, opportunityId); closure.events.add(opportunityId); }
    addVerified(verified.facts, visibleRevision); addVerified(verified.events, scheduleRevision);
    closure.facts.add(visibleRevision); closure.events.add(scheduleRevision);
  }
  function typedFactRows(value) {
    if (Array.isArray(value)) return value;
    if (!isObject(value)) return null;
    if (Array.isArray(value.directFacts)) return value.directFacts;
    if (Array.isArray(value.typedFacts)) return value.typedFacts;
    return null;
  }
  function scanTypedBaseline(value, scheduled, verified, closure, entries, identities, visibleUnitIndex) {
    var rows = typedFactRows(value), complete = rows !== null;
    if (!rows) return { complete: false };
    rows.forEach(function (fact) {
      var prototypeKind = validId(fact && fact.prototypeKind) ? fact.prototypeKind : '';
      var registry = REGISTRY[prototypeKind];
      if (!registry) { complete = false; return; }
      if (!indexPdaRow(verified, fact, false)) { complete = false; return; }
      var pair = pdaRefs(fact, verified);
      indexRefs(closure, pair);
      if (!pair.ok) { complete = false; return; }
      authenticatePdaRow(verified, fact);
      if (registry.capabilityKind !== 'TEAM_EFFECT') return;
      var made = teamEntries(registry, fact, scheduled, fact && fact.sourceEffectId, verified, closure, visibleUnitIndex);
      if (!made.complete) complete = false;
      made.entries.forEach(function (entry) { if (!addEntry(entries, identities, entry)) complete = false; });
    });
    return { complete: complete };
  }
  function scanBaseline(request, verified, closure, unitData) {
    var entries = [], identities = Object.create(null), complete = unitData.complete, gaps = [];
    unitData.entries.forEach(function (entry) {
      ['状态效果', '持续效果'].forEach(function (field) {
        var value = entry.unit && entry.unit[field];
        var path = entry.path + '.' + field;
        if (!own(entry.unit, field)) {
          complete = false; gaps.push({ unitId: entry.id, path: path }); return;
        }
        if (!isObject(value)) {
          complete = false; gaps.push({ unitId: entry.id, path: path }); return;
        }
        if (Object.keys(value).length === 0) return;
        var result = scanTypedBaseline(value, false, verified, closure, entries, identities, unitData.byId);
        if (!result.complete) {
          complete = false; gaps.push({ unitId: entry.id, path: path });
        }
      });
    });
    var context = request.evaluationContext || {};
    if (!own(context, 'scheduledEvents') || !Array.isArray(context.scheduledEvents)) {
      complete = false;
    }
    else context.scheduledEvents.forEach(function (event) {
      if (!isObject(event)) { complete = false; gaps.push({ path: 'request.evaluationContext.scheduledEvents' }); return; }
      var eventIds = sourceValues(event, ['eventId', 'sourceEventId', 'entryId'], ['sourceEventIds']);
      addVerifiedArray(verified.events, eventIds);
      var eventRefs = refs({
        sourceEventIds: eventIds,
      }, verified);
      indexRefs(closure, eventRefs);
      var result = scanTypedBaseline(event.scheduledFacts || event.typedFacts || event.directFacts, true, verified, closure, entries, identities, unitData.byId);
      if (!eventRefs.ok || !result.complete) {
        complete = false; gaps.push({ path: 'request.evaluationContext.scheduledEvents' });
      }
    });
    return { entries: sortObjects(entries), complete: complete, gaps: gaps };
  }
  function publicResource(unit, resource) {
    var key = RESOURCE_FIELDS[resource];
    return key && unit ? finite(unit[key]) : null;
  }
  function canonicalResourceKey(value) {
    return RESOURCES.indexOf(value) >= 0 ? value : RESOURCE_LABEL_KEYS[value] || '';
  }
  function contributionResourceKey(item) {
    var evidence = isObject(item && item.evidence) ? item.evidence : null;
    var raw;
    if (own(evidence, 'resourceKey')) return RESOURCES.indexOf(evidence.resourceKey) >= 0 ? evidence.resourceKey : '';
    if (own(item, 'resourceKey')) return RESOURCES.indexOf(item.resourceKey) >= 0 ? item.resourceKey : '';
    if (own(evidence, 'resource')) return RESOURCE_LABEL_KEYS[evidence.resource] || '';
    return '';
  }
  function publicMaxAmount(unit, resource) {
    var field = RESOURCE_FIELDS[resource];
    var maxField = field ? field + '_max' : '';
    return maxField && unit ? finite(unit[maxField]) : null;
  }
  function catalogRefs(request, verified, realActionId) {
    var context = request && request.evaluationContext, factIds = [], eventIds = [];
    var rootEvent = validId(request && request.requestHash) ? request.requestHash
      : request && request.actionOpportunity && request.actionOpportunity.opportunityId;
    if (validId(context && context.visibleWorldRevision)) factIds.push(context.visibleWorldRevision);
    if (validId(rootEvent)) eventIds.push(rootEvent);
    if (validId(realActionId)) eventIds.push(realActionId);
    return refs({ sourceFactIds: factIds, sourceEventIds: eventIds }, verified);
  }
  function scanConsumers(request, decisionApi, previewApi, unitData, closure, verified) {
    var entries = [], complete = unitData.complete, actorSide = request.actorSide, seen = Object.create(null);
    var followUpAudit = {
      prototypeComplete: true, grantSeen: false,
      grantScanComplete: true, pending: false, invalid: false, missing: Object.create(null),
    };
    if (!validId(actorSide)) complete = false;
    requireFunction(decisionApi.collectSkills, 'decisionApi.collectSkills');
    requireFunction(decisionApi.parseSkillCosts, 'decisionApi.parseSkillCosts');
    unitData.entries.filter(function (entry) { return entry.side === actorSide; }).forEach(function (unit) {
      var skills;
      try { skills = decisionApi.collectSkills(unit.unit); } catch (error) { complete = false; return; }
      if (!Array.isArray(skills)) { complete = false; return; }
      skills.forEach(function (skill) {
        var costs;
        if (!isObject(skill)) { complete = false; return; }
        var prototypeKinds = mechanicalPrototypeKinds(skill);
        if (!prototypeKinds || prototypeKinds.some(function (kind) { return !REGISTRY[kind]; })) {
          complete = false; followUpAudit.prototypeComplete = false; followUpAudit.grantScanComplete = false;
        }
        else if (prototypeKinds.indexOf('机制授予') >= 0) followUpAudit.grantSeen = true;
        try { costs = decisionApi.parseSkillCosts(skill); } catch (error) { complete = false; return; }
        var normalized = normalizeCosts(costs);
        if (!normalized.complete) { complete = false; return; }
        var realActionId = validId(skill.actionId) ? skill.actionId : '';
        var actionId = realActionId || mechanicalFingerprint(skill, costs, previewApi);
        if (!actionId) { complete = false; return; }
        if (realActionId) { addVerified(verified.events, realActionId); addVerified(verified.actions, realActionId); }
        var followUpKeysValid = own(skill, 'followUpKeys') && uniqueArrayIsValid(skill.followUpKeys);
        var followUpKeys = followUpKeysValid ? uniqueIds(skill.followUpKeys) : [];
        if (prototypeKinds && prototypeKinds.indexOf('机制授予') >= 0
          && followUpKeysValid && followUpKeys.length === 0) {
          followUpAudit.grantScanComplete = false;
        }
        if (!followUpKeysValid) followUpAudit.invalid = true;
        Object.keys(normalized.values).sort().forEach(function (resourceKey) {
          var current = publicResource(unit.unit, resourceKey), key = unit.id + '|' + resourceKey + '|' + actionId;
          if (current === null || current < 0 || seen[key]) { complete = false; return; }
          seen[key] = true;
          var pair = catalogRefs(request, verified, realActionId);
          indexRefs(closure, pair);
          if (!pair.ok) { complete = false; return; }
          var consumerId = 'public-consumer:' + unit.id + ':' + actionId + ':' + resourceKey;
          if (!followUpKeysValid) followUpAudit.missing[consumerId] = true;
          entries.push({
            consumerId: consumerId,
            ownerId: unit.id, resourceKey: resourceKey, currentAmount: current,
            requiredAmount: normalized.values[resourceKey], actionId: actionId, followUpKeys: followUpKeys,
            sourceFactIds: pair.facts, sourceEventIds: pair.events,
          });
        });
      });
    });
    return { entries: sortObjects(entries), complete: complete, followUpAudit: followUpAudit };
  }
  function finalizeFollowUpCatalog(catalog, audit) {
    var hasMissing = Object.keys(audit.missing).length > 0;
    var safeEmpty = audit.prototypeComplete && audit.grantScanComplete && !audit.grantSeen
      && !audit.pending && !audit.invalid && !hasMissing;
    if (!audit.prototypeComplete || !audit.grantScanComplete || audit.pending
      || audit.invalid || hasMissing) catalog.complete = false;
    catalog.entries.forEach(function (entry) {
      if (!audit.missing[entry.consumerId]) return;
      entry.followUpKeys = [];
      if (!safeEmpty) catalog.complete = false;
    });
    return catalog.complete;
  }
  function teamEntries(registry, fact, scheduled, effectId, verified, closure, visibleUnitIndex) {
    var ownerId = validId(fact && fact.sourceActorId) ? fact.sourceActorId : '';
    var targets = targetIds(fact), key = typedEffectKey(fact), duration = durationBand(fact);
    var visibleTargets = targets.length > 0 && targets.every(function (targetId) {
      return isObject(visibleUnitIndex) && Object.prototype.hasOwnProperty.call(visibleUnitIndex, targetId);
    });
    var pair = pdaRefs(fact, verified);
    indexRefs(closure, pair);
    if (!ownerId || !targets.length || !visibleTargets || !key || !duration
      || fact.sourceEffectId !== effectId || !pair.ok) return { entries: [], complete: false };
    return {
      complete: true,
      entries: targets.map(function (targetId) {
        return {
          capabilityKind: 'TEAM_EFFECT', ownerId: ownerId, targetId: targetId,
          effectAxis: registry.effectAxis, effectKey: key,
          timeBand: scheduled ? 'SCHEDULED' : 'NOW', durationBand: durationBand(fact),
          sourceFactIds: pair.facts.slice(), sourceEventIds: pair.events.slice(),
        };
      }),
    };
  }
  function resourceEntries(fact, scheduled, effectId, contributions, verified, closure, unitEntries) {
    var ownerId = validId(fact && fact.sourceActorId) ? fact.sourceActorId : '';
    var expected = targetIds(fact), resourceKey = canonicalResourceKey(fact && fact.key), matches = contributions.filter(function (item) {
      return validId(item && item.effectInstanceId) && item.effectInstanceId === effectId
        && item.component === 'RESOURCE_OPTION' && item.outcomeKind === 'RESOURCE_OPTION_CHANGED'
        && item.windowId !== 'ACTION_COST' && contributionResourceKey(item) === resourceKey;
    });
    var seen = Object.create(null), rows = [], complete = !!ownerId && expected.length > 0;
    if (!complete || !resourceKey || fact.sourceEffectId !== effectId || !matches.length) return { entries: [], complete: false };
    matches.forEach(function (item) {
      var evidence = isObject(item && item.evidence) ? item.evidence : {};
      var targetId = item && item.targetId;
      var current = finite(evidence.current), next = finite(evidence.next);
      var unit = unitEntries.filter(function (entry) { return entry.id === targetId; })[0];
      var maximum = publicMaxAmount(unit && unit.unit, resourceKey);
      var pair = previewRefs(item, verified);
      indexRefs(closure, pair);
      if (!validId(targetId) || !unit || current === null || next === null
        || maximum === null || maximum < 0 || evidence.applicationProbability !== 1
        || evidence.ownApplicationProbability !== 1 || !pair.ok) {
        complete = false; return;
      }
      seen[targetId] = true;
      rows.push({
        capabilityKind: 'RESOURCE_SUPPLY', ownerId: ownerId, targetId: targetId,
        resourceKey: resourceKey, timeBand: scheduled ? 'SCHEDULED' : 'NOW',
        supplyAmount: Math.max(0, next - current), publicMaxAmount: maximum,
        sourceFactIds: pair.facts.slice(), sourceEventIds: pair.events.slice(),
      });
    });
    if (Object.keys(seen).sort().join('|') !== expected.slice().sort().join('|')) complete = false;
    return { entries: complete ? rows : [], complete: complete };
  }
  function resourceEffectShape(facts, scheduled, effectId, contributions) {
    var pdaKeys = [], previewKeys = [], seenPda = Object.create(null), seenPreview = Object.create(null), complete = true;
    facts.concat(scheduled).forEach(function (fact) {
      var key = canonicalResourceKey(fact && fact.key);
      if (fact && fact.sourceEffectId !== effectId || !key || seenPda[key]) complete = false;
      if (key) { seenPda[key] = true; pdaKeys.push(key); }
    });
    contributions.forEach(function (item) {
      if (!validId(item && item.effectInstanceId) || item.effectInstanceId !== effectId
        || item.component !== 'RESOURCE_OPTION' || item.outcomeKind !== 'RESOURCE_OPTION_CHANGED' || item.windowId === 'ACTION_COST') return;
      var key = contributionResourceKey(item);
      if (!key) complete = false;
      if (key && !seenPreview[key]) { seenPreview[key] = true; previewKeys.push(key); }
    });
    pdaKeys.sort(); previewKeys.sort();
    return complete && JSON.stringify(pdaKeys) === JSON.stringify(previewKeys);
  }
  function followUpEntry(row, verified, closure, visibleUnitIndex) {
    var admission = grantAdmission(row, verified, visibleUnitIndex);
    var pair = pdaRefs(row, verified);
    if (!admission || !pair.ok) return null;
    var ordinary = {
      facts: pair.facts.slice(),
      events: pair.events.slice(),
    };
    if (ordinary.facts.length + ordinary.events.length === 0) return null;
    indexRefs(closure, ordinary);
    return {
      capabilityKind: 'FOLLOW_UP', grantType: 'FOLLOW_UP', ownerId: admission.ownerId,
      followUpKey: admission.followUpKey, grantProofIds: admission.proofs,
      sourceFactIds: ordinary.facts, sourceEventIds: ordinary.events,
    };
  }
  function hasPendingOrDeferred(admitted, projection) {
    var values = [];
    if (admitted && Array.isArray(admitted.reasons)) values = values.concat(admitted.reasons);
    if (projection && Array.isArray(projection.unsupportedOutcomeKinds)) values = values.concat(projection.unsupportedOutcomeKinds);
    if (projection && validId(projection.deferCode)) values.push(projection.deferCode);
    return values.some(function (value) { return typeof value === 'string' && /^(PENDING|DEFER)/.test(value); });
  }
  function indexCandidatePdaRow(row, verified, closure, visibleUnitIndex, followUpAudit, scheduled) {
    var admission = null;
    if (isFollowUpRow(row)) {
      if (scheduled !== true || followUpAudit.pending) return false;
      admission = grantFields(row, visibleUnitIndex);
      if (!admission || verified.authenticated.has(admission.entryId)) return false;
    }
    if (!indexPdaRow(verified, row, true)) return false;
    var pair = pdaRefs(row, verified);
    if (!pair.ok) return false;
    if (isFollowUpRow(row)) {
      authenticatePdaRow(verified, row);
      return !!grantAdmission(row, verified, visibleUnitIndex);
    }
    indexRefs(closure, pair);
    return pair.ok;
  }
  function indexCandidatePreviewRow(row, verified, closure) {
    if (isFollowUpRow(row)) return false;
    if (!indexPreviewRow(verified, row, true)) return false;
    var pair = previewRefs(row, verified);
    indexRefs(closure, pair);
    if (pair.ok) authenticatePreviewRow(verified, row);
    return pair.ok;
  }
  function unpackCarrierRows(effect) {
    // 造物承载/物品使用载体：无原型但有结构化使用效果时按 PDA/Preview 语义解包一层；
    // 内层目标 自身 规范化为 单体，使 PDA 按候选 targetSet（recipient）解析。
    // 不递归；畸形内层行原样保留，由未知原型路径 fail closed。
    if (!isObject(effect) || validId(effect['原型'])
      || !Array.isArray(effect['使用效果']) || effect['使用效果'].length === 0) return null;
    var rows = [], j, row, normalized;
    for (j = 0; j < effect['使用效果'].length; j += 1) {
      row = effect['使用效果'][j];
      if (!isObject(row) || row['目标'] !== '自身') { rows.push(row); continue; }
      normalized = {};
      Object.keys(row).forEach(function (key) { normalized[key] = row[key]; });
      normalized['目标'] = '单体';
      rows.push(normalized);
    }
    return rows;
  }
  function scanCandidate(candidate, request, previewApi, pdaApi, verified, closure, unitEntries, visibleUnitIndex, followUpAudit, injection) {
    var entries = [], identities = Object.create(null), status = { TEAM_EFFECT: 'COMPLETE', RESOURCE_SUPPLY: 'COMPLETE', FOLLOW_UP: 'COMPLETE' };
    var catalogComplete = true;
    var declaration = candidate.declaration === undefined ? {} : candidate.declaration;
    if (!isPlainObject(declaration)) fail('SOURCE_ACTION_ID_INVALID', candidate && candidate.candidateId);
    var actionKind = validId(declaration && declaration.actionKind) ? declaration.actionKind : '';
    var declaredEffects = declaration && declaration.skill && declaration.skill._效果数组;
    if (declaredEffects !== undefined && !Array.isArray(declaredEffects)) {
      fail('SOURCE_EFFECT_ARRAY_INVALID', candidate && candidate.candidateId);
    }
    var effects = Array.isArray(declaredEffects) ? declaredEffects : [];
    if (actionKind === 'RELEASE_SKILL' && (!declaration || !declaration.skill || !Array.isArray(declaration.skill._效果数组))) {
      status.TEAM_EFFECT = 'PARTIAL'; catalogComplete = false; followUpAudit.prototypeComplete = false;
    }
    var actionId = canonicalActionId(candidate);
    addVerified(verified.events, actionId); addVerified(verified.actions, actionId);
    var previewDeclaration = Object.assign({}, declaration || {}, { actionId: actionId });
    var preview = null;
    if (injection) {
      var injectedPreview = isObject(injection.previewResultsById) ? injection.previewResultsById[candidate.candidateId] : undefined;
      if (injectedPreview === undefined || !isObject(injectedPreview)) fail('SOURCE_PREVIEW_INJECTION_MISSING', candidate.candidateId);
      preview = injectedPreview;
    } else {
      try {
        preview = previewApi.previewAction({ worldSnapshot: request.visibleWorld, declaration: previewDeclaration, actorId: request.actorId, basisView: 'DECISION_VISIBLE' });
      } catch (error) {
        status.TEAM_EFFECT = 'PARTIAL'; status.RESOURCE_SUPPLY = 'PARTIAL'; status.FOLLOW_UP = 'PARTIAL';
        catalogComplete = false;
      }
    }
    var contributions = Array.isArray(preview && preview.contributions) ? preview.contributions : [];
    contributions.forEach(function (item) {
      if (!item || item.sourceActionId !== actionId) fail('SOURCE_PREVIEW_SOURCE_ACTION_MISMATCH', candidate.candidateId);
      if (!indexCandidatePreviewRow(item, verified, closure)) {
        status.FOLLOW_UP = 'PARTIAL'; catalogComplete = false;
      }
    });
    effects.forEach(function (effect, index) {
      var effectBaseId = canonicalEffectId(effect, actionId, index);
      var unpacked = unpackCarrierRows(effect), rows = unpacked === null ? [effect] : unpacked, u;
      for (u = 0; u < rows.length; u += 1) {
      var row = rows[u];
      var prototypeKind = validId(row && row['原型']) ? row['原型'] : '';
      var registry = REGISTRY[prototypeKind];
      var effectId = effectBaseId + (unpacked === null ? '' : ':unpack:' + u);
      if (!registry) {
        status.TEAM_EFFECT = 'PARTIAL'; status.RESOURCE_SUPPLY = 'PARTIAL'; status.FOLLOW_UP = 'PARTIAL'; catalogComplete = false; followUpAudit.prototypeComplete = false; continue;
      }
      var context = {
        sourceActionId: actionId, sourceActorId: request.actorId, sourceEffectId: effectId,
        candidateTargetIds: Array.isArray(declaration && declaration.targetIds) ? declaration.targetIds.slice() : [],
      };
      var admitted, projection;
      if (injection) {
        var perCandidateProjections = isObject(injection.pdaProjectionsById) ? injection.pdaProjectionsById[candidate.candidateId] : null;
        var injectedProjection = isObject(perCandidateProjections) ? perCandidateProjections[effectId] : undefined;
        if (injectedProjection === undefined || !isObject(injectedProjection) || !isObject(injectedProjection.projection)) {
          fail('SOURCE_PDA_INJECTION_MISSING', candidate.candidateId + ':' + effectId);
        }
        admitted = injectedProjection.admitted === undefined ? null : injectedProjection.admitted;
        projection = injectedProjection.projection;
      } else {
        try { admitted = pdaApi.admit(row, context); projection = pdaApi.project(row, context); } catch (error) {
          status[registry.capabilityKind === 'TEAM_EFFECT' ? 'TEAM_EFFECT' : registry.capabilityKind === 'RESOURCE_SUPPLY' ? 'RESOURCE_SUPPLY' : 'FOLLOW_UP'] = 'PARTIAL';
          catalogComplete = false;
          continue;
        }
      }
      if (hasPendingOrDeferred(admitted, projection)) {
        status[registry.capabilityKind === 'TEAM_EFFECT' ? 'TEAM_EFFECT' : registry.capabilityKind === 'RESOURCE_SUPPLY' ? 'RESOURCE_SUPPLY' : 'FOLLOW_UP'] = 'PARTIAL';
        status.FOLLOW_UP = 'PARTIAL';
        catalogComplete = false; followUpAudit.pending = true;
      }
      var direct = Array.isArray(projection && projection.directFacts) ? projection.directFacts : [];
      var scheduled = Array.isArray(projection && projection.scheduledFacts) ? projection.scheduledFacts : [];
      direct.forEach(function (fact) { if (!indexCandidatePdaRow(fact, verified, closure, visibleUnitIndex, followUpAudit, false)) { status.FOLLOW_UP = isFollowUpRow(fact) ? 'PARTIAL' : status.FOLLOW_UP; catalogComplete = isFollowUpRow(fact) ? false : catalogComplete; } });
      scheduled.forEach(function (fact) { if (!indexCandidatePdaRow(fact, verified, closure, visibleUnitIndex, followUpAudit, true)) { status.FOLLOW_UP = isFollowUpRow(fact) ? 'PARTIAL' : status.FOLLOW_UP; catalogComplete = isFollowUpRow(fact) ? false : catalogComplete; } });
      if (!admitted || admitted.admitted === false) {
        if (registry.capabilityKind === 'TEAM_EFFECT') status.TEAM_EFFECT = 'PARTIAL';
        if (registry.capabilityKind === 'RESOURCE_SUPPLY') status.RESOURCE_SUPPLY = 'PARTIAL';
        if (registry.capabilityKind === 'NOT_RELATIONAL') status.FOLLOW_UP = 'PARTIAL';
        catalogComplete = false;
        continue;
      }
      if (registry.capabilityKind === 'TEAM_EFFECT') {
        if (!direct.length && !scheduled.length) { status.TEAM_EFFECT = 'PARTIAL'; continue; }
        direct.forEach(function (fact) { var made = teamEntries(registry, fact, false, effectId, verified, closure, visibleUnitIndex); if (!made.complete) status.TEAM_EFFECT = 'PARTIAL'; else authenticatePdaRow(verified, fact); made.entries.forEach(function (entry) { if (!addEntry(entries, identities, entry)) status.TEAM_EFFECT = 'PARTIAL'; }); });
        scheduled.forEach(function (fact) { var made = teamEntries(registry, fact, true, effectId, verified, closure, visibleUnitIndex); if (!made.complete) status.TEAM_EFFECT = 'PARTIAL'; else authenticatePdaRow(verified, fact); made.entries.forEach(function (entry) { if (!addEntry(entries, identities, entry)) status.TEAM_EFFECT = 'PARTIAL'; }); });
      } else if (registry.capabilityKind === 'RESOURCE_SUPPLY') {
        if (!direct.length && !scheduled.length) { status.RESOURCE_SUPPLY = 'PARTIAL'; return; }
        if (!resourceEffectShape(direct, scheduled, effectId, contributions)) status.RESOURCE_SUPPLY = 'PARTIAL';
        direct.forEach(function (fact) { var made = resourceEntries(fact, false, effectId, contributions, verified, closure, unitEntries); if (!made.complete) status.RESOURCE_SUPPLY = 'PARTIAL'; else authenticatePdaRow(verified, fact); made.entries.forEach(function (entry) { if (!addEntry(entries, identities, entry)) status.RESOURCE_SUPPLY = 'PARTIAL'; }); });
        scheduled.forEach(function (fact) { var made = resourceEntries(fact, true, effectId, contributions, verified, closure, unitEntries); if (!made.complete) status.RESOURCE_SUPPLY = 'PARTIAL'; else authenticatePdaRow(verified, fact); made.entries.forEach(function (entry) { if (!addEntry(entries, identities, entry)) status.RESOURCE_SUPPLY = 'PARTIAL'; }); });
      } else if (registry.capabilityKind === 'NOT_RELATIONAL') {
        scheduled.forEach(function (fact) {
          if (fact && fact.grantType !== 'FOLLOW_UP') return;
          var grant = followUpAudit.pending ? null : followUpEntry(fact, verified, closure, visibleUnitIndex);
          if (!grant) { status.FOLLOW_UP = 'PARTIAL'; catalogComplete = false; }
          else if (!addEntry(entries, identities, grant)) status.FOLLOW_UP = 'PARTIAL';
        });
      }
      }
    });
    return { entries: sortObjects(entries), status: status, catalogComplete: catalogComplete };
  }
  function compilePreparedRequest(args) {
    args = args || {};
    var request = args.request, previewApi = args.previewApi, pdaApi = args.pdaApi, decisionApi = args.decisionApi;
    var injection = null;
    if (args.previewResultsById !== undefined || args.pdaProjectionsById !== undefined) {
      if (!isObject(args.previewResultsById) || !isObject(args.pdaProjectionsById)) fail('SOURCE_INJECTION_PARTIAL');
      injection = { previewResultsById: args.previewResultsById, pdaProjectionsById: args.pdaProjectionsById };
    }
    requireFormalApi(decisionApi, root.__LWCS_BATTLE_DECISION__, 'decisionApi');
    requireFormalApi(previewApi, root.__LWCS_BATTLE_PREVIEW__, 'previewApi');
    requireFormalApi(pdaApi, root.__LWCS_BEHAVIOR_PROTOTYPE_ADAPTER__, 'pdaApi');
    requireFunction(decisionApi && decisionApi.isPreparedDecisionRequest, 'decisionApi.isPreparedDecisionRequest');
    if (!decisionApi.isPreparedDecisionRequest(request)) fail('SOURCE_PREPARED_REQUEST_IDENTITY');
    if (injection) {
      requireFunction(decisionApi.isPreparedLinearSourceMaps, 'decisionApi.isPreparedLinearSourceMaps');
      if (!decisionApi.isPreparedLinearSourceMaps(request, injection.previewResultsById, injection.pdaProjectionsById)) {
        fail('SOURCE_MAP_IDENTITY');
      }
    }
    if (!isObject(request) || !Array.isArray(request.frozenCandidates) || request.frozenCandidates.length === 0) fail('SOURCE_FROZEN_REQUEST_REQUIRED');
    if (!isObject(request.visibleWorld)) fail('SOURCE_VISIBLE_WORLD_REQUIRED');
    requireFunction(previewApi && previewApi.previewAction, 'previewApi.previewAction');
    requireFunction(previewApi && previewApi.stableHash, 'previewApi.stableHash');
    requireFunction(pdaApi && pdaApi.admit, 'pdaApi.admit'); requireFunction(pdaApi && pdaApi.project, 'pdaApi.project');
    requireFunction(pdaApi && pdaApi.registry, 'pdaApi.registry');
    requireFunction(decisionApi && decisionApi.collectSkills, 'decisionApi.collectSkills');
    var candidateIds = new Set(), frozen = request.frozenCandidates.map(function (candidate) {
      var candidateId = candidate && candidate.candidateId;
      if (!validId(candidateId) || candidateIds.has(candidateId)) fail('SOURCE_CANDIDATE_CLOSURE', candidateId);
      candidateIds.add(candidateId); return candidateId;
    }).sort();
    var verified = {
      facts: new Set(), events: new Set(), actions: new Set(), authenticated: new Set(),
      links: Object.create(null),
    };
    var closure = { facts: new Set(), events: new Set() };
    initializeClosure(request, verified, closure);
    var attestation = registryAttestation(pdaApi);
    var unitData = visibleUnits(request, verified, closure, candidateIds);
    var baseline = scanBaseline(request, verified, closure, unitData);
    var catalog = scanConsumers(request, decisionApi, previewApi, unitData, closure, verified);
    var followUpAudit = catalog.followUpAudit;
    var catalogComplete = unitData.complete && catalog.complete;
    var candidateResults = {};
    request.frozenCandidates.forEach(function (candidate) {
      var candidateId = candidate.candidateId;
      var result = scanCandidate(candidate, request, previewApi, pdaApi, verified, closure, unitData.entries, unitData.byId, followUpAudit, injection);
      candidateResults[candidateId] = result;
      if (result.catalogComplete !== true) catalogComplete = false;
    });
    if (!finalizeFollowUpCatalog(catalog, followUpAudit)) {
      catalogComplete = false;
      Object.keys(candidateResults).forEach(function (candidateId) { candidateResults[candidateId].status.FOLLOW_UP = 'PARTIAL'; });
    }
    var candidateEntriesById = {}, candidateCompletenessByAxis = {};
    frozen.forEach(function (candidateId) {
      candidateEntriesById[candidateId] = candidateResults[candidateId].entries;
      candidateCompletenessByAxis[candidateId] = candidateResults[candidateId].status;
    });
    var factIds = Array.from(closure.facts).sort(), eventIds = Array.from(closure.events).sort();
    var output = {
      schemaVersion: 'BehaviorRelationalFeatureV1', frozenCandidateIds: frozen,
      baselineEntries: baseline.entries, candidateEntriesById: candidateEntriesById, publicConsumers: catalog.entries,
      baselineCompletenessByAxis: { TEAM_EFFECT: baseline.complete ? 'COMPLETE' : 'PARTIAL' },
      candidateCompletenessByAxis: candidateCompletenessByAxis,
      actionCatalogCompleteness: catalogComplete ? 'COMPLETE' : 'PARTIAL',
      sourceClosure: { factIds: factIds, eventIds: eventIds, closureHash: 'closure:' + previewApi.stableHash({ factIds: factIds, eventIds: eventIds }) },
      registryAttestation: attestation,
    };
    return freeze(output);
  }
  root.__LWCS_BEHAVIOR_CANDIDATE_FEATURE_SOURCE__ = Object.freeze({
    compilePreparedRequest: compilePreparedRequest,
    unpackCarrierRows: unpackCarrierRows,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
