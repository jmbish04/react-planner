import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
});

// Versions form a DAG: each version points at its parent. This gives rollback
// (restore an older version), clone, and branch (save a new child off any node)
// without ever mutating or losing prior versions.
export const versions = sqliteTable('versions', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  parentVersionId: text('parent_version_id'),
  label: text('label').notNull(),
  scene: text('scene').notNull(), // JSON-serialized react-planner scene
  createdAt: integer('created_at').notNull(),
});

export type ProjectRow = typeof projects.$inferSelect;
export type VersionRow = typeof versions.$inferSelect;
