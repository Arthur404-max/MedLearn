// public/js/resources-page.js
// Весь JS-код из <script> блока resources.html вынесен сюда для обхода CSP

let currentResources = [];
let currentResourceId = null;

// Инициализация страницы
window.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    loadSubjectsFilter();
    loadResources();

    // Поиск при вводе
    document.getElementById('searchInput').addEventListener('input', () => {
        setTimeout(() => {
            const filtered = getFilteredResources();
            displayResources(filtered);
        }, 300);
    });

    // Фильтрация при изменении селектов
    document.getElementById('subjectFilter').addEventListener('change', () => {
        const filtered = getFilteredResources();
        displayResources(filtered);
    });

    document.getElementById('typeFilter').addEventListener('change', () => {
        const filtered = getFilteredResources();
        displayResources(filtered);
    });

    // Закрытие модального окна по ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('articleModal').style.display === 'flex') {
            closeArticleModal();
        }
    });
});

// Загрузка предметов для фильтра
async function loadSubjectsFilter() {
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/tests/subjects', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const subjects = await response.json();
            const select = document.getElementById('subjectFilter');
            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject.id;
                option.textContent = `${subject.icon || '📚'} ${subject.name}`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Ошибка загрузки предметов:', error);
    }
}

// Загрузка ресурсов
async function loadResources() {
    try {
        console.log('📚 Загружаем ресурсы...');
        const container = document.getElementById('resourcesContainer');
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem;">⏳</div>
                <p>Загружаем ресурсы...</p>
            </div>
        `;
        const token = localStorage.getItem('token');
        const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
        const response = await fetch('/api/resources', { headers });
        if (response.ok) {
            const resources = await response.json();
            console.log('✅ Загружено ресурсов:', resources.length);
            currentResources = resources;
            await loadFavoriteStatuses(resources);
            displayResources(resources);
        } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки ресурсов:', error);
        document.getElementById('resourcesContainer').innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
                <div style="font-size: 3rem; margin-bottom: 1rem; color: #e74c3c;">❌</div>
                <h3>Ошибка загрузки ресурсов</h3>
                <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Не удалось загрузить учебные материалы</p>
                <button onclick="loadResources()" class="btn btn-primary">🔄 Попробовать еще раз</button>
            </div>
        `;
    }
}

// Загрузка статусов избранного для ресурсов
async function loadFavoriteStatuses(resources) {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        const favoriteChecks = await Promise.all(
            resources.map(async (resource) => {
                try {
                    const response = await fetch(`/api/resources/favorite/check/${resource.id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        return { id: resource.id, isFavorite: data.isFavorite };
                    }
                } catch (error) {
                    console.error('Ошибка проверки избранного для ресурса', resource.id, error);
                }
                return { id: resource.id, isFavorite: false };
            })
        );
        favoriteChecks.forEach(check => {
            const resource = resources.find(r => r.id === check.id);
            if (resource) {
                resource.is_favorite = check.isFavorite;
            }
        });
        console.log('✅ Статусы избранного загружены');
    } catch (error) {
        console.error('❌ Ошибка загрузки статусов избранного:', error);
    }
}

// Отображение ресурсов
function displayResources(resources) {
    const container = document.getElementById('resourcesContainer');
    if (resources.length === 0) {
        container.innerHTML = `
            <div class="card" style="grid-column: 1 / -1; text-align: center; border-color: #ff9800;">
                <div class="card-body" style="padding: 3rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">📚</div>
                    <h3>Ресурсы не найдены</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Попробуйте изменить критерии поиска или фильтрацию</p>
                    <button onclick="clearFilters()" class="btn btn-primary">🔄 Сбросить фильтры</button>
                </div>
            </div>
        `;
        return;
    }
    container.innerHTML = resources.map(resource => `
        <div class="card resource-card" onclick="openArticle(${resource.id})" style="cursor: pointer; transition: all 0.3s ease; border-left: 4px solid ${getResourceColor(resource.resource_type)};">
            <div class="card-header" style="position: relative; text-align: center; background: ${getResourceGradient(resource.resource_type)}; color: white; min-height: 120px; display: flex; flex-direction: column; justify-content: center;">
                ${resource.is_favorite ? '<div style="position: absolute; top: 0.5rem; right: 0.5rem; font-size: 1.2rem;">⭐</div>' : ''}
                <div style="font-size: 3rem; margin-bottom: 0.5rem;">
                    ${getResourceIcon(resource.resource_type)}
                </div>
                <div style="font-size: 0.8rem; opacity: 0.9; font-weight: 600;">
                    ${getResourceTypeName(resource.resource_type)}
                </div>
            </div>
            <div class="card-body">
                <h3 class="card-title" style="font-size: 1.1rem; margin-bottom: 0.5rem; height: 2.5rem; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                    ${resource.title}
                </h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1rem; height: 3rem; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                    ${resource.description || 'Качественный материал для изучения выбранной темы'}
                </p>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                    <span style="color: var(--text-secondary); display: flex; align-items: center;">
                        <span style="margin-right: 0.25rem;">👁️</span> ${resource.views_count || 0}
                    </span>
                    <div style="display: flex; gap: 0.5rem;">
                        ${resource.is_premium ? '<span style="color: #ff9800; font-weight: 600;">💎 Премиум</span>' : ''}
                        <button onclick="event.stopPropagation(); toggleResourceFavorite(${resource.id})" 
                                style="background: none; border: none; font-size: 1.2rem; cursor: pointer; padding: 0;" 
                                title="${resource.is_favorite ? 'Удалить из избранного' : 'Добавить в избранное'}">
                            ${resource.is_favorite ? '⭐' : '☆'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// Фильтрация ресурсов (вызывается из кнопки "Найти")
function filterResources() {
    console.log('🔍 Применяем фильтры...');
    const filtered = getFilteredResources();
    displayResources(filtered);
    const subjectId = document.getElementById('subjectFilter').value;
    const type = document.getElementById('typeFilter').value;
    const search = document.getElementById('searchInput').value;
    console.log('📊 Фильтр: предмет=' + subjectId + ', тип=' + type + ', поиск=' + search + ', результат=' + filtered.length);
}

// Открытие статьи
async function openArticle(resourceId) {
    try {
        currentResourceId = resourceId;
        const resource = currentResources.find(r => r.id === resourceId);
        if (!resource) {
            console.error('Ресурс не найден:', resourceId);
            return;
        }
        console.log('📖 Открываем ресурс:', resource.title);
        document.getElementById('modalTitle').textContent = resource.title;
        document.getElementById('modalContent').innerHTML = formatContent(resource.content || resource.description || 'Содержание недоступно');
        const favoriteBtn = document.getElementById('favoriteBtn');
        favoriteBtn.innerHTML = resource.is_favorite ? '⭐ Удалить из избранного' : '☆ Добавить в избранное';
        document.getElementById('articleModal').style.display = 'flex';
        try {
            const token = localStorage.getItem('token');
            if (token) {
                const response = await fetch(`/api/resources/view/${resourceId}`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    resource.views_count = (resource.views_count || 0) + 1;
                    console.log('👁️ Счетчик просмотров увеличен:', resource.views_count);
                }
            }
        } catch (error) {
            console.error('❌ Ошибка увеличения счетчика:', error);
        }
    } catch (error) {
        console.error('❌ Ошибка открытия ресурса:', error);
        alert('Ошибка при открытии ресурса');
    }
}

// Закрытие модального окна
function closeArticleModal() {
    document.getElementById('articleModal').style.display = 'none';
    currentResourceId = null;
}

// Форматирование контента
function formatContent(content) {
    if (!content) return '<p style="text-align: center; color: var(--text-secondary); font-style: italic;">Содержание временно недоступно</p>';
    return content
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^(.+)$/, '<p>$1</p>')
        .replace(/<p><\/p>/g, '');
}

function getResourceIcon(type) {
    const icons = {
        'article': '📄',
        'video': '🎥',
        'book': '📖',
        'document': '📋'
    };
    return icons[type] || '📚';
}

function getResourceGradient(type) {
    const gradients = {
        'article': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'video': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'book': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'document': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)'
    };
    return gradients[type] || 'var(--primary-gradient)';
}

function getResourceTypeName(type) {
    const names = {
        'article': 'СТАТЬЯ',
        'video': 'ВИДЕО',
        'book': 'КНИГА',
        'document': 'ДОКУМЕНТ'
    };
    return names[type] || 'РЕСУРС';
}

// Переключение избранного для ресурса
async function toggleResourceFavorite(resourceId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('Необходимо войти в аккаунт для добавления в избранное');
            return;
        }
        const resource = currentResources.find(r => r.id === resourceId);
        if (!resource) return;
        const method = resource.is_favorite ? 'DELETE' : 'POST';
        const response = await fetch(`/api/resources/favorite/${resourceId}`, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            resource.is_favorite = !resource.is_favorite;
            console.log(resource.is_favorite ? '⭐ Добавлено в избранное:' : '☆ Удалено из избранного:', resource.title);
            const filteredResources = getFilteredResources();
            displayResources(filteredResources);
        } else {
            throw new Error('Не удалось обновить избранное');
        }
    } catch (error) {
        console.error('❌ Ошибка обновления избранного:', error);
        alert('Ошибка при обновлении избранного');
    }
}

// Сброс всех фильтров
function clearFilters() {
    document.getElementById('subjectFilter').value = '';
    document.getElementById('typeFilter').value = '';
    document.getElementById('searchInput').value = '';
    displayResources(currentResources);
}

// Показать только избранные ресурсы
function showFavorites() {
    console.log('⭐ Показываем избранные ресурсы...');
    const favorites = currentResources.filter(resource => resource.is_favorite);
    if (favorites.length === 0) {
        const container = document.getElementById('resourcesContainer');
        container.innerHTML = `
            <div class="card" style="grid-column: 1 / -1; text-align: center; border-color: #ff9800;">
                <div class="card-body" style="padding: 3rem;">
                    <div style="font-size: 4rem; margin-bottom: 1rem;">⭐</div>
                    <h3>Нет избранных ресурсов</h3>
                    <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Добавьте ресурсы в избранное, нажав на звездочку</p>
                    <button onclick="loadResources()" class="btn btn-primary">📚 Показать все ресурсы</button>
                </div>
            </div>
        `;
    } else {
        displayResources(favorites);
        console.log('✅ Показано избранных ресурсов:', favorites.length);
    }
}

// Получение отфильтрованных ресурсов
function getFilteredResources() {
    const subjectId = document.getElementById('subjectFilter').value;
    const type = document.getElementById('typeFilter').value;
    const search = document.getElementById('searchInput').value.toLowerCase();
    return currentResources.filter(resource => {
        const matchSubject = !subjectId || resource.subject_id == subjectId;
        const matchType = !type || resource.resource_type === type;
        const matchSearch = !search || 
            resource.title.toLowerCase().includes(search) ||
            (resource.description && resource.description.toLowerCase().includes(search));
        return matchSubject && matchType && matchSearch;
    });
}

function getResourceColor(type) {
    const colors = {
        'article': '#667eea',
        'video': '#f5576c',
        'book': '#4facfe',
        'document': '#43e97b'
    };
    return colors[type] || '#667eea';
}

// Обновленная функция toggleFavorite для модального окна
async function toggleFavorite() {
    if (currentResourceId) {
        await toggleResourceFavorite(currentResourceId);
        const resource = currentResources.find(r => r.id === currentResourceId);
        if (resource) {
            const favoriteBtn = document.getElementById('favoriteBtn');
            favoriteBtn.innerHTML = resource.is_favorite ? '⭐ Удалить из избранного' : '☆ Добавить в избранное';
        }
    }
}
