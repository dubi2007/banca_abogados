export function initContactForm() {
	// Animation logic
	const observerOptions = { threshold: 0.1 };
	const observer = new IntersectionObserver((entries) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				entry.target.classList.add('visible');
			}
		});
	}, observerOptions);

	document.querySelectorAll('.info-item, .contact-form-wrapper').forEach(el => {
		el.classList.add('fade-up');
		observer.observe(el);
	});

	// Form logic
	const form = document.getElementById('contactForm') as HTMLFormElement;
	const status = document.getElementById('formStatus');
	const btn = document.getElementById('submitBtn') as HTMLButtonElement;
	const btnText = btn?.querySelector('.btn-text');
	const loader = btn?.querySelector('.loader');

	if (form && status && btn) {
		form.addEventListener('submit', async (e) => {
			e.preventDefault();
			
			btn.disabled = true;
			if (btnText) (btnText as HTMLElement).style.opacity = '0.5';
			if (loader) (loader as HTMLElement).style.display = 'inline-block';
			
			status.textContent = window.location.pathname.includes('/en/') ? 'Sending...' : 'Enviando...';
			status.className = 'form-status info';

			try {
				const formData = new FormData(form);
				
				const response = await fetch('https://formspree.io/f/mgorbywq', {
					method: 'POST',
					body: formData,
					headers: {
						'Accept': 'application/json'
					}
				});

				if (response.ok) {
					status.textContent = window.location.pathname.includes('/en/') 
						? 'Message sent successfully!' 
						: '¡Mensaje enviado con éxito!';
					status.className = 'form-status success';
					form.reset();
				} else {
					const result = await response.json();
					throw new Error(result.errors ? result.errors.map((e:any) => e.message).join(', ') : 'Error en el servicio');
				}
			} catch (error: any) {
				console.error('Form Error:', error);
				status.textContent = 'Ocurrió un error. Por favor, intenta de nuevo o escribe a info@faynshteynjuridico.com';
				status.className = 'form-status error';
			} finally {
				btn.disabled = false;
				if (btnText) (btnText as HTMLElement).style.opacity = '1';
				if (loader) (loader as HTMLElement).style.display = 'none';
			}
		});
	}
}
