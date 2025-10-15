let currentTest = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let timer = null;

// Загрузка предметов
async function loadSubjects() {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch('/api/tests/subjects', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const subjects = await response.json();
            const subjectSelect = document.getElementById('subject');
            subjectSelect.innerHTML = '<option value="">Выберите предмет</option>';
            
            subjects.forEach(subject => {
                const option = document.createElement('option');
                option.value = subject.id;
                option.textContent = subject.name;
                subjectSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading subjects:', error);
    }
}

// Загрузка категорий
async function loadCategories(subjectId) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`/api/tests/categories/${subjectId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const categories = await response.json();
            const categorySelect = document.getElementById('category');
            categorySelect.innerHTML = '<option value="">Выберите категорию</option>';
            categorySelect.disabled = false;
            
            categories.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                categorySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

// Загрузка подкатегорий
async function loadSubcategories(categoryId) {
    const token = localStorage.getItem('token');
    try {
        const response = await fetch(`/api/tests/subcategories/${categoryId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const subcategories = await response.json();
            const subcategorySelect = document.getElementById('subcategory');
            subcategorySelect.innerHTML = '<option value="">Выберите подкатегорию</option>';
            subcategorySelect.disabled = false;
            
            subcategories.forEach(subcategory => {
                const option = document.createElement('option');
                option.value = subcategory.id;
                option.textContent = subcategory.name;
                subcategorySelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading subcategories:', error);
    }
}

// Начало теста
async function startTest() {
    const subcategoryId = document.getElementById('subcategory').value;
    const token = localStorage.getItem('token');

    try {
        const response = await fetch(`/api/tests/start/${subcategoryId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            currentTest = await response.json();
            userAnswers = new Array(currentTest.questions.length).fill(null);
            currentQuestionIndex = 0;
            
            document.querySelector('.test-selection').style.display = 'none';
            document.getElementById('testArea').style.display = 'block';
            
            updateQuestion();
            startTimer();
        }
    } catch (error) {
        console.error('Error starting test:', error);
    }
}

// Обновление вопроса
function updateQuestion() {
    const question = currentTest.questions[currentQuestionIndex];
    document.getElementById('testTitle').textContent = currentTest.title;
    document.getElementById('questionCounter').textContent = `Вопрос ${currentQuestionIndex + 1} из ${currentTest.questions.length}`;
    document.getElementById('questionText').textContent = question.text;
    
    const answerOptions = document.getElementById('answerOptions');
    answerOptions.innerHTML = '';
    
    question.options.forEach((option, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'answer-option';
        if (userAnswers[currentQuestionIndex] === index) {
            optionDiv.classList.add('selected');
        }
        optionDiv.textContent = option;
        optionDiv.onclick = () => selectAnswer(index);
        answerOptions.appendChild(optionDiv);
    });

    // Обновление кнопок навигации
    document.getElementById('prevQuestion').disabled = currentQuestionIndex === 0;
    document.getElementById('nextQuestion').style.display = currentQuestionIndex === currentTest.questions.length - 1 ? 'none' : 'block';
    document.getElementById('finishTest').style.display = currentQuestionIndex === currentTest.questions.length - 1 ? 'block' : 'none';
}

// Выбор ответа
function selectAnswer(index) {
    userAnswers[currentQuestionIndex] = index;
    const options = document.querySelectorAll('.answer-option');
    options.forEach((option, i) => {
        option.classList.toggle('selected', i === index);
    });
}

// Таймер
function startTimer() {
    let seconds = 0;
    const timerElement = document.getElementById('timer');
    
    timer = setInterval(() => {
        seconds++;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        timerElement.textContent = `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
    }, 1000);
}

// Завершение теста
async function finishTest() {
    clearInterval(timer);
    const token = localStorage.getItem('token');

    try {
        const response = await fetch('/api/tests/finish', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                testId: currentTest.id,
                answers: userAnswers
            })
        });
        
        if (response.ok) {
            const results = await response.json();
            showResults(results);
        }
    } catch (error) {
        console.error('Error finishing test:', error);
    }
}

// Показ результатов
function showResults(results) {
    document.getElementById('testArea').style.display = 'none';
    document.getElementById('resultArea').style.display = 'block';
    
    document.getElementById('correctAnswers').textContent = `${results.correctAnswers}/${currentTest.questions.length}`;
    document.getElementById('scorePercentage').textContent = `${Math.round(results.percentage)}%`;
    document.getElementById('timeSpent').textContent = document.getElementById('timer').textContent;
    
    const reviewContainer = document.getElementById('answersReview');
    reviewContainer.innerHTML = '';
    
    results.answers.forEach((answer, index) => {
        const reviewItem = document.createElement('div');
        reviewItem.className = `review-item ${answer.correct ? 'correct' : 'incorrect'}`;
        reviewItem.innerHTML = `
            <h4>Вопрос ${index + 1}</h4>
            <p>${currentTest.questions[index].text}</p>
            <p>Ваш ответ: ${currentTest.questions[index].options[userAnswers[index]]}</p>
            ${!answer.correct ? `<p>Правильный ответ: ${currentTest.questions[index].options[answer.correctIndex]}</p>` : ''}
        `;
        reviewContainer.appendChild(reviewItem);
    });
}

// Перезапуск теста
function restartTest() {
    currentQuestionIndex = 0;
    userAnswers = new Array(currentTest.questions.length).fill(null);
    
    document.getElementById('resultArea').style.display = 'none';
    document.getElementById('testArea').style.display = 'block';
    
    updateQuestion();
    startTimer();
}

// Возврат к выбору теста
function backToSelection() {
    document.getElementById('resultArea').style.display = 'none';
    document.querySelector('.test-selection').style.display = 'block';
    
    // Сброс выбранных значений
    document.getElementById('category').disabled = true;
    document.getElementById('subcategory').disabled = true;
    document.getElementById('startTest').disabled = true;
}

// Обработчики событий
document.addEventListener('DOMContentLoaded', () => {
    loadSubjects();
    
    document.getElementById('subject').addEventListener('change', (e) => {
        if (e.target.value) {
            loadCategories(e.target.value);
        } else {
            document.getElementById('category').disabled = true;
            document.getElementById('subcategory').disabled = true;
        }
    });
    
    document.getElementById('category').addEventListener('change', (e) => {
        if (e.target.value) {
            loadSubcategories(e.target.value);
        } else {
            document.getElementById('subcategory').disabled = true;
        }
    });
    
    document.getElementById('subcategory').addEventListener('change', (e) => {
        document.getElementById('startTest').disabled = !e.target.value;
    });
    
    document.getElementById('startTest').addEventListener('click', startTest);
    document.getElementById('prevQuestion').addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            currentQuestionIndex--;
            updateQuestion();
        }
    });
    
    document.getElementById('nextQuestion').addEventListener('click', () => {
        if (currentQuestionIndex < currentTest.questions.length - 1) {
            currentQuestionIndex++;
            updateQuestion();
        }
    });
    
    document.getElementById('finishTest').addEventListener('click', finishTest);
});