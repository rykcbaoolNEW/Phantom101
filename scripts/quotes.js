window.Quotes = {
    getData() {
        return (window.SITE_CONFIG && window.SITE_CONFIG.quotes) || [];
    },

    getRandom() {
        const data = this.getData();
        if (!data.length) return null;
        return data[Math.floor(Math.random() * data.length)];
    },
    init(force = false) {
        const quote = this.getRandom();
        if (!quote) return;

        const targets = [
            '#quote',
            '#quote-display',
            '#subtitle',
            '.page-subtitle',
            '.extra-hero p',
            '.loading-text'
        ];

        targets.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                const text = el.textContent.trim();
                const lowText = text.toLowerCase();
                if (force || !text || lowText === 'loading...' || lowText.includes('stream movies') || lowText.includes('customize your') || lowText.includes('phantom unblocked')) {
                    el.textContent = quote;
                }
            });
        });
    }
};

window.QUOTES = window.Quotes.getData();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.Quotes.init());
} else {
    window.Quotes.init();
}
