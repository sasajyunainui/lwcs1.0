import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { sha256 } from './r83_rc6_battle_harness.mjs';

export function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export function writeArtifact(storeRoot, artifactType, value) {
  const content = canonicalJson(value);
  const contentHash = sha256(content);
  const relativePath = path.join(
    'objects',
    contentHash.slice(0, 2),
    `${contentHash}.json.gz`,
  );
  const absolutePath = path.join(storeRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  if (fs.existsSync(absolutePath)) {
    const existing = gunzipSync(
      fs.readFileSync(absolutePath),
    ).toString('utf8');
    if (existing !== content) {
      throw new Error(`EVIDENCE_CONTENT_HASH_COLLISION:${contentHash}`);
    }
  } else {
    fs.writeFileSync(
      absolutePath,
      gzipSync(Buffer.from(content, 'utf8'), {
        level: 9,
        mtime: 0,
      }),
    );
  }
  const storedByteLength = fs.statSync(absolutePath).size;
  return Object.freeze({
    schemaVersion: 'ContentAddressedArtifactRefV1',
    artifactType,
    contentHash,
    byteLength: Buffer.byteLength(content, 'utf8'),
    storedByteLength,
    encoding: 'gzip+utf8-json',
    relativePath: relativePath.replaceAll('\\', '/'),
  });
}

export function readArtifact(storeRoot, reference) {
  const absolutePath = path.join(storeRoot, reference.relativePath);
  const content = gunzipSync(
    fs.readFileSync(absolutePath),
  ).toString('utf8');
  if (sha256(content) !== reference.contentHash) {
    throw new Error(`EVIDENCE_ARTIFACT_HASH_MISMATCH:${reference.contentHash}`);
  }
  return JSON.parse(content);
}

export function writeArtifactIndex(outputPath, payload) {
  const index = {
    schemaVersion: 'EvidenceArtifactIndexV1',
    ...payload,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, canonicalJson(index), 'utf8');
  return index;
}
