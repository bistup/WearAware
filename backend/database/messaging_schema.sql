-- messaging and trade system schema
-- conversations, messages, trade requests with charity shop dropbox

-- conversations between two users
CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  user1_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user1_id, user2_id),
  CHECK (user1_id < user2_id)
);

CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations(user2_id);

-- messages within a conversation
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'trade_request', 'trade_update'
  trade_request_id INTEGER, -- links to trade_requests if message_type is trade-related
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- trade requests between users
CREATE TABLE IF NOT EXISTS trade_requests (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- the item being offered by the requester
  offered_item_id INTEGER NOT NULL REFERENCES wardrobe_items(id) ON DELETE CASCADE,
  -- the item wanted from the recipient (NULL = offering for free)
  wanted_item_id INTEGER REFERENCES wardrobe_items(id) ON DELETE SET NULL,
  trade_type VARCHAR(10) NOT NULL DEFAULT 'trade', -- 'trade' or 'free'
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined', 'completed', 'cancelled'
  -- charity shop meetup details (set when accepted)
  charity_shop_name VARCHAR(255),
  charity_shop_address TEXT,
  charity_shop_lat DOUBLE PRECISION,
  charity_shop_lng DOUBLE PRECISION,
  -- dropbox PIN codes
  requester_pin VARCHAR(6),
  recipient_pin VARCHAR(6),
  requester_compartment INTEGER,
  recipient_compartment INTEGER,
  -- user locations for midpoint calculation
  requester_lat DOUBLE PRECISION,
  requester_lng DOUBLE PRECISION,
  recipient_lat DOUBLE PRECISION,
  recipient_lng DOUBLE PRECISION,
  accepted_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_requests_conversation ON trade_requests(conversation_id);
CREATE INDEX IF NOT EXISTS idx_trade_requests_requester ON trade_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_trade_requests_recipient ON trade_requests(recipient_id);
CREATE INDEX IF NOT EXISTS idx_trade_requests_status ON trade_requests(status);
