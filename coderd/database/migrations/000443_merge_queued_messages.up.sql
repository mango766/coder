-- Add queued column to chat_messages
ALTER TABLE chat_messages ADD COLUMN queued boolean NOT NULL DEFAULT false;

-- Create index for queued message lookups
CREATE INDEX idx_chat_messages_queued ON chat_messages (chat_id) WHERE queued = true;

-- Migrate existing queued messages into chat_messages
INSERT INTO chat_messages (chat_id, created_at, role, content, visibility, queued)
SELECT chat_id, created_at, 'user', content, 'both'::chat_message_visibility, true
FROM chat_queued_messages
ORDER BY id ASC;

-- Drop the old table (this also drops its indexes and foreign keys)
DROP TABLE chat_queued_messages;
