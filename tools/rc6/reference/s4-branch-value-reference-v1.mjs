const finite = (value, code) => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(code);
  return number;
};

const clone = value => structuredClone(value);

const compareUtf16 = (left, right) => {
  const a = String(left || '');
  const b = String(right || '');
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const difference = a.charCodeAt(index) - b.charCodeAt(index);
    if (difference) return difference;
  }
  return a.length - b.length;
};

const targetValue = (objective, world, effects) => {
  const values = Object.entries(objective.targets).map(([unitId, target]) => {
    const current = finite(world[unitId]?.progress, 'S4_REFERENCE_WORLD_VALUE');
    const threshold = finite(target.threshold, 'S4_REFERENCE_THRESHOLD_VALUE');
    const delta = finite(effects?.[unitId] || 0, 'S4_REFERENCE_EFFECT_VALUE');
    const next = Math.min(threshold, current + delta);
    return next - current;
  });
  if (!values.length) return 0;
  return objective.mode === 'ALL' ? Math.min(...values) : Math.max(...values);
};

const routeValue = (objective, world, row) => targetValue(
  objective,
  world,
  row.effects,
);

const affordable = (row, actorResource) =>
  finite(actorResource, 'S4_REFERENCE_RESOURCE_VALUE') + 1e-9 >=
  finite(row.resourceCost || 0, 'S4_REFERENCE_RESOURCE_COST');

const sortRows = rows => rows.slice().sort((left, right) =>
  finite(right.valueHEPP, 'S4_REFERENCE_ROUTE_VALUE') -
    finite(left.valueHEPP, 'S4_REFERENCE_ROUTE_VALUE') ||
  compareUtf16(left.candidateId, right.candidateId),
);

export const fullRouteVector = (fixture, branch) => {
  const rows = fixture.rows
    .filter(row => affordable(row, branch.actorResource ?? fixture.actorResource))
    .map(row => ({
      candidateId: row.candidateId,
      valueHEPP: routeValue(fixture.objective, branch.world, row),
    }));
  return sortRows(rows);
};

export const buildBasis = fixture => Object.freeze({
  rows: fixture.rows.map(row => Object.freeze({
    candidateId: row.candidateId,
    dependencies: Object.freeze([...row.dependencies].sort(compareUtf16)),
    baselineValueHEPP: routeValue(fixture.objective, fixture.objective.targets, row),
    row: clone(row),
  })),
});

export const sparseRouteVector = (fixture, branch, basis) => {
  const changed = new Set(branch.changedUnitIds || []);
  const rows = basis.rows
    .filter(row => affordable(row.row, branch.actorResource ?? fixture.actorResource))
    .map(row => ({
      candidateId: row.candidateId,
      valueHEPP: row.dependencies.some(unitId => changed.has(unitId))
        ? routeValue(fixture.objective, branch.world, row.row)
        : row.baselineValueHEPP,
    }));
  return sortRows(rows);
};

const routeMap = vector => new Map(vector.map(row => [row.candidateId, row.valueHEPP]));

export const informationValue = (vectors, probabilities) => {
  if (probabilities.every(value => value === 0 || value === 1)) return 0;
  const tables = vectors.map(routeMap);
  const adaptive = tables.reduce((sum, table, index) =>
    sum + probabilities[index] * Math.max(0, ...table.values()),
  0);
  const common = [...tables[0].keys()].filter(candidateId =>
    tables.every(table => table.has(candidateId)),
  );
  const committed = Math.max(
    0,
    ...common.map(candidateId =>
      tables.reduce((sum, table, index) =>
        sum + probabilities[index] * table.get(candidateId),
      0),
    ),
  );
  return Math.max(0, adaptive - committed);
};
