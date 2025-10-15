import { pool } from '../config/db';

export async function initializeDatabase() {
    console.log('🔄 Инициализация базы данных...');
    
    try {
        // Создание таблицы пользователей
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
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
                banned_at TIMESTAMP WITH TIME ZONE,
                banned_until TIMESTAMP WITH TIME ZONE,
                banned_by INTEGER REFERENCES users(id),
                is_deleted BOOLEAN DEFAULT FALSE,
                last_login TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица users создана');

        // Добавляем недостающие столбцы к существующей таблице users
        try {
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE
            `);
            console.log('✅ Столбец last_login добавлен');
        } catch (error: any) {
            if (error.code !== '42701') { // Игнорируем ошибку "столбец уже существует"
                console.log('⚠️ Ошибка при добавлении столбца last_login:', error.message);
            }
        }

        // Добавляем недостающие столбцы для бана
        try {
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE
            `);
            console.log('✅ Столбец is_banned добавлен');
        } catch (error: any) {
            if (error.code !== '42701') { // Игнорируем ошибку "столбец уже существует"
                console.log('⚠️ Ошибка при добавлении столбца is_banned:', error.message);
            }
        }

        try {
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS ban_reason TEXT
            `);
            console.log('✅ Столбец ban_reason добавлен');
        } catch (error: any) {
            if (error.code !== '42701') { // Игнорируем ошибку "столбец уже существует"
                console.log('⚠️ Ошибка при добавлении столбца ban_reason:', error.message);
            }
        }

        try {
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE
            `);
            console.log('✅ Столбец banned_at добавлен');
        } catch (error: any) {
            if (error.code !== '42701') { // Игнорируем ошибку "столбец уже существует"
                console.log('⚠️ Ошибка при добавлении столбца banned_at:', error.message);
            }
        }

        try {
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS banned_by INTEGER
            `);
            console.log('✅ Столбец banned_by добавлен');
        } catch (error: any) {
            if (error.code !== '42701') { // Игнорируем ошибку "столбец уже существует"
                console.log('⚠️ Ошибка при добавлении столбца banned_by:', error.message);
            }
        }

        try {
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS banned_until TIMESTAMP WITH TIME ZONE
            `);
            console.log('✅ Столбец banned_until добавлен');
        } catch (error: any) {
            if (error.code !== '42701') {
                console.log('⚠️ Ошибка при добавлении столбца banned_until:', error.message);
            }
        }

        try {
            await pool.query(`
                ALTER TABLE users 
                ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE
            `);
            console.log('✅ Столбец is_deleted добавлен');
        } catch (error: any) {
            if (error.code !== '42701') {
                console.log('⚠️ Ошибка при добавлении столбца is_deleted:', error.message);
            }
        }

        // Создание таблицы предметов
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subjects (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица subjects создана');

        // Создание таблицы категорий
        await pool.query(`
            CREATE TABLE IF NOT EXISTS categories (
                id SERIAL PRIMARY KEY,
                subject_id INTEGER REFERENCES subjects(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица categories создана');

        // Создание таблицы подкатегорий
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subcategories (
                id SERIAL PRIMARY KEY,
                category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица subcategories создана');

        // Создание таблицы тестов с поддержкой админки
        await pool.query(`
            CREATE TABLE IF NOT EXISTS tests (
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
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица tests создана');

        // Обновляем существующую таблицу tests для поддержки админки
        try {
            await pool.query(`
                ALTER TABLE tests 
                ADD COLUMN IF NOT EXISTS subject_id INTEGER
            `);
            console.log('✅ Столбец subject_id в tests добавлен');
        } catch (error: any) {
            if (error.code !== '42701') {
                console.log('⚠️ Ошибка при добавлении столбца subject_id в tests:', error.message);
            }
        }

        try {
            await pool.query(`
                ALTER TABLE tests 
                ADD COLUMN IF NOT EXISTS category_id INTEGER
            `);
            console.log('✅ Столбец category_id в tests добавлен');
        } catch (error: any) {
            if (error.code !== '42701') {
                console.log('⚠️ Ошибка при добавлении столбца category_id в tests:', error.message);
            }
        }

        try {
            await pool.query(`
                ALTER TABLE tests 
                ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE
            `);
            console.log('✅ Столбец is_published в tests добавлен');
        } catch (error: any) {
            if (error.code !== '42701') {
                console.log('⚠️ Ошибка при добавлении столбца is_published в tests:', error.message);
            }
        }

        try {
            await pool.query(`
                ALTER TABLE tests 
                ADD CONSTRAINT tests_subject_id_fkey
                FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
            `);
        } catch (error: any) {
            if (error.code !== '42710') { // duplicate_object
                console.log('⚠️ Ошибка при добавлении внешнего ключа tests_subject_id_fkey:', error.message);
            }
        }

        try {
            await pool.query(`
                ALTER TABLE tests 
                ADD CONSTRAINT tests_category_id_fkey
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
            `);
        } catch (error: any) {
            if (error.code !== '42710') {
                console.log('⚠️ Ошибка при добавлении внешнего ключа tests_category_id_fkey:', error.message);
            }
        }

        // Создание таблицы вопросов
        await pool.query(`
            CREATE TABLE IF NOT EXISTS questions (
                id SERIAL PRIMARY KEY,
                test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
                question_text TEXT NOT NULL,
                question_type VARCHAR(50) DEFAULT 'multiple_choice',
                explanation TEXT,
                points INTEGER DEFAULT 1,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица questions создана');

        // Создание таблицы ответов
        await pool.query(`
            CREATE TABLE IF NOT EXISTS answers (
                id SERIAL PRIMARY KEY,
                question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
                answer_text TEXT NOT NULL,
                is_correct BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица answers создана');

        // Создание таблицы результатов тестов
        await pool.query(`
            CREATE TABLE IF NOT EXISTS test_results (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
                score INTEGER NOT NULL,
                max_score INTEGER NOT NULL,
                percentage DECIMAL(5,2),
                time_taken INTEGER, -- в секундах
                answers_data JSONB,
                completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица test_results создана');

        // Создание таблицы ресурсов
        await pool.query(`
            CREATE TABLE IF NOT EXISTS resources (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                description TEXT,
                content TEXT,
                resource_type VARCHAR(50) NOT NULL,
                url TEXT,
                file_path VARCHAR(500),
                subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
                category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                is_premium BOOLEAN DEFAULT FALSE,
                views_count INTEGER DEFAULT 0,
                likes_count INTEGER DEFAULT 0,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица resources создана');

        try {
            await pool.query(`
                ALTER TABLE resources 
                ADD COLUMN IF NOT EXISTS file_path VARCHAR(500)
            `);
            console.log('✅ Столбец file_path в resources добавлен');
        } catch (error: any) {
            if (error.code !== '42701') {
                console.log('⚠️ Ошибка при добавлении столбца file_path в resources:', error.message);
            }
        }

        try {
            await pool.query(`
                ALTER TABLE resources 
                ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0
            `);
            console.log('✅ Столбец views_count в resources добавлен');
        } catch (error: any) {
            if (error.code !== '42701') {
                console.log('⚠️ Ошибка при добавлении столбца views_count в resources:', error.message);
            }
        }

        try {
            await pool.query(`
                ALTER TABLE resources 
                ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0
            `);
            console.log('✅ Столбец likes_count в resources добавлен');
        } catch (error: any) {
            if (error.code !== '42701') {
                console.log('⚠️ Ошибка при добавлении столбца likes_count в resources:', error.message);
            }
        }

        // Создание таблицы подписок
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subscriptions (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                plan_type VARCHAR(50) NOT NULL,
                plan_name VARCHAR(100),
                duration VARCHAR(20),
                price DECIMAL(10,2),
                features JSONB,
                start_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                end_date TIMESTAMP WITH TIME ZONE,
                is_active BOOLEAN DEFAULT TRUE,
                payment_status VARCHAR(20) DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица subscriptions создана');

        try {
            await pool.query(`
                ALTER TABLE subscriptions 
                ADD COLUMN IF NOT EXISTS plan_name VARCHAR(100)
            `);
        } catch (error: any) {
            if (error.code !== '42701') {
                console.log('⚠️ Ошибка при добавлении plan_name в subscriptions:', error.message);
            }
        }

        try {
            await pool.query(`
                ALTER TABLE subscriptions 
                ADD COLUMN IF NOT EXISTS duration VARCHAR(20)
            `);
        } catch (error: any) {
            if (error.code !== '42701') {
                console.log('⚠️ Ошибка при добавлении duration в subscriptions:', error.message);
            }
        }

        try {
            await pool.query(`
                ALTER TABLE subscriptions 
                ADD COLUMN IF NOT EXISTS price DECIMAL(10,2)
            `);
        } catch (error: any) {
            if (error.code !== '42701') {
                console.log('⚠️ Ошибка при добавлении price в subscriptions:', error.message);
            }
        }

        try {
            await pool.query(`
                ALTER TABLE subscriptions 
                ADD COLUMN IF NOT EXISTS features JSONB
            `);
        } catch (error: any) {
            if (error.code !== '42701') {
                console.log('⚠️ Ошибка при добавлении features в subscriptions:', error.message);
            }
        }

        try {
            await pool.query(`
                ALTER TABLE subscriptions 
                ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) DEFAULT 'pending'
            `);
        } catch (error: any) {
            if (error.code !== '42701') {
                console.log('⚠️ Ошибка при добавлении payment_status в subscriptions:', error.message);
            }
        }

        // Создание таблицы избранного
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_favorites (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, resource_id)
            )
        `);
        console.log('✅ Таблица user_favorites создана');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_bans (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                banned_by INTEGER REFERENCES users(id),
                ban_reason TEXT,
                banned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                banned_until TIMESTAMP WITH TIME ZONE,
                is_permanent BOOLEAN DEFAULT FALSE,
                is_active BOOLEAN DEFAULT TRUE,
                unban_reason TEXT,
                unbanned_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица user_bans создана');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS achievements (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                icon VARCHAR(100),
                criteria JSONB,
                points INTEGER DEFAULT 0,
                badge_color VARCHAR(20) DEFAULT 'blue',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица achievements создана');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_achievements (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                achievement_id INTEGER REFERENCES achievements(id) ON DELETE CASCADE,
                earned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, achievement_id)
            )
        `);
        console.log('✅ Таблица user_achievements создана');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS test_attempts (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
                score INTEGER NOT NULL,
                total_questions INTEGER NOT NULL,
                correct_answers INTEGER NOT NULL,
                time_spent INTEGER,
                percentage DECIMAL(5,2),
                completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Таблица test_attempts создана');

        // Создание индексов для оптимизации
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_tests_subject_id ON tests(subject_id);
            CREATE INDEX IF NOT EXISTS idx_tests_category_id ON tests(category_id);
            CREATE INDEX IF NOT EXISTS idx_tests_subcategory_id ON tests(subcategory_id);
            CREATE INDEX IF NOT EXISTS idx_resources_subject_id ON resources(subject_id);
            CREATE INDEX IF NOT EXISTS idx_resources_category_id ON resources(category_id);
            CREATE INDEX IF NOT EXISTS idx_test_results_user_id ON test_results(user_id);
            CREATE INDEX IF NOT EXISTS idx_test_results_test_id ON test_results(test_id);
            CREATE INDEX IF NOT EXISTS idx_test_attempts_user_id ON test_attempts(user_id);
            CREATE INDEX IF NOT EXISTS idx_test_attempts_test_id ON test_attempts(test_id);
            CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id ON user_favorites(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_bans_user_id ON user_bans(user_id);
            CREATE INDEX IF NOT EXISTS idx_user_bans_is_active ON user_bans(is_active);
            CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
        `);
        console.log('✅ Индексы созданы');

        console.log('🎉 База данных успешно инициализирована!');
        return true;
    } catch (error) {
        console.error('❌ Ошибка инициализации базы данных:', error);
        return false;
    }
}

export async function seedDatabase() {
    console.log('🌱 Заполнение базы данных тестовыми данными...');
    
    try {
        // Проверяем, есть ли уже данные
        const subjectsCount = await pool.query('SELECT COUNT(*) FROM subjects');
        if (parseInt(subjectsCount.rows[0].count) > 0) {
            console.log('📊 База данных уже содержит данные, пропускаем заполнение');
            return true;
        }

        // Добавляем предметы
        const subjectsResult = await pool.query(`
            INSERT INTO subjects (name, description, icon, color) VALUES
            ('Анатомия', 'Изучение строения человеческого тела', '🦴', '#e74c3c'),
            ('Физиология', 'Изучение функций организма', '❤️', '#3498db'),
            ('Патология', 'Изучение болезней', '🔬', '#9b59b6'),
            ('Фармакология', 'Изучение лекарственных средств', '💊', '#2ecc71'),
            ('Хирургия', 'Оперативное лечение', '🏥', '#f39c12')
            RETURNING id
        `);
        console.log('✅ Предметы добавлены');

        // Добавляем категории для Анатомии
        await pool.query(`
            INSERT INTO categories (subject_id, name, description) VALUES
            (1, 'Опорно-двигательная система', 'Кости, мышцы, суставы'),
            (1, 'Сердечно-сосудистая система', 'Сердце и сосуды'),
            (1, 'Нервная система', 'Мозг, нервы, рефлексы'),
            (2, 'Кровообращение', 'Работа сердца и сосудов'),
            (2, 'Дыхание', 'Легкие и газообмен'),
            (3, 'Воспаление', 'Процессы воспаления'),
            (4, 'Антибиотики', 'Противомикробные препараты'),
            (5, 'Общая хирургия', 'Основы хирургии')
        `);
        console.log('✅ Категории добавлены');

        // Добавляем подкатегории
        await pool.query(`
            INSERT INTO subcategories (category_id, name, description) VALUES
            (1, 'Кости верхних конечностей', 'Анатомия костей рук'),
            (1, 'Кости нижних конечностей', 'Анатомия костей ног'),
            (2, 'Строение сердца', 'Камеры и клапаны сердца'),
            (3, 'Головной мозг', 'Отделы головного мозга'),
            (4, 'Малый круг кровообращения', 'Легочное кровообращение'),
            (5, 'Механизм дыхания', 'Вдох и выдох')
        `);
        console.log('✅ Подкатегории добавлены');

        // Добавляем несколько тестовых тестов
        const testResult = await pool.query(`
            INSERT INTO tests (subcategory_id, title, description, time_limit, difficulty_level) VALUES
            (1, 'Кости плечевого пояса', 'Тест на знание костей плечевого пояса', 15, 'easy'),
            (3, 'Анатомия сердца', 'Основы строения сердца', 20, 'medium'),
            (4, 'Отделы головного мозга', 'Знание структуры мозга', 25, 'hard')
            RETURNING id
        `);
        console.log('✅ Тесты добавлены');

        // Добавляем вопросы для первого теста
        const questionResult = await pool.query(`
            INSERT INTO questions (test_id, question_text, question_type, explanation, points) VALUES
            (1, 'Какая кость НЕ относится к плечевому поясу?', 'multiple_choice', 'Плечевой пояс состоит из ключицы и лопатки', 1),
            (1, 'Сколько костей входит в состав плечевого пояса?', 'multiple_choice', 'Ключица и лопатка - всего 2 кости с каждой стороны', 1)
            RETURNING id
        `);
        console.log('✅ Вопросы добавлены');

        // Добавляем варианты ответов
        await pool.query(`
            INSERT INTO answers (question_id, answer_text, is_correct) VALUES
            (1, 'Ключица', false),
            (1, 'Лопатка', false),
            (1, 'Плечевая кость', true),
            (1, 'Акромион', false),
            (2, '1', false),
            (2, '2', true),
            (2, '3', false),
            (2, '4', false)
        `);
        console.log('✅ Варианты ответов добавлены');

        // Добавляем ресурсы
        await pool.query(`
            INSERT INTO resources (title, description, resource_type, subject_id, category_id, is_premium) VALUES
            ('Атлас анатомии человека', 'Подробный атлас с иллюстрациями', 'article', 1, 1, false),
            ('Физиология кровообращения', 'Механизмы работы сердца', 'video', 2, 4, true),
            ('Основы патологии', 'Введение в патологические процессы', 'article', 3, 6, false),
            ('Справочник лекарств', 'Полный справочник препаратов', 'reference', 4, 7, true)
        `);
        console.log('✅ Ресурсы добавлены');

        // Создаем тестовых пользователей с правильным хешем пароля
        const bcrypt = require('bcrypt');
        const passwordHash = await bcrypt.hash('password', 10);
        
        await pool.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified) VALUES
            ('admin@medlearn.com', $1, 'Админ', 'Системы', 'admin', true),
            ('student@test.com', $1, 'Студент', 'Тестов', 'student', true),
            ('test@test.com', $1, 'Тестовый', 'Пользователь', 'student', true)
        `, [passwordHash]);
        console.log('✅ Тестовые пользователи добавлены (подтвержденные) с паролем "password"');

        console.log('🎉 База данных успешно заполнена тестовыми данными!');
        return true;
    } catch (error) {
        console.error('❌ Ошибка заполнения базы данных:', error);
        return false;
    }
}