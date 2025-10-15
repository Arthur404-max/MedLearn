-- Инициализация базы данных для медицинского образовательного портала MedLearn
-- Внимание: выполнение этого скрипта удалит все данные в перечисленных таблицах.

DROP TABLE IF EXISTS user_bans;
DROP TABLE IF EXISTS test_attempts;
DROP TABLE IF EXISTS user_favorites;
DROP TABLE IF EXISTS test_results;
DROP TABLE IF EXISTS answers;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS tests;
DROP TABLE IF EXISTS resources;
DROP TABLE IF EXISTS subcategories;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS user_achievements;
DROP TABLE IF EXISTS achievements;
DROP TABLE IF EXISTS subjects;
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'student',
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    is_premium BOOLEAN DEFAULT FALSE,
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    banned_at TIMESTAMPTZ,
    banned_until TIMESTAMPTZ,
    banned_by INTEGER REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE session (
    sid VARCHAR(255) PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_session_expire ON session (expire);

CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(10) DEFAULT '📚',
    color VARCHAR(20) DEFAULT '#3498db',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE subcategories (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tests (
    id SERIAL PRIMARY KEY,
    subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    time_limit INTEGER DEFAULT 30,
    difficulty_level VARCHAR(20) DEFAULT 'medium',
    is_active BOOLEAN DEFAULT TRUE,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) DEFAULT 'multiple_choice',
    explanation TEXT,
    points INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE answers (
    id SERIAL PRIMARY KEY,
    question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE test_results (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    max_score INTEGER NOT NULL,
    percentage DECIMAL(5,2),
    time_taken INTEGER,
    answers_data JSONB,
    completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE test_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    time_spent INTEGER,
    percentage DECIMAL(5,2),
    completed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE resources (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content TEXT,
    resource_type VARCHAR(50) NOT NULL,
    url VARCHAR(500),
    file_path VARCHAR(500),
    subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    is_premium BOOLEAN DEFAULT FALSE,
    views_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_favorites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, resource_id)
);

CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    plan_type VARCHAR(50) NOT NULL,
    plan_name VARCHAR(100),
    duration VARCHAR(20),
    price DECIMAL(10,2),
    features JSONB,
    start_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    payment_status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_bans (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    banned_by INTEGER REFERENCES users(id),
    ban_reason TEXT,
    banned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    banned_until TIMESTAMPTZ,
    is_permanent BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    unban_reason TEXT,
    unbanned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    criteria JSONB,
    points INTEGER DEFAULT 0,
    badge_color VARCHAR(20) DEFAULT 'blue',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_achievements (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, achievement_id)
);

CREATE INDEX idx_tests_subject_id ON tests(subject_id);
CREATE INDEX idx_tests_category_id ON tests(category_id);
CREATE INDEX idx_tests_subcategory_id ON tests(subcategory_id);
CREATE INDEX idx_resources_subject_id ON resources(subject_id);
CREATE INDEX idx_resources_category_id ON resources(category_id);
CREATE INDEX idx_test_results_user_id ON test_results(user_id);
CREATE INDEX idx_test_results_test_id ON test_results(test_id);
CREATE INDEX idx_test_attempts_user_id ON test_attempts(user_id);
CREATE INDEX idx_test_attempts_test_id ON test_attempts(test_id);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_user_favorites_user_id ON user_favorites(user_id);
CREATE INDEX idx_user_bans_user_id ON user_bans(user_id);
CREATE INDEX idx_user_bans_is_active ON user_bans(is_active);
CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);

INSERT INTO subjects (name, description, icon, color) VALUES
    ('Анатомия', 'Изучение строения человеческого тела', '🦴', '#e74c3c'),
    ('Физиология', 'Изучение функций организма', '❤️', '#3498db'),
    ('Патология', 'Изучение болезней', '🔬', '#9b59b6'),
    ('Фармакология', 'Изучение лекарственных средств', '💊', '#2ecc71'),
    ('Хирургия', 'Оперативное лечение', '🏥', '#f39c12');

INSERT INTO categories (subject_id, name, description) VALUES
    (1, 'Опорно-двигательная система', 'Кости, мышцы, суставы'),
    (1, 'Сердечно-сосудистая система', 'Сердце и сосуды'),
    (1, 'Нервная система', 'Центральная и периферическая НС'),
    (2, 'Кровообращение', 'Работа сердца и сосудов'),
    (2, 'Дыхание', 'Легкие и газообмен'),
    (3, 'Воспаление', 'Процессы воспаления'),
    (4, 'Антибиотики', 'Противомикробные препараты'),
    (5, 'Общая хирургия', 'Основы хирургии');

INSERT INTO subcategories (category_id, name, description) VALUES
    (1, 'Кости верхних конечностей', 'Анатомия костей рук'),
    (1, 'Кости нижних конечностей', 'Анатомия костей ног'),
    (2, 'Строение сердца', 'Камеры и клапаны сердца'),
    (3, 'Головной мозг', 'Отделы головного мозга'),
    (4, 'Малый круг кровообращения', 'Легочное кровообращение'),
    (5, 'Механизм дыхания', 'Вдох и выдох');

INSERT INTO tests (subject_id, category_id, subcategory_id, title, description, time_limit, difficulty_level, is_published) VALUES
    (1, 1, 1, 'Кости плечевого пояса', 'Тест на знание костей плечевого пояса', 15, 'easy', TRUE),
    (1, 1, 2, 'Кости таза', 'Тест на знание костей тазового пояса', 20, 'medium', TRUE),
    (1, 2, 3, 'Анатомия сердца', 'Основы строения сердца', 20, 'medium', TRUE);

INSERT INTO questions (test_id, question_text, question_type, explanation, points) VALUES
    (1, 'Какая кость НЕ относится к плечевому поясу?', 'multiple_choice', 'Плечевой пояс состоит из ключицы и лопатки', 1),
    (1, 'Сколько костей входит в состав плечевого пояса?', 'multiple_choice', 'Ключица и лопатка - всего две кости с каждой стороны', 1);

INSERT INTO answers (question_id, answer_text, is_correct) VALUES
    (1, 'Ключица', FALSE),
    (1, 'Лопатка', FALSE),
    (1, 'Плечевая кость', TRUE),
    (1, 'Акромион', FALSE),
    (2, '1', FALSE),
    (2, '2', TRUE),
    (2, '3', FALSE),
    (2, '4', FALSE);

INSERT INTO resources (title, description, resource_type, subject_id, category_id, is_premium) VALUES
    ('Атлас анатомии человека', 'Подробный атлас с иллюстрациями', 'article', 1, 1, FALSE),
    ('Физиология кровообращения', 'Механизмы работы сердца', 'video', 2, 4, TRUE),
    ('Основы патологии', 'Введение в патологические процессы', 'article', 3, 6, FALSE),
    ('Справочник лекарств', 'Полный справочник препаратов', 'reference', 4, 7, TRUE);

INSERT INTO achievements (name, description, icon, criteria, points, badge_color) VALUES
    ('Первые шаги', 'Завершить первый тест', 'star', '{"tests_completed": 1}', 10, 'bronze'),
    ('Знаток анатомии', 'Набрать 90% в тесте по анатомии', 'trophy', '{"subject_score": {"anatomy": 90}}', 50, 'gold'),
    ('Активный студент', 'Завершить 10 тестов', 'medal', '{"tests_completed": 10}', 100, 'silver'),
    ('Отличник', 'Набрать средний балл 85%', 'crown', '{"average_score": 85}', 200, 'gold');

INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified, is_premium) VALUES
    ('admin@medlearn.com', '$2b$10$rOvHPxkzR4kJGGG5nLYg5OuY7P5ZjK3kX2N7Q9wY8zV6M4L2P1R3S', 'Админ', 'Системы', 'admin', TRUE, TRUE),
    ('student@test.com', '$2b$10$rOvHPxkzR4kJGGG5nLYg5OuY7P5ZjK3kX2N7Q9wY8zV6M4L2P1R3S', 'Студент', 'Тестов', 'student', TRUE, FALSE),
    ('test@test.com', '$2b$10$rOvHPxkzR4kJGGG5nLYg5OuY7P5ZjK3kX2N7Q9wY8zV6M4L2P1R3S', 'Тестовый', 'Пользователь', 'student', TRUE, FALSE);