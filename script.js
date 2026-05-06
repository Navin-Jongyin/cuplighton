document.addEventListener('DOMContentLoaded', () => {
    // UI Logic for Sidebar and Navigation
    initializeUI();

    function initializeUI() {
        // --- Sidebar Category Toggles ---
        const categoryLinks = document.querySelectorAll('.category-list > li > .category-link');

        categoryLinks.forEach(link => {
            const subMenu = link.nextElementSibling;

            if (subMenu && subMenu.tagName === 'UL') {
                link.classList.add('has-children');

                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const parentLi = link.parentElement;

                    // Toggle the expanded class
                    parentLi.classList.toggle('expanded');

                    // Manage Active State
                    const allCategoryLinks = document.querySelectorAll('.category-list > li > .category-link');
                    allCategoryLinks.forEach(l => l.classList.remove('active'));
                    link.classList.add('active');

                    // Update page title/subtitle if on products page
                    const categoryText = link.textContent.trim();
                    const pageTitle = document.getElementById('page-title');
                    const pageSubtitle = document.getElementById('page-subtitle');

                    if (pageTitle) pageTitle.textContent = categoryText;
                    if (pageSubtitle) pageSubtitle.textContent = `Showing all items in ${categoryText}`;

                    // Dispatch a custom event for the products module to listen to
                    window.dispatchEvent(new CustomEvent('categoryFilter', { detail: { category: categoryText } }));
                });
            }
        });

        // Handle subcategory clicks
        const subCategoryLinks = document.querySelectorAll('.category-list ul .category-link');
        const pageTitle = document.getElementById('page-title');
        const pageSubtitle = document.getElementById('page-subtitle');

        subCategoryLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const subCategoryText = link.textContent;
                const parentCategoryLink = link.closest('ul').previousElementSibling;
                const parentCategoryText = parentCategoryLink.textContent.trim();

                if (pageTitle) pageTitle.textContent = `${parentCategoryText} / ${subCategoryText}`;
                if (pageSubtitle) pageSubtitle.textContent = `Showing results for ${subCategoryText}`;
                
                // Dispatch event for subcategory filter
                window.dispatchEvent(new CustomEvent('subcategoryFilter', { detail: { subcategory: subCategoryText, category: parentCategoryText } }));
            });
        });

        // Handle "All Products" click
        const allProductsLink = document.getElementById('all-products-link');
        if (allProductsLink) {
            allProductsLink.addEventListener('click', (e) => {
                e.preventDefault();

                const allCategoryLinks = document.querySelectorAll('.category-list > li > .category-link');
                allCategoryLinks.forEach(l => l.classList.remove('active'));

                const allCheckboxes = document.querySelectorAll('.category-checkbox input[type="checkbox"]');
                allCheckboxes.forEach(cb => cb.checked = false);

                if (pageTitle) pageTitle.textContent = 'All Products';
                if (pageSubtitle) pageSubtitle.textContent = 'Showing all items';

                window.dispatchEvent(new CustomEvent('clearFilters'));
            });
        }
    }
});

