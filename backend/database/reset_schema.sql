-- Drop everything and recreate
DROP TRIGGER IF EXISTS update_scans_updated_at ON scans;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TABLE IF EXISTS scans CASCADE;
DROP TABLE IF EXISTS item_types CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Users table (synced with Firebase Auth)
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Item types with estimated weights
CREATE TABLE item_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    estimated_weight_grams INTEGER NOT NULL,
    category VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default item types with weights
INSERT INTO item_types (name, estimated_weight_grams, category) VALUES
('Shirt', 200, 'tops'),
('T-Shirt', 150, 'tops'),
('Blouse', 180, 'tops'),
('Sweater', 400, 'tops'),
('Hoodie', 500, 'tops'),
('Jacket', 600, 'outerwear'),
('Coat', 800, 'outerwear'),
('Jeans', 600, 'bottoms'),
('Pants', 400, 'bottoms'),
('Shorts', 250, 'bottoms'),
('Skirt', 300, 'bottoms'),
('Dress', 350, 'dresses'),
('Underwear', 50, 'undergarments'),
('Socks', 40, 'accessories'),
('Scarf', 100, 'accessories'),
('Garment', 300, 'general');

-- Scans table
CREATE TABLE scans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    firebase_uid VARCHAR(255) NOT NULL,
    brand VARCHAR(255),
    item_type VARCHAR(100),
    item_weight_grams INTEGER,
    fibers JSONB NOT NULL,
    environmental_score INTEGER NOT NULL,
    environmental_grade CHAR(1) NOT NULL,
    raw_text TEXT,
    scan_type VARCHAR(50) DEFAULT 'camera',
    water_usage_liters DECIMAL(10, 2),
    carbon_footprint_kg DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_scans_user_id ON scans(user_id);
CREATE INDEX idx_scans_firebase_uid ON scans(firebase_uid);
CREATE INDEX idx_scans_created_at ON scans(created_at DESC);
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);

-- Triggers to auto-update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scans_updated_at BEFORE UPDATE ON scans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
