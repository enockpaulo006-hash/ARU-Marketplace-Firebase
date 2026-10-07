(function () {
    const initMobileNavigation = () => {
        const nav = document.querySelector(".site-nav");
        const toggle = document.querySelector(".nav-toggle");
        const links = document.querySelector(".nav-links");

        if (!nav || !toggle || !links) {
            return;
        }

        const setOpen = (isOpen) => {
            nav.classList.toggle("nav-open", isOpen);
            toggle.setAttribute("aria-expanded", String(isOpen));
            toggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
        };

        toggle.addEventListener("click", () => {
            setOpen(!nav.classList.contains("nav-open"));
        });

        links.addEventListener("click", (event) => {
            if (event.target.closest("a")) {
                setOpen(false);
            }
        });

        document.addEventListener("click", (event) => {
            if (!nav.classList.contains("nav-open") || nav.contains(event.target)) {
                return;
            }

            setOpen(false);
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 768) {
                setOpen(false);
            }
        });
    };

    const initFooterVisibility = () => {
        const footer = document.querySelector(".site-footer");

        if (!footer) {
            return;
        }

        const updateFooterVisibility = () => {
            const scrollTop = window.scrollY || window.pageYOffset;
            const viewportBottom = scrollTop + window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            const revealOffset = footer.offsetHeight + 24;
            const hasScrollablePage = documentHeight > window.innerHeight + 24;
            const shouldShow = hasScrollablePage && viewportBottom >= documentHeight - revealOffset;

            document.body.classList.toggle("footer-visible", shouldShow);
        };

        window.addEventListener("scroll", updateFooterVisibility, { passive: true });
        window.addEventListener("resize", updateFooterVisibility);
        window.addEventListener("load", updateFooterVisibility);

        updateFooterVisibility();
    };

    const initProductFormset = () => {
        const root = document.querySelector("[data-formset-root]");

        if (!root) {
            return;
        }

        const prefix = root.dataset.formsetPrefix;
        const formsContainer = root.querySelector("[data-formset-forms]");
        const template = root.parentElement.querySelector("[data-formset-template]");
        const totalFormsInput = root.querySelector(`input[name="${prefix}-TOTAL_FORMS"]`);

        if (!prefix || !formsContainer || !template || !totalFormsInput) {
            return;
        }

        const formIndexPattern = new RegExp(`${prefix}-(?:__prefix__|\\d+)-`, "g");

        const updateFormIndices = () => {
            const items = Array.from(formsContainer.querySelectorAll("[data-formset-item]"));

            items.forEach((item, index) => {
                const title = item.querySelector(".product-batch-title");
                if (title) {
                    title.textContent = `Item ${index + 1}`;
                }

                item.querySelectorAll("input, select, textarea, label").forEach((element) => {
                    if (element.name) {
                        element.name = element.name.replace(formIndexPattern, `${prefix}-${index}-`);
                    }

                    if (element.id) {
                        element.id = element.id.replace(formIndexPattern, `${prefix}-${index}-`);
                    }

                    if (element.htmlFor) {
                        element.htmlFor = element.htmlFor.replace(formIndexPattern, `${prefix}-${index}-`);
                    }
                });
            });

            totalFormsInput.value = items.length;

            items.forEach((item) => {
                const removeButton = item.querySelector("[data-formset-remove]");
                if (removeButton) {
                    removeButton.hidden = items.length === 1;
                }
            });
        };

        root.addEventListener("click", (event) => {
            const addButton = event.target.closest("[data-formset-add]");
            if (addButton) {
                const wrapper = document.createElement("div");
                wrapper.innerHTML = template.innerHTML.trim();
                const nextItem = wrapper.firstElementChild;

                if (nextItem) {
                    formsContainer.appendChild(nextItem);
                    updateFormIndices();
                }
                return;
            }

            const removeButton = event.target.closest("[data-formset-remove]");
            if (!removeButton) {
                return;
            }

            const item = removeButton.closest("[data-formset-item]");
            if (!item) {
                return;
            }

            item.remove();
            updateFormIndices();
        });

        updateFormIndices();
    };

    const initMessages = () => {
        const container = document.querySelector('.messages');
        if (!container) return;

        const messages = Array.from(container.querySelectorAll('.message'));
        if (!messages.length) return;

        messages.forEach((msg) => {
            // Allow manual dismissal on click
            msg.style.cursor = 'pointer';
            msg.addEventListener('click', () => {
                msg.style.transition = 'opacity 300ms ease, height 300ms ease, margin 300ms ease, padding 300ms ease';
                msg.style.opacity = '0';
                msg.style.padding = '0';
                msg.style.margin = '0';
                setTimeout(() => msg.remove(), 350);
            });

            // Auto-hide after 4 seconds
            setTimeout(() => {
                try {
                    msg.style.transition = 'opacity 500ms ease, height 300ms ease, margin 300ms ease, padding 300ms ease';
                    msg.style.opacity = '0';
                    msg.style.padding = '0';
                    msg.style.margin = '0';
                    setTimeout(() => {
                        if (msg.parentElement) msg.remove();
                    }, 520);
                } catch (e) {
                    // ignore
                }
            }, 4000);
        });
    };

    const initProductContact = () => {
        const root = document.querySelector('.seller-contact-card');
        if (!root) return;

        root.addEventListener('click', (event) => {
            const button = event.target.closest('[data-contact-action]');
            if (!button) return;

            const action = button.dataset.contactAction;
            const details = root.querySelector('[data-contact-panel="details"]');
            const request = root.querySelector('[data-contact-panel="request"]');
            const sent = root.querySelector('[data-contact-panel="sent"]');

            if (action === 'show-contact') {
                const isHidden = details.classList.contains('hidden');
                details.classList.toggle('hidden', !isHidden);
                button.textContent = isHidden ? 'Hide contact' : 'Show contact';
                request.classList.add('hidden');
                sent.classList.add('hidden');
            }

            if (action === 'request-call') {
                request.classList.remove('hidden');
                details.classList.add('hidden');
                sent.classList.add('hidden');
                const showButton = root.querySelector('[data-contact-action="show-contact"]');
                if (showButton) showButton.textContent = 'Show contact';
            }

            if (action === 'send-request') {
                request.classList.add('hidden');
                sent.classList.remove('hidden');
            }
        });
    };

    initMobileNavigation();
    initFooterVisibility();
    initProductFormset();
    initMessages();
    initProductContact();
})();
