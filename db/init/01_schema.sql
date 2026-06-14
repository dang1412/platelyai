-- Plately — schema chính: restaurants + menus + tags + reviews + tracking.
-- Geo search qua PostGIS, semantic search qua pgvector, fuzzy match qua pg_trgm.
--
-- File này chạy tự động bởi Postgres khi volume dữ liệu còn TRỐNG
-- (mount vào /docker-entrypoint-initdb.d). Đổi schema trên volume đã có dữ liệu
-- phải dùng migration tay, không sửa file này rồi mong nó tự áp dụng.

-- ───────────────────────────── Extensions ─────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;    -- geography(POINT) + geo search
CREATE EXTENSION IF NOT EXISTS vector;     -- cột VECTOR + ANN index cho semantic search
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy/substring match (tag, tên quán, tên món)
CREATE EXTENSION IF NOT EXISTS unaccent;   -- bỏ dấu cho normalized_name (lexical match)


-- ──────────────────────────── restaurants ─────────────────────────────
-- Thực thể tìm kiếm chính, kèm toạ độ địa lý.
CREATE TABLE IF NOT EXISTS restaurants (
  id                   BIGSERIAL PRIMARY KEY,

  google_place_id      TEXT UNIQUE,
  name                 TEXT NOT NULL,
  slug                 TEXT UNIQUE,
  address              TEXT,

  lat                  DOUBLE PRECISION,
  lng                  DOUBLE PRECISION,
  location             GEOGRAPHY(POINT, 4326),

  rating               NUMERIC(2, 1),
  rating_count         INTEGER,

  phone                TEXT,
  website              TEXT,
  source               TEXT,

  -- Dữ liệu này để filter nhanh trong TH query search ko có món.
  serves_food          BOOLEAN,
  serves_drink         BOOLEAN,

  -- semantic_description TEXT,
  -- embedding            VECTOR(1536),

  created_at           TIMESTAMP DEFAULT now(),
  updated_at           TIMESTAMP DEFAULT now()
);

-- Geo search theo khoảng cách (ST_DWithin / ST_Distance).
CREATE INDEX IF NOT EXISTS restaurants_location_idx
  ON restaurants USING GIST (location);

-- Semantic search ở cấp quán đã bỏ — semantic đi qua menu_items.
-- Bật lại cột embedding ở restaurants nếu cần KNN theo quán rồi mở index này.
-- CREATE INDEX IF NOT EXISTS restaurants_embedding_idx
--   ON restaurants USING hnsw (embedding vector_cosine_ops);

-- Lọc nhanh quán bán đồ ăn / đồ uống.
CREATE INDEX IF NOT EXISTS restaurants_serves_idx
  ON restaurants (serves_food, serves_drink);

-- Tìm quán theo TÊN với leading-wildcard (name ILIKE '%...%') không bị seq scan.
CREATE INDEX IF NOT EXISTS restaurants_name_trgm_idx
  ON restaurants USING GIN (name gin_trgm_ops);


-- ──────────────────────── tags (vibes/features) ───────────────────────
-- Tag chung về không gian/đặc điểm quán.
CREATE TABLE IF NOT EXISTS tags (
  id   BIGSERIAL PRIMARY KEY,
  name TEXT UNIQUE
);

CREATE TABLE IF NOT EXISTS restaurant_tags (
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  tag_id        BIGINT NOT NULL REFERENCES tags(id)        ON DELETE CASCADE,
  PRIMARY KEY (restaurant_id, tag_id)
);


-- ──────────────────────────── menu_categories ─────────────────────────
-- Nhóm món trong một quán (vd: "Bánh cuốn & Món ăn kèm", "Đồ uống").
-- kind: food = món ăn, drink = đồ uống/tráng miệng, other = topping/combo/nước chấm.
-- Nullable cho tới khi backfill xong; menu_items kế thừa kind qua category_id.
CREATE TABLE IF NOT EXISTS menu_categories (
  id            BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category_name VARCHAR(100) NOT NULL,
  kind          TEXT CHECK (kind IN ('food', 'drink', 'other')),
  display_order INT DEFAULT 0,
  created_at    TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS menu_categories_restaurant_idx
  ON menu_categories (restaurant_id);

CREATE INDEX IF NOT EXISTS menu_categories_kind_idx
  ON menu_categories (kind);


-- ────────────────────────────── menu_items ────────────────────────────
-- Món thực tế (giữ denormalized có chủ đích — tên món local rất đa dạng).
-- normalized_name = lower(unaccent(name)) cho lexical trgm match.
CREATE TABLE IF NOT EXISTS menu_items (
  id              BIGSERIAL PRIMARY KEY,
  category_id     BIGINT REFERENCES menu_categories(id) ON DELETE SET NULL,
  restaurant_id   BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,

  name            TEXT NOT NULL,
  normalized_name TEXT,
  description     TEXT,

  price           INTEGER,
  currency        VARCHAR(10) DEFAULT 'VND',

  image_url       TEXT,
  is_available    BOOLEAN DEFAULT TRUE,

  embedding       VECTOR(1536),

  created_at      TIMESTAMP DEFAULT now(),
  updated_at      TIMESTAMP DEFAULT now()
);

-- Semantic KNN theo món (build sau khi đã sinh embedding).
CREATE INDEX IF NOT EXISTS menu_items_embedding_idx
  ON menu_items USING hnsw (embedding vector_cosine_ops);

-- Gom món → quán ở bước ranking.
CREATE INDEX IF NOT EXISTS menu_items_restaurant_idx
  ON menu_items (restaurant_id);

-- Lexical match tên món.
CREATE INDEX IF NOT EXISTS menu_items_normalized_name_trgm_idx
  ON menu_items USING GIN (normalized_name gin_trgm_ops);


-- ─────────────────────────────── reviews ──────────────────────────────
-- Nội dung review cho semantic search.
CREATE TABLE IF NOT EXISTS reviews (
  id            BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT REFERENCES restaurants(id) ON DELETE CASCADE,

  rating        NUMERIC(2, 1),
  author_name   TEXT,
  content       TEXT NOT NULL,
  embedding     VECTOR(1536),
  source        TEXT,

  created_at    TIMESTAMP
);

CREATE INDEX IF NOT EXISTS reviews_embedding_idx
  ON reviews USING ivfflat (embedding vector_cosine_ops);


-- ────────────────────────────── map_clicks ────────────────────────────
-- Event-log: mỗi lần user click "Mở Google Maps" = 1 dòng.
-- Count = COUNT(*); thời gian = clicked_at từng dòng.
CREATE TABLE IF NOT EXISTS map_clicks (
  id            BIGSERIAL PRIMARY KEY,
  restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  clicked_at    TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS map_clicks_restaurant_idx
  ON map_clicks (restaurant_id);

CREATE INDEX IF NOT EXISTS map_clicks_clicked_at_idx
  ON map_clicks (clicked_at);


-- ────────────────────────────── raw_pages ─────────────────────────────
-- Nội dung crawler thô để debug / xử lý lại.
CREATE TABLE IF NOT EXISTS raw_pages (
  id          BIGSERIAL PRIMARY KEY,
  url         TEXT,
  source      TEXT,
  raw_content TEXT,
  crawled_at  TIMESTAMP DEFAULT now()
);
