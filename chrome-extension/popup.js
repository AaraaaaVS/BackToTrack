document.addEventListener('DOMContentLoaded', async () => {
    // 👇👇👇 PASTE YOUR REAL FIREBASE URL HERE 👇👇👇
    const DB_URL = "https://backtotrack-cd750-default-rtdb.firebaseio.com/"; 
    // 👆👆👆 KEEP THE SLASH '/' AT THE END 👆👆👆

    // Global DOM Elements
    const navMenu = document.getElementById('nav-menu');
    const profileTrigger = document.getElementById('profile-trigger');
    const profileUpload = document.getElementById('profile-upload');
    const profileImg = document.getElementById('profile-img');
    const profileInitials = document.getElementById('profile-initials');
    const greeting = document.getElementById('greeting');
    const coinBalanceEl = document.getElementById('coin-balance');
    const today = new Date().toLocaleDateString('en-CA');
    let chartInstance = null;
    let userCoins = 0;

    // Leaderboard DOM Elements
    const groupActions = document.getElementById('group-actions');
    const leaderboardDisplay = document.getElementById('leaderboard-display');
    const groupCodeInput = document.getElementById('group-code-input');
    const joinBtn = document.getElementById('join-group-btn');
    const createBtn = document.getElementById('create-group-btn');
    const displayCode = document.getElementById('display-code');
    const leaderboardList = document.getElementById('leaderboard-list');
    const refreshBtn = document.getElementById('refresh-board');
    const leaveBtn = document.getElementById('leave-group');
    const groupError = document.getElementById('group-error');

    // Settings DOM Elements
    const focusStartInput = document.getElementById('focus-start');
    const focusEndInput = document.getElementById('focus-end');
    const saveSettingsBtn = document.getElementById('save-settings');
    const settingsMsg = document.getElementById('settings-msg');

    // Partner DOM Element
    const sponsorBtn = document.getElementById('sponsor-btn');

    // --- NAVIGATION LOGIC ---
    profileTrigger.onclick = (e) => {
        e.stopPropagation(); 
        navMenu.style.display = navMenu.style.display === 'block' ? 'none' : 'block';
    };
    
    document.onclick = () => navMenu.style.display = 'none';
    navMenu.onclick = (e) => e.stopPropagation();

    const switchView = (target) => {
        document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
        const targetView = document.getElementById(`view-${target}`);
        if (targetView) targetView.style.display = 'block';
        navMenu.style.display = 'none';
        
        if (target === 'leaderboard') checkGroupStatus();
        if (target === 'main') renderStats();
        if (target === 'store') renderStore();
        if (target === 'analysis') {
            renderManageSites();
            setTimeout(renderUsageChart, 50);
        }
        if (target === 'settings') loadSettings();
    };

    document.getElementById('nav-main').onclick = () => switchView('main');
    document.getElementById('nav-store').onclick = () => switchView('store');
    document.getElementById('nav-tasks').onclick = () => switchView('tasks');
    document.getElementById('nav-leaderboard').onclick = () => switchView('leaderboard');
    document.getElementById('nav-analysis').onclick = () => switchView('analysis');
    document.getElementById('nav-settings').onclick = () => switchView('settings');
    document.getElementById('nav-name').onclick = () => switchView('name');
    
    document.getElementById('nav-upload').onclick = () => {
        navMenu.style.display = 'none'; 
        profileUpload.click(); 
    };

    document.getElementById('nav-reset').onclick = async (e) => {
        e.stopPropagation();
        await chrome.storage.local.remove("profilePic");
        updateProfileUI(null); 
        navMenu.style.display = 'none'; 
    };

    // --- PARTNER LOGIC ---
    if (sponsorBtn) {
        sponsorBtn.onclick = () => {
            const email = "test@gmail.com";
            const subject = "Partnership Inquiry - BackToTrack";
            const body = "Hello,\n\nWe are interested in featuring our product on your Rewards Store.\n\nBest regards,";
            window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        };
    }

    // --- COIN LOGIC ---
    async function loadCoins() {
        const res = await chrome.storage.sync.get(["coins"]);
        userCoins = res.coins || 0;
        if(coinBalanceEl) coinBalanceEl.innerText = userCoins;
    }

    async function addCoins(amount) {
        userCoins += amount;
        if(coinBalanceEl) coinBalanceEl.innerText = userCoins;
        await chrome.storage.sync.set({ coins: userCoins });
    }

    // --- STORE LOGIC (ADJUSTED PRICES FOR RARE COINS) ---
    const rewards = [
        { id: 1, name: "Spotify (1 Mo)", cost: 7, icon: "🎵" },  // 1 week of perfect streaks
        { id: 2, name: "Netflix (1 Mo)", cost: 10, icon: "🍿" },
        { id: 3, name: "Amazon $5", cost: 14, icon: "📦" }, // 2 weeks
        { id: 4, name: "Calm Premium", cost: 5, icon: "🧘" }
    ];

    function renderStore() {
        const grid = document.getElementById('store-grid');
        grid.innerHTML = rewards.map(r => `
            <div class="reward-card">
                <div>
                    <div class="reward-icon">${r.icon}</div>
                    <div class="reward-name">${r.name}</div>
                    <div class="reward-cost">${r.cost} Coins</div>
                </div>
                <button class="redeem-btn" onclick="redeemItem(${r.id}, ${r.cost}, '${r.name}')">Redeem</button>
            </div>
        `).join('');
    }

    window.redeemItem = async (id, cost, name) => {
        if (userCoins >= cost) {
            await addCoins(-cost);
            alert(`🎉 Success! Check your email for the ${name} code.`);
             if (typeof confetti === 'function') {
                confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
            }
        } else {
            alert(`❌ Not enough coins! You need ${cost - userCoins} more.`);
        }
    };

    // --- SETTINGS LOGIC ---
    async function loadSettings() {
        const res = await chrome.storage.sync.get(["focusStart", "focusEnd"]);
        if (res.focusStart) focusStartInput.value = res.focusStart;
        if (res.focusEnd) focusEndInput.value = res.focusEnd;
    }

    saveSettingsBtn.onclick = async () => {
        const start = focusStartInput.value;
        const end = focusEndInput.value;
        if (start && end) {
            await chrome.storage.sync.set({ focusStart: start, focusEnd: end });
            settingsMsg.innerText = "Saved! Focus Zone Active.";
            setTimeout(() => settingsMsg.innerText = "", 3000);
        } else {
            settingsMsg.style.color = "#f87171";
            settingsMsg.innerText = "Please select start and end times.";
        }
    };

    // --- PROFILE LOGIC ---
    const updateProfileUI = (pic) => {
        if (pic) {
            profileImg.src = pic;
            profileImg.style.display = 'block';
            profileInitials.style.display = 'none';
        } else {
            profileImg.src = ''; 
            profileImg.style.display = 'none';
            profileInitials.style.display = 'flex'; 
            profileInitials.style.justifyContent = 'center';
            profileInitials.style.alignItems = 'center';
            profileInitials.style.width = '100%';
            profileInitials.style.height = '100%';
        }
    };

    const syncData = await chrome.storage.sync.get(["userName"]);
    const localData = await chrome.storage.local.get(["profilePic"]);
    
    let myUserName = syncData.userName || "Guest";
    if (syncData.userName) {
        greeting.textContent = `Hi, ${syncData.userName}`;
        profileInitials.textContent = syncData.userName.charAt(0).toUpperCase();
    } else {
        document.getElementById('name-modal').style.display = 'flex';
    }
    updateProfileUI(localData.profilePic);
    loadCoins(); 

    profileUpload.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (ev) => {
                await chrome.storage.local.set({ profilePic: ev.target.result });
                updateProfileUI(ev.target.result);
                navMenu.style.display = 'none'; 
            };
            reader.readAsDataURL(file);
        }
    };

    document.getElementById('save-name').onclick = async () => {
        const name = document.getElementById('name-input').value.trim();
        if (name) {
            await chrome.storage.sync.set({ userName: name });
            myUserName = name;
            greeting.textContent = `Hi, ${name}`;
            profileInitials.textContent = name.charAt(0).toUpperCase();
            document.getElementById('name-modal').style.display = 'none';
        }
    };
    
    document.getElementById('save-new-name').onclick = async () => {
        const name = document.getElementById('edit-name-input').value.trim();
        if (name) {
            await chrome.storage.sync.set({ userName: name });
            myUserName = name;
            greeting.textContent = `Hi, ${name}`;
            profileInitials.textContent = name.charAt(0).toUpperCase();
            switchView('main');
        }
    };

    // --- MAIN STATS & RPG SCORE LOGIC ---
    const renderStats = async () => {
        const datePicker = document.getElementById('date-picker');
        if(!datePicker.value) datePicker.value = today;
        const selectedDate = datePicker.value;

        // 1. Get Penalties (Site Usage)
        const sync = await chrome.storage.sync.get(["trackedSites"]);
        const local = await chrome.storage.local.get([selectedDate]);
        const sites = sync.trackedSites || ["youtube.com", "reddit.com", "instagram.com"];
        const usage = local[selectedDate] || {};
        const container = document.getElementById('stats-container');
        
        container.innerHTML = '';
        let mMin=0, aMin=0, nMin=0, fMin=0;

        sites.forEach(site => {
            let sec = 0, brk = { morning:0, afternoon:0, night:0, focus:0 };
            if(typeof usage[site] === 'number') { sec = usage[site]; brk.afternoon = sec; }
            else if(usage[site]) { sec = usage[site].total||0; brk = usage[site]; }

            mMin += (brk.morning||0)/60; 
            aMin += (brk.afternoon||0)/60; 
            nMin += (brk.night||0)/60;
            fMin += (brk.focus||0)/60;

            const mins = Math.floor(sec / 60);
            const secs = sec % 60;
            const div = document.createElement('div');
            div.className = 'site-row';
            div.innerHTML = `
                <span class="site-name">${site}</span>
                <span class="site-time">${mins}m ${secs}s</span>
            `;
            container.appendChild(div);
        });

        // 2. Get Rewards (With Time Math applied to Score)
        const taskData = await chrome.storage.local.get([`tasks_${selectedDate}`]);
        const tasks = taskData[`tasks_${selectedDate}`] || [];
        
        let taskScore = 0;
        
        tasks.forEach(t => {
            if (t.completed) {
                let points = 10; // Base Score for completing
                
                // 🔥 SCORE LOGIC (Based on Deadline)
                if (t.deadline) {
                    const now = new Date();
                    const [h, m] = t.deadline.split(':');
                    const deadline = new Date();
                    deadline.setHours(h, m, 0, 0);
                    
                    const diffMins = (deadline - now) / 60000;
                    
                    if (diffMins > 0) {
                        // EARLY: +1 Score per 30 mins
                        points += Math.floor(diffMins / 30);
                    } else {
                        // LATE: -1 Score per 30 mins
                        const penalty = Math.floor(Math.abs(diffMins) / 30);
                        points -= penalty;
                        if(points < 0) points = 0;
                    }
                }
                taskScore += points;
            }
        });

        // 3. Calculate RPG Score
        const penalty = (4 * fMin) + (2 * mMin) + (1 * aMin) + (0.5 * nMin);
        const finalScore = Math.round(0 + taskScore - penalty);
        
        updateScoreUI(finalScore);

        // 🔥 NEW: DAILY BONUS LOGIC (80+ Score = 1 Coin)
        if (finalScore >= 80) {
            const bonusData = await chrome.storage.local.get(["lastBonusDate"]);
            if (bonusData.lastBonusDate !== today) {
                await addCoins(1); // STRICTLY 1 COIN
                await chrome.storage.local.set({ lastBonusDate: today });
                alert("🌟 DAILY TARGET HIT! +1 COIN EARNED 🌟");
                if (typeof confetti === 'function') confetti({ particleCount: 200, spread: 100 });
            }
        }

        return finalScore; 
    };

    const updateScoreUI = (score) => {
        const val = document.getElementById('score-value');
        const bar = document.getElementById('score-bar');
        const msg = document.getElementById('score-message');
        
        if (val) val.innerText = score;
        
        let width = score;
        if(score < 0) width = 0;
        if(score > 100) width = 100;
        if (bar) bar.style.width = `${width}%`;
        
        if (msg) {
            if (score >= 80) { 
                val.style.color = "#4ade80"; 
                bar.style.background = "#22c55e"; 
                msg.innerText = "High Performance! You earned a Coin! 🪙"; 
            } else if (score >= 0) { 
                val.style.color = "#facc15"; 
                bar.style.background = "#eab308"; 
                msg.innerText = "Neutral. Get to 80 Points for a Coin. \u26A0\uFE0F"; 
            } else { 
                val.style.color = "#f87171"; 
                bar.style.background = "#ef4444"; 
                msg.innerText = "Dopamine Debt! Focus! \uD83E\uDDE0\uD83D\uDD25"; 
            }
        }
    };

    document.getElementById('date-picker').onchange = renderStats;


    // --- LEADERBOARD LOGIC ---
    async function getDB(path) {
        if(DB_URL.includes("YOUR-REAL-PROJECT-ID")) {
            groupError.innerText = "Error: DB URL not set.";
            return null;
        }
        try {
            const res = await fetch(`${DB_URL}${path}.json`);
            return await res.json();
        } catch(e) { console.error(e); return null; }
    }
    
    async function updateDB(path, data) {
        if(DB_URL.includes("YOUR-REAL-PROJECT-ID")) return;
        await fetch(`${DB_URL}${path}.json`, { 
            method: 'PATCH', 
            body: JSON.stringify(data) 
        });
    }

    async function checkGroupStatus() {
        const data = await chrome.storage.sync.get(["userGroupCode"]);
        if (data.userGroupCode) {
            groupActions.style.display = 'none';
            leaderboardDisplay.style.display = 'block';
            displayCode.innerText = data.userGroupCode;
            fetchLeaderboard(data.userGroupCode);
        } else {
            groupActions.style.display = 'block';
            leaderboardDisplay.style.display = 'none';
        }
    }

    function getCurrentScore() {
        const val = document.getElementById('score-value').innerText;
        return parseInt(val) || 0;
    }

    createBtn.onclick = async () => {
        const newCode = Math.floor(100000 + Math.random() * 900000).toString();
        await chrome.storage.sync.set({ userGroupCode: newCode });
        await updateDB(`groups/${newCode}/${myUserName}`, { score: getCurrentScore() });
        checkGroupStatus();
    };

    joinBtn.onclick = async () => {
        const code = groupCodeInput.value.trim();
        if (code.length !== 6) { groupError.innerText = "Code must be 6 digits."; return; }
        const groupData = await getDB(`groups/${code}`);
        if (!groupData) { groupError.innerText = "Group not found!"; return; }
        await chrome.storage.sync.set({ userGroupCode: code });
        await updateDB(`groups/${code}/${myUserName}`, { score: getCurrentScore() });
        groupError.innerText = "";
        checkGroupStatus();
    };

    async function fetchLeaderboard(code) {
        leaderboardList.innerHTML = '<div style="text-align:center; padding:10px; color:#aaa;">Loading...</div>';
        await updateDB(`groups/${code}/${myUserName}`, { score: getCurrentScore() });
        const members = await getDB(`groups/${code}`);
        if (!members) { leaderboardList.innerHTML = 'Error loading.'; return; }

        const sortedMembers = Object.entries(members)
            .map(([name, data]) => ({ name, score: data.score }))
            .sort((a, b) => b.score - a.score);

        leaderboardList.innerHTML = '';
        sortedMembers.forEach((member, index) => {
            const rank = index + 1;
            const isMe = member.name === myUserName ? "(You)" : "";
            const div = document.createElement('div');
            div.className = `rank-row rank-${rank}`;
            div.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-weight:bold; color:#8B5CF6;">#${rank}</span>
                    <span style="color:#e2e8f0;">${member.name} <span style="font-size:10px; color:#aaa;">${isMe}</span></span>
                </div>
                <span class="rank-score">${member.score}</span>
            `;
            leaderboardList.appendChild(div);
        });
    }

    refreshBtn.onclick = async () => {
        const data = await chrome.storage.sync.get(["userGroupCode"]);
        if (data.userGroupCode) fetchLeaderboard(data.userGroupCode);
    };

    leaveBtn.onclick = async () => {
        await chrome.storage.sync.remove("userGroupCode");
        checkGroupStatus();
    };

    // --- OTHER VIEWS ---
    document.getElementById('add-task').onclick = async () => {
        const name = document.getElementById('task-name').value;
        const time = document.getElementById('task-deadline').value;
        if (name && time) {
            const data = await chrome.storage.local.get([`tasks_${today}`]);
            const list = data[`tasks_${today}`] || [];
            list.push({ name, deadline: time, completed: false });
            await chrome.storage.local.set({ [`tasks_${today}`]: list });
            renderTasks();
            renderStats(); 
        }
    };

    const renderTasks = async () => {
        const list = document.getElementById('task-list');
        const data = await chrome.storage.local.get([`tasks_${today}`]);
        const tasks = data[`tasks_${today}`] || [];
        
        list.innerHTML = ''; 

        tasks.forEach((t, i) => {
            const row = document.createElement('div');
            row.className = 'site-row';
            row.style.justifyContent = 'space-between';
            if (t.completed) row.style.opacity = '0.5';

            const span = document.createElement('span');
            span.innerHTML = `${t.name} <small style="color: #64748b;">(${t.deadline})</small>`;
            if (t.completed) {
                span.style.textDecoration = 'line-through';
                span.style.color = '#94a3b8';
            }

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = t.completed;

            checkbox.addEventListener('change', async () => {
                tasks[i].completed = !tasks[i].completed;
                await chrome.storage.local.set({ [`tasks_${today}`]: tasks });
                
                // ⚠️ NO COINS HERE anymore. Just score update.
                if (t.completed && typeof confetti === 'function') {
                    confetti({ particleCount: 50, spread: 40, colors: ['#4ade80'] });
                }

                renderTasks();
                renderStats(); // Updates SCORE
            });

            row.appendChild(span);
            row.appendChild(checkbox);
            list.appendChild(row);
        });
    };

    const renderUsageChart = async () => {
        const sync = await chrome.storage.sync.get(["trackedSites"]);
        const local = await chrome.storage.local.get([today]);
        const sites = sync.trackedSites || [];
        const usage = local[today] || {};
        const labels = [];
        const dataPoints = [];
        sites.forEach(s => {
            labels.push(s);
            let total = 0;
            if(usage[s]) total = (usage[s].total || usage[s] || 0) / 60;
            dataPoints.push(total);
        });
        const ctx = document.getElementById('usageChart').getContext('2d');
        if(chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Minutes Used',
                    data: dataPoints,
                    backgroundColor: '#8B5CF6',
                    borderRadius: 4
                }]
            },
            options: {
                scales: {
                    y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { ticks: { color: '#94a3b8' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    };
    
    const renderManageSites = async () => {
        const sync = await chrome.storage.sync.get(["trackedSites"]);
        const sites = sync.trackedSites || ["youtube.com"];
        const list = document.getElementById('manage-sites-list');
        list.innerHTML = sites.map(s => `
            <div class="site-row" style="justify-content:space-between;">
                <span>${s}</span>
                <button class="remove-btn" data-site="${s}">×</button>
            </div>
        `).join('');
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.onclick = async (e) => {
                const s = e.target.getAttribute('data-site');
                const newSites = sites.filter(x => x !== s);
                await chrome.storage.sync.set({ trackedSites: newSites });
                renderManageSites();
            };
        });
    };

    document.getElementById('add-site').onclick = async () => {
        const val = document.getElementById('site-input').value.trim().toLowerCase().replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
        if (val) {
            const res = await chrome.storage.sync.get(["trackedSites"]);
            const current = res.trackedSites || [];
            if (!current.includes(val)) {
                current.push(val);
                await chrome.storage.sync.set({ trackedSites: current });
                document.getElementById('site-input').value = '';
                renderStats();
            }
        }
    };

    renderStats();
    renderTasks();
});