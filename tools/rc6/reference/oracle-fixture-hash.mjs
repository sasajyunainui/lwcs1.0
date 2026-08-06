import crypto from 'node:crypto';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

export const hashJson = value => sha256(JSON.stringify(value));

// Binding excludes generated fixture/status fields so regeneration is stable.
export const oracleIndexBinding = oracleIndex => ({
  schemaVersion: oracleIndex.schemaVersion,
  sourcePath: oracleIndex.sourcePath,
  sourceHash: oracleIndex.sourceHash,
  count: oracleIndex.count,
  oracles: (oracleIndex.oracles || []).map(oracle => ({
    schemaVersion: oracle.schemaVersion,
    oracleId: oracle.oracleId,
    caseId: oracle.caseId,
    semanticDomain: oracle.semanticDomain,
  })),
});

export const oracleIndexBindingHash = oracleIndex =>
  hashJson(oracleIndexBinding(oracleIndex));

