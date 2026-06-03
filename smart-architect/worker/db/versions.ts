import { eq, desc } from 'drizzle-orm';
import { db } from './index';
import { projects, versions, type VersionRow } from './schema';
import type { Scene } from '../blueprint/scene';

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

async function ensureProject(env: Env, projectId: string) {
  const d = db(env);
  const existing = await d.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (existing.length === 0) {
    await d.insert(projects).values({ id: projectId, name: projectId, createdAt: Date.now() });
  }
}

export interface VersionMeta {
  id: string;
  projectId: string;
  parentVersionId: string | null;
  label: string;
  createdAt: number;
}

function toMeta(row: VersionRow): VersionMeta {
  return {
    id: row.id, projectId: row.projectId, parentVersionId: row.parentVersionId,
    label: row.label, createdAt: row.createdAt,
  };
}

export async function saveVersion(
  env: Env,
  args: { projectId: string; parentVersionId: string | null; label: string; scene: Scene }
): Promise<VersionMeta> {
  await ensureProject(env, args.projectId);
  const row: VersionRow = {
    id: uid('ver'),
    projectId: args.projectId,
    parentVersionId: args.parentVersionId,
    label: args.label,
    scene: JSON.stringify(args.scene),
    createdAt: Date.now(),
  };
  await db(env).insert(versions).values(row);
  return toMeta(row);
}

export async function listVersions(env: Env, projectId: string): Promise<VersionMeta[]> {
  const rows = await db(env).select().from(versions)
    .where(eq(versions.projectId, projectId))
    .orderBy(desc(versions.createdAt));
  return rows.map(toMeta);
}

export async function getVersion(env: Env, versionId: string): Promise<(VersionMeta & { scene: Scene }) | null> {
  const rows = await db(env).select().from(versions).where(eq(versions.id, versionId)).limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  return { ...toMeta(row), scene: JSON.parse(row.scene) as Scene };
}

/** Clone a version into a new branch: a new version whose parent is the source, scene copied verbatim. */
export async function cloneVersion(env: Env, versionId: string, label?: string): Promise<VersionMeta | null> {
  const src = await getVersion(env, versionId);
  if (!src) return null;
  return saveVersion(env, {
    projectId: src.projectId,
    parentVersionId: src.id,
    label: label || `Clone of ${src.label}`,
    scene: src.scene,
  });
}
