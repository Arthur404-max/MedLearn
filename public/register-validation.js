// Валидация формы регистрации в реальном времени
document.addEventListener('DOMContentLoaded', () => {
    const firstNameInput = document.getElementById('firstName');
    const lastNameInput = document.getElementById('lastName');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    if (!firstNameInput) return; // Проверка что мы на странице регистрации
    
    // Валидация имени
    firstNameInput.addEventListener('input', (e) => {
        const value = e.target.value;
        const nameRegex = /^[A-Za-z]*$/;
        
        if (!nameRegex.test(value)) {
            e.target.setCustomValidity('Только английские буквы');
            e.target.style.borderColor = '#e74c3c';
        } else {
            e.target.setCustomValidity('');
            e.target.style.borderColor = value ? '#10b981' : '';
        }
    });
    
    // Валидация фамилии
    lastNameInput.addEventListener('input', (e) => {
        const value = e.target.value;
        const nameRegex = /^[A-Za-z]*$/;
        
        if (!nameRegex.test(value)) {
            e.target.setCustomValidity('Только английские буквы');
            e.target.style.borderColor = '#e74c3c';
        } else {
            e.target.setCustomValidity('');
            e.target.style.borderColor = value ? '#10b981' : '';
        }
    });
    
    // Валидация пароля
    passwordInput.addEventListener('input', (e) => {
        const value = e.target.value;
        const passwordRegex = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]*$/;
        
        if (!passwordRegex.test(value)) {
            e.target.setCustomValidity('Только английские буквы, цифры и спецсимволы');
            e.target.style.borderColor = '#e74c3c';
        } else if (value.length > 0 && value.length < 6) {
            e.target.setCustomValidity('Минимум 6 символов');
            e.target.style.borderColor = '#f39c12';
        } else {
            e.target.setCustomValidity('');
            e.target.style.borderColor = value.length >= 6 ? '#10b981' : '';
        }
        
        // Проверить совпадение с подтверждением
        if (confirmPasswordInput.value) {
            validatePasswordMatch();
        }
    });
    
    // Валидация подтверждения пароля
    confirmPasswordInput.addEventListener('input', validatePasswordMatch);
    
    function validatePasswordMatch() {
        if (confirmPasswordInput.value === passwordInput.value && confirmPasswordInput.value.length >= 6) {
            confirmPasswordInput.style.borderColor = '#10b981';
            confirmPasswordInput.setCustomValidity('');
        } else if (confirmPasswordInput.value.length > 0) {
            confirmPasswordInput.style.borderColor = '#e74c3c';
            confirmPasswordInput.setCustomValidity('Пароли не совпадают');
        } else {
            confirmPasswordInput.style.borderColor = '';
            confirmPasswordInput.setCustomValidity('');
        }
    }
});
