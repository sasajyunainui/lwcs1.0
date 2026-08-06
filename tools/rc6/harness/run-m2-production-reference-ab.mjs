import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clone,
  loadBattleSandbox,
  manualCasesById,
} from '../../r83_rc6_battle_harness.mjs';
import {
  evaluateRawCandidate,
  evaluateRawCase,
} from '../reference/reference-value-evaluator-v2.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const evidencePath = path.join(repoRoot, 'tools', 'rc6', 'evidence', 'm2', 'production-reference-ab.json');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const assert = (condition, code) => {
  if (!condition) throw new Error(code);
};
const approx = (left, right, detail) => {
  assert(Number.isFinite(left) && Number.isFinite(right), `PRODUCTION_AB_NON_FINITE:${detail}`);
  assert(Math.abs(left - right) <= 1e-9, `PRODUCTION_AB_VALUE_MISMATCH:${detail}:${left}:${right}`);
};

const HEALTH_KINDS = new Set([
  'HP_DELTA',
  'SCHEDULED_HP_DELTA',
  'WITHDRAWAL_CONTEST',
  'SHIELD_DELTA',
]);
const ZERO_VALUE_KINDS = new Set([
  'STATE_CHANGED',
  'NEXT_ACTION_QUALITY_CHANGED',
]);

const healthFact = (entry, world, targetId, preview, deltaHp, actorSide, sequence) => {
  const target = healthTarget(entry, world, targetId, preview);
  if (!target) return null;
  return {
    componentCode: 'S1_HEALTH',
    formula: 'HEALTH_PP',
    deltaHp,
    maxHp: target.maxHp,
    polarity: target.side === actorSide ? 1 : -1,
    sourceEventId: `${entry.candidateId}:route:${targetId}`,
    sourceFactId: `${entry.candidateId}:route-health:${targetId}`,
    targetUnitId: targetId,
    sequence,
  };
};

function routeFactsForEntry(entry, world, preview, actorSide) {
  const grouped = new Map();
  const facts = [];
  (entry?.contributions || []).forEach((contribution, index) => {
    const outcomeKind = String(contribution?.outcomeKind || '').trim();
    if (HEALTH_KINDS.has(outcomeKind)) {
      const targetId = String(contribution?.targetId || '').trim();
      const deltaHp = Number(
        contribution?.expectedDelta ?? contribution?.evidence?.delta ?? 0,
      );
      if (!targetId || !Number.isFinite(deltaHp)) return;
      const current = grouped.get(targetId) || { deltaHp: 0, index };
      current.deltaHp += deltaHp;
      grouped.set(targetId, current);
      return;
    }
    const evidence = contribution?.evidence || {};
    const explicitKey = [
      'actionPoolDeltaHEPP',
      'routeDeltaHEPP',
      'objectiveDeltaHEPP',
      'terminalDeltaHEPP',
      'terminalValueHEPP',
    ].find(key => Object.hasOwn(evidence, key));
    if (!explicitKey) return;
    const amountHEPP = Number(evidence[explicitKey]);
    if (!Number.isFinite(amountHEPP) || Math.abs(amountHEPP) <= 1e-9) return;
    const isTerminal = ['terminalDeltaHEPP', 'terminalValueHEPP'].includes(explicitKey);
    facts.push({
      componentCode: isTerminal ? 'S1_TERMINAL' : 'S2_CONSTANT',
      formula: 'CONSTANT_HEPP',
      amountHEPP,
      sourceEventId: String(
        contribution?.sourceActionId || contribution?.effectInstanceId ||
        `${entry.candidateId}:route-explicit:${index}`,
      ).trim(),
      sourceFactId: `${entry.candidateId}:route-explicit:${index}`,
      targetUnitId: String(contribution?.targetId || entry.actorId).trim(),
      sequence: index,
    });
  });
  grouped.forEach((row, targetId) => {
    const fact = healthFact(
      entry,
      world,
      targetId,
      preview,
      row.deltaHp,
      actorSide,
      row.index,
    );
    if (fact) facts.push(fact);
  });
  return facts;
}

function routeValueForEntry(entry, world, preview, request, unitId) {
  const unit = preview.findUnit(world, unitId);
  if (!unit) return 0;
  const actorSide = preview.sideOf(world, unit);
  const targetProfiles = Object.entries(world?.参战者 || {}).flatMap(([side, units]) =>
    (Array.isArray(units) ? units : []).map(target => ({
      targetId: preview.unitId(target),
      name: preview.unitName(target),
      side,
      currentHpPP: 100 * preview.readHp(target) /
        Math.max(1, preview.readHpMax(target)),
    }))
  );
  const evaluated = evaluateRawCandidate({
    candidateId: entry.candidateId,
    actionId: String(entry?.declaration?.actionId || entry.candidateId).trim(),
    actorId: unitId,
    actorSide,
    targetSet: [...(entry.targetIds || [])],
    paymentMode: entry.resourcePotentialOnly ? 'EXTERNAL_TIMELINE' : 'FORMAL',
    legal: entry.hardInvalid !== true,
    hardExclusionCodes: entry.hardInvalid ? ['REFERENCE_ROUTE_ENTRY_INVALID'] : [],
    rawFacts: routeFactsForEntry(entry, world, preview, actorSide),
    informationGroups: [],
    objectiveContract: clone(request.objectiveContract || world?.胜负条件 || {}),
    targetProfiles,
  });
  return evaluated.goalUtilityDeltaHEPP;
}

function bestReferenceRoute(routePoolByUnit, unitId, world, preview, request, resourceOverrides = {}) {
  const unit = preview.findUnit(world, unitId);
  const entries = routePoolByUnit.get(unitId) || [];
  if (!unit || !entries.length) return { complete: false, valueHEPP: 0, candidateId: '' };
  const affordable = entries.filter(entry =>
    entry?.hardInvalid !== true &&
    Object.entries(entry.resourceCosts || {}).every(([resource, amount]) => {
      const available = Object.hasOwn(resourceOverrides, resource)
        ? Number(resourceOverrides[resource])
        : preview.readResource(unit, resource);
      return Number.isFinite(available) && available + 1e-9 >= Number(amount || 0);
    }),
  );
  const ranked = affordable.map(entry => ({
    entry,
    valueHEPP: routeValueForEntry(entry, world, preview, request, unitId),
  })).sort((left, right) =>
    right.valueHEPP - left.valueHEPP ||
    (left.entry.candidateId < right.entry.candidateId ? -1 : left.entry.candidateId > right.entry.candidateId ? 1 : 0),
  );
  return {
    complete: true,
    valueHEPP: ranked[0]?.valueHEPP || 0,
    candidateId: ranked[0]?.entry?.candidateId || '',
  };
}

function referenceBehaviorMutationKind(contribution) {
  const kind = String(contribution?.outcomeKind || '').trim();
  const evidence = contribution?.evidence || {};
  const prototype = String(evidence?.prototype || '').trim();
  if (kind === 'NEXT_ACTION_QUALITY_CHANGED') {
    return {
      '决策干扰': 'DECISION_INTERFERENCE',
      '位移执行': 'POSITION',
      '属性修正': 'ATTRIBUTE_MODIFIER',
      '判定修正': 'CHECK_MODIFIER',
      '结算修正': 'SETTLEMENT_MODIFIER',
    }[prototype] || '';
  }
  if (kind === 'STATE_CHANGED' && prototype === '状态施加' &&
      String(evidence?.state || '').trim()) return 'STATE_APPLY';
  if (kind === 'STATE_CHANGED' && Array.isArray(evidence?.removedKeys) &&
      evidence.removedKeys.length) return 'STATE_REMOVE';
  if (kind === 'STATE_CHANGED' && prototype === '时窗修正' &&
      Array.isArray(evidence?.durationChanges) && evidence.durationChanges.length) {
    return 'TIME_WINDOW';
  }
  return '';
}

function referenceActiveOpportunityCount(request, targetId) {
  const ids = new Set();
  const opportunity = request?.actionOpportunity || {};
  (opportunity?.pendingNaturalActorIds || []).forEach(unitId => {
    if (String(unitId || '').trim() === targetId) ids.add(`pending:${targetId}`);
  });
  const snapshot = request?.evaluationContext?.opportunitySnapshot;
  const opportunities = Array.isArray(snapshot)
    ? snapshot
    : Array.isArray(snapshot?.opportunities)
      ? snapshot.opportunities
      : snapshot && typeof snapshot === 'object' ? [snapshot] : [];
  opportunities.forEach(record => {
    if (String(record?.ownerId || '').trim() !== targetId ||
        String(record?.role || '').trim().toUpperCase() !== 'ACTIVE' ||
        !['PENDING', 'EXECUTING'].includes(String(record?.status || '').trim().toUpperCase())) return;
    ids.add(String(record?.opportunityId || record?.grantId || `active:${targetId}`));
  });
  const scheduled = request?.evaluationContext?.scheduledEvents;
  const events = Array.isArray(scheduled)
    ? scheduled
    : scheduled && typeof scheduled === 'object' ? [scheduled] : [];
  events.forEach(record => {
    if (String(record?.ownerId || '').trim() !== targetId ||
        !['NATURAL_ACTION', 'FUTURE_NATURAL_ACTION'].includes(
          String(record?.expectedGrantType || record?.eventType || '').trim(),
        )) return;
    ids.add(String(record?.descriptorId || `scheduled:${targetId}`));
  });
  return ids.size;
}

function referenceNaturalOpportunityCount(request, world, target, preview) {
  const objectives = preview.normalizeBattleObjectives(
    world?.胜负条件 || {},
    world,
  );
  const currentRound = Math.max(0, Number(world?.回合 || 0));
  const elapsedRounds = Math.max(
    0,
    currentRound - Number(objectives.startRound || 0),
  );
  const futureRounds = Math.max(
    0,
    Number(objectives.maxRounds || 0) - elapsedRounds,
  );
  const naturalOpportunity = target?.__battleRuntime?.naturalOpportunity;
  const currentPending = naturalOpportunity &&
    Number(naturalOpportunity?.round || 0) === currentRound &&
    String(naturalOpportunity?.status || '').trim() === 'PENDING' &&
    String(request?.actorId || '').trim() !== String(preview.unitId(target) || '').trim()
    ? 1
    : 0;
  return currentPending + futureRounds;
}

function referenceSetResource(unit, resource, value) {
  const fields = /精神/.test(resource)
    ? ['men', '精神力']
    : /体力/.test(resource)
      ? ['vit', 'sta', '体力']
      : /生命|HP/i.test(resource)
        ? ['hp', '生命']
        : ['sp', '魂力'];
  fields.forEach(field => {
    unit[field] = value;
  });
}

function referenceWorldAfterResourceCosts(world, actorId, costs, preview) {
  const next = clone(world);
  const actor = preview.findUnit(next, actorId);
  if (!actor) return null;
  for (const [resource, amount] of Object.entries(costs || {})) {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount)) return null;
    const current = preview.readResource(actor, resource);
    referenceSetResource(actor, resource, Math.max(0, current - numericAmount));
  }
  return next;
}

function referenceWorldAfterCreation(world, creation, preview) {
  const next = clone(world);
  const recipient = preview.findUnit(next, creation.recipientId);
  if (!recipient) return null;
  const inventory = recipient?.背包 && typeof recipient.背包 === 'object' &&
    !Array.isArray(recipient.背包)
    ? recipient.背包
    : {};
  const existing = inventory[creation.productId] &&
    typeof inventory[creation.productId] === 'object'
    ? inventory[creation.productId]
    : {};
  inventory[creation.productId] = {
    ...existing,
    id: String(existing.id || creation.productId).trim() || creation.productId,
    name: String(existing.name || creation.productId).trim() || creation.productId,
    名称: String(existing.名称 || creation.productId).trim() || creation.productId,
    物品名: String(existing.物品名 || creation.productId).trim() || creation.productId,
    数量: Math.max(0, Number(existing.数量 || 0)) + creation.quantity,
    使用效果: clone(creation.useEffects),
  };
  recipient.背包 = inventory;
  return next;
}

function referenceRouteEntriesForUnit({
  decision,
  preview,
  world,
  unitId,
  request,
  actionOpportunity,
}) {
  const candidates = decision.enumerateCandidates({
    worldSnapshot: world,
    actorId: unitId,
    beliefState: clone(request.beliefState || {}),
    battleIntent: clone(request.battleIntent || {}),
    includeUnaffordableRoutes: true,
    actionOpportunity: {
      ...clone(actionOpportunity || {}),
      role: 'ACTIVE',
      ownerId: unitId,
    },
  });
  return candidates.map(candidate => {
    const declaration = clone(candidate?.declaration || {});
    try {
      const previewResult = preview.previewAction({
        worldSnapshot: world,
        actorId: unitId,
        declaration,
        paymentMode: candidate?.resourcePotentialOnly === true
          ? 'EXTERNAL_TIMELINE'
          : 'FORMAL',
        resourcePotentialOnly: candidate?.resourcePotentialOnly === true,
        horizon: 'SHALLOW',
        beliefSnapshot: clone(request.beliefState || {}),
        battleIntent: clone(request.battleIntent || {}),
        actionOpportunity: {
          ...clone(actionOpportunity || {}),
          role: 'ACTIVE',
          ownerId: unitId,
        },
        worldRevision: `reference-route:${unitId}`,
        beliefRevision: String(request.beliefState?.revision || '').trim(),
        actionFingerprint: preview.stableHash(declaration),
      });
      return {
        candidateId: String(candidate?.candidateId || '').trim(),
        actorId: unitId,
        actorSide: preview.sideOf(world, preview.findUnit(world, unitId)),
        declaration,
        targetIds: [...(declaration.targetIds || [])],
        resourceCosts: clone(candidate?.costs || declaration.resourceCosts || {}),
        resourcePotentialOnly: candidate?.resourcePotentialOnly === true,
        contributions: clone(previewResult?.contributions || []),
        summonDefinitions: clone(previewResult?.summonDefinitions || []),
        hardInvalid: false,
        previewError: '',
      };
    } catch (error) {
      return {
        candidateId: String(candidate?.candidateId || '').trim(),
        actorId: unitId,
        actorSide: preview.sideOf(world, preview.findUnit(world, unitId)),
        declaration,
        targetIds: [...(declaration.targetIds || [])],
        resourceCosts: clone(candidate?.costs || declaration.resourceCosts || {}),
        resourcePotentialOnly: candidate?.resourcePotentialOnly === true,
        contributions: [],
        summonDefinitions: [],
        hardInvalid: true,
        previewError: String(error?.message || error),
      };
    }
  });
}

function referenceCreationRouteProjection({
  entry,
  contribution,
  index,
  world,
  preview,
  request,
  decision,
}) {
  const evidence = contribution?.evidence || {};
  const productId = String(evidence?.productId || '').trim();
  const useEffects = Array.isArray(evidence?.useEffects)
    ? evidence.useEffects
    : [];
  const recipientId = String(
    evidence?.recipientId || contribution?.targetId || '',
  ).trim();
  if (!productId || !recipientId || !useEffects.length) {
    return { reason: `CREATION_METADATA_UNAVAILABLE:${index}` };
  }
  const recipient = preview.findUnit(world, recipientId);
  if (!recipient || !preview.isBattleCapable(recipient)) {
    return { handled: true, valueHEPP: 0 };
  }
  const productionWindow = Math.max(
    1,
    Number(
      evidence?.productionWindow ||
      Math.ceil(Number(entry?.declaration?.skill?.前摇 || 0) / 40) ||
      1,
    ),
  );
  if (!Number.isFinite(productionWindow)) {
    return { reason: `CREATION_WINDOW_NON_FINITE:${index}` };
  }
  const remainingOpportunities = referenceNaturalOpportunityCount(
    request,
    world,
    recipient,
    preview,
  );
  if (remainingOpportunities < productionWindow) {
    return { handled: true, valueHEPP: 0 };
  }
  const quantity = Math.max(1, Number(evidence?.quantity || 1));
  if (!Number.isFinite(quantity)) {
    return { reason: `CREATION_QUANTITY_NON_FINITE:${index}` };
  }
  const paidWorld = referenceWorldAfterResourceCosts(
    world,
    entry.actorId,
    entry.resourceCosts || {},
    preview,
  );
  const creation = { productId, quantity, recipientId, useEffects };
  const withProductWorld = paidWorld
    ? referenceWorldAfterCreation(paidWorld, creation, preview)
    : null;
  if (!paidWorld || !withProductWorld) {
    return { reason: `CREATION_WORLD_PROJECTION_FAILED:${index}` };
  }
  const currentOpportunity = request.actionOpportunity || {};
  const futureActionOpportunity = {
    ...clone(currentOpportunity),
    role: 'ACTIVE',
    ownerId: recipientId,
    sequence: Number(
      currentOpportunity?.sequence ??
      currentOpportunity?.opportunitySequence ??
      0,
    ) + productionWindow,
    pendingNaturalActorIds: (
      currentOpportunity?.pendingNaturalActorIds || []
    ).filter(unitId => String(unitId || '').trim() !== recipientId),
  };
  const recipientSide = preview.sideOf(world, recipient);
  const withoutRequest = {
    ...request,
    visibleWorld: paidWorld,
    actorId: recipientId,
    actorSide: recipientSide,
    actionOpportunity: futureActionOpportunity,
  };
  const withoutPool = new Map([[recipientId, referenceRouteEntriesForUnit({
    decision,
    preview,
    world: paidWorld,
    unitId: recipientId,
    request: withoutRequest,
    actionOpportunity: futureActionOpportunity,
  })]]);
  const withoutProduct = bestReferenceRoute(
    withoutPool,
    recipientId,
    paidWorld,
    preview,
    withoutRequest,
  );
  const withProductRequest = {
    ...withoutRequest,
    visibleWorld: withProductWorld,
  };
  const withPool = new Map([[recipientId, referenceRouteEntriesForUnit({
    decision,
    preview,
    world: withProductWorld,
    unitId: recipientId,
    request: withProductRequest,
    actionOpportunity: futureActionOpportunity,
  })]]);
  const withProduct = bestReferenceRoute(
    withPool,
    recipientId,
    withProductWorld,
    preview,
    withProductRequest,
  );
  if (!withoutProduct.complete || !withProduct.complete) {
    return { reason: `CREATION_ROUTE_INCOMPLETE:${index}` };
  }
  const probability = Number(contribution?.probability ?? 1);
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
    return { reason: `CREATION_PROBABILITY_INVALID:${index}` };
  }
  const polarity = recipientSide === request.actorSide ? 1 : -1;
  const amountHEPP = (withProduct.valueHEPP - withoutProduct.valueHEPP) *
    probability * polarity;
  if (!Number.isFinite(amountHEPP)) {
    return { reason: `CREATION_VALUE_NON_FINITE:${index}` };
  }
  return {
    handled: true,
    valueHEPP: amountHEPP,
    fact: {
      componentCode: 'S5_CREATION_CONSUMER',
      formula: 'ROUTE_DELTA',
      beforeRouteHEPP: withoutProduct.valueHEPP,
      afterRouteHEPP: withProduct.valueHEPP,
      applicationProbability: probability,
      polarity,
      sourceEventId: String(
        contribution?.sourceActionId ||
        contribution?.effectInstanceId ||
        `${entry.candidateId}:creation:${index}`,
      ).trim(),
      sourceFactId: `${entry.candidateId}:creation-consumer:${index}`,
      targetUnitId: recipientId,
      sequence: index,
    },
  };
}

function healthTarget(entry, world, targetId, preview) {
  const visibleTarget = preview.findUnit(world, targetId);
  if (visibleTarget) {
    return {
      maxHp: Math.max(1, preview.readHpMax(visibleTarget)),
      side: preview.sideOf(world, visibleTarget),
    };
  }
  const summon = (entry.summonDefinitions || []).find(definition =>
    String(
      definition?.id ||
      definition?.召唤键 ||
      definition?.summonId ||
      '',
    ).trim() === targetId,
  );
  if (!summon) return null;
  return {
    maxHp: Math.max(
      1,
      Number(summon?.hp_max || summon?.HP上限 || summon?.vit_max || 1),
    ),
    side: String(summon?.side || summon?.阵营 || '').trim() || entry.actorSide,
  };
}

function toReferenceCandidate(entry, row, world, preview, request, routePoolByUnit, decision) {
  const reasons = [];
  const groupedHealth = new Map();
  const rawExplicitFacts = [];
  const rawRouteFacts = [];
  const actor = preview.findUnit(world, request.actorId);
  const riskInputs = actor
    ? {
        actorId: request.actorId,
        actorSide: request.actorSide,
        actorHp: preview.readHp(actor),
        actorMaxHp: Math.max(1, preview.readHpMax(actor)),
        actorOutcomeDeltas: [],
        shieldFacts: [],
        negativeTerminal: false,
      }
    : null;
  (entry.contributions || []).forEach((contribution, index) => {
    const outcomeKind = String(contribution?.outcomeKind || '').trim();
    if (HEALTH_KINDS.has(outcomeKind)) {
      const targetId = String(contribution?.targetId || '').trim();
      const target = healthTarget(entry, world, targetId, preview);
      if (!target) {
        reasons.push(`HEALTH_TARGET_UNAVAILABLE:${index}:${targetId}`);
        return;
      }
      const deltaHp = Number(
        contribution?.expectedDelta ?? contribution?.evidence?.delta ?? 0,
      );
      if (!Number.isFinite(deltaHp)) {
        reasons.push(`HEALTH_DELTA_NON_FINITE:${index}`);
        return;
      }
      const current = groupedHealth.get(targetId) || {
        targetId,
        maxHp: target.maxHp,
        side: target.side,
        deltaHp: 0,
        sourceEventId: String(
          contribution?.sourceActionId ||
          contribution?.effectInstanceId ||
          `${entry.candidateId}:health`,
        ).trim(),
      };
      current.deltaHp += deltaHp;
      groupedHealth.set(targetId, current);
      if (riskInputs && targetId === request.actorId) {
        const outcomes = Array.isArray(contribution?.evidence?.outcomeDistribution) &&
          contribution.evidence.outcomeDistribution.length
          ? contribution.evidence.outcomeDistribution.map(outcome => {
              if (outcomeKind === 'WITHDRAWAL_CONTEST') {
                return -Math.max(0, Number(outcome?.pursuitDamage ?? outcome?.hpDamage ?? 0));
              }
              if (Number.isFinite(Number(outcome?.delta))) return Number(outcome.delta);
              return Number(outcome?.hpDamage || 0) * -1;
            })
          : [deltaHp];
        riskInputs.actorOutcomeDeltas.push({ deltas: outcomes });
      }
      if (riskInputs && outcomeKind === 'SHIELD_DELTA') {
        riskInputs.shieldFacts.push({
          deltaHp,
          maxHp: target.maxHp,
          side: target.side,
        });
      }
      return;
    }
    const evidence = contribution?.evidence || {};
    const explicitKey = [
      'actionPoolDeltaHEPP',
      'routeDeltaHEPP',
      'objectiveDeltaHEPP',
      'terminalDeltaHEPP',
      'terminalValueHEPP',
    ].find(key => Object.hasOwn(evidence, key));
    if (explicitKey) {
      const amountHEPP = Number(evidence[explicitKey]);
      if (!Number.isFinite(amountHEPP)) {
        reasons.push(`EXPLICIT_VALUE_NON_FINITE:${index}`);
        return;
      }
      if (Math.abs(amountHEPP) <= 1e-9) return;
      rawExplicitFacts.push({
        componentCode: ['terminalDeltaHEPP', 'terminalValueHEPP'].includes(explicitKey)
          ? 'S1_TERMINAL'
          : 'S2_CONSTANT',
        formula: 'CONSTANT_HEPP',
        amountHEPP,
        sourceEventId: String(
          contribution?.sourceActionId || contribution?.effectInstanceId ||
          `${entry.candidateId}:explicit:${index}`,
        ).trim(),
        sourceFactId: `${entry.candidateId}:explicit:${index}`,
        targetUnitId: String(contribution?.targetId || entry.actorId).trim(),
        sequence: index,
      });
      return;
    }
    if (outcomeKind === 'RESOURCE_OPTION_CHANGED') {
      const targetId = String(contribution?.targetId || '').trim();
      const resource = String(evidence?.resource || '').trim();
      const target = preview.findUnit(world, targetId);
      const routePool = routePoolByUnit?.get(targetId) || [];
      const current = Number.isFinite(Number(evidence?.before))
        ? Number(evidence.before)
        : Number.isFinite(Number(evidence?.current))
          ? Number(evidence.current)
          : target ? preview.readResource(target, resource) : Number.NaN;
      const next = Number.isFinite(Number(evidence?.next))
        ? Number(evidence.next)
        : current + Number(contribution?.expectedDelta || 0);
      if (!target || !resource || !routePool.length || !Number.isFinite(current) || !Number.isFinite(next)) {
        reasons.push(`RESOURCE_ROUTE_UNAVAILABLE:${index}:${targetId}`);
        return;
      }
      const beforeRoute = bestReferenceRoute(
        routePoolByUnit,
        targetId,
        world,
        preview,
        request,
      );
      const afterRoute = bestReferenceRoute(
        routePoolByUnit,
        targetId,
        world,
        preview,
        request,
        { [resource]: next },
      );
      if (!beforeRoute.complete || !afterRoute.complete) {
        reasons.push(`RESOURCE_ROUTE_INCOMPLETE:${index}:${targetId}`);
        return;
      }
      const polarity = preview.sideOf(world, target) === request.actorSide ? 1 : -1;
      const routeValue = (afterRoute.valueHEPP - beforeRoute.valueHEPP) *
        Number(contribution?.probability ?? 1) * polarity;
      if (Math.abs(routeValue) <= 1e-9) return;
      rawRouteFacts.push({
        componentCode: 'S2_ROUTE',
        formula: 'ROUTE_DELTA',
        beforeRouteHEPP: beforeRoute.valueHEPP,
        afterRouteHEPP: afterRoute.valueHEPP,
        applicationProbability: Number(contribution?.probability ?? 1),
        polarity,
        sourceEventId: String(
          contribution?.sourceActionId || contribution?.effectInstanceId ||
          `${entry.candidateId}:resource:${index}`,
        ).trim(),
        sourceFactId: `${entry.candidateId}:resource:${index}`,
        targetUnitId: targetId,
        sequence: index,
      });
      return;
    }
    if (
      String(evidence?.productId || '').trim() &&
      Array.isArray(evidence?.useEffects) &&
      evidence.useEffects.length
    ) {
      const creationProjection = referenceCreationRouteProjection({
        entry,
        contribution,
        index,
        world,
        preview,
        request,
        decision,
      });
      if (creationProjection.reason) {
        reasons.push(creationProjection.reason);
        return;
      }
      if (creationProjection.fact &&
          Math.abs(creationProjection.valueHEPP) > 1e-9) {
        rawRouteFacts.push(creationProjection.fact);
      }
      return;
    }
    if (outcomeKind === 'SUMMON_WINDOW') {
      const evidence = contribution?.evidence || {};
      const windows = Math.max(
        1,
        Number(evidence?.duration || 0),
        Number(evidence?.remainingWindows || 0) +
          (evidence?.immediateWindowConsumed === true ? 1 : 0),
      );
      const potential = Number(evidence?.actionPotential ?? 0);
      if (!Number.isFinite(potential)) {
        reasons.push(`SUMMON_POTENTIAL_NON_FINITE:${index}`);
        return;
      }
      if (Math.abs(potential) <= 1e-9) return;
      const targetId = String(contribution?.targetId || '').trim();
      const summon = (entry?.summonDefinitions || []).find(definition =>
        String(
          definition?.id || definition?.召唤键 || definition?.summonId || '',
        ).trim() === targetId ||
        String(definition?.id || '').trim() === String(evidence?.instanceId || '').trim(),
      );
      const summonSide = String(summon?.side || summon?.阵营 || '').trim() || request.actorSide;
      const polarity = summonSide === request.actorSide ? 1 : -1;
      const amountHEPP = potential * windows *
        Number(contribution?.probability ?? 1) * polarity;
      if (Math.abs(amountHEPP) <= 1e-9) return;
      rawExplicitFacts.push({
        componentCode: 'S5_SUMMON_WINDOW',
        formula: 'CONSTANT_HEPP',
        amountHEPP,
        sourceEventId: String(
          contribution?.sourceActionId || contribution?.effectInstanceId ||
          `${entry.candidateId}:summon:${index}`,
        ).trim(),
        sourceFactId: `${entry.candidateId}:summon:${index}`,
        targetUnitId: targetId || entry.actorId,
        sequence: index,
      });
      return;
    }
    const behaviorMutation = referenceBehaviorMutationKind(contribution);
    if (behaviorMutation) {
      const applicationProbability = Number(
        evidence?.applicationProbability ??
        evidence?.ownApplicationProbability ??
        contribution?.probability ?? 1,
      );
      if (evidence?.marginal === false || applicationProbability <= 1e-12 ||
          referenceActiveOpportunityCount(request, String(contribution?.targetId || '').trim()) === 0) return;
      reasons.push(`BEHAVIOR_ROUTE_UNAVAILABLE:${index}:${behaviorMutation}`);
      return;
    }
    const explicit = contribution?.evidence || {};
    const terminalValue = Number(
      explicit?.terminalDeltaHEPP ?? explicit?.terminalValueHEPP ?? 0,
    );
    if (riskInputs && Number.isFinite(terminalValue) && terminalValue < 0) {
      riskInputs.negativeTerminal = true;
    }
    if (
      ZERO_VALUE_KINDS.has(outcomeKind) &&
      Number(contribution?.expectedDelta || 0) === 0 &&
      contribution?.evidence?.marginal === false
    ) return;
    if (!outcomeKind) return;
    reasons.push(`UNMAPPED_PRODUCTION_FACT:${index}:${outcomeKind}`);
  });
  if (reasons.length) return { reasons };
  const rawFacts = [...groupedHealth.values()]
    .map((row, index) => ({
      componentCode: 'S1_HEALTH',
      formula: 'HEALTH_PP',
      deltaHp: row.deltaHp,
      maxHp: row.maxHp,
      polarity: row.side === entry.actorSide ? 1 : -1,
      sourceEventId: row.sourceEventId,
      sourceFactId: `${entry.candidateId}:state:${row.targetId}`,
      targetUnitId: row.targetId,
      sequence: index,
    }))
    .concat(rawExplicitFacts, rawRouteFacts);
  return {
    candidateId: entry.candidateId,
    actionId: String(row?.actionId || entry.candidateId).trim(),
    actorId: entry.actorId,
    targetSet: [...(entry.targetIds || [])],
    paymentMode: entry.resourcePotentialOnly ? 'EXTERNAL_TIMELINE' : 'FORMAL',
    legal: row.legal !== false,
    hardExclusionCodes: clone(row.hardExclusionCodes || []),
    rawFacts,
    informationGroups: [],
    actorSide: request.actorSide,
    objectiveContract: clone(request.objectiveContract || world?.胜负条件 || {}),
    targetProfiles: Object.entries(world?.参战者 || {}).flatMap(([side, units]) =>
      (Array.isArray(units) ? units : []).map(unit => ({
        targetId: preview.unitId(unit),
        name: preview.unitName(unit),
        side,
        currentHpPP: 100 * preview.readHp(unit) /
          Math.max(1, preview.readHpMax(unit)),
      }))
    ),
    riskInputs,
  };
}

function compareCandidate(reference, vector, caseId) {
  for (const field of [
    'stateDeltaTotal',
    'actionPoolDeltaTotal',
    'terminalDeltaTotal',
    'goalUtilityDeltaHEPP',
    'informationValueHEPP',
    'objectiveUtilityHEPP',
  ]) {
    approx(vector[field], reference[field], `${caseId}:${reference.candidateId}:${field}`);
  }
  const actualFacts = vector.causalFacts
    .slice()
    .sort((left, right) => left.sourceFactId < right.sourceFactId ? -1 : left.sourceFactId > right.sourceFactId ? 1 : 0);
  const expectedFacts = reference.causalFacts
    .slice()
    .sort((left, right) => left.sourceFactId < right.sourceFactId ? -1 : left.sourceFactId > right.sourceFactId ? 1 : 0);
  assert(
    actualFacts.length === expectedFacts.length,
    `PRODUCTION_AB_CAUSAL_COUNT_MISMATCH:${caseId}:${reference.candidateId}:${actualFacts.length}:${expectedFacts.length}:${JSON.stringify(actualFacts.map(fact => [fact.sourceFactId, fact.causalOwnerType, fact.valueHEPP]))}:${JSON.stringify(expectedFacts.map(fact => [fact.sourceFactId, fact.causalOwnerType, fact.valueHEPP]))}`,
  );
  actualFacts.forEach((fact, index) => {
    const expected = expectedFacts[index];
    assert(
      fact.sourceFactId === expected.sourceFactId &&
        fact.causalOwnerType === expected.causalOwnerType,
      `PRODUCTION_AB_CAUSAL_ID_MISMATCH:${caseId}:${reference.candidateId}:${index}`,
    );
    approx(
      fact.valueHEPP,
      expected.valueHEPP,
      `${caseId}:${reference.candidateId}:fact:${fact.sourceFactId}`,
    );
  });
  for (const field of [
    'worstTailUtilityHEPP',
    'survivalUtilityHEPP',
    'assetReserveHEPP',
    'discardedOverkillPP',
  ]) {
    approx(vector.paretoDimensions[field], reference[field], `${caseId}:${reference.candidateId}:${field}`);
  }
}

const sandbox = loadBattleSandbox({ includeTargetKernel: true });
const targetKernelSink = { slices: [] };
sandbox.__LWCS_R9V2_TARGET_KERNEL_TEST_SINK__ = targetKernelSink;
const decision = sandbox.__LWCS_BATTLE_DECISION__;
const preview = sandbox.__LWCS_BATTLE_PREVIEW__;
const cases = manualCasesById(sandbox);
const caseIds = [
  'duel_overmatch_lethal',
  'duel_peer_unknown_probe',
  'team_focus_without_overkill',
  'team_control_overlap',
  'summon_one_window',
  'item_creation_consumption',
  'raid_summon_heavy',
  'raid_response_terminal_information',
];
const rows = [];

for (const caseId of caseIds) {
  const definition = cases.get(caseId);
  assert(definition, `PRODUCTION_AB_CASE_MISSING:${caseId}`);
  const world = clone(definition.combatData);
  const actorId = String(world?.参战者?.team_player?.[0]?.id || '').trim();
  assert(actorId, `PRODUCTION_AB_ACTOR_MISSING:${caseId}`);
  const request = decision.prepareDecisionRequest({
    worldSnapshot: world,
    actorId,
    objectiveContract: world.胜负条件,
    battleIntent: {
      mode: definition.intent,
      objectives: clone(world.胜负条件),
    },
    actionOpportunity: {
      opportunityId: `${caseId}:production-reference-ab`,
      role: 'ACTIVE',
    },
    providerId: 'r9v2',
    analysisDepth: 'CANDIDATES_ONLY',
    r9v2InformationValueOnly: true,
    collectDecisionReplayIdentity: true,
    seed: definition.seed,
  });
  const normalizedWorld = request.visibleWorld;
  const targetResult = decision.runR9v2TargetProviderForTest(request);
  const slice = targetKernelSink.slices.at(-1);
  assert(slice, `PRODUCTION_AB_KERNEL_SLICE_MISSING:${caseId}`);
  const routePoolByUnit = new Map([
    [
      request.actorId,
      slice.rows
        .map(row => row.rawInput?.mechanicalEntry)
        .filter(Boolean),
    ],
  ]);
  const supported = [];
  const unsupported = [];
  const referenceCandidates = [];
  slice.rows.forEach((row, index) => {
    const entry = row.rawInput?.mechanicalEntry;
    const vector = slice.vectors[index];
    const referenceInput = toReferenceCandidate(
      entry,
      row,
      normalizedWorld,
      preview,
      request,
      routePoolByUnit,
      decision,
    );
    if (referenceInput.reasons) {
      unsupported.push({ candidateId: entry.candidateId, reasons: referenceInput.reasons });
      return;
    }
    const reference = evaluateRawCandidate(referenceInput);
    compareCandidate(reference, vector, caseId);
    referenceCandidates.push(referenceInput);
    supported.push({
      candidateId: entry.candidateId,
      componentFactCount: reference.causalFacts.length,
      valuesEqual: true,
    });
  });
  assert(unsupported.length === 0, `PRODUCTION_AB_REFERENCE_INPUT_UNSUPPORTED:${caseId}`);
  const referenceCase = evaluateRawCase({
    caseId,
    candidates: referenceCandidates,
    mode: String(definition.intent || '').trim().toLowerCase() === 'manual'
      ? 'manual'
      : 'auto',
    playerLockedCandidateId: request.playerLockedCandidateId,
  });
  const actualParetoIds = slice.vectors
    .filter(vector => vector.paretoWitness?.kind === 'NON_DOMINATED')
    .map(vector => vector.candidateId)
    .sort();
  const expectedParetoIds = referenceCase.pareto
    .map(candidate => candidate.candidateId)
    .sort();
  assert(
    JSON.stringify(actualParetoIds) === JSON.stringify(expectedParetoIds),
    `PRODUCTION_AB_PARETO_MISMATCH:${caseId}:${JSON.stringify(actualParetoIds)}:${JSON.stringify(expectedParetoIds)}`,
  );
  assert(
    targetResult?.selected?.candidateId === referenceCase.selected.candidateId,
    `PRODUCTION_AB_SELECTION_MISMATCH:${caseId}:${targetResult?.selected?.candidateId || ''}:${referenceCase.selected.candidateId}`,
  );
  const actualRequiredProofIds = targetResult?.requiredProofCandidateIds ||
    targetResult?.decisionAudit?.requiredProofCandidateIds || [];
  const expectedRequiredProofIds = [
    referenceCase.selected.candidateId,
    ...referenceCase.alternatives.map(candidate => candidate.candidateId),
  ].sort();
  assert(
    JSON.stringify(actualRequiredProofIds) === JSON.stringify(expectedRequiredProofIds),
    `PRODUCTION_AB_REQUIRED_PROOF_MISMATCH:${caseId}`,
  );
  rows.push({
    caseId,
    candidateCount: slice.rows.length,
    supportedCandidateCount: supported.length,
    unsupportedCandidateCount: unsupported.length,
    referenceParetoCandidateIds: expectedParetoIds,
    targetParetoCandidateIds: actualParetoIds,
    referenceSelectedCandidateId: referenceCase.selected.candidateId,
    targetSelectedCandidateId: targetResult?.selected?.candidateId || '',
    requiredProofCandidateIds: actualRequiredProofIds,
    supported,
    unsupported,
    fullCaseSelectionAB: true,
  });
}

const fullCaseSelectionAB = rows.every(row => row.fullCaseSelectionAB);
const output = {
  schemaVersion: 'M2ProductionReferenceABV1',
  status: fullCaseSelectionAB ? 'PASSED' : 'BLOCKED',
  scope: 'PRODUCTION_TARGET_KERNEL_FULL_CANDIDATE_FIELD_AB',
  caseCount: rows.length,
  rows,
  candidateValueFieldsEqual: rows.every(row => row.supportedCandidateCount > 0),
  causalFactsEqual: rows.every(row => row.supportedCandidateCount > 0),
  paretoAndSelectionEqual: rows.every(row => row.fullCaseSelectionAB),
  requiredProofCoverageEqual: rows.every(row => row.requiredProofCandidateIds.length > 0),
  fullCaseSelectionAB,
  targetProductionAdapterAB: fullCaseSelectionAB,
  closureStatus: fullCaseSelectionAB
    ? 'CLOSED'
    : 'BLOCKED_PENDING_S2_S4_S5_REFERENCE_FACTS',
  kernelHash: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecisionR9v2Kernel_Module.js'))),
  decisionHash: sha256(fs.readFileSync(path.join(repoRoot, 'BattleDecision_Module.js'))),
  referenceHash: sha256(fs.readFileSync(path.join(repoRoot, 'tools', 'rc6', 'reference', 'reference-value-evaluator-v2.mjs'))),
  harnessHash: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
};
fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
fs.writeFileSync(evidencePath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (!fullCaseSelectionAB) process.exitCode = 1;
