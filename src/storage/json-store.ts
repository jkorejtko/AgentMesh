
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import type { ZodType } from 'zod';

export async function readJson<T>(
  filePath: string,
  schema: ZodType<T>,
): Promise<T> {
  const absolutePath = resolve(filePath);
  const content = await readFile(absolutePath, 'utf8');
  const parsed: unknown = JSON.parse(content);

  return schema.parse(parsed);
}

export async function writeJson<T>(
  filePath: string,
  data: T,
  schema: ZodType<T>,
): Promise<void> {
  const absolutePath = resolve(filePath);
  const directory = dirname(absolutePath);
  const validated = schema.parse(data);

  await mkdir(directory, { recursive: true });

  const temporaryPath = `${absolutePath}.${randomUUID()}.tmp`;
  const content = `${JSON.stringify(validated, null, 2)}\n`;

  try {
    await writeFile(temporaryPath, content, {
      encoding: 'utf8',
      flag: 'wx',
    });

    await rename(temporaryPath, absolutePath);
  } catch (error) {
    const { unlink } = await import('node:fs/promises');

    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}


export async function writeJsonRaw(
  filePath: string,
  data: unknown,
): Promise<void> {
  const absolutePath = resolve(filePath);
  const directory = dirname(absolutePath);

  await mkdir(directory, { recursive: true });

  const temporaryPath = `${absolutePath}.${randomUUID()}.tmp`;
  const content = `${JSON.stringify(data, null, 2)}\n`;

  try {
    await writeFile(temporaryPath, content, {
      encoding: 'utf8',
      flag: 'wx',
    });

    await rename(temporaryPath, absolutePath);
  } catch (error) {
    const { unlink } = await import('node:fs/promises');

    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}
