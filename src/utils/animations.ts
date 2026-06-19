export function initScrollAnimations() {
    // PARALLAX EFFECT
    const parallaxSections = document.querySelectorAll('[data-parallax]');
    
    function handleParallax() {
        parallaxSections.forEach(section => {
            const rect = (section as HTMLElement).getBoundingClientRect();
            // Only animate if section is in viewport
            if (rect.top < window.innerHeight && rect.bottom > 0) {
                const rate = (rect.top) * 0.15; // Slower, smoother rate
                (section as HTMLElement).style.backgroundPosition = `center ${rate}px`;
            }
        });
    }

    if (window.innerWidth > 768) {
        window.addEventListener('scroll', handleParallax, { passive: true });
    }

    // FADE-IN ON SCROLL
    const observerOptions = { 
        threshold: 0.15, 
        rootMargin: '0px 0px -80px 0px' 
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                // Once visible, no need to observe anymore for performance
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.area-preview-card, .card, .section-title, .parallax-content, .stat-item, .commitment-item, .faq-item').forEach(el => {
        el.classList.add('fade-up');
        observer.observe(el);
    });
}
