// Проверка авторизации (синхронная версия для обратной совместимости)
function checkAuth() {
    const token = localStorage.getItem('token');
    const protectedPages = ['dashboard.html', 'testing.html', 'resources.html', 'subscription.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (!token) {
        // Если пользователь не авторизован и находится на защищенной странице
        if (protectedPages.includes(currentPage)) {
            window.location.href = 'auth.html';
            return false;
        }
    }
    
    return true;
}

// Асинхронная проверка авторизации с проверкой статуса пользователя
async function checkAuthAsync() {
    const token = localStorage.getItem('token');
    const protectedPages = ['dashboard.html', 'testing.html', 'resources.html', 'subscription.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (!token) {
        // Если пользователь не авторизован и находится на защищенной странице
        if (protectedPages.includes(currentPage)) {
            window.location.href = 'auth.html';
            return false;
        }
    } else {
        // Если есть токен, проверяем статус пользователя
        const isValid = await checkUserStatus();
        if (!isValid) {
            return false;
        }
    }
    
    return true;
}

// Выход из системы
function logout() {
    console.log('🚪 Выход из аккаунта...');
    
    // Удаляем все данные пользователя из localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('banInfo');
    localStorage.removeItem('currentUser'); // Добавляем очистку этого тоже
    
    console.log('✅ Данные пользователя очищены из localStorage');
    
    // Проверяем текущий путь
    const currentPath = window.location.pathname;
    console.log('📍 Текущий путь:', currentPath);
    
    // Если мы уже на главной странице или странице авторизации
    if (currentPath === '/' || currentPath === '/index.html' || currentPath === '/auth.html') {
        console.log('🏠 Уже на главной странице, перезагружаем...');
        window.location.reload();
    } else {
        console.log('🔄 Переходим на главную страницу...');
        // Переходим на главную страницу
        window.location.href = '/index.html';
    }
}

// Функция выхода с обновлением навигации (для использования в кнопках)
function logoutAndUpdate() {
    console.log('🚪 Выход из системы...');
    
    // Очищаем данные авторизации
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('banInfo');
    
    // Проверяем на какой мы странице
    const currentPage = window.location.pathname;
    console.log('� Текущая страница:', currentPage);
    
    // Если на главной странице - обновляем навигацию
    if (currentPage === '/' || currentPage === '/index.html' || currentPage.endsWith('index.html')) {
        console.log('🔄 На главной странице - обновляем навигацию');
        // Небольшая задержка для завершения очистки localStorage
        setTimeout(() => {
            if (typeof updateNavigation === 'function') {
                updateNavigation();
                console.log('✅ Навигация обновлена');
            } else {
                console.log('⚠️ Функция updateNavigation не найдена, перезагружаем страницу');
                window.location.reload();
            }
        }, 100);
    } else {
        // Если на другой странице, переходим на главную
        console.log('🏠 Переходим на главную страницу');
        window.location.href = 'index.html';
    }
}

// Обработка бана пользователя
function handleUserBan(banData) {
    console.log('User is banned:', banData);
    
    // Сохраняем информацию о бане
    localStorage.setItem('banInfo', JSON.stringify(banData));
    
    // Очищаем токен авторизации
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Перенаправляем на страницу бана
    window.location.href = 'banned.html';
}

// Защита от частых проверок статуса
let lastStatusCheck = 0;
const STATUS_CHECK_INTERVAL = 30000; // 30 секунд

// Проверка статуса пользователя (бан, активность и т.д.)
async function checkUserStatus() {
    const token = localStorage.getItem('token');
    if (!token) return true;
    
    // Защита от частых вызовов
    const now = Date.now();
    if (now - lastStatusCheck < STATUS_CHECK_INTERVAL) {
        return true; // Слишком частая проверка
    }
    lastStatusCheck = now;
    
    try {
        const response = await fetch('/api/auth/status', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.status === 403) {
            const data = await response.json();
            if (data.error === 'USER_BANNED') {
                handleUserBan(data);
                return false;
            }
        }
        
        if (!response.ok && response.status === 401) {
            // Токен недействителен
            logout();
            return false;
        }
        
        return response.ok;
    } catch (error) {
        console.error('Error checking user status:', error);
        return true; // Не блокируем при ошибке сети
    }
}

// Middleware для проверки статуса перед API запросами
async function makeAuthenticatedRequest(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) {
        throw new Error('No authentication token');
    }
    
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
    };
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    // Проверяем на бан
    if (response.status === 403) {
        const data = await response.json();
        if (data.error === 'USER_BANNED') {
            handleUserBan(data);
            throw new Error('User is banned');
        }
    }
    
    // Проверяем на недействительный токен
    if (response.status === 401) {
        logout();
        throw new Error('Authentication failed');
    }
    
    return response;
}

// Обработчик формы входа
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorElement = document.getElementById('errorMessage');

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                window.location.href = 'dashboard.html';
            } else {
                // Проверяем на бан пользователя
                if (data.error === 'USER_BANNED' || response.status === 403) {
                    handleUserBan(data);
                    return;
                }
                
                errorElement.style.display = 'block';
                errorElement.textContent = data.message;
                
                // Если email не подтвержден, показать ссылку на повторную отправку
                if (data.emailNotVerified) {
                    errorElement.innerHTML = data.message + '<br><a href="verify-email.html" style="color: var(--primary-color); text-decoration: underline;">Подтвердить email</a>';
                }
            }
        } catch (error) {
            errorElement.style.display = 'block';
            errorElement.textContent = 'Произошла ошибка при входе';
        }
    });
}

// Обработчик формы регистрации
if (document.getElementById('registerForm')) {
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const firstName = document.getElementById('firstName').value.trim();
        const lastName = document.getElementById('lastName').value.trim();
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorElement = document.getElementById('errorMessage');

        // Валидация имени (только английские буквы)
        const nameRegex = /^[A-Za-z]+$/;
        if (!nameRegex.test(firstName)) {
            errorElement.style.display = 'block';
            errorElement.textContent = 'Имя должно содержать только английские буквы (A-Z)';
            return;
        }
        
        if (!nameRegex.test(lastName)) {
            errorElement.style.display = 'block';
            errorElement.textContent = 'Фамилия должна содержать только английские буквы (A-Z)';
            return;
        }
        
        // Валидация пароля (английские буквы, цифры и спецсимволы)
        const passwordRegex = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+$/;
        if (password.length < 6) {
            errorElement.style.display = 'block';
            errorElement.textContent = 'Пароль должен содержать минимум 6 символов';
            return;
        }
        
        if (!passwordRegex.test(password)) {
            errorElement.style.display = 'block';
            errorElement.textContent = 'Пароль должен содержать только английские буквы, цифры и спецсимволы';
            return;
        }

        // Проверка совпадения паролей
        if (password !== confirmPassword) {
            errorElement.style.display = 'block';
            errorElement.textContent = 'Пароли не совпадают';
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ firstName, lastName, email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Если требуется подтверждение email
                if (data.verificationRequired) {
                    alert('Регистрация прошла успешно! Проверьте email для подтверждения регистрации. В консоли разработчика вы найдете ссылку для активации (в реальном приложении она придет на почту).');
                    window.location.href = 'verify-email.html';
                } else {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user', JSON.stringify(data.user));
                    window.location.href = 'dashboard.html';
                }
            } else {
                errorElement.style.display = 'block';
                errorElement.textContent = data.message;
            }
        } catch (error) {
            errorElement.style.display = 'block';
            errorElement.textContent = 'Произошла ошибка при регистрации';
        }
    });
}

// Функции для личного кабинета
async function loadUserProfile() {
    try {
        const response = await fetch('/api/auth/profile', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const data = await response.json();
        if (response.ok) {
            document.getElementById('userName').textContent = data.firstName || 'Студент';
            document.getElementById('userEmail').value = data.email || '';
            document.getElementById('userFirstName').value = data.firstName || '';
            document.getElementById('userLastName').value = data.lastName || '';
            document.getElementById('userRole').value = data.role || 'student';
            document.getElementById('registrationDate').value = new Date(data.createdAt).toLocaleDateString('ru-RU');
        }
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

async function loadUserStats() {
    try {
        const response = await fetch('/api/stats/testing', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const data = await response.json();
        if (response.ok) {
            document.getElementById('totalTests').textContent = data.totalTests || 0;
            document.getElementById('averageScore').textContent = (data.averageScore || 0) + '%';
            document.getElementById('studyDays').textContent = data.studyDays || 0;
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

async function loadAchievements() {
    try {
        const response = await fetch('/api/stats/achievements', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const data = await response.json();
        if (response.ok) {
            document.getElementById('achievements').textContent = data.length || 0;
            
            const achievementsList = document.getElementById('achievementsList');
            if (achievementsList) {
                if (data.length === 0) {
                    achievementsList.innerHTML = `
                        <div style="text-align: center; color: var(--text-light); padding: 2rem;">
                            Пройдите первый тест, чтобы получить достижения!
                        </div>
                    `;
                } else {
                    achievementsList.innerHTML = data.map(achievement => `
                        <div style="display: flex; align-items: center; padding: 1rem; background: var(--bg-secondary); border-radius: 8px; margin-bottom: 1rem;">
                            <div style="font-size: 2rem; margin-right: 1rem;">${achievement.icon || '🏆'}</div>
                            <div>
                                <h4 style="margin: 0; color: var(--text-primary);">${achievement.name}</h4>
                                <p style="margin: 0; color: var(--text-secondary); font-size: 0.9rem;">${achievement.description}</p>
                            </div>
                        </div>
                    `).join('');
                }
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки достижений:', error);
    }
}

// Функции для тестирования
async function loadSubjects() {
    try {
        console.log('📚 Загружаем предметы...');
        
        // Пробуем загрузить с авторизацией, если токен есть
        const token = localStorage.getItem('token');
        const headers = token ? {
            'Authorization': `Bearer ${token}`
        } : {};
        
        console.log('🔐 Используем токен:', !!token);
        
        const response = await fetch('/api/tests/subjects', {
            headers: headers
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('📊 Загружено предметов:', data.length);
        
        const subjectsGrid = document.getElementById('subjectsGrid');
        if (subjectsGrid) {
            if (data.length === 0) {
                subjectsGrid.innerHTML = `
                    <div class="card" style="text-align: center; grid-column: 1 / -1;">
                        <div class="card-body">
                            <div style="font-size: 3rem; margin-bottom: 1rem;">📚</div>
                            <h3 class="card-title">Предметы загружаются...</h3>
                            <p class="card-subtitle">Пожалуйста, подождите</p>
                        </div>
                    </div>
                `;
            } else {
                subjectsGrid.innerHTML = data.map(subject => `
                    <div class="card" onclick="selectSubject(${subject.id}, '${subject.name}')" style="cursor: pointer; transition: all 0.3s ease;">
                        <div class="card-body" style="text-align: center;">
                            <div style="font-size: 3rem; margin-bottom: 1rem;">${getSubjectIcon(subject.name)}</div>
                            <h3 class="card-title">${subject.name}</h3>
                            <p class="card-subtitle">${subject.description || 'Изучение ' + subject.name.toLowerCase()}</p>
                        </div>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки предметов:', error);
        const subjectsGrid = document.getElementById('subjectsGrid');
        if (subjectsGrid) {
            subjectsGrid.innerHTML = `
                <div class="card" style="text-align: center; grid-column: 1 / -1; border-color: #e74c3c;">
                    <div class="card-body">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                        <h3 class="card-title">Ошибка загрузки</h3>
                        <p class="card-subtitle">Не удалось загрузить предметы. Попробуйте обновить страницу.</p>
                        <button onclick="loadSubjects()" class="btn btn-primary" style="margin-top: 1rem;">🔄 Повторить</button>
                    </div>
                </div>
            `;
        }
    }
}

function getSubjectIcon(subjectName) {
    const icons = {
        'Анатомия': '🦴',
        'Физиология': '❤️',
        'Патология': '🔬',
        'Фармакология': '💊',
        'Терапия': '🩺',
        'Хирургия': '⚔️'
    };
    return icons[subjectName] || '📚';
}

function selectSubject(subjectId, subjectName) {
    console.log('📖 Выбран предмет:', subjectName, 'ID:', subjectId);
    window.currentSubjectId = subjectId;
    window.currentSubjectName = subjectName;
    loadCategories(subjectId);
    showSection('categorySelection');
}

async function loadCategories(subjectId) {
    try {
        console.log('📂 Загружаем категории для предмета ID:', subjectId);
        
        const token = localStorage.getItem('token');
        const headers = token ? {
            'Authorization': `Bearer ${token}`
        } : {};

        // Загружаем категории
        const categoriesResponse = await fetch(`/api/tests/categories/${subjectId}`, {
            headers: headers
        });

        // Загружаем тесты напрямую по предмету (созданные через админку)
        const testsResponse = await fetch(`/api/tests/subject/${subjectId}`, {
            headers: headers
        });

        const categoriesGrid = document.getElementById('categoriesGrid');
        if (!categoriesGrid) return;

        let categoriesData = [];
        let testsData = [];

        if (categoriesResponse.ok) {
            categoriesData = await categoriesResponse.json();
        }

        if (testsResponse.ok) {
            testsData = await testsResponse.json();
        }

        console.log('📊 Загружено категорий:', categoriesData.length, 'тестов:', testsData.length);

        let html = '';
        
        // Добавляем категории
        if (categoriesData.length > 0) {
            html += categoriesData.map(category => `
                <div class="card" onclick="selectCategory(${category.id}, '${category.name}')" style="cursor: pointer; transition: all 0.3s ease;">
                    <div class="card-body">
                        <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                            <span style="font-size: 1.5rem; margin-right: 0.5rem;">📁</span>
                            <span class="badge" style="background: #e3f2fd; color: #1976d2; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem;">Категория</span>
                        </div>
                        <h3 class="card-title">${category.name}</h3>
                        <p class="card-subtitle">${category.description || 'Тема ' + category.name.toLowerCase()}</p>
                    </div>
                </div>
            `).join('');
        }
        
        // Добавляем тесты напрямую (из админки)
        if (testsData.length > 0) {
            html += testsData.map(test => `
                <div class="card" onclick="startTestBySubject(${test.id}, '${test.title}')" style="cursor: pointer; border-left: 4px solid #4caf50; transition: all 0.3s ease;">
                    <div class="card-body">
                        <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                            <span style="font-size: 1.5rem; margin-right: 0.5rem;">🧪</span>
                            <span class="badge" style="background: #e8f5e9; color: #2e7d32; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem;">Тест</span>
                        </div>
                        <h3 class="card-title">${test.title}</h3>
                        <p class="card-subtitle">${test.description || 'Готовый тест по выбранной теме'}</p>
                    </div>
                </div>
            `).join('');
        }
        
        if (html === '') {
            html = `
                <div class="card" style="text-align: center; grid-column: 1 / -1; border-color: #ff9800;">
                    <div class="card-body">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">📭</div>
                        <h3 class="card-title">Контент в разработке</h3>
                        <p class="card-subtitle">Тесты для предмета "${window.currentSubjectName}" скоро будут добавлены</p>
                        <button onclick="showSubjects()" class="btn btn-primary" style="margin-top: 1rem;">← Выбрать другой предмет</button>
                    </div>
                </div>
            `;
        }
        
        categoriesGrid.innerHTML = html;
        
    } catch (error) {
        console.error('❌ Ошибка загрузки категорий:', error);
        const categoriesGrid = document.getElementById('categoriesGrid');
        if (categoriesGrid) {
            categoriesGrid.innerHTML = `
                <div class="card" style="text-align: center; grid-column: 1 / -1; border-color: #e74c3c;">
                    <div class="card-body">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                        <h3 class="card-title">Ошибка загрузки</h3>
                        <p class="card-subtitle">Не удалось загрузить категории. Попробуйте еще раз.</p>
                        <button onclick="loadCategories(${subjectId})" class="btn btn-primary" style="margin-top: 1rem;">🔄 Повторить</button>
                    </div>
                </div>
            `;
        }
    }
}

function selectCategory(categoryId, categoryName = 'Выбранная категория') {
    console.log('📁 Выбрана категория ID:', categoryId, 'Название:', categoryName);
    
    window.currentCategoryId = categoryId;
    window.currentCategoryName = categoryName;
    
    loadSubcategories(categoryId);
    showSection('subcategorySelection');
    
    console.log('✅ Переход к подкатегориям для категории:', categoryName);
}

async function loadSubcategories(categoryId) {
    try {
        console.log('📄 Загружаем подкатегории для категории ID:', categoryId);
        
        const token = localStorage.getItem('token');
        const headers = token ? {
            'Authorization': `Bearer ${token}`
        } : {};
        
        const response = await fetch(`/api/tests/subcategories/${categoryId}`, {
            headers: headers
        });

        const subcategoriesGrid = document.getElementById('subcategoriesGrid');
        if (!subcategoriesGrid) return;

        if (response.ok) {
            const data = await response.json();
            console.log('📊 Загружено подкатегорий:', data.length);
            
            if (data.length > 0) {
                subcategoriesGrid.innerHTML = data.map(subcategory => `
                    <div class="card" onclick="startTest(${subcategory.id}, '${subcategory.name}')" style="cursor: pointer; transition: all 0.3s ease; border-left: 4px solid #2196f3;">
                        <div class="card-body">
                            <div style="display: flex; align-items: center; margin-bottom: 0.5rem;">
                                <span style="font-size: 1.5rem; margin-right: 0.5rem;">📝</span>
                                <span class="badge" style="background: #e3f2fd; color: #1976d2; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem;">Подкатегория</span>
                            </div>
                            <h3 class="card-title">${subcategory.name}</h3>
                            <p class="card-subtitle">${subcategory.description || 'Тема ' + subcategory.name.toLowerCase()}</p>
                            <div style="margin-top: 1rem;">
                                <span class="btn btn-primary" style="padding: 0.5rem 1rem; font-size: 0.9rem; border-radius: 0.5rem;">
                                    🚀 Начать тест
                                </span>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                subcategoriesGrid.innerHTML = `
                    <div class="card" style="text-align: center; grid-column: 1 / -1; border-color: #ff9800;">
                        <div class="card-body">
                            <div style="font-size: 3rem; margin-bottom: 1rem;">📂</div>
                            <h3 class="card-title">Тесты готовятся</h3>
                            <p class="card-subtitle">Тесты для категории "${window.currentCategoryName}" скоро будут доступны</p>
                            <button onclick="showCategories()" class="btn btn-primary" style="margin-top: 1rem;">← Выбрать другую категорию</button>
                        </div>
                    </div>
                `;
            }
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки подкатегорий:', error);
        const subcategoriesGrid = document.getElementById('subcategoriesGrid');
        if (subcategoriesGrid) {
            subcategoriesGrid.innerHTML = `
                <div class="card" style="text-align: center; grid-column: 1 / -1; border-color: #e74c3c;">
                    <div class="card-body">
                        <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                        <h3 class="card-title">Ошибка загрузки</h3>
                        <p class="card-subtitle">Не удалось загрузить подкатегории. Проверьте соединение.</p>
                        <div style="margin-top: 1rem;">
                            <button onclick="loadSubcategories(${categoryId})" class="btn btn-primary" style="margin-right: 0.5rem;">🔄 Повторить</button>
                            <button onclick="showCategories()" class="btn btn-secondary">← Назад к категориям</button>
                        </div>
                    </div>
                </div>
            `;
        }
    }
}

function showSection(sectionId) {
    const sections = ['subjectSelection', 'categorySelection', 'subcategorySelection', 'testContainer', 'resultsContainer'];
    sections.forEach(section => {
        const element = document.getElementById(section);
        if (element) {
            element.style.display = section === sectionId ? 'block' : 'none';
        }
    });
}

function showSubjects() {
    showSection('subjectSelection');
}

function showCategories() {
    if (window.currentSubjectId) {
        loadCategories(window.currentSubjectId);
        showSection('categorySelection');
    }
}

async function startTestBySubject(testId, testTitle = 'Выбранный тест') {
    try {
        console.log('🎯 Запускаем админский тест ID:', testId, 'Название:', testTitle);
        
        // Показываем индикатор загрузки
        const testContainer = document.getElementById('testContainer');
        if (testContainer) {
            testContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">🎯</div>
                    <h3>Подготавливаем тест...</h3>
                    <p>Загружаем "${testTitle}"</p>
                </div>
            `;
        }
        
        const token = localStorage.getItem('token');
        const headers = token ? {
            'Authorization': `Bearer ${token}`
        } : {};
        
        // Для тестов, созданных через админку, используем ID теста напрямую
        const response = await fetch(`/api/tests/start-by-id/${testId}`, {
            headers: headers
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Админский тест загружен:', data.title, 'Вопросов:', data.questions?.length);
            
            window.currentTest = data;
            window.currentQuestionIndex = 0;
            window.userAnswers = [];
            window.testStartTime = Date.now();
            
            showSection('testContainer');
            displayQuestion();
            startTimer(data.timeLimit || 15);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('❌ Ошибка запуска админского теста:', error);
        
        // Показываем ошибку в интерфейсе
        const testContainer = document.getElementById('testContainer');
        if (testContainer) {
            testContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                    <h3>Не удалось запустить тест</h3>
                    <p>"${testTitle}"</p>
                    <p style="color: #e74c3c;">Ошибка: ${error.message}</p>
                    <div style="margin-top: 2rem;">
                        <button onclick="startTestBySubject(${testId}, '${testTitle}')" class="btn btn-primary" style="margin-right: 0.5rem;">🔄 Попробовать еще раз</button>
                        <button onclick="showCategories()" class="btn btn-secondary">← Назад к категориям</button>
                    </div>
                </div>
            `;
            showSection('testContainer');
        } else {
            alert('Не удалось запустить тест: ' + error.message);
        }
    }
}

async function startTest(subcategoryId, subcategoryName = 'Выбранная подкатегория') {
    try {
        console.log('🚀 Запускаем тест для подкатегории ID:', subcategoryId, 'Название:', subcategoryName);
        
        // Показываем индикатор загрузки
        const testContainer = document.getElementById('testContainer');
        if (testContainer) {
            testContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
                    <h3>Подготавливаем тест...</h3>
                    <p>Загружаем вопросы по теме "${subcategoryName}"</p>
                </div>
            `;
        }
        
        const token = localStorage.getItem('token');
        const headers = token ? {
            'Authorization': `Bearer ${token}`
        } : {};
        
        const response = await fetch(`/api/tests/start/${subcategoryId}`, {
            headers: headers
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ Тест загружен:', data.title, 'Вопросов:', data.questions?.length);
            
            window.currentTest = data;
            window.currentQuestionIndex = 0;
            window.userAnswers = [];
            window.testStartTime = Date.now();
            
            showSection('testContainer');
            displayQuestion();
            startTimer(data.timeLimit || 15);
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('❌ Ошибка запуска теста:', error);
        
        // Показываем ошибку в интерфейсе
        const testContainer = document.getElementById('testContainer');
        if (testContainer) {
            testContainer.innerHTML = `
                <div style="text-align: center; padding: 3rem;">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">❌</div>
                    <h3>Не удалось запустить тест</h3>
                    <p>Ошибка: ${error.message}</p>
                    <div style="margin-top: 2rem;">
                        <button onclick="startTest(${subcategoryId}, '${subcategoryName}')" class="btn btn-primary" style="margin-right: 0.5rem;">🔄 Попробовать еще раз</button>
                        <button onclick="showCategories()" class="btn btn-secondary">← Назад к категориям</button>
                    </div>
                </div>
            `;
            showSection('testContainer');
        } else {
            alert('Не удалось запустить тест: ' + error.message);
        }
    }
}

function displayQuestion() {
    const test = window.currentTest;
    const questionIndex = window.currentQuestionIndex;
    const question = test.questions[questionIndex];

    document.getElementById('testTitle').textContent = test.title;
    document.getElementById('testProgress').textContent = `Вопрос ${questionIndex + 1} из ${test.questions.length}`;
    document.getElementById('questionText').textContent = question.question_text;

    const answersContainer = document.getElementById('answersContainer');
    answersContainer.innerHTML = question.options.map((option, index) => `
        <label class="card" style="cursor: pointer; padding: 1rem; margin: 0;" onclick="selectAnswer(${index})">
            <input type="radio" name="answer" value="${index}" style="margin-right: 0.5rem;">
            ${option}
        </label>
    `).join('');

    // Восстановить выбранный ответ
    if (window.userAnswers[questionIndex] !== undefined) {
        const radio = answersContainer.querySelector(`input[value="${window.userAnswers[questionIndex]}"]`);
        if (radio) radio.checked = true;
    }

    // Обновить кнопки
    document.getElementById('prevBtn').disabled = questionIndex === 0;
    document.getElementById('nextBtn').textContent = questionIndex === test.questions.length - 1 ? 'Завершить тест' : 'Следующий';
}

function selectAnswer(answerIndex) {
    window.userAnswers[window.currentQuestionIndex] = answerIndex;
}

function previousQuestion() {
    if (window.currentQuestionIndex > 0) {
        window.currentQuestionIndex--;
        displayQuestion();
    }
}

function nextQuestion() {
    const test = window.currentTest;
    
    if (window.currentQuestionIndex < test.questions.length - 1) {
        window.currentQuestionIndex++;
        displayQuestion();
    } else {
        finishTest();
    }
}

async function finishTest() {
    try {
        const response = await fetch('/api/tests/finish', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                testId: window.currentTest.id,
                answers: window.userAnswers
            })
        });

        const data = await response.json();
        if (response.ok) {
            displayResults(data);
        }
    } catch (error) {
        console.error('Ошибка завершения теста:', error);
        alert('Не удалось завершить тест');
    }
}

function displayResults(results) {
    document.getElementById('scorePercentage').textContent = Math.round(results.percentage) + '%';
    document.getElementById('scoreDetails').textContent = 
        `Правильных ответов: ${results.correctAnswers} из ${window.currentTest.questions.length}`;
    
    const percentage = results.percentage;
    let emoji = '📚';
    let message = 'Продолжайте изучение!';
    
    if (percentage >= 90) {
        emoji = '🏆';
        message = 'Превосходный результат!';
    } else if (percentage >= 75) {
        emoji = '🎯';
        message = 'Отличная работа!';
    } else if (percentage >= 60) {
        emoji = '👍';
        message = 'Хороший результат!';
    }
    
    document.getElementById('resultEmoji').textContent = emoji;
    document.getElementById('resultMessage').textContent = message;
    
    showSection('resultsContainer');
    
    // Проверить новые достижения
    checkNewAchievements();
}

async function checkNewAchievements() {
    try {
        await fetch('/api/stats/check-achievements', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
    } catch (error) {
        console.error('Ошибка проверки достижений:', error);
    }
}

function startTimer(minutes) {
    let timeLeft = minutes * 60;
    const timer = document.getElementById('timer');
    
    window.testTimer = setInterval(() => {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        timer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(window.testTimer);
            finishTest();
        }
        
        timeLeft--;
    }, 1000);
}

// Функции для подписок
async function loadCurrentSubscription() {
    try {
        const response = await fetch('/api/subscriptions/current', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        const data = await response.json();
        if (response.ok && data.subscription) {
            const sub = data.subscription;
            const currentPlan = document.getElementById('currentPlan');
            const planDescription = document.getElementById('planDescription');
            const planExpiry = document.getElementById('planExpiry');
            const planPrice = document.getElementById('planPrice');
            const planStatus = document.getElementById('planStatus');
            
            if (currentPlan) currentPlan.textContent = sub.plan_name;
            if (planDescription) planDescription.textContent = getSubPlanDescription(sub.plan_type);
            if (planExpiry) planExpiry.textContent = new Date(sub.end_date).toLocaleDateString('ru-RU');
            if (planPrice) planPrice.textContent = sub.price + '₽';
            if (planStatus) planStatus.textContent = sub.is_active ? '✅ Активна' : '❌ Неактивна';
        } else {
            const currentPlan = document.getElementById('currentPlan');
            const planDescription = document.getElementById('planDescription');
            
            if (currentPlan) currentPlan.textContent = 'Нет активной подписки';
            if (planDescription) planDescription.textContent = 'Выберите подходящий план';
        }
    } catch (error) {
        console.error('Ошибка загрузки подписки:', error);
    }
}

function getSubPlanDescription(planType) {
    const descriptions = {
        'basic': 'Базовые функции для изучения',
        'premium': 'Расширенные возможности с AI',
        'yearly': 'Годовой доступ ко всем функциям'
    };
    return descriptions[planType] || 'Описание плана';
}

// =============================================================================
// АДМИНСКИЕ ФУНКЦИИ ДЛЯ ИНТЕГРАЦИИ С АДМИН ПАНЕЛЬЮ
// =============================================================================

// Проверка административных прав
async function checkAdminPermissions() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return false;
        
        const response = await fetch('/api/user/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const user = await response.json();
            return user.role === 'admin' || user.role === 'teacher';
        }
        
        return false;
    } catch (error) {
        console.error('❌ Ошибка проверки прав:', error);
        return false;
    }
}

// Получение статистики системы (только для админов)
async function getSystemStats() {
    try {
        console.log('📊 Получаем системную статистику...');
        
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const stats = await response.json();
            console.log('✅ Системная статистика получена:', stats);
            return stats;
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('❌ Ошибка получения системной статистики:', error);
        throw error;
    }
}

// Управление пользователями (для админов)
async function getUsersList(page = 1, limit = 20) {
    try {
        console.log('👥 Получаем список пользователей...');
        
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/admin/users?page=${page}&limit=${limit}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ Список пользователей получен:', data.users.length, 'пользователей');
            return data;
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('❌ Ошибка получения списка пользователей:', error);
        throw error;
    }
}

// Управление тестами из основного сайта
async function getTestsForAdmin() {
    try {
        console.log('📝 Получаем список тестов для администрирования...');
        
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/tests', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const tests = await response.json();
            console.log('✅ Тесты для админа получены:', tests.length, 'тестов');
            return tests;
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('❌ Ошибка получения тестов:', error);
        throw error;
    }
}

// Управление ресурсами из основного сайта
async function getResourcesForAdmin() {
    try {
        console.log('📚 Получаем список ресурсов для администрирования...');
        
        const token = localStorage.getItem('token');
        const response = await fetch('/api/admin/resources', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
            const resources = await response.json();
            console.log('✅ Ресурсы для админа получены:', resources.length, 'ресурсов');
            return resources;
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('❌ Ошибка получения ресурсов:', error);
        throw error;
    }
}

// Быстрые действия для админов
async function adminQuickActions() {
    const hasAdminRights = await checkAdminPermissions();
    
    if (!hasAdminRights) {
        console.log('❌ Нет прав администратора');
        return null;
    }
    
    return {
        // Действия с пользователями
        banUser: async (userId, reason = 'Нарушение правил') => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/admin/users/${userId}/ban`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ reason })
                });
                
                if (response.ok) {
                    console.log('✅ Пользователь заблокирован:', userId);
                    return true;
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                console.error('❌ Ошибка блокировки пользователя:', error);
                throw error;
            }
        },
        
        unbanUser: async (userId) => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/admin/users/${userId}/unban`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    console.log('✅ Пользователь разблокирован:', userId);
                    return true;
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                console.error('❌ Ошибка разблокировки пользователя:', error);
                throw error;
            }
        },
        
        // Действия с контентом
        publishTest: async (testId) => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/admin/tests/${testId}/publish`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    console.log('✅ Тест опубликован:', testId);
                    return true;
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                console.error('❌ Ошибка публикации теста:', error);
                throw error;
            }
        },
        
        publishResource: async (resourceId) => {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/admin/resources/${resourceId}/publish`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    console.log('✅ Ресурс опубликован:', resourceId);
                    return true;
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                console.error('❌ Ошибка публикации ресурса:', error);
                throw error;
            }
        }
    };
}

// Синхронизация данных с админ панелью
async function syncWithAdminPanel() {
    try {
        console.log('🔄 Синхронизация с админ панелью...');
        
        // Проверяем права
        const hasAdminRights = await checkAdminPermissions();
        if (!hasAdminRights) {
            console.log('❌ Нет прав для синхронизации');
            return false;
        }
        
        // Получаем актуальные данные
        const [systemStats, usersList, testsList, resourcesList] = await Promise.all([
            getSystemStats().catch(e => ({ error: e.message })),
            getUsersList(1, 10).catch(e => ({ error: e.message })),
            getTestsForAdmin().catch(e => ({ error: e.message })),
            getResourcesForAdmin().catch(e => ({ error: e.message }))
        ]);
        
        console.log('✅ Синхронизация завершена');
        
        return {
            systemStats,
            users: usersList,
            tests: testsList,
            resources: resourcesList,
            timestamp: new Date().toISOString()
        };
        
    } catch (error) {
        console.error('❌ Ошибка синхронизации:', error);
        return false;
    }
}

// Уведомления для админов
function showAdminNotification(message, type = 'info') {
    console.log(`🔔 Админ уведомление [${type}]:`, message);
    
    // Создаем уведомление
    const notification = document.createElement('div');
    notification.className = 'admin-notification';
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        max-width: 400px;
        border-left: 4px solid ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
    `;
    
    // Цвет фона в зависимости от типа
    if (type === 'success') {
        notification.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    } else if (type === 'error') {
        notification.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    } else {
        notification.style.background = 'linear-gradient(135deg, #3b82f6, #2563eb)';
    }
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between;">
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: white; font-size: 1.2rem; cursor: pointer; margin-left: 1rem;">
                ×
            </button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Автоматическое удаление через 5 секунд
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// CSS анимации для уведомлений
if (!document.getElementById('adminNotificationStyles')) {
    const style = document.createElement('style');
    style.id = 'adminNotificationStyles';
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}
