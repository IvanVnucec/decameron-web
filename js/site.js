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
            // srcset wins over src, so swap both or the picture never changes
            if (thumb.dataset.srcset) main.srcset = thumb.dataset.srcset;
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
        // (with the same sizes, so the browser picks the same 800 or 1600 file it will show)
        window.addEventListener('load', () => thumbs.forEach((t) => {
            const img = new Image();
            img.sizes = main.sizes;
            if (t.dataset.srcset) img.srcset = t.dataset.srcset;
            img.src = t.dataset.large;
        }));
    });

    // how it works: the render's LEDs light up the way the device does in the current step. the steps play
    // one by one while the render is on screen; clicking a step shows that one and stops the playing.
    // the light patterns themselves are CSS animations keyed on data-step, see .led-demo in style.css
    const ledDemo = document.querySelector('[data-led-demo]');
    if (ledDemo) {
        const steps = [...document.querySelectorAll('[data-led-step]')];
        const pills = [...document.querySelectorAll('[data-led-pick]')]; // below lg: one step shows, picked by number
        // how long each step stays up: two status blinks, or two full rounds of the five camera flashes
        const stepMs = { 1: 5000, 2: 5000, 3: 6000, 4: 5000 };
        let playing = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        let timer = null;

        const showStep = (step) => {
            if (ledDemo.dataset.step === step.dataset.ledStep) return; // same step: don't restart the flashes
            ledDemo.dataset.step = step.dataset.ledStep;
            steps.forEach((s) => {
                s.classList.toggle('active', s === step);
                if (s === step) s.setAttribute('aria-current', 'step');
                else s.removeAttribute('aria-current');
            });
            pills.forEach((p) => {
                const on = p.dataset.ledPick === step.dataset.ledStep;
                p.classList.toggle('active', on);
                p.setAttribute('aria-pressed', String(on));
            });
        };

        const scheduleNext = () => {
            timer = setTimeout(() => {
                const i = steps.findIndex((s) => s.dataset.ledStep === ledDemo.dataset.step);
                showStep(steps[(i + 1) % steps.length]);
                scheduleNext();
            }, stepMs[ledDemo.dataset.step] || 5000);
        };
        const pause = () => {
            clearTimeout(timer);
            timer = null;
        };

        const pick = (step) => {
            playing = false;
            pause();
            showStep(step);
        };
        steps.forEach((step) => {
            step.tabIndex = 0;
            if (step.dataset.ledStep === ledDemo.dataset.step) step.setAttribute('aria-current', 'step');
            step.addEventListener('click', () => pick(step));
            step.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    pick(step);
                }
            });
        });
        pills.forEach((pill) => pill.addEventListener('click', () => {
            pick(steps.find((s) => s.dataset.ledStep === pill.dataset.ledPick));
        }));

        // only play while the render can be seen, so nobody arrives halfway through a step
        new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && playing && !timer) scheduleNext();
            else if (!entry.isIntersecting) pause();
        }, { threshold: 0.5 }).observe(ledDemo);
    }

    // faq: opening support-and-faq#faq-<id> expands that answer
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
