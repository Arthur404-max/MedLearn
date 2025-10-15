import { pool } from '../config/db';

async function clearAndSeedDatabase() {
    console.log('🧹 Очистка базы данных...');
    
    try {
        // Очищаем все таблицы в правильном порядке (учитывая внешние ключи)
        await pool.query('TRUNCATE test_results, answers, questions, tests, subcategories, categories, subjects, resources, subscriptions, user_favorites, users RESTART IDENTITY CASCADE');
        console.log('✅ База данных очищена');

        // Добавляем предметы
        const subjectsResult = await pool.query(`
            INSERT INTO subjects (name, description) VALUES
            ('Анатомия', 'Изучение строения человеческого тела'),
            ('Физиология', 'Изучение функций организма'),
            ('Патология', 'Изучение болезней'),
            ('Фармакология', 'Изучение лекарственных средств'),
            ('Хирургия', 'Оперативное лечение')
            RETURNING id
        `);
        console.log('✅ Предметы добавлены:', subjectsResult.rows.length);

        // Добавляем категории для всех предметов
        await pool.query(`
            INSERT INTO categories (subject_id, name, description) VALUES
            (1, 'Опорно-двигательная система', 'Кости, мышцы, суставы'),
            (1, 'Сердечно-сосудистая система', 'Сердце и сосуды'),
            (1, 'Нервная система', 'Мозг, нервы, рефлексы'),
            (2, 'Кровообращение', 'Работа сердца и сосудов'),
            (2, 'Дыхание', 'Легкие и газообмен'),
            (3, 'Воспаление', 'Процессы воспаления'),
            (3, 'Опухоли', 'Доброкачественные и злокачественные новообразования'),
            (4, 'Антибиотики', 'Противомикробные препараты'),
            (4, 'Анальгетики', 'Обезболивающие препараты'),
            (5, 'Общая хирургия', 'Основы хирургии'),
            (5, 'Травматология', 'Лечение травм')
        `);
        console.log('✅ Категории добавлены');

        // Добавляем подкатегории
        await pool.query(`
            INSERT INTO subcategories (category_id, name, description) VALUES
            (1, 'Кости верхних конечностей', 'Анатомия костей рук'),
            (1, 'Кости нижних конечностей', 'Анатомия костей ног'),
            (1, 'Мышцы туловища', 'Мышцы спины и живота'),
            (2, 'Строение сердца', 'Камеры и клапаны сердца'),
            (2, 'Кровеносные сосуды', 'Артерии, вены, капилляры'),
            (3, 'Головной мозг', 'Отделы головного мозга'),
            (3, 'Спинной мозг', 'Структура спинного мозга'),
            (4, 'Малый круг кровообращения', 'Легочное кровообращение'),
            (5, 'Механизм дыхания', 'Вдох и выдох')
        `);
        console.log('✅ Подкатегории добавлены');

        // Добавляем тесты (как обычные через subcategory_id, так и для админки через subject_id)
        const testResult = await pool.query(`
            INSERT INTO tests (subcategory_id, subject_id, title, description, time_limit, difficulty_level) VALUES
            (1, NULL, 'Кости плечевого пояса', 'Тест на знание костей плечевого пояса', 15, 'easy'),
            (4, NULL, 'Анатомия сердца', 'Основы строения сердца', 20, 'medium'),
            (6, NULL, 'Отделы головного мозга', 'Знание структуры мозга', 25, 'hard'),
            (NULL, 1, 'Общий тест по анатомии', 'Комплексный тест по анатомии (создан через админку)', 30, 'medium'),
            (NULL, 2, 'Основы физиологии', 'Базовые знания физиологии (создан через админку)', 25, 'easy')
            RETURNING id
        `);
        console.log('✅ Тесты добавлены:', testResult.rows.length);

        // Добавляем вопросы для тестов
        const questionResult = await pool.query(`
            INSERT INTO questions (test_id, question_text, question_type, explanation, points) VALUES
            (1, 'Какая кость НЕ относится к плечевому поясу?', 'multiple_choice', 'Плечевой пояс состоит из ключицы и лопатки', 1),
            (1, 'Сколько костей входит в состав плечевого пояса?', 'multiple_choice', 'Ключица и лопатка - всего 2 кости с каждой стороны', 1),
            (2, 'Сколько камер имеет сердце человека?', 'multiple_choice', 'Сердце имеет 4 камеры: 2 предсердия и 2 желудочка', 1),
            (2, 'Какой клапан находится между левым предсердием и левым желудочком?', 'multiple_choice', 'Митральный клапан обеспечивает односторонний ток крови', 1),
            (4, 'Что изучает анатомия?', 'multiple_choice', 'Анатомия изучает строение тела', 1),
            (5, 'Что такое гомеостаз?', 'multiple_choice', 'Гомеостаз - поддержание постоянства внутренней среды', 1)
            RETURNING id
        `);
        console.log('✅ Вопросы добавлены:', questionResult.rows.length);

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
            (2, '4', false),
            (3, '2', false),
            (3, '3', false),
            (3, '4', true),
            (3, '5', false),
            (4, 'Трехстворчатый', false),
            (4, 'Митральный', true),
            (4, 'Аортальный', false),
            (4, 'Легочный', false),
            (5, 'Строение тела', true),
            (5, 'Функции органов', false),
            (5, 'Болезни', false),
            (5, 'Лекарства', false),
            (6, 'Равновесие', false),
            (6, 'Постоянство внутренней среды', true),
            (6, 'Движение', false),
            (6, 'Рост', false)
        `);
        console.log('✅ Варианты ответов добавлены');

        // Добавляем ресурсы
        await pool.query(`
            INSERT INTO resources (title, description, resource_type, subject_id, category_id, is_premium) VALUES
            ('Атлас анатомии человека', 'Подробный атлас с иллюстрациями всех систем организма', 'article', 1, 1, false),
            ('Физиология кровообращения', 'Механизмы работы сердца и сосудов', 'video', 2, 4, true),
            ('Основы патологии', 'Введение в патологические процессы', 'article', 3, 6, false),
            ('Справочник лекарств', 'Полный справочник лекарственных препаратов', 'reference', 4, 8, true),
            ('Хирургические инструменты', 'Описание основных хирургических инструментов', 'article', 5, 10, false)
        `);
        console.log('✅ Ресурсы добавлены');

        // Создаем тестового пользователя с правильным хешем пароля
        const bcrypt = require('bcrypt');
        const passwordHash = await bcrypt.hash('password', 10);
        
        await pool.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified) VALUES
            ('admin@medlearn.com', $1, 'Админ', 'Системы', 'admin', true),
            ('student@test.com', $1, 'Студент', 'Тестов', 'student', true),
            ('test@test.com', $1, 'Тестовый', 'Пользователь', 'student', true)
        `, [passwordHash]);
        console.log('✅ Тестовые пользователи добавлены (подтвержденные) с паролем "password"');

        console.log('🎉 База данных успешно очищена и заполнена новыми данными!');
        return true;
    } catch (error) {
        console.error('❌ Ошибка при очистке и заполнении базы данных:', error);
        return false;
    }
}

export { clearAndSeedDatabase };