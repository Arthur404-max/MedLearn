import { createUserWithSubscription, createUserBatch, SUBSCRIPTION_PLANS } from './createUserWithSubscription';

// Предустановленные пользователи для тестирования
const TEST_USERS = [
    {
        email: 'student1@medlearn.ru',
        password: 'Student123!',
        firstName: 'Алексей',
        lastName: 'Петров',
        subscriptionPlan: 'basic' as const,
        role: 'student'
    },
    {
        email: 'student2@medlearn.ru',
        password: 'Student456!',
        firstName: 'Мария',
        lastName: 'Иванова',
        subscriptionPlan: 'premium' as const,
        role: 'student'
    },
    {
        email: 'teacher@medlearn.ru',
        password: 'Teacher789!',
        firstName: 'Дмитрий',
        lastName: 'Сидоров',
        subscriptionPlan: 'ai_assistant' as const,
        role: 'teacher'
    },
    {
        email: 'admin@medlearn.ru',
        password: 'Admin2024!',
        firstName: 'Елена',
        lastName: 'Козлова',
        subscriptionPlan: 'ai_assistant' as const,
        role: 'admin'
    },
    {
        email: 'demo@medlearn.ru',
        password: 'Demo123!',
        firstName: 'Демо',
        lastName: 'Пользователь',
        subscriptionPlan: 'basic' as const,
        role: 'student'
    }
];

async function createTestUsers() {
    console.log('🎯 Создание тестовых пользователей MedLearn Platform...\n');
    
    try {
        const results = await createUserBatch(TEST_USERS);
        
        console.log('\n📋 СПИСОК СОЗДАННЫХ ПОЛЬЗОВАТЕЛЕЙ:');
        console.log('=' .repeat(80));
        
        TEST_USERS.forEach((user, index) => {
            const result = results[index];
            if (result.success) {
                const plan = SUBSCRIPTION_PLANS[user.subscriptionPlan];
                console.log(`
👤 ${user.firstName} ${user.lastName} (${user.role.toUpperCase()})
   📧 Email: ${user.email}
   🔑 Пароль: ${user.password}
   📦 План: ${plan.plan_name}
   💰 Стоимость: ${plan.price} руб.
   ⏰ Длительность: ${plan.duration_months} месяцев
   ✅ Статус: Создан успешно
                `);
            } else {
                console.log(`
❌ ${user.firstName} ${user.lastName}
   📧 Email: ${user.email}
   ⚠️  Ошибка: ${result.error}
                `);
            }
        });
        
        console.log('\n🌐 ДОСТУП К СИСТЕМЕ:');
        console.log('=' .repeat(50));
        console.log('🔗 URL: http://localhost:3000');
        console.log('📊 Админ панель: http://localhost:3002 (пароль: admin2024)');
        
        console.log('\n📖 ВОЗМОЖНОСТИ ПЛАНОВ:');
        console.log('=' .repeat(50));
        
        Object.entries(SUBSCRIPTION_PLANS).forEach(([key, plan]) => {
            console.log(`\n📦 ${plan.plan_name.toUpperCase()}:`);
            console.log(`   💰 Цена: ${plan.price} руб/${plan.duration_months} мес.`);
            console.log(`   🎯 Возможности:`);
            Object.entries(plan.features).forEach(([feature, value]) => {
                const displayValue = typeof value === 'object' ? 
                    Array.isArray(value) ? value.join(', ') : JSON.stringify(value)
                    : value.toString();
                console.log(`      • ${feature}: ${displayValue}`);
            });
        });
        
        console.log('\n🚀 СЛЕДУЮЩИЕ ШАГИ:');
        console.log('1. Убедитесь что сервер запущен: npm run start-all');
        console.log('2. Откройте браузер: http://localhost:3000');
        console.log('3. Войдите с любыми из созданных учетных записей');
        console.log('4. Проверьте функционал в зависимости от плана подписки');
        
    } catch (error) {
        console.error('💥 Критическая ошибка при создании тестовых пользователей:', error);
        process.exit(1);
    }
}

// Функция для создания пользователей по ролям
async function createUsersByRole(role: string, count: number = 5) {
    console.log(`🎯 Создание ${count} пользователей с ролью: ${role}`);
    
    const users = [];
    const plans = ['basic', 'premium', 'ai_assistant'] as const;
    
    for (let i = 1; i <= count; i++) {
        const planIndex = (i - 1) % plans.length;
        const plan = plans[planIndex];
        
        users.push({
            email: `${role}${i}@medlearn.ru`,
            password: `${role.charAt(0).toUpperCase() + role.slice(1)}${i}23!`,
            firstName: `${role.charAt(0).toUpperCase() + role.slice(1)}`,
            lastName: `Тестовый${i}`,
            subscriptionPlan: plan,
            role: role,
            isEmailVerified: true
        });
    }
    
    return await createUserBatch(users);
}

// Парсинг аргументов для различных режимов
function parseCommand(): { action: string; role?: string; count?: number } {
    const args = process.argv.slice(2);
    const command = args[0];
    
    switch (command) {
        case 'test-users':
            return { action: 'test-users' };
            
        case 'by-role':
            const role: string = args[1] || 'student';
            const count: number = parseInt(args[2]) || 5;
            return { action: 'by-role', role, count };
            
        default:
            console.log(`
🚀 Пакетное создание пользователей MedLearn Platform

Доступные команды:

1. Создать тестовых пользователей:
   npm run create-batch test-users

2. Создать пользователей по роли:
   npm run create-batch by-role <role> [количество]
   
   Примеры:
   npm run create-batch by-role student 10
   npm run create-batch by-role teacher 3
   npm run create-batch by-role admin 1

Доступные роли: student, teacher, admin
Доступные планы: basic, premium, ai_assistant
            `);
            process.exit(0);
    }
}

// Запуск скрипта
if (require.main === module) {
    const { action, role, count } = parseCommand();
    
    switch (action) {
        case 'test-users':
            createTestUsers()
                .then(() => {
                    console.log('\n🎉 Все тестовые пользователи созданы!');
                    process.exit(0);
                })
                .catch((error) => {
                    console.error('💥 Ошибка:', error);
                    process.exit(1);
                });
            break;
            
        case 'by-role':
            if (role && count) {
                createUsersByRole(role, count)
                    .then((results) => {
                        const successful = results.filter(r => r.success).length;
                        console.log(`\n✅ Создано ${successful} пользователей с ролью ${role}`);
                        process.exit(0);
                    })
                    .catch((error) => {
                        console.error('💥 Ошибка:', error);
                        process.exit(1);
                    });
            }
            break;
    }
}

export { createTestUsers, createUsersByRole };