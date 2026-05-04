const Games = {
    lib: 'multi',
    allGames: [],
    filteredGames: [],
    renderedCount: 0,
    lastRenderTime: 0,
    BATCH_SIZE: 40,
    liked: JSON.parse(localStorage.getItem('liked_games') || '[]'),
    recent: JSON.parse(localStorage.getItem('recent_games') || '[]'),
    isLoading: false,
    firstLoad: true,
    showLikedOnly: false,
    popularityData: { year: {}, month: {}, week: {}, day: {} },
    top10Trending: [],

    async init() {
        this.lib = window.Settings?.get('gameLibrary') || 'multi';

        if (this.lib === 'lib1') this.lib = 'gnmath';
        if (this.lib === 'lib2') this.lib = 'ugs';

        window.addEventListener('scroll', () => {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
                this.renderMore();
            }
            this.updateBackToTop();
        });

        await this.loadGames();
        await this.fetchPopularity();
        this.checkRedirect();
        this.setupListeners();

        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            this.sort(sortSelect.value);
        }
    },

    updateBackToTop() {
        const btn = document.getElementById('back-to-top');
        if (btn) {
            btn.classList.toggle('visible', window.scrollY > 300);
        }
    },

    async fetchPopularity() {
       try {
            const durations = ['year', 'month', 'week', 'day'];
            await Promise.all(durations.map(d => this.fetchPopularityForDuration(d)));
        } catch (e) {
            console.warn('Failed to fetch popularity data:', e);
        }
    },

    async fetchPopularityForDuration(duration) {
        try {
            const gnmathResponse = await fetch(
                `https://data.jsdelivr.com/v1/stats/packages/gh/gn-math/html@main/files?period=${duration}`
            );
            const gnmathData = await gnmathResponse.json();
            gnmathData.forEach(file => {
                const idMatch = file.name.match(/^\/(\d+)[^/]*\.html$/);
                if (idMatch) {
                    const id = parseInt(idMatch[1]);
                    this.popularityData[duration][id] = file.hits?.total ?? 0;
                }
            });
        } catch (e) {
            console.warn(`Failed to fetch ${duration} gnmath popularity:`, e);
        }

        try {
            const ugsResponse = await fetch(
                `https://data.jsdelivr.com/v1/stats/packages/gh/bubbls/ugs-singlefile@master/files?period=${duration}`
            );
            const ugsData = await ugsResponse.json();
            ugsData.forEach(file => {
                let nameMatch = file.name?.match(/^\/UGS-Files\/(.+)\.html$/);
                if (!nameMatch) {
                    nameMatch = file.name?.match(/^\/(.+)\.html$/);
                }
                if (nameMatch) {
                    const gameName = nameMatch[1];
                    this.popularityData[duration][`ugs:${gameName}`] = file.hits?.total ?? 0;
                }
            });
            const pzResponse = await fetch(
                `https://data.jsdelivr.com/v1/stats/packages/gh/PeteZah-Games/Games-lib@main/files?period=${duration}`
            );
            const pzData = await pzResponse.json();
            pzData.forEach(file => {
                const nameMatch = file.name?.match(/^\/(.+)\/index\.html$/);
                if (nameMatch) {
                    const gameName = nameMatch[1];
                    this.popularityData[duration][`pz:${gameName}`] = file.hits?.total ?? 0;
                }
            });
        } catch (e) {
            console.warn(`Failed to fetch ${duration} popularity:`, e);
        }
    },

    async loadGames() {
        if (this.isLoading) return;
        this.isLoading = true;

        try {
            if (!window.Gloader) {
                console.error('Gloader missing');
                return;
            }

            this.allGames = await window.Gloader.load(this.lib);
            this.filteredGames = [...this.allGames];
            this.applyFilters();

            if (window.Notify) window.Notify.success('Games', `${this.allGames.length} games loaded`);
        } catch (e) {
            console.error(e);
            if (window.Notify) window.Notify.error('Error', 'Failed to load games');
        } finally {
            this.isLoading = false;
            this.firstLoad = false;
        }
    },

    checkRedirect() {
        const params = new URLSearchParams(window.location.search);
        const target = params.get('gamename');
        if (!target) return;

        const targetNormalized = target.toLowerCase().replace(/[^a-z0-9]/g, '');
        const game = this.allGames.find(g =>
            (g.normalized && g.normalized === targetNormalized) ||
            g.name.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNormalized
        );

        if (game) {
            console.log('Redirecting to game:', game.name);
            this.openGame(game);
        } else {
            console.warn('Game not found for redirect:', target);
        }
    },

    calculateTopTrending() {

        this.top10Trending = [...this.allGames]
            .sort((a, b) => this.getPopularity(b, 'week') - this.getPopularity(a, 'week'))
            .slice(0, 10)
            .map(g => g.url);
    },

    sort(method) {

        this.currentSortMethod = method;

        if (method === 'newest') {
            this.filteredGames.reverse();
        } else if (method === 'popularity') {

            const originalOrder = new Map(this.allGames.map((g, i) => [g.url, i]));
            this.filteredGames.sort((a, b) => (originalOrder.get(a.url) || 0) - (originalOrder.get(b.url) || 0));
        } else if (method === 'trendingYear') {

            this.filteredGames.sort((a, b) => {
                const aGnmath = a.type === 'gnmath' ? 0 : 1;
                const bGnmath = b.type === 'gnmath' ? 0 : 1;
                if (aGnmath !== bGnmath) return aGnmath - bGnmath;
                return this.getPopularity(b) - this.getPopularity(a);
            });
        } else if (method === 'trendingMonth') {

            this.filteredGames.sort((a, b) => {
                const aGnmath = a.type === 'gnmath' ? 0 : 1;
                const bGnmath = b.type === 'gnmath' ? 0 : 1;
                if (aGnmath !== bGnmath) return aGnmath - bGnmath;
                return this.getPopularity(b, 'month') - this.getPopularity(a, 'month');
            });
        } else if (method === 'trendingWeek') {

            this.filteredGames.sort((a, b) => {
                const aGnmath = a.type === 'gnmath' ? 0 : 1;
                const bGnmath = b.type === 'gnmath' ? 0 : 1;
                if (aGnmath !== bGnmath) return aGnmath - bGnmath;
                return this.getPopularity(b, 'week') - this.getPopularity(a, 'week');
            });
        }
        this.calculateTopTrending();
        this.applyFilters();
        this.resetRender();
    },

    applyFilters() {

        if (this.showLikedOnly) {
            this.filteredGames = this.allGames.filter(g => this.isLiked(g));
        } else {

            this.applyLikedSort();
        }
    },

    getPopularity(game, duration = 'year') {

        const idMatch = game.url?.match(/\/(\d+)[^/]*\.html$/);
        if (idMatch) {
            const id = parseInt(idMatch[1]);
            return this.popularityData[duration]?.[id] ?? 0;
        }

        const ugsMatch = game.url?.match(/UGS-Files\/(.+)\.html$/);
        if (ugsMatch) {

            const gameName = decodeURIComponent(ugsMatch[1]);
            const ugsKey = `ugs:${gameName}`;
            return this.popularityData[duration]?.[ugsKey] ?? 0;
        }

        const pzMatch = game.url?.match(/gh\/Destroyed12121\/Games-lib\/(.+)\/index\.html$/);
        if (pzMatch) {
            const gameName = pzMatch[1];
            return this.popularityData[duration][`pz:${gameName}`] ?? 0;
        }
        return 0;
    },

    resetRender() {
        const grid = document.getElementById('games-grid');
        if (!grid) return;
        grid.innerHTML = '';
        this.renderedCount = 0;
        this.updateRecentSection();
        const countDisplay = document.getElementById('game-count');
        if (countDisplay) {
            const label = this.showLikedOnly ? 'Favorited Games' : 'All Games';
            countDisplay.innerText = `${this.filteredGames.length} ${label}`;
        }

        if (this.filteredGames.length === 0) {
            this.renderEmptyState(grid);
        } else {
            this.renderMore();
        }
    },

    renderEmptyState(grid) {
        grid.style.display = 'block';
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-ghost"></i>
                <h2>No games found</h2>
                <p>Try searching for something else or check your filters.</p>
                <button class="btn" onclick="Games.clearFilters()" style="margin-top: 20px;">Clear All Filters</button>
            </div>
        `;
    },

    clearFilters() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
        this.showLikedOnly = false;
        document.getElementById('liked-toggle')?.classList.remove('active');
        this.performSearch('');
    },

    renderMore() {
        if (this.renderedCount >= this.filteredGames.length) return;
        
        const now = Date.now();
        const delay = 1300;
        const timeElapsed = now - this.lastRenderTime;

        if (timeElapsed < delay) {
            if (this.renderTimeout) return;
            this.renderTimeout = setTimeout(() => {
                this.renderTimeout = null;
                this.renderMore();
            }, delay - timeElapsed);
            return;
        }

        this.lastRenderTime = now;
        const grid = document.getElementById('games-grid');
        if (!grid) return;

        grid.style.display = 'grid';
        const batch = this.filteredGames.slice(this.renderedCount, this.renderedCount + this.BATCH_SIZE);

        batch.forEach((game, index) => {
            const card = this.createCard(game);

            card.style.animationDelay = `${(index % this.BATCH_SIZE) * 0.02}s`;
            grid.appendChild(card);
        });

        this.renderedCount += batch.length;
    },

    createCard(game, isRecent = false) {
        const div = document.createElement('div');
        div.className = 'game-card';
        const isLiked = this.isLiked(game);
        const isTrending = !isRecent && this.top10Trending.includes(game.url);

        let imgHTML;
        if (game.img) {
            imgHTML = `<img src="${game.img}" loading="lazy" alt="${game.name}" onerror="this.parentElement.innerHTML='<div class=\\'game-placeholder\\' style=\\'${this.getGradient(game.name)}\\'><i class=\\'fa-solid fa-gamepad\\'></i></div>'">`;
        } else {
            imgHTML = `<div class="game-placeholder" style="${this.getGradient(game.name)}"><i class="fa-solid fa-gamepad"></i></div>`;
        }

        div.innerHTML = `
            <div class="game-img-wrapper">
                ${imgHTML}
                ${isTrending ? '<div class="trending-badge" title="Top 10 Trending This Week"><i class="fa-solid fa-fire"></i></div>' : ''}
                ${isRecent ? '<button class="remove-btn" title="Remove from Recent"><i class="fa-solid fa-xmark"></i></button>' : ''}
                <button class="like-btn ${isLiked ? 'active' : ''}"><i class="fa-solid fa-heart"></i></button>
            </div>
            <div class="game-info">
                <div class="game-title">${game.name}</div>
                ${game.developer ? `<div class="game-developer">by ${game.developer}</div>` : ''}
            </div>
        `;

        const open = () => this.openGame(game);
        div.querySelector('.game-img-wrapper').onclick = open;
        div.querySelector('.game-info').onclick = open;

        if (isRecent) {
            const removeBtn = div.querySelector('.remove-btn');
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                this.removeFromRecent(game);
            };
        }

        const likeBtn = div.querySelector('.like-btn');
        likeBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleLike(game);
            likeBtn.classList.toggle('active', this.isLiked(game));
        };
        return div;
    },

    applyLikedSort() {


        const indexMap = new Map(this.filteredGames.map((g, i) => [g.url, i]));
        this.filteredGames.sort((a, b) => {
            const aLiked = this.isLiked(a) ? 1 : 0;
            const bLiked = this.isLiked(b) ? 1 : 0;
            if (aLiked !== bLiked) return bLiked - aLiked;

            return (indexMap.get(a.url) || 0) - (indexMap.get(b.url) || 0);
        });
    },

    openGame(game) {
        this.addToRecent(game);
        window.location.href = `player.html?type=game&title=${encodeURIComponent(game.name)}&url=${encodeURIComponent(game.url)}&img=${encodeURIComponent(game.img || '')}`;
    },

    addToRecent(game) {
        if (window.Settings && window.Settings.get('historyEnabled') === false) return;

        this.recent = this.recent.filter(g => g.url !== game.url);

        this.recent.unshift({ 
            name: game.name, 
            url: game.url, 
            img: game.img, 
            type: game.type,
            developer: game.developer,
            developerLink: game.developerLink
        });

        if (this.recent.length > 10) this.recent.pop();
        localStorage.setItem('recent_games', JSON.stringify(this.recent));
    },

    removeFromRecent(game) {
        this.recent = this.recent.filter(g => g.url !== game.url);
        localStorage.setItem('recent_games', JSON.stringify(this.recent));
        this.updateRecentSection();
    },

    updateRecentSection() {
        const recentGrid = document.getElementById('recent-grid');
        const recentSection = document.getElementById('recent-section');
        if (!recentGrid) return;

        if (window.Settings && window.Settings.get('historyEnabled') === false || this.showLikedOnly) {
            recentSection.style.display = 'none';
            return;
        }



        recentGrid.innerHTML = '';
        if (this.recent.length > 0) {
            recentSection.style.display = 'block';
            this.recent.forEach(g => recentGrid.appendChild(this.createCard(g, true)));
        } else {
            recentSection.style.display = 'none';
        }
    },

    getGradient(name) {
        const colors = [
            ['#f43f5e', '#e11d48'], ['#3b82f6', '#2563eb'], ['#10b981', '#059669'],
            ['#8b5cf6', '#7c3aed'], ['#f59e0b', '#d97706'], ['#ec4899', '#db2777'],
            ['#6366f1', '#4f46e5'], ['#14b8a6', '#0d9488']
        ];
        const index = name.length % colors.length;
        const [c1, c2] = colors[index];
        return `background: linear-gradient(135deg, ${c1}, ${c2}); display:flex; align-items:center; justify-content:center; width:100%; height:100%; color:rgba(255,255,255,0.8); font-size:2rem;`;
    },

    isLiked(game) { return this.liked.some(g => g.url === game.url); },

    toggleLike(game) {
        if (this.isLiked(game)) {
            this.liked = this.liked.filter(g => g.url !== game.url);
        } else {
            this.liked.push({ 
                name: game.name, 
                url: game.url, 
                img: game.img, 
                type: game.type,
                developer: game.developer,
                developerLink: game.developerLink
            });
        }
        localStorage.setItem('liked_games', JSON.stringify(this.liked));


        if (this.showLikedOnly) {
            this.performSearch(document.getElementById('search-input')?.value.toLowerCase().trim() || '');
        }
    },

    setupListeners() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            let timer;
            searchInput.oninput = (e) => {
                clearTimeout(timer);
                timer = setTimeout(() => this.performSearch(e.target.value.toLowerCase().trim()), 300);
            };
        }
        const libSelect = document.getElementById('lib-select');
        if (libSelect) {
            libSelect.value = this.lib;
            libSelect.onchange = (e) => {
                const newLib = e.target.value;
                if (newLib === this.lib) return;


                window.Settings?.set('gameLibrary', newLib);
                window.location.reload();
            };
        }
        window.addEventListener('settings-changed', (e) => {
            if (e.detail.gameLibrary && e.detail.gameLibrary !== this.lib) {
                this.lib = e.detail.gameLibrary;
                if (libSelect) libSelect.value = this.lib;
            }
        });
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) sortSelect.onchange = (e) => this.sort(e.target.value);


        const randomBtn = document.getElementById('random-btn');
        if (randomBtn) {
            randomBtn.onclick = () => {
                if (this.allGames.length > 0) {
                    const game = this.allGames[Math.floor(Math.random() * this.allGames.length)];
                    this.openGame(game);
                }
            };
        }


        const likedToggle = document.getElementById('liked-toggle');
        if (likedToggle) {
            likedToggle.onclick = () => {
                this.showLikedOnly = !this.showLikedOnly;
                likedToggle.classList.toggle('active', this.showLikedOnly);
                this.performSearch(searchInput?.value.toLowerCase().trim() || '');
            };
        }


        const backToTop = document.getElementById('back-to-top');
        if (backToTop) {
            backToTop.onclick = () => {
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
        }
    },

    performSearch(term) {
        if (!term) {
            this.filteredGames = [...this.allGames];
        } else if (window.Fuse) {
            if (!this.fuse) {
                this.fuse = new window.Fuse(this.allGames, {
                    keys: ['name', 'normalized'],
                    threshold: 0.4
                });
            }
            this.filteredGames = this.fuse.search(term).map(r => r.item);
        } else {
            const q = term.toLowerCase();
            this.filteredGames = this.allGames.filter(g => 
                g.name.toLowerCase().includes(q) || 
                (g.normalized && g.normalized.includes(q))
            );
        }

        if (this.showLikedOnly) {
            this.filteredGames = this.filteredGames.filter(g => this.isLiked(g));
        }

        this.applyFilters();
        this.resetRender();
    }
};

document.addEventListener('DOMContentLoaded', () => Games.init());

