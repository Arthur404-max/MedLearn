document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const errorElement = document.getElementById('errorMessage');
    const submitBtn = this.querySelector('button[type="submit"]');
    
    submitBtn.textContent = '🔄 Проверка...';
    submitBtn.disabled = true;
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            localStorage.setItem('adminToken', data.token);
            localStorage.setItem('adminLoginTime', Date.now().toString());
            
            // Успешный вход
            submitBtn.textContent = '✅ Успешно!';
            setTimeout(() => {
                window.location.href = '/';
            }, 500);
        } else {
            errorElement.style.display = 'block';
            errorElement.textContent = data.message;
            submitBtn.textContent = '🔓 Войти в админ-панель';
            submitBtn.disabled = false;
        }
    } catch (error) {
        console.error('Ошибка входа:', error);
        errorElement.style.display = 'block';
        errorElement.textContent = 'Ошибка соединения с сервером';
        submitBtn.textContent = '🔓 Войти в админ-панель';
        submitBtn.disabled = false;
    }
});