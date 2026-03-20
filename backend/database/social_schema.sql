-- WearAware Social Features Schema
-- Run after the main schema.sql has been applied
-- Adds tables for: follows, posts, likes, comments, achievements, challenges,
-- wishlists, product recommendations, and user stats

-- 
-- 1. USER PROFILES (extends existing users table)
-- 

CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url TEXT,
    privacy_level VARCHAR(20) DEFAULT 'public',
    -- 'private', 'followers', 'public'
    show_statistics BOOLEAN DEFAULT TRUE,
    allow_follow BOOLEAN DEFAULT TRUE,
    total_scans INTEGER DEFAULT 0,
    average_grade VARCHAR(1),
    sustainability_score INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);

-- 
-- 2. FOLLOWS (follow/unfollow - directional relationship)
-- 

CREATE TABLE IF NOT EXISTS follows (
    id SERIAL PRIMARY KEY,
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, following_id),
    CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- 
-- 3. SCAN POSTS (shareable scan entries)
-- 

CREATE TABLE IF NOT EXISTS scan_posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scan_id INTEGER REFERENCES scans(id) ON DELETE SET NULL,
    caption TEXT,
    visibility VARCHAR(20) NOT NULL DEFAULT 'private',
    -- 'private', 'public'
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scan_posts_user ON scan_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_posts_scan ON scan_posts(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_posts_visibility ON scan_posts(visibility);
CREATE INDEX IF NOT EXISTS idx_scan_posts_created ON scan_posts(created_at DESC);

-- 
-- 4. LIKES
-- 

CREATE TABLE IF NOT EXISTS likes (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES scan_posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);

-- 
-- 5. COMMENTS
-- 

CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES scan_posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

-- 
-- 6. ACHIEVEMENTS
-- 

CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) UNIQUE NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    category VARCHAR(50) DEFAULT 'general',
    -- 'scanning', 'social', 'sustainability', 'streak'
    threshold INTEGER DEFAULT 1,
    points INTEGER DEFAULT 10,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed default achievements
INSERT INTO achievements (key, title, description, icon, category, threshold, points) VALUES
('first_scan', 'First Scan', 'Complete your first garment scan', '🔍', 'scanning', 1, 10),
('scan_5', 'Getting Started', 'Complete 5 garment scans', '📋', 'scanning', 5, 25),
('scan_25', 'Label Reader', 'Complete 25 garment scans', '📖', 'scanning', 25, 50),
('scan_100', 'Scanning Pro', 'Complete 100 garment scans', '🏆', 'scanning', 100, 100),
('grade_a_first', 'Green Choice', 'Scan your first A-graded item', '🌱', 'sustainability', 1, 15),
('grade_a_10', 'Eco Warrior', 'Scan 10 A-graded items', '🌿', 'sustainability', 10, 50),
('all_a_wardrobe', 'Perfect Wardrobe', 'Have 5 consecutive A-grade scans', '💚', 'sustainability', 5, 100),
('first_share', 'Going Social', 'Share your first scan publicly', '📢', 'social', 1, 10),
('share_10', 'Influencer', 'Share 10 scans publicly', '🌟', 'social', 10, 50),
('first_follow', 'Connected', 'Follow your first user', '🤝', 'social', 1, 10),
('followers_10', 'Growing Community', 'Get 10 followers', '👥', 'social', 10, 50),
('water_saver', 'Water Saver', 'Choose items saving 1000L of water vs polyester equivalents', '💧', 'sustainability', 1000, 75),
('carbon_cutter', 'Carbon Cutter', 'Choose items saving 10kg CO₂ vs synthetic equivalents', '🌍', 'sustainability', 10, 75),
('streak_7', 'Weekly Warrior', 'Scan at least once a day for 7 days', '🔥', 'streak', 7, 50),
('wishlist_5', 'Conscious Shopper', 'Add 5 sustainable alternatives to wishlist', '🛒', 'sustainability', 5, 25)
ON CONFLICT (key) DO NOTHING;

-- 
-- 7. USER ACHIEVEMENTS (junction table)
-- 

CREATE TABLE IF NOT EXISTS user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    progress INTEGER DEFAULT 0,
    unlocked BOOLEAN DEFAULT FALSE,
    unlocked_at TIMESTAMP,
    shared_to_feed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id);

-- 
-- 8. CHALLENGES
-- 

CREATE TABLE IF NOT EXISTS challenges (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    challenge_type VARCHAR(20) NOT NULL DEFAULT 'weekly',
    -- 'weekly', 'monthly'
    goal_type VARCHAR(50) NOT NULL,
    -- 'scan_count', 'avg_grade', 'water_saved', 'carbon_saved', 'share_count'
    goal_value INTEGER NOT NULL,
    points INTEGER DEFAULT 50,
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_challenges_dates ON challenges(starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_challenges_type ON challenges(challenge_type);

-- Seed some sample challenges  
INSERT INTO challenges (title, description, icon, challenge_type, goal_type, goal_value, points, starts_at, ends_at) VALUES
('Scan Sprint', 'Scan 10 items this week', '⚡', 'weekly', 'scan_count', 10, 50, NOW(), NOW() + INTERVAL '7 days'),
('Grade Chaser', 'Achieve an average grade of B or higher this month', '📈', 'monthly', 'avg_grade', 65, 100, NOW(), NOW() + INTERVAL '30 days'),
('Water Warrior', 'Choose items that save 500L of water this week', '💧', 'weekly', 'water_saved', 500, 75, NOW(), NOW() + INTERVAL '7 days'),
('Share & Care', 'Share 5 scans with the community this week', '🤝', 'weekly', 'share_count', 5, 50, NOW(), NOW() + INTERVAL '7 days'),
('Carbon Conscious', 'Save 5kg of CO₂ with sustainable choices this month', '🌍', 'monthly', 'carbon_saved', 5, 100, NOW(), NOW() + INTERVAL '30 days')
ON CONFLICT DO NOTHING;

-- 
-- 9. USER CHALLENGE PROGRESS
-- 

CREATE TABLE IF NOT EXISTS user_challenges (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    challenge_id INTEGER NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
    progress INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_challenges_user ON user_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_challenges_challenge ON user_challenges(challenge_id);

-- 
-- 10. PRODUCT RECOMMENDATIONS (sustainable alternatives)
-- 

CREATE TABLE IF NOT EXISTS product_recommendations (
    id SERIAL PRIMARY KEY,
    item_type VARCHAR(100) NOT NULL,
    brand VARCHAR(255) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    price_usd DECIMAL(10, 2),
    sustainability_grade CHAR(1) NOT NULL,
    sustainability_score INTEGER NOT NULL,
    water_usage_liters DECIMAL(10, 2),
    carbon_footprint_kg DECIMAL(10, 2),
    primary_fiber VARCHAR(100),
    external_url TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recommendations_item_type ON product_recommendations(item_type);
CREATE INDEX IF NOT EXISTS idx_recommendations_grade ON product_recommendations(sustainability_grade);
CREATE INDEX IF NOT EXISTS idx_recommendations_score ON product_recommendations(sustainability_score DESC);

-- Seed sample sustainable product alternatives
INSERT INTO product_recommendations (item_type, brand, product_name, price_usd, sustainability_grade, sustainability_score, water_usage_liters, carbon_footprint_kg, primary_fiber, external_url) VALUES
('T-Shirt', 'Patagonia', 'Organic Cotton Tee', 45.00, 'A', 85, 375.00, 0.15, 'Organic Cotton', 'https://www.patagonia.com'),
('T-Shirt', 'Pact', 'Essential Organic Crew', 25.00, 'A', 82, 400.00, 0.16, 'Organic Cotton', 'https://wearpact.com'),
('T-Shirt', 'tentree', 'TreeBlend Classic Tee', 38.00, 'A', 83, 350.00, 0.12, 'Tencel', 'https://www.tentree.com'),
('Jeans', 'Nudie Jeans', 'Lean Dean Organic', 189.00, 'A', 80, 1800.00, 0.60, 'Organic Cotton', 'https://www.nudiejeans.com'),
('Jeans', 'Outerknown', 'Ambassador Slim', 148.00, 'B', 75, 2200.00, 0.72, 'Organic Cotton', 'https://www.outerknown.com'),
('Hoodie', 'Pangaia', 'Organic Cotton Hoodie', 95.00, 'A', 84, 1250.00, 0.50, 'Organic Cotton', 'https://thepangaia.com'),
('Hoodie', 'Allbirds', 'R&R Hoodie', 98.00, 'A', 81, 1400.00, 0.55, 'Merino Wool', 'https://www.allbirds.com'),
('Jacket', 'Patagonia', 'Better Sweater Jacket', 149.00, 'A', 82, 900.00, 0.40, 'Recycled Polyester', 'https://www.patagonia.com'),
('Jacket', 'Girlfriend Collective', 'Recycled Fleece Jacket', 128.00, 'A', 80, 850.00, 0.38, 'Recycled Polyester', 'https://www.girlfriend.com'),
('Dress', 'Reformation', 'Casette Linen Dress', 148.00, 'A', 85, 525.00, 0.23, 'Linen', 'https://www.thereformation.com'),
('Dress', 'Eileen Fisher', 'Organic Linen Dress', 198.00, 'A', 83, 550.00, 0.25, 'Organic Linen', 'https://www.eileenfisher.com'),
('Shirt', 'Kotn', 'Essential Button-Down', 68.00, 'A', 82, 600.00, 0.20, 'Organic Cotton', 'https://kotn.com'),
('Sweater', 'Everlane', 'ReCashmere Crew', 120.00, 'B', 72, 1800.00, 0.90, 'Recycled Cashmere', 'https://www.everlane.com'),
('Pants', 'Thought', 'Organic Cotton Chinos', 79.00, 'A', 80, 1200.00, 0.40, 'Organic Cotton', 'https://www.wearethought.com'),
('Shorts', 'Patagonia', 'Baggies Shorts', 55.00, 'B', 75, 300.00, 0.18, 'Recycled Nylon', 'https://www.patagonia.com'),
('Socks', 'Bombas', 'Merino Wool Calf Socks', 16.00, 'B', 70, 200.00, 0.10, 'Merino Wool', 'https://bombas.com')
ON CONFLICT DO NOTHING;

-- 
-- 11. WISHLIST
-- 

CREATE TABLE IF NOT EXISTS wishlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommendation_id INTEGER NOT NULL REFERENCES product_recommendations(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, recommendation_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);

-- 
-- 12. LEADERBOARD CACHE (materialized weekly/monthly)
-- 

CREATE TABLE IF NOT EXISTS leaderboard (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL,
    -- 'weekly', 'monthly', 'alltime'
    period_start DATE NOT NULL,
    total_points INTEGER DEFAULT 0,
    scan_count INTEGER DEFAULT 0,
    avg_score DECIMAL(5, 2) DEFAULT 0,
    rank INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, period_type, period_start)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_period ON leaderboard(period_type, period_start);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard(period_type, period_start, rank);

-- 
-- TRIGGERS
-- 

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scan_posts_updated_at BEFORE UPDATE ON scan_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_achievements_updated_at BEFORE UPDATE ON user_achievements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_challenges_updated_at BEFORE UPDATE ON user_challenges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
