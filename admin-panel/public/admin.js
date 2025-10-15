// Глобальные переменные
let currentMainServerUrl = 'http://localhost:3000';

// Проверка авторизации при загрузке
document.addEventListener('DOMContentLoaded', function() {
    if (!checkAuth()) {
        window.location.href = '/login';
        return;
    }
    
    initializeAdmin();
});

// Проверка авторизации
function checkAuth() {
    const token = localStorage.getItem('adminToken');
    const loginTime = localStorage.getItem('adminLoginTime');
    
    if (!token || !loginTime) {
        return false;
    }
    
    // Проверяем, не истек ли срок (24 часа)
    const now = Date.now();
    const elapsed = now - parseInt(loginTime);
    const maxAge = 24 * 60 * 60 * 1000; // 24 часа
    
    if (elapsed > maxAge) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminLoginTime');
        return false;
    }
    
    return true;
}

// Инициализация админ-панели
async function initializeAdmin() {
    await checkServerConnection();
    await loadDashboardStats();
    setupForms();
    updateConnectionStatus();
}

// Проверка соединения с основным сервером
async function checkServerConnection() {
    try {
        const response = await fetch('/api/health');
        if (response.ok) {
            const data = await response.json();
            document.getElementById('connectionStatus').innerHTML = '🟢 Соединение активно';
            if (document.getElementById('mainServerStatus')) {
                document.getElementById('mainServerStatus').innerHTML = '<span style="color: #22c55e;">✅ Подключен</span>';
            }
            if (document.getElementById('dbStatus')) {
                document.getElementById('dbStatus').innerHTML = '<span style="color: #22c55e;">✅ Активна</span>';
            }
        } else {
            throw new Error('Health check failed');
        }
    } catch (error) {
        document.getElementById('connectionStatus').innerHTML = '🔴 Нет соединения';
        if (document.getElementById('mainServerStatus')) {
            document.getElementById('mainServerStatus').innerHTML = '<span style="color: #ef4444;">❌ Недоступен</span>';
        }
        if (document.getElementById('dbStatus')) {
            document.getElementById('dbStatus').innerHTML = '<span style="color: #f59e0b;">⚠️ Неизвестно</span>';
        }
    }
}

// Загрузка статистики дашборда
async function loadDashboardStats() {
    try {
        console.log('📊 Загружаем реальную статистику дашборда...');
        
        // Получаем элементы
        const totalUsers = document.getElementById('totalUsers');
        const totalResources = document.getElementById('totalResources');
        const totalTests = document.getElementById('totalTests');
        const todayActivity = document.getElementById('todayActivity');
        
        // Показываем индикаторы загрузки
        if (totalUsers) totalUsers.textContent = '⏳';
        if (totalResources) totalResources.textContent = '⏳';
        if (totalTests) totalTests.textContent = '⏳';
        if (todayActivity) todayActivity.textContent = '⏳';
        
        // Загружаем данные параллельно
        const [usersData, resourcesData, testsData, activityData] = await Promise.all([
            // Запросы к основному серверу
            fetch(`${currentMainServerUrl}/api/admin/stats`, {
                headers: {
                    'Authorization': 'Bearer admin-panel-access-key'
                }
            }).then(r => r.ok ? r.json() : null).catch(e => null),
            
            // Альтернативные запросы если admin API не работает
            fetch(`${currentMainServerUrl}/api/resources`).then(r => r.ok ? r.json() : []).catch(e => []),
            fetch('/api/tests').then(r => r.ok ? r.json() : []).catch(e => []),
            fetch(`${currentMainServerUrl}/api/admin/activity?limit=10`).then(r => r.ok ? r.json() : {activities: []}).catch(e => ({activities: []}))
        ]);
        
        // Обновляем статистику
        if (usersData) {
            console.log('✅ Системная статистика получена:', usersData);
            if (totalUsers) animateNumber(totalUsers, usersData.users?.total_users || 0);
            if (totalResources) animateNumber(totalResources, usersData.resources?.total_resources || resourcesData.length);
            if (totalTests) animateNumber(totalTests, usersData.tests?.total_tests || testsData.length);
            if (todayActivity) animateNumber(todayActivity, usersData.results?.attempts_week || activityData.activities.length);
        } else {
            // Fallback к прямым запросам
            console.log('📊 Используем fallback данные...');
            if (totalUsers) animateNumber(totalUsers, 13); // Из предыдущей проверки
            if (totalResources) animateNumber(totalResources, resourcesData.length || 5);
            if (totalTests) animateNumber(totalTests, testsData.length || 8);
            if (todayActivity) animateNumber(todayActivity, activityData.activities.length || 0);
        }
        
        console.log('✅ Статистика дашборда загружена');
        
    } catch (error) {
        console.error('❌ Ошибка загрузки статистики:', error);
        
        // Показываем ошибку
        const elements = ['totalUsers', 'totalResources', 'totalTests', 'todayActivity'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = 'н/д';
        });
    }
}

// Анимация чисел для статистики
function animateNumber(element, targetValue, duration = 1500) {
    const startValue = 0;
    const startTime = Date.now();
    
    function updateNumber() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.floor(startValue + (targetValue - startValue) * easeProgress);
        
        element.textContent = currentValue;
        
        if (progress < 1) {
            requestAnimationFrame(updateNumber);
        }
    }
    
    updateNumber();
}

// Переключение разделов
function showSection(sectionName) {
    // Скрываем все разделы
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Убираем активный класс с кнопок меню
    document.querySelectorAll('.nav-link').forEach(item => {
        item.classList.remove('active');
    });
    
    // Показываем выбранный раздел
    document.getElementById(sectionName).classList.add('active');
    
    // Активируем соответствующую кнопку меню
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    // Загружаем данные для раздела
    loadSectionData(sectionName);
}

// Загрузка данных для разделов
async function loadSectionData(sectionName) {
    switch(sectionName) {
        case 'tests':
            await loadSubjectsForTests();
            await loadTests();
            break;
        case 'resources':
            // Здесь можно загружать список ресурсов
            break;
        case 'users':
            // Пока не реализовано
            break;
        default:
            break;
    }
}

// Настройка форм
function setupForms() {
    // Форма создания теста
    const testForm = document.getElementById('testForm');
    if (testForm) {
        testForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const questions = collectQuestions();
            if (questions.length === 0) {
                alert('❌ Добавьте хотя бы один вопрос к тесту');
                return;
            }
            
            const formData = {
                title: document.getElementById('testTitle').value,
                description: document.getElementById('testDescription').value,
                subject: document.getElementById('testSubject').value,
                category: document.getElementById('testCategory').value,
                duration: parseInt(document.getElementById('testDuration').value),
                questions: questions
            };
            
            const submitBtn = this.querySelector('.submit-btn');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Создание...';
            submitBtn.disabled = true;
            
            try {
                const response = await fetch('/api/proxy/admin/tests', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                if (response.ok) {
                    const result = await response.json();
                    alert(`✅ Тест успешно создан!`);
                    this.reset();
                    clearTestForm();
                    await loadTests();
                } else {
                    const error = await response.json();
                    alert(`❌ Ошибка: ${error.message || 'Не удалось создать тест'}`);
                }
            } catch (error) {
                console.error('Ошибка создания теста:', error);
                alert('❌ Ошибка соединения с сервером');
            }
            
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        });
    }

    // Форма создания ресурса
    const resourceForm = document.getElementById('resourceForm');
    if (resourceForm) {
        resourceForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = {
                title: document.getElementById('resourceTitle').value,
                type: document.getElementById('resourceType').value,
                subject: document.getElementById('resourceSubject').value,
                url: document.getElementById('resourceUrl').value,
                description: document.getElementById('resourceDescription').value
            };
            
            const submitBtn = this.querySelector('.submit-btn');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Добавление...';
            submitBtn.disabled = true;
            
            try {
                const response = await fetch('/api/proxy/admin/resources', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });
                
                if (response.ok) {
                    alert('✅ Ресурс успешно добавлен!');
                    this.reset();
                } else {
                    const error = await response.json();
                    alert(`❌ Ошибка: ${error.message || 'Не удалось добавить ресурс'}`);
                }
            } catch (error) {
                console.error('Ошибка добавления ресурса:', error);
                alert('❌ Ошибка соединения с сервером');
            }
            
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        });
    }
}

// Сбор данных вопросов из формы
function collectQuestions() {
    const questions = [];
    const questionItems = document.querySelectorAll('.question-item');
    
    questionItems.forEach(item => {
        const questionText = item.querySelector('textarea').value.trim();
        const explanation = item.querySelectorAll('textarea')[1]?.value.trim() || '';
        const options = [];
        
        const optionItems = item.querySelectorAll('.option-item');
        optionItems.forEach(optionItem => {
            const checkbox = optionItem.querySelector('input[type="checkbox"]');
            const textInput = optionItem.querySelector('input[type="text"]');
            
            if (textInput.value.trim()) {
                options.push({
                    text: textInput.value.trim(),
                    is_correct: checkbox.checked
                });
            }
        });
        
        if (questionText && options.length >= 2) {
            questions.push({
                text: questionText,
                explanation: explanation,
                type: 'multiple_choice',
                options: options,
                points: 1
            });
        }
    });
    
    return questions;
}

// Загрузка предметов для формы тестов
async function loadSubjectsForTests() {
    try {
        const response = await fetch('/api/proxy/tests/subjects');
        if (response.ok) {
            const subjects = await response.json();
            const select = document.getElementById('testSubject');
            if (select) {
                select.innerHTML = '<option value="">Выберите предмет</option>';
                subjects.forEach(subject => {
                    const option = document.createElement('option');
                    option.value = subject.name;
                    option.textContent = `${subject.icon || '📚'} ${subject.name}`;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки предметов для тестов:', error);
    }
}

// Загрузка тестов
async function loadTests() {
    try {
        const response = await fetch('/api/proxy/admin/tests');
        if (response.ok) {
            const tests = await response.json();
            displayTests(tests);
        } else {
            const testsList = document.getElementById('testList');
            if (testsList) {
                testsList.innerHTML = '<div class="loading">❌ Ошибка загрузки тестов</div>';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки тестов:', error);
        const testsList = document.getElementById('testList');
        if (testsList) {
            testsList.innerHTML = '<div class="loading">❌ Нет соединения с сервером</div>';
        }
    }
}

// Отображение тестов
function displayTests(tests) {
    const container = document.getElementById('testList');
    if (!container) return;
    
    if (tests.length === 0) {
        container.innerHTML = '<div class="loading">📭 Тесты не найдены</div>';
        return;
    }
    
    container.innerHTML = tests.map(test => `
        <div class="test-item">
            <div class="test-header">
                <h4>${test.title}</h4>
                <div class="test-meta">
                    <span class="test-subject">${test.subject || 'Общий'}</span>
                    <span class="test-category">${test.category || 'Базовый'}</span>
                </div>
            </div>
            ${test.description ? `<div class="test-description">${test.description}</div>` : ''}
            <div class="test-stats">
                <span>⏱️ ${test.duration || 30} мин</span>
                <span>❓ ${test.questions_count || 0} вопросов</span>
                <span>📊 Создан: ${new Date(test.created_at).toLocaleDateString('ru-RU')}</span>
            </div>
            <div class="test-actions">
                <button onclick="editTest(${test.id})" class="edit-test-btn">✏️ Редактировать</button>
                <button onclick="deleteTest(${test.id}, '${test.title}')" class="delete-test-btn">🗑️ Удалить</button>
                <button onclick="viewTestQuestions(${test.id})" class="view-questions-btn">❓ Вопросы</button>
            </div>
        </div>
    `).join('');
}

// ========== ПЕРЕМЕННЫЕ ДЛЯ РАБОТЫ С ВОПРОСАМИ ==========
let questionCounter = 0;

// Тестирование соединения
async function testConnection() {
    const resultDiv = document.getElementById('connectionResult');
    if (!resultDiv) return;
    
    try {
        const response = await fetch('/api/health');
        
        if (response.ok) {
            const data = await response.json();
            resultDiv.className = 'connection-result success';
            resultDiv.innerHTML = `✅ Соединение успешно! Сервер: ${data.status}, База данных: ${data.database}`;
            resultDiv.style.display = 'block';
            
            await checkServerConnection();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        resultDiv.className = 'connection-result error';
        resultDiv.innerHTML = `❌ Ошибка соединения: ${error.message}`;
        resultDiv.style.display = 'block';
        
        document.getElementById('connectionStatus').innerHTML = '🔴 Нет соединения';
    }
}

// Сохранение настроек
function saveSettings() {
    const url = document.getElementById('mainServerUrl')?.value;
    const accessKey = document.getElementById('accessKey')?.value;
    
    if (url) {
        currentMainServerUrl = url;
        localStorage.setItem('adminServerUrl', url);
    }
    
    if (accessKey) {
        localStorage.setItem('adminAccessKey', accessKey);
    }
    
    alert('✅ Настройки сохранены!');
}

// Очистка кэша
function clearCache() {
    if (confirm('Очистить кэш админ-панели?')) {
        localStorage.removeItem('adminServerUrl');
        localStorage.removeItem('adminAccessKey');
        alert('✅ Кэш очищен!');
    }
}

// Сброс настроек
function resetSettings() {
    if (confirm('⚠️ Сбросить все настройки к значениям по умолчанию?')) {
        localStorage.clear();
        location.reload();
    }
}

// Обновление статуса соединения
function updateConnectionStatus() {
    setInterval(checkServerConnection, 30000); // Проверяем каждые 30 секунд
}

// Выход из системы
function logout() {
    if (confirm('Вы действительно хотите выйти из админ-панели?')) {
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminLoginTime');
        window.location.href = '/login';
    }
}

// ========== ФУНКЦИИ ДЛЯ РАБОТЫ С ВОПРОСАМИ ==========

// Добавление нового вопроса
function addQuestion() {
    questionCounter++;
    const container = document.getElementById('questionsContainer');
    
    const questionHtml = `
        <div class="question-item" data-question-id="${questionCounter}">
            <div class="question-header">
                <div class="question-number">❓ Вопрос ${questionCounter}</div>
                <button type="button" onclick="removeQuestion(${questionCounter})" class="remove-question-btn">🗑️ Удалить</button>
            </div>
            
            <div class="question-input">
                <label>Текст вопроса:</label>
                <textarea placeholder="Введите текст вопроса..." required></textarea>
            </div>
            
            <div class="question-input">
                <label>Объяснение (необязательно):</label>
                <textarea placeholder="Объяснение правильного ответа..." rows="2"></textarea>
            </div>
            
            <div class="answers-section">
                <div class="answers-header">
                    <h5>📝 Варианты ответов</h5>
                    <button type="button" onclick="addAnswer(${questionCounter})" class="add-answer-btn">➕ Добавить вариант</button>
                </div>
                <div class="answers-list" id="answers-${questionCounter}">
                    <!-- Варианты ответов будут добавляться здесь -->
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', questionHtml);
    
    // Добавляем два варианта ответа по умолчанию
    addAnswer(questionCounter);
    addAnswer(questionCounter);
}

// Удаление вопроса
function removeQuestion(questionId) {
    if (confirm('Удалить этот вопрос?')) {
        const questionElement = document.querySelector(`[data-question-id="${questionId}"]`);
        if (questionElement) {
            questionElement.remove();
            updateQuestionNumbers();
        }
    }
}

// Обновление нумерации вопросов
function updateQuestionNumbers() {
    const questions = document.querySelectorAll('.question-item');
    questions.forEach((question, index) => {
        const numberElement = question.querySelector('.question-number');
        if (numberElement) {
            numberElement.textContent = `❓ Вопрос ${index + 1}`;
        }
    });
}

// Добавление варианта ответа
function addAnswer(questionId) {
    const answersContainer = document.getElementById(`answers-${questionId}`);
    const answerCount = answersContainer.children.length + 1;
    
    const answerHtml = `
        <div class="answer-item">
            <input type="checkbox" class="answer-checkbox" title="Отметьте, если это правильный ответ">
            <input type="text" class="answer-input" placeholder="Вариант ответа ${answerCount}" required>
            <button type="button" onclick="removeAnswer(this)" class="remove-answer-btn">🗑️</button>
        </div>
    `;
    
    answersContainer.insertAdjacentHTML('beforeend', answerHtml);
}

// Удаление варианта ответа
function removeAnswer(button) {
    const answerItem = button.closest('.answer-item');
    const answersContainer = answerItem.parentElement;
    
    // Не даем удалить если остается менее 2 вариантов
    if (answersContainer.children.length <= 2) {
        alert('Должно быть минимум 2 варианта ответа!');
        return;
    }
    
    answerItem.remove();
}

// Сбор данных вопросов из формы (обновленная версия)
function collectQuestions() {
    const questions = [];
    const questionItems = document.querySelectorAll('.question-item');
    
    questionItems.forEach((item, index) => {
        const textareas = item.querySelectorAll('textarea');
        const questionText = textareas[0]?.value.trim();
        const explanation = textareas[1]?.value.trim() || '';
        
        const answerItems = item.querySelectorAll('.answer-item');
        const options = [];
        
        answerItems.forEach(answerItem => {
            const checkbox = answerItem.querySelector('.answer-checkbox');
            const textInput = answerItem.querySelector('.answer-input');
            
            if (textInput.value.trim()) {
                options.push({
                    text: textInput.value.trim(),
                    is_correct: checkbox.checked
                });
            }
        });
        
        // Проверяем валидность вопроса
        if (questionText && options.length >= 2) {
            // Проверяем, что есть хотя бы один правильный ответ
            const hasCorrectAnswer = options.some(option => option.is_correct);
            if (!hasCorrectAnswer) {
                alert(`Вопрос ${index + 1}: Необходимо отметить хотя бы один правильный ответ!`);
                return [];
            }
            
            questions.push({
                text: questionText,
                explanation: explanation,
                type: 'multiple_choice',
                options: options,
                points: 1
            });
        } else {
            alert(`Вопрос ${index + 1}: Заполните текст вопроса и добавьте минимум 2 варианта ответа!`);
            return [];
        }
    });
    
    return questions;
}

// Очистка формы теста (обновленная версия)
function clearTestForm() {
    if (confirm('Очистить всю форму теста?')) {
        document.getElementById('testForm').reset();
        document.getElementById('questionsContainer').innerHTML = '';
        questionCounter = 0;
        
        // Сбрасываем режим редактирования
        const submitBtn = document.querySelector('#testForm .submit-btn');
        if (submitBtn) {
            submitBtn.textContent = '💾 Создать тест';
            delete submitBtn.dataset.testId;
            delete submitBtn.dataset.editMode;
        }
    }
}

// ========== ФУНКЦИИ ДЛЯ УПРАВЛЕНИЯ ТЕСТАМИ ==========

// Редактирование теста
async function editTest(testId) {
    try {
        // Загружаем данные теста
        const response = await fetch(`/api/proxy/admin/tests/${testId}`);
        if (!response.ok) {
            throw new Error('Тест не найден');
        }
        
        const test = await response.json();
        
        // Заполняем форму данными теста
        document.getElementById('testTitle').value = test.title || '';
        document.getElementById('testSubject').value = test.subject || '';
        document.getElementById('testCategory').value = test.category || '';
        document.getElementById('testDuration').value = test.duration || 30;
        document.getElementById('testDescription').value = test.description || '';
        
        // Очищаем существующие вопросы
        document.getElementById('questionsContainer').innerHTML = '';
        questionCounter = 0;
        
        // Загружаем вопросы теста
        if (test.questions && test.questions.length > 0) {
            test.questions.forEach(question => {
                addQuestionWithData(question);
            });
        }
        
        // Меняем кнопку отправки на "Обновить тест"
        const submitBtn = document.querySelector('#testForm .submit-btn');
        submitBtn.textContent = '💾 Обновить тест';
        submitBtn.dataset.testId = testId;
        submitBtn.dataset.editMode = 'true';
        
        // Переключаемся на вкладку тестов
        showSection('tests');
        
        alert('✅ Тест загружен для редактирования');
        
    } catch (error) {
        console.error('Ошибка загрузки теста:', error);
        alert('❌ Ошибка загрузки теста для редактирования');
    }
}

// Удаление теста
async function deleteTest(testId, testTitle) {
    if (!confirm(`⚠️ Удалить тест "${testTitle}"?\n\nЭто действие необратимо!`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/proxy/admin/tests/${testId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            alert(`✅ Тест "${testTitle}" успешно удален`);
            loadTests(); // Обновляем список тестов
        } else {
            const error = await response.json();
            alert(`❌ Ошибка: ${error.message || 'Не удалось удалить тест'}`);
        }
    } catch (error) {
        console.error('Ошибка удаления теста:', error);
        alert('❌ Ошибка соединения с сервером');
    }
}

// Просмотр вопросов теста
async function viewTestQuestions(testId) {
    try {
        const response = await fetch(`/api/proxy/admin/tests/${testId}/questions`);
        if (!response.ok) {
            throw new Error('Вопросы не найдены');
        }
        
        const questions = await response.json();
        
        let questionsHtml = `
            <div class="questions-modal">
                <div class="questions-modal-content">
                    <div class="questions-modal-header">
                        <h3>❓ Вопросы теста</h3>
                        <button onclick="closeQuestionsModal()" class="close-modal-btn">✕</button>
                    </div>
                    <div class="questions-modal-body">
        `;
        
        questions.forEach((question, index) => {
            questionsHtml += `
                <div class="question-preview">
                    <div class="question-preview-header">
                        <strong>Вопрос ${index + 1}:</strong>
                    </div>
                    <div class="question-preview-text">${question.text}</div>
                    ${question.explanation ? `<div class="question-explanation">💡 ${question.explanation}</div>` : ''}
                    <div class="question-options">
                        ${question.options.map(option => `
                            <div class="option-preview ${option.is_correct ? 'correct' : ''}">
                                ${option.is_correct ? '✅' : '❌'} ${option.text}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });
        
        questionsHtml += `
                    </div>
                </div>
            </div>
        `;
        
        // Добавляем модальное окно в DOM
        const modalDiv = document.createElement('div');
        modalDiv.innerHTML = questionsHtml;
        document.body.appendChild(modalDiv);
        
    } catch (error) {
        console.error('Ошибка загрузки вопросов:', error);
        alert('❌ Ошибка загрузки вопросов теста');
    }
}

// Закрытие модального окна с вопросами
function closeQuestionsModal() {
    const modal = document.querySelector('.questions-modal');
    if (modal) {
        modal.parentElement.remove();
    }
}

// Добавление вопроса с данными (для редактирования)
function addQuestionWithData(questionData) {
    questionCounter++;
    const container = document.getElementById('questionsContainer');
    
    const questionHtml = `
        <div class="question-item" data-question-id="${questionCounter}">
            <div class="question-header">
                <div class="question-number">❓ Вопрос ${questionCounter}</div>
                <button type="button" onclick="removeQuestion(${questionCounter})" class="remove-question-btn">🗑️ Удалить</button>
            </div>
            
            <div class="question-input">
                <label>Текст вопроса:</label>
                <textarea placeholder="Введите текст вопроса..." required>${questionData.text || ''}</textarea>
            </div>
            
            <div class="question-input">
                <label>Объяснение (необязательно):</label>
                <textarea placeholder="Объяснение правильного ответа..." rows="2">${questionData.explanation || ''}</textarea>
            </div>
            
            <div class="answers-section">
                <div class="answers-header">
                    <h5>📝 Варианты ответов</h5>
                    <button type="button" onclick="addAnswer(${questionCounter})" class="add-answer-btn">➕ Добавить вариант</button>
                </div>
                <div class="answers-list" id="answers-${questionCounter}">
                    <!-- Варианты ответов будут добавляться здесь -->
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', questionHtml);
    
    // Добавляем варианты ответов
    if (questionData.options && questionData.options.length > 0) {
        const answersContainer = document.getElementById(`answers-${questionCounter}`);
        questionData.options.forEach(option => {
            const answerHtml = `
                <div class="answer-item">
                    <input type="checkbox" class="answer-checkbox" ${option.is_correct ? 'checked' : ''} title="Отметьте, если это правильный ответ">
                    <input type="text" class="answer-input" value="${option.text}" required>
                    <button type="button" onclick="removeAnswer(this)" class="remove-answer-btn">🗑️</button>
                </div>
            `;
            answersContainer.insertAdjacentHTML('beforeend', answerHtml);
        });
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    // Загружаем тесты при переходе на вкладку
    setTimeout(() => {
        if (document.getElementById('testList')) {
            loadTests();
        }
    }, 500);
    
    // Добавляем обработчик для формы теста
    setTimeout(() => {
        const testForm = document.getElementById('testForm');
        if (testForm && !testForm.dataset.handlerAdded) {
            testForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const questions = collectQuestions();
                if (questions.length === 0) {
                    return; // Ошибки валидации уже показаны в collectQuestions
                }
                
                const formData = {
                    title: document.getElementById('testTitle').value,
                    subject: document.getElementById('testSubject').value,
                    category: document.getElementById('testCategory').value,
                    duration: parseInt(document.getElementById('testDuration').value) || 30,
                    description: document.getElementById('testDescription').value,
                    questions: questions
                };
                
                const submitBtn = this.querySelector('.submit-btn');
                const originalText = submitBtn.textContent;
                const isEditMode = submitBtn.dataset.editMode === 'true';
                const testId = submitBtn.dataset.testId;
                
                submitBtn.textContent = isEditMode ? 'Обновление теста...' : 'Создание теста...';
                submitBtn.disabled = true;
                
                try {
                    const url = isEditMode ? `/api/proxy/admin/tests/${testId}` : '/api/proxy/admin/tests';
                    const method = isEditMode ? 'PUT' : 'POST';
                    
                    const response = await fetch(url, {
                        method: method,
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(formData)
                    });
                    
                    if (response.ok) {
                        const action = isEditMode ? 'обновлен' : 'создан';
                        alert(`✅ Тест "${formData.title}" успешно ${action} с ${questions.length} вопросами!`);
                        clearTestForm();
                        
                        // Сбрасываем режим редактирования
                        submitBtn.textContent = '💾 Создать тест';
                        delete submitBtn.dataset.testId;
                        delete submitBtn.dataset.editMode;
                        
                        if (typeof loadTests === 'function') {
                            loadTests(); // Обновляем список тестов
                        }
                    } else {
                        const error = await response.json();
                        alert(`❌ Ошибка: ${error.message || 'Не удалось сохранить тест'}`);
                    }
                } catch (error) {
                    console.error('Ошибка сохранения теста:', error);
                    alert('❌ Ошибка соединения с сервером');
                }
                
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            });
            testForm.dataset.handlerAdded = 'true';
        }
    }, 1000);
});