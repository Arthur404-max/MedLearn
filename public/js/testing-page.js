document.addEventListener('DOMContentLoaded', function () {
    console.log('🔍 Страница тестирования загружена');

    const isAuth = checkAuth();
    console.log('🔐 Статус авторизации:', isAuth);

    console.log('📚 Начинаем загрузку предметов...');
    loadSubjects()
        .then(() => {
            console.log('✅ Предметы загружены');
        })
        .catch((error) => {
            console.error('❌ Ошибка загрузки предметов:', error);

            const subjectsGrid = document.getElementById('subjectsGrid');
            if (subjectsGrid) {
                subjectsGrid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 2rem;">
                        <h3>⚠️ Проблема с загрузкой тестов</h3>
                        <p>Не удалось загрузить список предметов. Попробуйте:</p>
                        <ul style="text-align: left; display: inline-block;">
                            <li>Обновить страницу</li>
                            <li>Проверить подключение к интернету</li>
                            <li>Войти в систему через <a href="auth.html">авторизацию</a></li>
                        </ul>
                        <button onclick="location.reload()" class="btn btn-primary">Обновить</button>
                    </div>
                `;
            }
        });
});

async function loadSubjectsPublic() {
    try {
        console.log('📡 Запрос к API без авторизации...');
        const response = await fetch('/api/tests/subjects');
        console.log('📊 Ответ сервера:', response.status);

        const data = await response.json();
        console.log('📋 Данные:', data);

        if (response.ok && data.length > 0) {
            const subjectsGrid = document.getElementById('subjectsGrid');
            if (subjectsGrid) {
                subjectsGrid.innerHTML = data
                    .map(
                        (subject) => `
                            <div class="card" onclick="selectSubject(${subject.id})" style="cursor: pointer;">
                                <div class="card-body" style="text-align: center;">
                                    <div style="font-size: 3rem; margin-bottom: 1rem;">${getSubjectIcon(subject.name)}</div>
                                    <h3 class="card-title">${subject.name}</h3>
                                    <p class="card-subtitle">${subject.description}</p>
                                </div>
                            </div>
                        `
                    )
                    .join('');
                console.log('✅ Предметы отображены на странице');
            }
        } else {
            throw new Error('Нет данных или ошибка ответа');
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки предметов:', error);
    }
}
