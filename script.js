// 全局变量
let currentWordIndex = 0;
let orangeCount = 0;
let hasUsedHint = false;
let engine, world, canvas;
let oranges = [];
let isGameCompleted = false;

// 当前登录用户
let currentUser = '';

// 错词本数据 - 根据用户隔离
let errorWords = [];

// 白名单手机号（示例）
const whitelist = [
    '13800138000',
    '13900139000', 
    '15800158000',
    '18600186000',
    '17700177000'
];

// 单词数据 - 引用完整的2055词数据库
// 注意：实际的单词数据在 words-data-extended.js 文件中定义

// DOM 元素
const loginScreen = document.getElementById('loginScreen');
const gameScreen = document.getElementById('gameScreen');
const completionScreen = document.getElementById('completionScreen');
const phoneInput = document.getElementById('phoneInput');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const wordInput = document.getElementById('wordInput');
const submitBtn = document.getElementById('submitBtn');
const playBtn = document.getElementById('playBtn');
const hintBtn = document.getElementById('hintBtn');
const hintDisplay = document.getElementById('hintDisplay');
const currentWordSpan = document.getElementById('currentWord');
const totalWordsSpan = document.getElementById('totalWords');
const orangeCountSpan = document.getElementById('orangeCount');
const finalScoreSpan = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');
const errorBookBtn = document.getElementById('errorBookBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userPhoneSpan = document.getElementById('userPhone');
// 用户数据管理
function getUserStorageKey(key) {
    return `sweetbeet_${currentUser}_${key}`;
}

function loadUserData() {
    // 加载用户专属的错词本
    errorWords = JSON.parse(localStorage.getItem(getUserStorageKey('error_words')) || '[]');
    
    // 加载用户的学习进度
    const savedSession = loadUserSession();
    if (savedSession) {
        currentWordIndex = savedSession.currentWordIndex || 0;
        orangeCount = savedSession.orangeCount || 0;
        hasUsedHint = savedSession.hasUsedHint || false;
        
        // 恢复橘子到屏幕上
        if (savedSession.orangeCount > 0) {
            setTimeout(() => {
                restoreOrangesFromProgress(savedSession.orangeCount);
            }, 500);
        }
    }
}

function saveUserErrorWords() {
    localStorage.setItem(getUserStorageKey('error_words'), JSON.stringify(errorWords));
}

// 完整的用户会话管理
function saveUserSession() {
    const sessionData = {
        currentWordIndex,
        orangeCount,
        hasUsedHint,
        isGameCompleted,
        lastSaveTime: Date.now(),
        totalWords: wordsData.length,
        completedWords: currentWordIndex,
        sessionId: generateSessionId()
    };
    
    localStorage.setItem(getUserStorageKey('session'), JSON.stringify(sessionData));
    
    // 同时保存到会话历史
    saveSessionHistory(sessionData);
}

function loadUserSession() {
    try {
        const saved = localStorage.getItem(getUserStorageKey('session'));
        if (saved) {
            const sessionData = JSON.parse(saved);
            
            // 验证会话数据的有效性
            if (sessionData && 
                typeof sessionData.currentWordIndex === 'number' &&
                sessionData.currentWordIndex >= 0 &&
                sessionData.currentWordIndex <= wordsData.length) {
                return sessionData;
            }
        }
    } catch (e) {
        console.log('加载用户会话失败:', e);
    }
    return null;
}

function clearUserSession() {
    localStorage.removeItem(getUserStorageKey('session'));
}

function saveSessionHistory(sessionData) {
    try {
        const historyKey = getUserStorageKey('session_history');
        let history = JSON.parse(localStorage.getItem(historyKey) || '[]');
        
        // 保留最近10次会话记录
        history.unshift({
            ...sessionData,
            saveTime: Date.now()
        });
        
        if (history.length > 10) {
            history = history.slice(0, 10);
        }
        
        localStorage.setItem(historyKey, JSON.stringify(history));
    } catch (e) {
        console.log('保存会话历史失败:', e);
    }
}

function generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 自动保存功能
function autoSave() {
    if (currentUser) {
        showSaveIndicator();
        saveUserSession();
    }
}

// 显示保存指示器
function showSaveIndicator() {
    // 创建保存提示
    const saveIndicator = document.createElement('div');
    saveIndicator.className = 'save-indicator';
    saveIndicator.innerHTML = '💾 已保存';
    document.body.appendChild(saveIndicator);
    
    // 2秒后移除
    setTimeout(() => {
        if (saveIndicator.parentNode) {
            saveIndicator.parentNode.removeChild(saveIndicator);
        }
    }, 2000);
}

// 设置自动保存间隔（每30秒保存一次）
let autoSaveInterval;

function startAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
    autoSaveInterval = setInterval(autoSave, 30000); // 30秒
}

function stopAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
        autoSaveInterval = null;
    }
}

// 更新用户显示信息
function updateUserDisplay() {
    if (currentUser && userPhoneSpan) {
        // 隐藏手机号中间4位
        const maskedPhone = currentUser.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
        userPhoneSpan.textContent = `👤 ${maskedPhone}`;
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializePhysics();
    setupEventListeners();
    totalWordsSpan.textContent = wordsData.length;
    
    // 用户首次交互时初始化音频
    document.addEventListener('click', function initAudio() {
        soundManager.init();
        document.removeEventListener('click', initAudio);
    }, { once: true });
    
    // 移除了键盘提示，改为纯点击操作以提升用户体验
});

// 设置事件监听器
function setupEventListeners() {
    loginBtn.addEventListener('click', handleLogin);
    phoneInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleLogin();
    });
    
    submitBtn.addEventListener('click', handleSubmit);
    wordInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') handleSubmit();
    });
    
    playBtn.addEventListener('click', playCurrentWord);
    hintBtn.addEventListener('click', showHint);
    restartBtn.addEventListener('click', restartGame);
    errorBookBtn.addEventListener('click', showErrorBook);
    logoutBtn.addEventListener('click', logout);
}

// 登录处理
function handleLogin() {
    const phone = phoneInput.value.trim();
    
    if (!phone) {
        showError('请输入手机号');
        return;
    }
    
    if (!/^1[3-9]\d{9}$/.test(phone)) {
        showError('请输入正确的手机号格式');
        return;
    }
    
    if (!whitelist.includes(phone)) {
        showError('该手机号未购买课程，请联系客服');
        return;
    }
    
    // 登录成功
    currentUser = phone;
    loadUserData(); // 加载用户专属数据
    
    // 显示用户信息
    updateUserDisplay();
    
    // 启动自动保存
    startAutoSave();
    
    loginScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    startGame();
}

// 登出功能
function logout() {
    if (currentUser) {
        const confirmLogout = confirm('确定要登出吗？当前学习进度将会自动保存。');
        if (!confirmLogout) {
            return;
        }
        
        // 保存当前会话状态
        saveUserSession();
        
        // 停止自动保存
        stopAutoSave();
        
        // 清理当前状态
        currentUser = '';
        currentWordIndex = 0;
        orangeCount = 0;
        hasUsedHint = false;
        isGameCompleted = false;
        errorWords = [];
        
        // 清除所有橘子
        oranges.forEach(orange => {
            Matter.World.remove(world, orange);
        });
        oranges = [];
        
        // 切换到登录界面
        gameScreen.classList.add('hidden');
        completionScreen.classList.add('hidden');
        loginScreen.classList.remove('hidden');
        
        // 重置输入
        phoneInput.value = '';
        wordInput.value = '';
        hintDisplay.classList.add('hidden');
        
        // 清除用户显示
        if (userPhoneSpan) {
            userPhoneSpan.textContent = '';
        }
    }
}

function showError(message) {
    loginError.textContent = message;
    loginError.classList.add('show');
    setTimeout(() => {
        loginError.classList.remove('show');
    }, 3000);
}

// 游戏逻辑
function startGame() {
    // 用户数据已在 loadUserData() 中加载，直接开始游戏
    updateUI();
    
    // 如果有未完成的进度，询问是否继续
    const savedSession = loadUserSession();
    if (savedSession && savedSession.currentWordIndex > 0 && savedSession.currentWordIndex < wordsData.length) {
        const continueGame = confirm(`发现未完成的学习进度 (${savedSession.currentWordIndex}/${wordsData.length})，是否继续？`);
        if (!continueGame) {
            // 用户选择重新开始
            resetGameProgress();
        }
    }
    
    updateUI();
    playCurrentWord();
}

function resetGameProgress() {
    currentWordIndex = 0;
    orangeCount = 0;
    hasUsedHint = false;
    isGameCompleted = false;
    
    // 清除所有橘子
    oranges.forEach(orange => {
        Matter.World.remove(world, orange);
    });
    oranges = [];
    
    // 清除保存的会话
    clearUserSession();
    
    // 立即保存新状态
    saveUserSession();
}

function updateUI() {
    currentWordSpan.textContent = currentWordIndex + 1;
    orangeCountSpan.textContent = orangeCount;
    wordInput.value = '';
    hintDisplay.classList.add('hidden');
    hasUsedHint = false;
}

function playCurrentWord() {
    if (currentWordIndex >= wordsData.length) return;
    
    const audioPath = wordsData[currentWordIndex].audio;
    
    // 创建音频对象并播放
    const audio = new Audio(audioPath);
    audio.onerror = function() {
        console.log('音频文件不存在:', audioPath);
    };
    
    audio.play().catch(e => {
        console.log('音频播放失败:', e);
    });
    
    // 按钮动画效果
    playBtn.classList.add('bounce');
    setTimeout(() => {
        playBtn.classList.remove('bounce');
    }, 600);
}

function showHint() {
    if (currentWordIndex >= wordsData.length) return;
    
    const currentWord = wordsData[currentWordIndex];
    const hint = currentWord.hint;
    const correctSpelling = currentWord.words[0];
    
    hintDisplay.innerHTML = `
        <div class="hint-content">
            <div class="hint-meaning">💡 ${hint}</div>
            <div class="hint-spelling">✏️ ${correctSpelling}</div>
        </div>
    `;
    hintDisplay.classList.remove('hidden');
    hasUsedHint = true;
    
    // 记录到错词本（使用了提示）
    addToErrorBook(currentWord, 'hint');
    
    // 保存状态更新
    saveUserSession();
    
    // 按钮动画效果
    hintBtn.classList.add('bounce');
    setTimeout(() => {
        hintBtn.classList.remove('bounce');
    }, 600);
}

function handleSubmit() {
    if (currentWordIndex >= wordsData.length) return;
    
    const userInput = wordInput.value.trim().toLowerCase();
    const correctWords = wordsData[currentWordIndex].words;
    
    if (!userInput) {
        shakeInput();
        return;
    }
    
    // 检查答案是否正确
    const isCorrect = correctWords.some(word => word.toLowerCase() === userInput);
    
    if (isCorrect) {
        handleCorrectAnswer();
    } else {
        handleWrongAnswer();
    }
}

function handleCorrectAnswer() {
    soundManager.playSuccess();
    
    // 如果没有使用提示，奖励橘子
    if (!hasUsedHint) {
        dropOrange();
        orangeCount++;
        orangeCountSpan.textContent = orangeCount;
    }
    
    // 进入下一个单词
    currentWordIndex++;
    
    // 立即保存进度
    saveUserSession();
    
    if (currentWordIndex >= wordsData.length) {
        // 游戏完成
        completeGame();
    } else {
        // 继续下一个单词
        setTimeout(() => {
            updateUI();
            playCurrentWord();
        }, 1000);
    }
}

function handleWrongAnswer() {
    soundManager.playError();
    
    // 记录到错词本（答错）
    const currentWord = wordsData[currentWordIndex];
    addToErrorBook(currentWord, 'wrong');
    
    // 保存错词本更新
    saveUserSession();
    
    // 输入框抖动动画
    shakeInput();
}

function shakeInput() {
    wordInput.classList.add('shake');
    setTimeout(() => {
        wordInput.classList.remove('shake');
    }, 500);
}

function completeGame() {
    isGameCompleted = true;
    soundManager.playComplete();
    
    // 保存完成状态
    saveUserSession();
    
    // 记录完成时间到历史
    saveCompletionRecord();
    
    // 开始疯狂掉橘子
    const celebrationInterval = setInterval(() => {
        dropOrange();
        dropOrange();
        dropOrange();
    }, 200);
    
    // 3秒后停止掉橘子并显示完成界面
    setTimeout(() => {
        clearInterval(celebrationInterval);
        gameScreen.classList.add('hidden');
        completionScreen.classList.remove('hidden');
        finalScoreSpan.textContent = orangeCount;
    }, 3000);
}

function saveCompletionRecord() {
    try {
        const completionKey = getUserStorageKey('completions');
        let completions = JSON.parse(localStorage.getItem(completionKey) || '[]');
        
        const record = {
            completionTime: Date.now(),
            orangeCount: orangeCount,
            totalWords: wordsData.length,
            errorWordsCount: errorWords.length,
            sessionId: generateSessionId()
        };
        
        completions.unshift(record);
        
        // 保留最近20次完成记录
        if (completions.length > 20) {
            completions = completions.slice(0, 20);
        }
        
        localStorage.setItem(completionKey, JSON.stringify(completions));
    } catch (e) {
        console.log('保存完成记录失败:', e);
    }
}

function restartGame() {
    if (currentUser) {
        // 保存当前完成状态
        saveUserSession();
        
        // 询问是否要重新开始学习
        const restart = confirm('是否要重新开始学习？这将清除当前进度。');
        if (restart) {
            resetGameProgress();
            
            // 切换到游戏界面
            completionScreen.classList.add('hidden');
            gameScreen.classList.remove('hidden');
            
            updateUI();
            playCurrentWord();
        }
    } else {
        // 如果没有用户登录，返回登录界面
        logout();
    }
}
// 页面可见性变化时自动保存
document.addEventListener('visibilitychange', function() {
    if (document.hidden && currentUser) {
        // 页面隐藏时保存状态
        saveUserSession();
    }
});

// 页面卸载前保存状态
window.addEventListener('beforeunload', function() {
    if (currentUser) {
        saveUserSession();
    }
});

// 音效系统
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
    }
    
    async init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('音频上下文创建失败:', e);
        }
    }
    
    playSuccess() {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(523, this.audioContext.currentTime);
        oscillator.frequency.setValueAtTime(659, this.audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(784, this.audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.4);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.4);
    }
    
    playError() {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(400, this.audioContext.currentTime);
        oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(200, this.audioContext.currentTime + 0.2);
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + 0.3);
    }
    
    playComplete() {
        if (!this.audioContext) return;
        
        const notes = [523, 659, 784, 1047];
        notes.forEach((freq, index) => {
            setTimeout(() => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
                gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                
                oscillator.start(this.audioContext.currentTime);
                oscillator.stop(this.audioContext.currentTime + 0.3);
            }, index * 150);
        });
    }
}

const soundManager = new SoundManager();

// 错词本功能
function addToErrorBook(wordData, errorType) {
    const existingIndex = errorWords.findIndex(item => 
        item.words[0] === wordData.words[0]
    );
    
    const errorRecord = {
        words: wordData.words,
        hint: wordData.hint,
        errorType: errorType,
        timestamp: Date.now(),
        count: 1
    };
    
    if (existingIndex >= 0) {
        errorWords[existingIndex].count++;
        errorWords[existingIndex].timestamp = Date.now();
        errorWords[existingIndex].errorType = errorType;
    } else {
        errorWords.push(errorRecord);
    }
    
    // 保存错词本和会话状态
    saveUserErrorWords();
    saveUserSession();
}

function showErrorBook() {
    if (errorWords.length === 0) {
        alert('错词本是空的，继续加油学习吧！');
        return;
    }
    
    let errorBookHTML = '<h3>📖 错词本</h3>';
    errorBookHTML += '<div class="error-book-controls">';
    errorBookHTML += '<button onclick="copyErrorWords()" class="btn secondary">📋 复制全部</button>';
    errorBookHTML += '<button onclick="clearErrorBook()" class="btn error-book">🗑️ 清空</button>';
    errorBookHTML += '</div>';
    errorBookHTML += '<div class="error-words-list">';
    
    const sortedErrors = [...errorWords].sort((a, b) => b.timestamp - a.timestamp);
    
    sortedErrors.forEach((error, index) => {
        const errorTypeText = error.errorType === 'wrong' ? '❌ 答错' : '💡 看提示';
        const date = new Date(error.timestamp).toLocaleDateString('zh-CN');
        
        errorBookHTML += `
            <div class="error-word-item">
                <div class="error-word-header">
                    <span class="error-word-spelling">${error.words[0]}</span>
                    <span class="error-type">${errorTypeText}</span>
                </div>
                <div class="error-word-meaning">${error.hint}</div>
                <div class="error-word-meta">
                    <span>错误次数: ${error.count}</span>
                    <span>最近: ${date}</span>
                </div>
            </div>
        `;
    });
    
    errorBookHTML += '</div>';
    errorBookHTML += '<button onclick="closeErrorBook()" class="btn primary">关闭</button>';
    
    const errorBookModal = document.createElement('div');
    errorBookModal.id = 'errorBookModal';
    errorBookModal.className = 'modal';
    errorBookModal.innerHTML = `<div class="modal-content error-book-content">${errorBookHTML}</div>`;
    
    document.body.appendChild(errorBookModal);
}

function copyErrorWords() {
    let copyText = '甜菜答案词 - 错词本\n\n';
    
    errorWords.forEach((error, index) => {
        const errorTypeText = error.errorType === 'wrong' ? '答错' : '看提示';
        copyText += `${index + 1}. ${error.words[0]} - ${error.hint} (${errorTypeText}, ${error.count}次)\n`;
    });
    
    navigator.clipboard.writeText(copyText).then(() => {
        alert('错词本已复制到剪贴板！');
    }).catch(() => {
        const textArea = document.createElement('textarea');
        textArea.value = copyText;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('错词本已复制到剪贴板！');
    });
}

function clearErrorBook() {
    if (confirm('确定要清空错词本吗？此操作不可恢复。')) {
        errorWords = [];
        saveUserErrorWords();
        saveUserSession(); // 同时更新会话状态
        closeErrorBook();
        alert('错词本已清空！');
    }
}

function closeErrorBook() {
    const modal = document.getElementById('errorBookModal');
    if (modal) {
        modal.remove();
    }
}
// 物理引擎功能
function initializePhysics() {
    engine = Matter.Engine.create();
    world = engine.world;
    engine.world.gravity.y = 0.8;
    
    canvas = document.getElementById('physicsCanvas');
    const ctx = canvas.getContext('2d');
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    createBoundaries();
    Matter.Engine.run(engine);
    
    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        oranges.forEach(orange => {
            if (orange.render && orange.render.visible !== false) {
                drawOrange(ctx, orange);
            }
        });
        
        requestAnimationFrame(render);
    }
    render();
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    createBoundaries();
}

function createBoundaries() {
    const bodies = Matter.Composite.allBodies(world);
    bodies.forEach(body => {
        if (body.label === 'boundary') {
            Matter.World.remove(world, body);
        }
    });
    
    const thickness = 50;
    const width = canvas.width;
    const height = canvas.height;
    
    const ground = Matter.Bodies.rectangle(width / 2, height + thickness / 2, width, thickness, {
        isStatic: true,
        label: 'boundary'
    });
    
    const leftWall = Matter.Bodies.rectangle(-thickness / 2, height / 2, thickness, height, {
        isStatic: true,
        label: 'boundary'
    });
    
    const rightWall = Matter.Bodies.rectangle(width + thickness / 2, height / 2, thickness, height, {
        isStatic: true,
        label: 'boundary'
    });
    
    Matter.World.add(world, [ground, leftWall, rightWall]);
}

function dropOrange() {
    const x = Math.random() * (canvas.width - 100) + 50;
    const y = -50;
    const radius = 18 + Math.random() * 12;
    
    const orange = Matter.Bodies.circle(x, y, radius, {
        restitution: 0.7,
        friction: 0.3,
        frictionAir: 0.01,
        render: {
            fillStyle: '#ff6b35',
            strokeStyle: '#e55100',
            lineWidth: 2
        }
    });
    
    orange.hasFace = Math.random() < 0.3;
    
    Matter.World.add(world, orange);
    oranges.push(orange);
    
    if (oranges.length > 50) {
        const oldOrange = oranges.shift();
        Matter.World.remove(world, oldOrange);
    }
}

function drawOrange(ctx, orange) {
    const pos = orange.position;
    const radius = orange.circleRadius;
    
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(orange.angle);
    
    const gradient = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
    gradient.addColorStop(0, '#ffb347');
    gradient.addColorStop(0.7, '#ff8c42');
    gradient.addColorStop(1, '#ff6b35');
    
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    
    ctx.beginPath();
    ctx.arc(-radius * 0.4, -radius * 0.4, radius * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(255, 108, 53, 0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * radius * 0.7, Math.sin(angle) * radius * 0.7);
        ctx.stroke();
    }
    
    ctx.fillStyle = '#81c784';
    ctx.beginPath();
    ctx.ellipse(0, -radius * 0.8, radius * 0.2, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#66bb6a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -radius * 0.6);
    ctx.lineTo(0, -radius * 0.9);
    ctx.stroke();
    
    if (orange.hasFace) {
        ctx.fillStyle = '#2d3436';
        ctx.beginPath();
        ctx.arc(-radius * 0.25, -radius * 0.1, radius * 0.08, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(radius * 0.25, -radius * 0.1, radius * 0.08, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(-radius * 0.22, -radius * 0.13, radius * 0.03, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(radius * 0.28, -radius * 0.13, radius * 0.03, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#e17055';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, radius * 0.15, radius * 0.15, 0, Math.PI);
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(253, 121, 168, 0.3)';
        ctx.beginPath();
        ctx.arc(-radius * 0.5, radius * 0.1, radius * 0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(radius * 0.5, radius * 0.1, radius * 0.12, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.strokeStyle = 'rgba(255, 108, 53, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
}

function restoreOrangesFromProgress(orangeCount) {
    const batchSize = 3;
    let restored = 0;
    
    const restoreBatch = () => {
        for (let i = 0; i < Math.min(batchSize, orangeCount - restored); i++) {
            const x = Math.random() * (canvas.width - 100) + 50;
            const y = canvas.height - 100 - Math.random() * 200;
            const radius = 18 + Math.random() * 12;
            
            const orange = Matter.Bodies.circle(x, y, radius, {
                restitution: 0.7,
                friction: 0.3,
                frictionAir: 0.01,
                render: {
                    fillStyle: '#ff6b35',
                    strokeStyle: '#e55100',
                    lineWidth: 2
                }
            });
            
            orange.hasFace = Math.random() < 0.3;
            
            Matter.Body.setVelocity(orange, {
                x: (Math.random() - 0.5) * 2,
                y: Math.random() * 2
            });
            
            Matter.World.add(world, orange);
            oranges.push(orange);
            restored++;
        }
        
        if (restored < orangeCount) {
            setTimeout(restoreBatch, 200);
        }
    };
    
    if (orangeCount > 0) {
        restoreBatch();
    }
}

// 移除了键盘快捷键以避免误触，改为纯点击操作
// 这样可以避免在输入包含 'h' 字母的单词或使用空格时的误操作