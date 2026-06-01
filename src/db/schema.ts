import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: text("created_at").notNull()
});

export const revisions = sqliteTable("revisions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  revisionNumber: integer("revision_number").notNull(),
  description: text("description").notNull(),
  stateJson: text("state_json").notNull(),
  createdAt: text("created_at").notNull()
});

export const snapshots = sqliteTable("snapshots", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  revisionId: text("revision_id").notNull(),
  imageUrl: text("image_url").notNull(),
  viewMode: text("view_mode").notNull(),
  timeOfDay: text("time_of_day").notNull(),
  createdAt: text("created_at").notNull()
});
