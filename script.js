document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Initialization ---
    const firebaseConfig = {
        apiKey: "AIzaSyD8JyqoRLjwn93CsL9iOkZ8w79VT2OU5VI",
        authDomain: "cuplighton-72192.firebaseapp.com",
        projectId: "cuplighton-72192",
        storageBucket: "cuplighton-72192.firebasestorage.app",
        messagingSenderId: "60391723671",
        appId: "1:60391723671:web:fc2b7b509b99b595f74fd2"
    };

    // Dynamically load Firebase
    if (!window.firebase) {
        const script = document.createElement('script');
        script.src = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
        script.onload = () => {
            const scriptDb = document.createElement('script');
            scriptDb.src = 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
            scriptDb.onload = initializeApp;
            document.head.appendChild(scriptDb);
        };
        document.head.appendChild(script);
    } else {
        initializeApp();
    }

    let db = null;

    async function initializeApp() {
        if (window.firebase && window.firebase.initializeApp) {
            try {
                const app = window.firebase.initializeApp(firebaseConfig);
                db = window.firebase.firestore(app);
                initializePage();
            } catch (e) {
                console.log('Firebase already initialized or error:', e);
                db = window.firebase.firestore();
                initializePage();
            }
        }
    }

    function initializePage() {
    // --- Load Featured Products on Homepage ---
    // --- Featured Products on Homepage ---
    // Now handled by static HTML in index.html
    const featuredProductsGrid = document.getElementById('featured-products-grid');
    if (featuredProductsGrid) {
        // Optional: Add any specific behavior for the static grid here if needed
        // For now, we just leave the static HTML as is
    }

    const categoryLinks = document.querySelectorAll('.category-list > li > .category-link');

    categoryLinks.forEach(link => {
        // Check if this link has a sibling UL (subcategory)
        const subMenu = link.nextElementSibling;

        if (subMenu && subMenu.tagName === 'UL') {
            // Add a class to indicate it has children (for styling arrows)
            link.classList.add('has-children');

            link.addEventListener('click', (e) => {
                e.preventDefault();
                const parentLi = link.parentElement;

                // Toggle the expanded class
                parentLi.classList.toggle('expanded');

                // NEW: Also filter products by this category

                // 1. Manage Active State for Links
                const allCategoryLinks = document.querySelectorAll('.category-list > li > .category-link');
                allCategoryLinks.forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // Uncheck all checkboxes first to ensure clean state
                const allCheckboxes = document.querySelectorAll('.category-checkbox input[type="checkbox"]');
                allCheckboxes.forEach(cb => cb.checked = false);

                // Update text
                const categoryText = link.textContent.trim();
                const pageTitle = document.getElementById('page-title');
                const pageSubtitle = document.getElementById('page-subtitle');

                if (pageTitle) pageTitle.textContent = categoryText;
                if (pageSubtitle) pageSubtitle.textContent = `Showing all items in ${categoryText}`;

                // Trigger filter override
                if (typeof renderProducts === 'function') {
                    renderProducts(categoryText);
                }
            });
        }
    });

    // Handle subcategory clicks for breadcrumbs
    const subCategoryLinks = document.querySelectorAll('.category-list ul .category-link');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');

    subCategoryLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            // Stop propagation so it doesn't trigger the parent collapse toggle if nested specifically
            e.stopPropagation();

            const subCategoryText = link.textContent;
            // Find the parent category link text
            // Structure: li > ul > li > link
            // We want the parent li of the ul, then its direct child .category-link
            const parentCategoryLink = link.closest('ul').previousElementSibling;
            const parentCategoryText = parentCategoryLink.textContent.trim();

            pageTitle.textContent = `${parentCategoryText} / ${subCategoryText}`;
            pageSubtitle.textContent = `Showing results for ${subCategoryText}`;
        });
    });

    // Handle "All Products" click
    const allProductsLink = document.getElementById('all-products-link');
    if (allProductsLink) {
        allProductsLink.addEventListener('click', (e) => {
            e.preventDefault();

            // Clear active state from sidebar
            const allCategoryLinks = document.querySelectorAll('.category-list > li > .category-link');
            allCategoryLinks.forEach(l => l.classList.remove('active'));

            // Uncheck all checkboxes
            const allCheckboxes = document.querySelectorAll('.category-checkbox input[type="checkbox"]');
            allCheckboxes.forEach(cb => cb.checked = false);

            // Clear context
            if (typeof renderProducts === 'function') {
                // If on products page, we can trigger re-render
                renderProducts(null, true);
            }

            if (pageTitle) pageTitle.textContent = 'All Products';
        });
    }


    // --- Load Products from JSON (for products.html page only) ---
    const productGrid = document.querySelector('.product-grid:not(#featured-products-grid)');
    let allProductsData = null;
    let currentContextCategory = null;

    if (productGrid) {
        // Function to render products based on selected checkboxes or explicit category filter
        window.renderProducts = function (categoryOverride = null, resetContext = false) {
            if (!allProductsData) return;

            if (resetContext) {
                currentContextCategory = null;
            } else if (categoryOverride) {
                currentContextCategory = categoryOverride;
            }

            productGrid.innerHTML = '';
            let productCount = 0;

            // Get all checked checkboxes
            const checkedBoxes = document.querySelectorAll('.category-checkbox input[type="checkbox"]:checked');
            const allProductsCheckbox = document.getElementById('all-products');

            // Collect selected categories and subcategories
            const selectedFilters = new Set();
            checkedBoxes.forEach(checkbox => {
                if (checkbox.id !== 'all-products' && checkbox.value) {
                    selectedFilters.add(checkbox.value.toLowerCase());
                }
            });

            // Iterate through categories and products
            Object.keys(allProductsData.categories).forEach(categoryKey => {
                const category = allProductsData.categories[categoryKey];

                // Logic update: Allow cross-category filtering if filters are present.
                // We handle context inside the loop logic below.

                Object.keys(category).forEach(subcategoryKey => {
                    const products = category[subcategoryKey];

                    // Logic:
                    // 1. If filters are active, they take precedence (show matched subcategories globally).
                    // 2. If NO filters are active, respect current context.
                    // 3. Fallback to global if neither.

                    let shouldShow = false;

                    if (selectedFilters.size > 0) {
                        shouldShow = selectedFilters.has(subcategoryKey.toLowerCase());
                    } else {
                        // No specific filters -> Fallback to context
                        if (currentContextCategory) {
                            shouldShow = categoryKey.toLowerCase() === currentContextCategory.toLowerCase();
                        } else {
                            shouldShow = true;
                        }
                    }

                    if (!shouldShow) return;

                    products.forEach((product, index) => {
                        const productCard = document.createElement('article');
                        productCard.className = 'product-card';
                        productCard.dataset.category = categoryKey;
                        productCard.dataset.subcategory = subcategoryKey;

                        const productId = `${categoryKey}-${subcategoryKey}-${index}`;

                        productCard.innerHTML = `
                            <a href="product-detail.html?id=${productId}">
                                <div class="product-image">
                                    <img src="${product.image}" alt="${product.name}">
                                </div>
                                <div class="product-info">
                                    <span class="product-category-tag">${categoryKey} / ${subcategoryKey}</span>
                                    <h3>${product.name}</h3>
                                    <p style="font-size: 0.9rem; margin-bottom: 0.5rem;">${product.description || 'Premium lighting solution'}</p>
                                    <span class="product-price">$${product.price.toLocaleString()}</span>
                                    <button class="btn btn-primary" style="width: 100%;">View Details</button>
                                </div>
                            </a>
                        `;

                        productGrid.appendChild(productCard);
                        productCount++;
                    });
                });
            });

            // Update page subtitle
            const pageSubtitle = document.getElementById('page-subtitle');

            if (pageSubtitle) {
                const itemText = productCount === 1 ? 'item' : 'items';

                if (currentContextCategory) {
                    if (selectedFilters.size > 0) {
                        // Simplify message when cross-filtering might be happening
                        pageSubtitle.textContent = `Showing ${productCount} ${itemText} (Filtered)`;
                    } else {
                        pageSubtitle.textContent = `Showing all ${productCount} ${itemText} in ${currentContextCategory}`;
                    }
                } else {
                    if (selectedFilters.size > 0) {
                        pageSubtitle.textContent = `Showing ${productCount} ${itemText} (Filtered)`;
                    } else {
                        pageSubtitle.textContent = `Showing all ${productCount} ${itemText}`;
                    }
                }
            }
        };

        // Load products from Firebase
        async function loadProductsFromFirebase() {
            try {
                const querySnapshot = await db.collection('products').get();
                
                // Transform Firebase data into the JSON structure
                const transformedData = {
                    categories: {}
                };

                querySnapshot.forEach((doc) => {
                    const product = doc.data();
                    const category = product.category || 'other';
                    const subcategory = product.subcategory || 'uncategorized';

                    if (!transformedData.categories[category]) {
                        transformedData.categories[category] = {};
                    }
                    if (!transformedData.categories[category][subcategory]) {
                        transformedData.categories[category][subcategory] = [];
                    }

                    transformedData.categories[category][subcategory].push({
                        name: product.name,
                        price: product.price,
                        image: product.image,
                        description: product.description,
                        datasheet: product.datasheet || '',
                        id: doc.id
                    });
                });

                allProductsData = transformedData;

                // Check for URL parameters to filter initially
                const urlParams = new URLSearchParams(window.location.search);
                const categoryParam = urlParams.get('category');

                if (categoryParam) {
                    const categoryLinks = document.querySelectorAll('.category-list > li > .category-link');
                    categoryLinks.forEach(link => {
                        if (link.textContent.trim().toLowerCase() === categoryParam.toLowerCase()) {
                            const parentLi = link.parentElement;
                            parentLi.classList.add('expanded');
                            link.classList.add('active');
                            if (pageTitle) pageTitle.textContent = categoryParam;
                        }
                    });
                    // Filter products by this category
                    renderProducts(categoryParam);
                } else {
                    renderProducts(); // Show all products initially
                }

                // Add change handlers for all checkboxes
                const allCheckboxes = document.querySelectorAll('.category-checkbox input[type="checkbox"]');
                const allProductsCheckbox = document.getElementById('all-products');

                allCheckboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', () => {
                        if (checkbox.id === 'all-products' && checkbox.checked) {
                            allCheckboxes.forEach(cb => {
                                if (cb.id !== 'all-products') cb.checked = false;
                            });
                            // Reset context when All Products checked
                            renderProducts(null, true);
                        } else if (checkbox.id !== 'all-products' && checkbox.checked) {
                            if (allProductsCheckbox && allProductsCheckbox.checked) {
                                allProductsCheckbox.checked = false;
                            }
                            renderProducts();
                        } else {
                            // Checkbox unchecked
                            renderProducts();
                        }
                    });
                });

                // Update "All Products" link handler inside here to ensure access to renderProducts
                const allProductsLink = document.getElementById('all-products-link');
                if (allProductsLink) {
                    allProductsLink.addEventListener('click', (e) => {
                        e.preventDefault();

                        // Clear active state from sidebar
                        const allCategoryLinks = document.querySelectorAll('.category-list > li > .category-link');
                        allCategoryLinks.forEach(l => l.classList.remove('active'));

                        const allCheckboxes = document.querySelectorAll('.category-checkbox input[type="checkbox"]');
                        allCheckboxes.forEach(cb => cb.checked = false);

                        if (pageTitle) pageTitle.textContent = 'All Products';

                        // Reset context and render all
                        renderProducts(null, true);
                    });
                }
            } catch (error) {
                console.error('Error loading products from Firebase:', error);
                productGrid.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">Error loading products. Please try again later.</p>';
            }
        }

        // Load products from Firebase
        loadProductsFromFirebase();
    }

    // --- Product Detail Page Logic ---
    if (window.location.pathname.includes('product-detail.html') && db) {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');

        if (productId) {
            // Load product from Firebase by ID
            db.collection('products').doc(productId).get().then((doc) => {
                if (doc.exists) {
                    const product = doc.data();

                    document.title = `${product.name} | Cuplighton`;
                    document.getElementById('detail-category').textContent = `${product.category} / ${product.subcategory}`;
                    document.getElementById('detail-name').textContent = product.name;
                    document.getElementById('detail-title').textContent = product.name;
                    document.getElementById('detail-price').textContent = `฿${product.price.toLocaleString()}`;
                    document.getElementById('detail-description').textContent = product.description || 'Premium lighting solution designed for modern spaces.';

                    const imgElement = document.getElementById('detail-image');
                    const thumbnailsContainer = document.getElementById('image-thumbnails');

                    if (product.image) {
                        imgElement.src = product.image;
                        imgElement.alt = product.name;
                    } else {
                        imgElement.style.backgroundColor = '#ffffff';
                        imgElement.alt = 'Image coming soon';
                    }

                    const datasheetBtn = document.getElementById('datasheet-btn');
                    if (product.datasheet) {
                        datasheetBtn.onclick = () => {
                            window.open(product.datasheet, '_blank');
                        };
                    } else {
                        datasheetBtn.disabled = true;
                        datasheetBtn.textContent = 'Datasheet Not Available';
                        datasheetBtn.style.opacity = '0.5';
                    }

                    const featuresList = document.getElementById('detail-features');
                    featuresList.innerHTML = '';

                    if (product.features && product.features.length > 0) {
                        product.features.forEach(feature => {
                            const li = document.createElement('li');
                            li.textContent = feature;
                            li.style.marginBottom = '0.5rem';
                            featuresList.appendChild(li);
                        });
                    } else {
                        const defaultFeatures = [
                            'Premium Quality Materials',
                            'Energy Efficient',
                            'Easy Installation',
                            '2 Year Warranty'
                        ];
                        defaultFeatures.forEach(feature => {
                            const li = document.createElement('li');
                            li.textContent = feature;
                            li.style.marginBottom = '0.5rem';
                            featuresList.appendChild(li);
                        });
                    }
                } else {
                    document.querySelector('.product-detail-container').innerHTML = '<h2 class="text-center">Product Not Found</h2><p class="text-center"><a href="products.html" class="text-gold">Return to Collection</a></p>';
                }
            }).catch(error => {
                console.error('Error loading product details:', error);
                document.querySelector('.product-detail-container').innerHTML = '<h2 class="text-center">Error Loading Product</h2><p class="text-center"><a href="products.html" class="text-gold">Return to Collection</a></p>';
            });
        } else {
            document.querySelector('.product-detail-container').innerHTML = '<h2 class="text-center">Product Not Found</h2><p class="text-center"><a href="products.html" class="text-gold">Return to Collection</a></p>';
        }
    }
    }
});

