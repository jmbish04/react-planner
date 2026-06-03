-- Migration: v1
-- Created at: 2026-05-25

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Create revisions table
CREATE TABLE IF NOT EXISTS revisions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  revision_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Create snapshots table
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  revision_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  view_mode TEXT NOT NULL,
  time_of_day TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_revisions_project_id ON revisions(project_id);
CREATE INDEX IF NOT EXISTS idx_revisions_revision_number ON revisions(revision_number);
CREATE INDEX IF NOT EXISTS idx_snapshots_session_id ON snapshots(session_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_revision_id ON snapshots(revision_id);
