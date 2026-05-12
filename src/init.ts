import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { configTemplate } from './config.js';

export async function initConfig(root: string, preset: string, force = false): Promise<string> {
  const target = path.join(root, '.blobbudget.json');
  await writeFile(target, configTemplate(preset), { flag: force ? 'w' : 'wx' });
  return target;
}
