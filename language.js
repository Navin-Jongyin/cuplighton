// Language switching functionality
class LanguageSwitcher {
    constructor() {
        this.currentLang = localStorage.getItem('language') || 'en';
        this.init();
    }

    init() {
        // Set initial language
        this.setLanguage(this.currentLang);

        // Add event listeners to language buttons
        document.addEventListener('DOMContentLoaded', () => {
            const langButtons = document.querySelectorAll('[data-lang]');
            langButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    e.preventDefault();
                    const lang = button.getAttribute('data-lang');
                    this.setLanguage(lang);
                });
            });
        });
    }

    setLanguage(lang) {
        this.currentLang = lang;
        localStorage.setItem('language', lang);

        // Update HTML lang attribute
        document.documentElement.setAttribute('lang', lang);

        // Update all translatable elements
        this.updateContent();

        // Update active state on language buttons
        this.updateActiveButton();

        // Update body font class for Thai
        if (lang === 'th') {
            document.body.classList.add('thai-font');
        } else {
            document.body.classList.remove('thai-font');
        }
    }

    updateContent() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.getTranslation(key);

            if (translation) {
                // Check if element is an input placeholder
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.placeholder = translation;
                } else {
                    element.textContent = translation;
                }
            }
        });
    }

    getTranslation(key) {
        const keys = key.split('.');
        let value = translations[this.currentLang];

        for (const k of keys) {
            if (value && value[k]) {
                value = value[k];
            } else {
                return null;
            }
        }

        return value;
    }

    updateActiveButton() {
        const langButtons = document.querySelectorAll('[data-lang]');
        langButtons.forEach(button => {
            const lang = button.getAttribute('data-lang');
            if (lang === this.currentLang) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }

    getCurrentLanguage() {
        return this.currentLang;
    }
}

// Initialize language switcher
const languageSwitcher = new LanguageSwitcher();
