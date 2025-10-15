let resources = [];
let currentFilter = 'all';

// Загрузка ресурсов
async function loadResources() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/resources', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            resources = await response.json();
            filterResources(currentFilter);
        }
    } catch (error) {
        console.error('Error loading resources:', error);
    }
}

// Фильтрация ресурсов
function filterResources(filter) {
    currentFilter = filter;
    const filteredResources = filter === 'all' 
        ? resources 
        : resources.filter(resource => resource.type === filter);
    
    displayResources(filteredResources);
    updateFilterButtons();
}

// Отображение ресурсов
function displayResources(resourcesToShow) {
    const grid = document.getElementById('resourcesGrid');
    grid.innerHTML = '';
    
    if (resourcesToShow.length === 0) {
        grid.innerHTML = '<p class="no-resources">Ресурсы не найдены</p>';
        return;
    }

    const template = document.getElementById('resourceTemplate');
    
    resourcesToShow.forEach(resource => {
        const clone = template.content.cloneNode(true);
        
        // Заполняем данные
        clone.querySelector('.resource-image img').src = resource.image;
        clone.querySelector('.resource-image img').alt = resource.title;
        clone.querySelector('.resource-type').textContent = getResourceTypeLabel(resource.type);
        clone.querySelector('.resource-title').textContent = resource.title;
        clone.querySelector('.resource-description').textContent = resource.description;
        clone.querySelector('.resource-author').textContent = resource.author;
        clone.querySelector('.resource-date').textContent = new Date(resource.date).toLocaleDateString();
        clone.querySelector('.resource-link').href = resource.url;
        
        grid.appendChild(clone);
    });
}

// Обновление кнопок фильтров
function updateFilterButtons() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === currentFilter);
    });
}

// Получение метки типа ресурса
function getResourceTypeLabel(type) {
    const types = {
        'articles': 'Статья',
        'videos': 'Видео',
        'books': 'Книга',
        'tools': 'Инструмент'
    };
    return types[type] || 'Другое';
}

// Поиск ресурсов
function searchResources(query) {
    query = query.toLowerCase();
    const filtered = resources.filter(resource => 
        resource.title.toLowerCase().includes(query) ||
        resource.description.toLowerCase().includes(query) ||
        resource.author.toLowerCase().includes(query)
    );
    displayResources(filtered);
}

// Инициализация страницы
document.addEventListener('DOMContentLoaded', () => {
    loadResources();
    
    // Обработчики фильтров
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => filterResources(btn.dataset.filter));
    });
    
    // Обработчик поиска
    const searchInput = document.getElementById('searchResources');
    let searchTimeout;
    
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchResources(e.target.value);
        }, 300);
    });
});