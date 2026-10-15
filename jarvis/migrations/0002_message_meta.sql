-- Per-message metadata (e.g. reply timings) used for quality and latency review.
ALTER TABLE messages ADD COLUMN meta TEXT NOT NULL DEFAULT '';
