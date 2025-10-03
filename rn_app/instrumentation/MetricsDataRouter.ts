// metrics-dump.ts
import RNFS from 'react-native-fs';
import { metrics } from './VideoMetrics'; // or wherever your Metrics instance lives

const DIR = RNFS.DocumentDirectoryPath + '/metrics';
const FILE = `${DIR}/plays.ndjson`;

export async function metricsInit() {
  try { await RNFS.mkdir(DIR); } catch {}
}

export async function metricsAppend(records: any[]) {
  if (!records.length) return;
  const lines = records.map(r => JSON.stringify(r)).join('\n') + '\n';
  await RNFS.appendFile(FILE, lines, 'utf8');
}

export async function metricsFlushToFile() {
  const out = metrics.flush();
  await metricsAppend(out);
}

export async function metricsRotateIfBig(maxBytes = 5_000_000) { // ~5MB
  try {
    const stat = await RNFS.stat(FILE);
    if (Number(stat.size) > maxBytes) {
      const rotated = `${DIR}/plays-${Date.now()}.ndjson`;
      await RNFS.moveFile(FILE, rotated);
      await RNFS.writeFile(FILE, '', 'utf8');
    }
  } catch { /* file may not exist yet */ }
}

export const metricsFilePath = FILE;
