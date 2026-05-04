class Draggable {
    constructor(element, handle, storageKey) {
        this.element = element;
        this.handle = handle || element;
        this.storageKey = storageKey;
        this.isDragging = false;
        this.init();
    }

    init() {
        const savedPos = JSON.parse(localStorage.getItem(this.storageKey) || 'null');
        if (savedPos) {
            Object.assign(this.element.style, {
                bottom: 'auto',
                right: 'auto',
                left: `${savedPos.left}px`,
                top: `${savedPos.top}px`
            });
        }

        this.handle.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            this.isDragging = true;
            const rect = this.element.getBoundingClientRect();
            this.startX = e.clientX;
            this.startY = e.clientY;
            this.startLeft = rect.left;
            this.startTop = rect.top;
            this.element.style.transition = 'none';
            this.element.classList.add('dragging');
            e.preventDefault();
        });

        window.addEventListener('mousemove', e => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.startX;
            const dy = e.clientY - this.startY;
            let left = Math.max(0, Math.min(this.startLeft + dx, window.innerWidth - this.element.offsetWidth));
            let top = Math.max(0, Math.min(this.startTop + dy, window.innerHeight - this.element.offsetHeight));
            
            Object.assign(this.element.style, {
                bottom: 'auto',
                right: 'auto',
                left: `${left}px`,
                top: `${top}px`
            });
        });

        window.addEventListener('mouseup', () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.element.style.transition = '';
            this.element.classList.remove('dragging');
            const rect = this.element.getBoundingClientRect();
            localStorage.setItem(this.storageKey, JSON.stringify({ left: rect.left, top: rect.top }));
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const weather = document.getElementById('weather-widget-container');
    if (weather) new Draggable(weather, weather.querySelector('.widget-header'), 'weather_widget_pos');
    
    const news = document.getElementById('news-widget-container');
    if (news) new Draggable(news, news.querySelector('.widget-header'), 'news_widget_pos');
});
