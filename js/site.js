// small progressive enhancements shared by several pages
(() => {
    // "2 days ago": the page is built once a day, so recount against the visitor's clock
    const ago = (ms) => {
        const unit = (n, word) => `${n} ${word}${n === 1 ? '' : 's'} ago`;
        const minutes = Math.floor(ms / 60000);
        if (minutes < 1) return 'just now';
        if (minutes < 60) return unit(minutes, 'minute');
        if (minutes < 24 * 60) return unit(Math.floor(minutes / 60), 'hour');
        return unit(Math.floor(minutes / (24 * 60)), 'day');
    };
    document.querySelectorAll('time[data-ago]').forEach((el) => {
        const when = Date.parse(el.dateTime);
        if (!Number.isNaN(when)) el.textContent = ago(Math.max(0, Date.now() - when));
    });

    // gallery: hovering a thumbnail shows it large; tapping does the same on touch screens
    document.querySelectorAll('[data-gallery]').forEach((gallery) => {
        const main = gallery.querySelector('[data-gallery-main]');
        const thumbs = gallery.querySelectorAll('[data-large]');
        const show = (thumb) => {
            main.src = thumb.dataset.large;
            main.alt = thumb.dataset.alt;
            thumbs.forEach((t) => {
                t.classList.toggle('active', t === thumb);
                t.setAttribute('aria-pressed', String(t === thumb));
            });
        };
        thumbs.forEach((thumb) => {
            thumb.addEventListener('mouseenter', () => show(thumb));
            thumb.addEventListener('click', () => show(thumb));
            thumb.addEventListener('focus', () => show(thumb));
        });
        // fetch the large photos early so the first hover doesn't flash
        window.addEventListener('load', () => thumbs.forEach((t) => { new Image().src = t.dataset.large; }));
    });

    // faq: opening support-and-faq.html#faq-<id> expands that answer
    function openFromHash() {
        const target = location.hash && document.getElementById(location.hash.slice(1));
        if (!target || !target.classList.contains('accordion-item') || !window.bootstrap) return;
        const panel = target.querySelector('.accordion-collapse');
        if (panel) {
            bootstrap.Collapse.getOrCreateInstance(panel, { toggle: false }).show();
            target.scrollIntoView();
        }
    }
    window.addEventListener('hashchange', openFromHash);
    openFromHash();
})();
