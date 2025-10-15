// Проверка авторизации при загрузке защищенных страниц
function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/';
        return false;
    }
    return true;
}

// Функция выхода
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

// Получение данных пользователя
async function getCurrentUser() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/auth/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        if (response.ok) {
            const user = await response.json();
            return user;
        } else {
            logout();
            return null;
        }
    } catch (error) {
        console.error('Error fetching user data:', error);
        return null;
    }
}

// Проверяем авторизацию при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    // Не проверяем авторизацию на главной странице
    if (window.location.pathname === '/') return;
    
    checkAuth();
});