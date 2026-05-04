// News widget for Phantom using Pollinations Gemini-Search
(function () {
    const News = {
        config: {
            apiKey: 'sk_j66iDfX2lPbTZ2Otb9MI7xje7kRZQUyE',
            model: 'gemini-search',
            baseUrl: 'https://gen.pollinations.ai/v1/chat/completions'
        },

        init() {
            this.containers = document.querySelectorAll('#news-widget, #news-widget-mobile');
            if (this.containers.length === 0) return;
            this.load();
        },

        async load() {
            try {
                this.renderLoading();
                
                const config = window.SITE_CONFIG?.news;
                const userShowNews = (window.Settings && typeof window.Settings.get === 'function') 
                    ? window.Settings.get('newsEnabled') !== false 
                    : true;

                if (!config || config.enabled === false || !userShowNews) {
                    this.containers.forEach(c => {
                        const widget = c.parentElement;
                        if (widget) widget.style.display = 'none';
                    });
                    return;
                }

                this.updateTitle();
                const news = await this.fetchNews();
                this.render(news);
            } catch (err) {
                console.error('News error:', err);
                this.renderError();
            }
        },


        updateTitle() {
            const config = window.SITE_CONFIG.news || { title: 'March Madness', icon: 'fa-basketball' };
            this.containers.forEach(c => {
                const header = c.parentElement?.querySelector('.widget-header');
                if (!header) return;
                
                const span = header.querySelector('span');
                const icon = header.querySelector('i');

                if (span) span.textContent = config.title || 'News';
                if (icon) {
                    const iconClass = config.icon || (config.title === 'March Madness' ? 'fa-basketball' : 'fa-newspaper');
                    icon.className = `fa-solid ${iconClass}`;
                }
            });
        },

        async fetchNews() {
            const config = window.SITE_CONFIG.news || {};
            const prompt = config.prompt || `4 biggest ${config.title || 'March Madness'} results right now.\nFormat: * Headline with score | Source | Summary under 8 words.`;

            const body = {
                messages: [
                    { role: 'system', content: 'You are a live sports ticker feeding a UI parser. Respond with ONLY the bulleted lines requested. No introductions, conclusions, headers, or markdown. Each line must start with * and use | as the delimiter.' },
                    { role: 'user', content: prompt }
                ],
                model: this.config.model
            };
            if (!this.config.model.startsWith('perplexity')) {
                body.seed = Math.floor(Date.now() / (1000 * 60 * 60));
            }

            const res = await fetch(this.config.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.apiKey}`
                },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            const content = data.choices[0].message.content;
            return this.parseNews(content);
        },

        parseNews(content) {
            const lines = content.split('\n').filter(l => l.trim().startsWith('*'));
            return lines.map(line => {
                const clean = line.replace(/^\*\s*/, '').replace(/\[\d+\]/g, '').trim();
                const parts = clean.split('|').map(p => p.trim());
                let summary = parts[2] || '';

                if (summary) {
                    summary = summary.split(/[.!?]\s+(?=[A-Z])/)[0].replace(/[.!?]+$/, '') + '.';
                    if (summary.length > 120) summary = summary.substring(0, 117) + '...';
                }

                return {
                    title: parts[0] || 'Tournament Update',
                    source: parts[1] || 'NCAA',
                    summary: summary
                };
            }).slice(0, 4);
        },

        renderLoading() {
            this.containers.forEach(c => {
                c.innerHTML = `
                    <div class="news-loading">
                        <div class="skeleton" style="height: 40px; margin-bottom: 12px;"></div>
                        <div class="skeleton" style="height: 40px; margin-bottom: 12px;"></div>
                    </div>
                `;
            });
        },

        renderError() {
            this.containers.forEach(c => c.innerHTML = '<div style="color: var(--text-dim); font-size: 0.75rem;">Feed unavailable</div>');
        },

        render(news) {
            if (!news.length) return this.renderError();

            this.containers.forEach(c => {
                c.innerHTML = `
                    <div class="news-list">
                        ${news.map(n => `
                            <div class="news-item">
                                <div class="news-content">
                                    <div class="news-title">${n.title}</div>
                                    <div class="news-summary">${n.summary}</div>
                                    <div class="news-meta">${n.source}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
            });
        }
    };

    window.NewsWidget = News;
    document.addEventListener('DOMContentLoaded', () => News.init());
    
    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'settings-update') {
            News.load();
        }
    });
})();
