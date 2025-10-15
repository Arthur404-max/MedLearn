let currentPlan = null;
let isYearly = false;

// Инициализация страницы
document.addEventListener('DOMContentLoaded', () => {
    updatePrices();
    setupEventListeners();
    loadUserSubscription();
});

// Загрузка текущей подписки пользователя
async function loadUserSubscription() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/subscriptions/current', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const subscription = await response.json();
            if (subscription.active) {
                highlightCurrentPlan(subscription.plan);
            }
        }
    } catch (error) {
        console.error('Error loading subscription:', error);
    }
}

// Подсветка текущего плана
function highlightCurrentPlan(plan) {
    document.querySelectorAll('.subscription-card').forEach(card => {
        const cardPlan = card.querySelector('.btn-subscribe').dataset.plan;
        if (cardPlan === plan) {
            card.classList.add('current');
            card.querySelector('.btn-subscribe').textContent = 'Текущий план';
            card.querySelector('.btn-subscribe').disabled = true;
        }
    });
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Переключатель периода оплаты
    document.getElementById('billingToggle').addEventListener('change', (e) => {
        isYearly = e.target.checked;
        updatePrices();
    });

    // Кнопки выбора плана
    document.querySelectorAll('.btn-subscribe').forEach(btn => {
        btn.addEventListener('click', () => {
            currentPlan = {
                type: btn.dataset.plan,
                period: isYearly ? 'year' : 'semester'
            };
            showPaymentModal();
        });
    });

    // Закрытие модального окна
    window.onclick = function(event) {
        const modal = document.getElementById('paymentModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    // Обработка формы оплаты
    document.getElementById('paymentForm').addEventListener('submit', handlePayment);
}

// Обновление цен
function updatePrices() {
    document.querySelectorAll('.amount.semester').forEach(el => {
        el.classList.toggle('active', !isYearly);
    });
    document.querySelectorAll('.amount.year').forEach(el => {
        el.classList.toggle('active', isYearly);
    });
}

// Показ модального окна оплаты
function showPaymentModal() {
    const modal = document.getElementById('paymentModal');
    const planTitle = currentPlan.type === 'basic' ? 'Базовая' : 'Базовая + ИИ';
    const period = currentPlan.period === 'year' ? 'Год' : 'Семестр';
    const price = getPlanPrice();

    document.getElementById('selectedPlan').textContent = `${planTitle} (${period})`;
    document.getElementById('planPrice').textContent = `${price}₽`;
    modal.style.display = 'block';
}

// Получение цены плана
function getPlanPrice() {
    const prices = {
        basic: {
            semester: 100,
            year: 150
        },
        premium: {
            semester: 150,
            year: 250
        }
    };
    return prices[currentPlan.type][currentPlan.period];
}

// Форматирование номера карты
function formatCardNumber(input) {
    let value = input.value.replace(/\D/g, '');
    let formattedValue = '';
    
    for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0) {
            formattedValue += ' ';
        }
        formattedValue += value[i];
    }
    
    input.value = formattedValue;
}

// Форматирование срока действия карты
function formatExpiryDate(input) {
    let value = input.value.replace(/\D/g, '');
    if (value.length > 2) {
        value = value.substr(0, 2) + '/' + value.substr(2);
    }
    input.value = value;
}

// Обработка оплаты
async function handlePayment(e) {
    e.preventDefault();
    
    const formData = {
        plan: currentPlan,
        payment: {
            cardNumber: document.getElementById('cardNumber').value.replace(/\s/g, ''),
            expiryDate: document.getElementById('expiryDate').value,
            cvv: document.getElementById('cvv').value,
            cardHolder: document.getElementById('cardHolder').value
        }
    };

    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/subscriptions/purchase', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            alert('Подписка успешно оформлена!');
            window.location.reload();
        } else {
            const error = await response.json();
            alert(error.message || 'Ошибка при оформлении подписки');
        }
    } catch (error) {
        console.error('Error processing payment:', error);
        alert('Произошла ошибка при обработке платежа');
    }
}

// Добавляем обработчики форматирования полей ввода
document.getElementById('cardNumber').addEventListener('input', (e) => formatCardNumber(e.target));
document.getElementById('expiryDate').addEventListener('input', (e) => formatExpiryDate(e.target));