-- Recreate the old table
CREATE TABLE chat_queued_messages (
    id BIGSERIAL PRIMARY KEY,
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_chat_queued_messages_chat_id ON chat_queued_messages(chat_id);

-- Move queued messages back
INSERT INTO chat_queued_messages (chat_id, content, created_at)
SELECT chat_id, content, created_at
FROM chat_messages
WHERE queued = true
ORDER BY id ASC;

-- Remove queued messages from chat_messages
DELETE FROM chat_messages WHERE queued = true;

-- Drop the column
ALTER TABLE chat_messages DROP COLUMN queued;
