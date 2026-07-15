/* BattleReport_Module.js - Structured battle fact projection. */

(() => {
  'use strict';

  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  const runtime = root.__LWCS_BATTLE_RUNTIME__;
  if (!runtime || runtime.version !== '7.3-R6.3') {
    throw new Error(`battle_report_runtime_version_mismatch:${runtime?.version || 'missing'}`);
  }

  const visibilityModes = Object.freeze(['PLAYER', 'DEVELOPER']);

  function cloneValue(value) {
    return runtime.cloneValue(value);
  }

  function normalizeVisibilityMode(value = 'PLAYER') {
    const mode = String(value || '').trim().toUpperCase();
    if (!visibilityModes.includes(mode)) throw new Error(`battle_report_visibility_mode_invalid:${mode || 'missing'}`);
    return mode;
  }

  function eventFactType(event = {}) {
    return String(event?.factType || runtime.inferFactType(event?.eventKind, event) || 'EVENT').trim();
  }

  function numericTokens(event = {}, visibilityMode = 'PLAYER') {
    const meta = event?.meta && typeof event.meta === 'object' ? event.meta : {};
    const tokens = [];
    const push = (label, value, unit, sourceName, sourceType, operation) => {
      const number = Number(value);
      if (!Number.isFinite(number)) return;
      tokens.push({
        label,
        value: number,
        unit,
        sourceName,
        sourceType,
        operation,
        sourceEventId: String(event?.eventId || '').trim(),
        visibility: visibilityMode,
      });
    };
    const damage = Number(event?.appliedDamage ?? meta.appliedDamage);
    if (damage > 0) push('最终伤害', damage, 'HP', String(event?.actionName || '伤害结算').trim(), 'SETTLEMENT', 'SET');
    const delta = Number(event?.delta ?? meta.delta);
    if (Number.isFinite(delta) && delta !== 0) {
      push('资源变化', delta, String(event?.resource || meta.resource || '').trim(), String(event?.actionName || '资源结算').trim(), 'RESOURCE', 'ADD');
    }
    const probability = Number(event?.probability ?? meta.probability ?? meta.dodgeRate ?? meta.successRate);
    if (Number.isFinite(probability) && probability >= 0 && probability <= 1) {
      push('成功率', probability * 100, '%', String(event?.actionName || '判定').trim(), 'PROBABILITY', 'SET');
    }
    const roll = Number(event?.roll ?? meta.roll ?? meta.dodgeRoll);
    if (Number.isFinite(roll) && roll >= 0 && roll <= 1) {
      push('随机值', roll * 100, '%', '固定种子随机流', 'RANDOM', 'SET');
    }
    return tokens;
  }

  function buildFact(event = {}, visibilityMode = 'PLAYER') {
    const fact = {
      factId: String(event?.eventId || '').trim(),
      round: Math.max(0, Number(event?.round || 0)),
      actionId: String(event?.actionId || '').trim(),
      sourceActionId: String(event?.sourceActionId || '').trim(),
      parentNodeId: String(event?.parentNodeId || '').trim(),
      reactionNodeId: String(event?.reactionNodeId || '').trim(),
      eventKind: String(event?.eventKind || '').trim(),
      factType: eventFactType(event),
      actorId: String(event?.actorId || event?.actorName || '').trim(),
      actorName: String(event?.actorName || '').trim(),
      actorSide: String(event?.actorSide || '').trim(),
      targetIds: Array.isArray(event?.targetIds) ? event.targetIds.map(value => String(value || '').trim()).filter(Boolean) : [],
      targetName: String(event?.targetName || '').trim(),
      targetSide: String(event?.targetSide || '').trim(),
      actorControl: String(event?.actorControl || '').trim(),
      actionRole: String(event?.actionRole || '').trim(),
      actionName: String(event?.actionName || '').trim(),
      resultState: String(event?.resultState || event?.result || '').trim(),
      numericTokens: numericTokens(event, visibilityMode),
      canonicalFactOwner: '',
      projectionRefs: [],
    };
    if (visibilityMode === 'DEVELOPER') {
      fact.developerDetail = {
        ruleCode: String(event?.ruleCode || '').trim(),
        result: String(event?.result || '').trim(),
        meta: cloneValue(event?.meta || {}),
      };
    }
    return fact;
  }

  function build(input = {}) {
    const draft = input?.draft && typeof input.draft === 'object' ? cloneValue(input.draft) : null;
    if (!draft || String(draft?.status || '').trim() !== 'DRAFT') throw new Error('battle_report_draft_invalid');
    const draftHash = String(draft?.draftHash || '').trim();
    delete draft.draftHash;
    if (!draftHash || runtime.hashBattleValue(draft) !== draftHash) throw new Error('BATTLE_COMMIT_HASH_MISMATCH:draft');
    const visibilityMode = normalizeVisibilityMode(input?.visibilityMode || 'PLAYER');
    const ledger = Array.isArray(draft?.ledger) ? draft.ledger.filter(Boolean) : [];
    const actionStarts = new Map(ledger
      .filter(event => String(event?.eventKind || '').trim() === 'action_start')
      .map(event => [String(event?.actionId || '').trim(), event])
      .filter(([actionId]) => !!actionId));
    const resolveRootActionId = event => {
      let actionId = String(event?.sourceActionId || event?.actionId || event?.eventId || '').trim();
      const visited = new Set();
      for (let depth = 0; actionId && depth < 16 && !visited.has(actionId); depth += 1) {
        visited.add(actionId);
        const start = actionStarts.get(actionId);
        const sourceActionId = String(start?.sourceActionId || '').trim();
        if (!sourceActionId) break;
        actionId = sourceActionId;
      }
      return actionId || String(event?.eventId || '').trim();
    };
    const factRegistry = ledger.map(event => buildFact(event, visibilityMode));
    const factsById = new Map(factRegistry.map(fact => [fact.factId, fact]));
    const exchangeMap = new Map();
    const roundMap = new Map();
    const finalFactIds = [];
    ledger.forEach(event => {
      const factId = String(event?.eventId || '').trim();
      const fact = factsById.get(factId);
      if (!fact) return;
      const round = Math.max(0, Number(event?.round || 0));
      if (!roundMap.has(round)) roundMap.set(round, { round, factIds: [], canonicalFactIds: [] });
      roundMap.get(round).factIds.push(factId);
      const eventKind = String(event?.eventKind || '').trim();
      if (eventKind === 'round_summary') {
        fact.canonicalFactOwner = `round:${round}`;
        roundMap.get(round).canonicalFactIds.push(factId);
        return;
      }
      if (eventKind === 'battle_objective_resolved') {
        fact.canonicalFactOwner = 'final-summary';
        finalFactIds.push(factId);
        return;
      }
      const rootActionId = resolveRootActionId(event);
      const exchangeId = `exchange:${rootActionId}`;
      if (!exchangeMap.has(exchangeId)) {
        exchangeMap.set(exchangeId, {
          exchangeId,
          round,
          rootActionId,
          actorId: String(event?.actorId || event?.actorName || '').trim(),
          targetIds: Array.isArray(event?.targetIds) ? event.targetIds.map(value => String(value || '').trim()).filter(Boolean) : [],
          factIds: [],
        });
      }
      exchangeMap.get(exchangeId).factIds.push(factId);
      fact.canonicalFactOwner = exchangeId;
    });
    const exchanges = [...exchangeMap.values()];
    const roundOverview = Array.from({ length: Math.max(0, Number(draft?.actualRoundCount || 0)) }, (_, index) => {
      const round = index + 1;
      return roundMap.get(round) || { round, factIds: [], canonicalFactIds: [] };
    });
    const adjudications = (Array.isArray(draft?.decisionAudit) ? draft.decisionAudit : []).map((decision, index) => ({
      adjudicationId: `adjudication:${Number(decision?.round || 0)}:${String(decision?.actorId || '').trim()}:${index + 1}`,
      round: Math.max(0, Number(decision?.round || 0)),
      actorId: String(decision?.actorId || '').trim(),
      actionRole: String(decision?.actionRole || 'ACTIVE').trim(),
      selected: cloneValue(decision?.selected || null),
      alternatives: (Array.isArray(decision?.scoreAudit) ? decision.scoreAudit : [])
        .filter(candidate => candidate?.selected !== true)
        .slice(0, 2)
        .map(candidate => cloneValue(candidate)),
    }));
    factRegistry.forEach(fact => {
      fact.projectionRefs.push({ ownerId: fact.canonicalFactOwner, projection: 'DETAIL' });
      const roundId = `round:${fact.round}`;
      if (fact.canonicalFactOwner !== roundId) fact.projectionRefs.push({ ownerId: roundId, projection: 'ROUND_REFERENCE' });
    });
    return {
      schemaVersion: '7.3-R7.4-report-1',
      visibilityMode,
      actualRoundCount: Math.max(0, Number(draft?.actualRoundCount || 0)),
      terminalResult: cloneValue(draft?.terminalResult || null),
      projectionStatus: 'PENDING',
      sourceDraftHash: draftHash,
      factRegistry,
      roundOverview,
      exchanges,
      adjudications,
      finalSummary: {
        canonicalFactIds: finalFactIds,
        terminalResult: cloneValue(draft?.terminalResult || null),
        finalSnapshot: cloneValue(draft?.finalSnapshot || null),
      },
      aiSummaryInput: {
        terminalResult: cloneValue(draft?.terminalResult || null),
        finalSnapshot: cloneValue(draft?.finalSnapshot || null),
      },
    };
  }

  function auditProjection(reportDto = {}) {
    const report = reportDto && typeof reportDto === 'object' ? cloneValue(reportDto) : {};
    const fatals = [];
    const pushFatal = (code, detail = {}) => fatals.push({ code, ...detail });
    const registry = Array.isArray(report?.factRegistry) ? report.factRegistry : [];
    const factsById = new Map();
    registry.forEach((fact, index) => {
      const factId = String(fact?.factId || '').trim();
      if (!factId) {
        pushFatal('REPORT_FACT_MISSING', { index, reason: 'FACT_ID_MISSING' });
        return;
      }
      if (factsById.has(factId)) {
        pushFatal('REPORT_FACT_OWNER_CONFLICT', { factId, reason: 'FACT_REGISTERED_TWICE' });
        return;
      }
      factsById.set(factId, fact);
      (Array.isArray(fact?.numericTokens) ? fact.numericTokens : []).forEach((token, tokenIndex) => {
        if (
          !Number.isFinite(Number(token?.value)) ||
          String(token?.sourceEventId || '').trim() !== factId
        ) {
          pushFatal('REPORT_NUMBER_SOURCE_MISSING', { factId, tokenIndex });
        }
      });
      if (report?.visibilityMode === 'PLAYER' && fact?.developerDetail !== undefined) {
        pushFatal('REPORT_VISIBILITY_LEAK', { factId, reason: 'DEVELOPER_DETAIL_IN_PLAYER_REPORT' });
      }
    });
    const ownerRefs = new Map();
    const registerOwner = (ownerId, factId) => {
      const normalizedOwnerId = String(ownerId || '').trim();
      const normalizedFactId = String(factId || '').trim();
      if (!factsById.has(normalizedFactId)) {
        pushFatal('REPORT_FACT_INVENTED', { ownerId: normalizedOwnerId, factId: normalizedFactId });
        return;
      }
      if (!ownerRefs.has(normalizedFactId)) ownerRefs.set(normalizedFactId, []);
      ownerRefs.get(normalizedFactId).push(normalizedOwnerId);
    };
    (Array.isArray(report?.exchanges) ? report.exchanges : []).forEach(exchange => {
      (Array.isArray(exchange?.factIds) ? exchange.factIds : []).forEach(factId => registerOwner(exchange?.exchangeId, factId));
    });
    (Array.isArray(report?.roundOverview) ? report.roundOverview : []).forEach(round => {
      (Array.isArray(round?.canonicalFactIds) ? round.canonicalFactIds : []).forEach(factId => registerOwner(`round:${Number(round?.round || 0)}`, factId));
      (Array.isArray(round?.factIds) ? round.factIds : []).forEach(factId => {
        if (!factsById.has(String(factId || '').trim())) pushFatal('REPORT_FACT_INVENTED', { ownerId: `round:${round?.round}`, factId });
      });
    });
    (Array.isArray(report?.finalSummary?.canonicalFactIds) ? report.finalSummary.canonicalFactIds : [])
      .forEach(factId => registerOwner('final-summary', factId));
    factsById.forEach((fact, factId) => {
      const owners = ownerRefs.get(factId) || [];
      const canonicalOwner = String(fact?.canonicalFactOwner || '').trim();
      if (owners.length === 0) {
        pushFatal('REPORT_FACT_MISSING', { factId, reason: 'DETAILED_OWNER_MISSING' });
      } else if (owners.length !== 1 || owners[0] !== canonicalOwner) {
        pushFatal('REPORT_FACT_OWNER_CONFLICT', { factId, canonicalOwner, owners });
      }
    });
    report.projectionStatus = fatals.length ? 'FAILED' : 'PASSED';
    const reportHash = runtime.hashBattleValue(report);
    return {
      passed: fatals.length === 0,
      fatalCount: fatals.length,
      fatals,
      reportHash,
      reportDto: report,
    };
  }

  function serializeFullText(reportDto = {}) {
    const registry = new Map((Array.isArray(reportDto?.factRegistry) ? reportDto.factRegistry : [])
      .map(fact => [String(fact?.factId || '').trim(), fact]));
    const lines = [];
    (Array.isArray(reportDto?.roundOverview) ? reportDto.roundOverview : []).forEach(round => {
      lines.push(`回合 ${Number(round?.round || 0)}`);
      (Array.isArray(round?.factIds) ? round.factIds : []).forEach(factId => {
        const fact = registry.get(String(factId || '').trim());
        if (!fact) return;
        lines.push(`${fact.actorName || 'SYSTEM'} | ${fact.actionName || fact.eventKind} | ${fact.targetName || '-'} | ${fact.resultState || '-'}`);
      });
    });
    return lines.join('\n');
  }

  root.__LWCS_BATTLE_REPORT__ = Object.freeze({
    version: '7.3-R7.4-report-1',
    visibilityModes,
    build,
    auditProjection,
    serializeFullText,
  });
})();
