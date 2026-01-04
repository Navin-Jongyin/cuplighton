document.addEventListener('DOMContentLoaded', () => {
    // --- Load Featured Products on Homepage ---
    const featuredProductsGrid = document.getElementById('featured-products-grid');

    if (featuredProductsGrid) {
        fetch('product.json')
            .then(response => response.json())
            .then(data => {
                // Collect all products from all categories
                const allProducts = [];
                Object.keys(data.categories).forEach(categoryKey => {
                    const category = data.categories[categoryKey];
                    Object.keys(category).forEach(subcategoryKey => {
                        const products = category[subcategoryKey];
                        products.forEach((product, index) => {
                            allProducts.push({
                                ...product,
                                category: categoryKey,
                                subcategory: subcategoryKey,
                                index: index,
                                id: `${categoryKey}-${subcategoryKey}-${index}`
                            });
                        });
                    });
                });

                // Select random products for featured section (one row)
                const shuffled = allProducts.sort(() => 0.5 - Math.random());
                const featured = shuffled.slice(0, 6);

                // Render featured products
                featuredProductsGrid.innerHTML = '';
                featured.forEach(product => {
                    const productCard = document.createElement('article');
                    productCard.className = 'product-card';

                    productCard.innerHTML = `
                        <a href="product-detail.html?id=${product.id}">
                            <div class="product-image">
                                <img src="${product.image}" alt="${product.name}">
                            </div>
                            <div class="product-info text-center">
                                <span class="product-category-tag">${product.category} / ${product.subcategory}</span>
                                <h3>${product.name}</h3>
                                <span class="product-price">$${product.price.toLocaleString()}</span>
                                <button class="btn">View Details</button>
                            </div>
                        </a>
                    `;

                    featuredProductsGrid.appendChild(productCard);
                });
            })
            .catch(error => {
                console.error('Error loading featured products:', error);
                featuredProductsGrid.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">Error loading products.</p>';
            });
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
            pageTitle.textContent = 'All Products';
            pageSubtitle.textContent = 'Showing all items';
        });
    }


    // --- Load Products from JSON (for products.html page only) ---
    const productGrid = document.querySelector('.product-grid:not(#featured-products-grid)');
    let allProductsData = null;

    if (productGrid) {
        // Function to render products based on filter
        function renderProducts(filterCategory = null, filterSubcategory = null) {
            if (!allProductsData) return;

            productGrid.innerHTML = '';
            let productCount = 0;

            // Iterate through categories and products
            Object.keys(allProductsData.categories).forEach(categoryKey => {
                const category = allProductsData.categories[categoryKey];

                // Skip if filtering by category and this isn't it
                if (filterCategory && categoryKey.toLowerCase() !== filterCategory.toLowerCase()) {
                    return;
                }

                Object.keys(category).forEach(subcategoryKey => {
                    const products = category[subcategoryKey];

                    // Skip if filtering by subcategory and this isn't it
                    if (filterSubcategory && subcategoryKey.toLowerCase() !== filterSubcategory.toLowerCase()) {
                        return;
                    }

                    products.forEach((product, index) => {
                        const productCard = document.createElement('article');
                        productCard.className = 'product-card';
                        productCard.dataset.category = categoryKey;
                        productCard.dataset.subcategory = subcategoryKey;

                        // Create unique ID for product
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
                                    <button class="btn btn-primary" style="width: 100%;">Add to Cart</button>
                                </div>
                            </a>
                        `;

                        productGrid.appendChild(productCard);
                        productCount++;
                    });
                });
            });

            // Update page subtitle with count
            if (pageSubtitle) {
                const itemText = productCount === 1 ? 'item' : 'items';
                if (filterSubcategory) {
                    pageSubtitle.textContent = `Showing ${productCount} ${itemText} in ${filterSubcategory}`;
                } else if (filterCategory) {
                    pageSubtitle.textContent = `Showing ${productCount} ${itemText} in ${filterCategory}`;
                } else {
                    pageSubtitle.textContent = `Showing all ${productCount} ${itemText}`;
                }
            }
        }

        // Load products from JSON
        fetch('product.json')
            .then(response => response.json())
            .then(data => {
                allProductsData = data;
                renderProducts(); // Show all products initially

                // Add click handlers for subcategory filtering
                const subCategoryLinks = document.querySelectorAll('.category-list ul .category-link');
                subCategoryLinks.forEach(link => {
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        const subcategoryText = link.textContent.trim();
                        const parentCategoryLink = link.closest('ul').previousElementSibling;
                        const parentCategoryText = parentCategoryLink.textContent.trim();

                        // Update page title
                        if (pageTitle) {
                            pageTitle.textContent = `${parentCategoryText} / ${subcategoryText}`;
                        }

                        // Filter products
                        renderProducts(parentCategoryText, subcategoryText);
                    });
                });

                // Update "All Products" link to show all
                const allProductsLink = document.getElementById('all-products-link');
                if (allProductsLink) {
                    allProductsLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (pageTitle) pageTitle.textContent = 'All Products';
                        renderProducts(); // Show all products
                    });
                }
            })
            .catch(error => {
                console.error('Error loading products:', error);
                productGrid.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">Error loading products. Please try again later.</p>';
            });
    }

    // --- Product Detail Page Logic ---

    // Check if we are on the product detail page
    if (window.location.pathname.includes('product-detail.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');

        if (productId) {
            // Load product data from JSON
            fetch('product.json')
                .then(response => response.json())
                .then(data => {
                    // Parse the product ID (format: category-subcategory-index)
                    const [categoryKey, subcategoryKey, indexStr] = productId.split('-');
                    const index = parseInt(indexStr);

                    // Find the product in the JSON data
                    if (data.categories[categoryKey] &&
                        data.categories[categoryKey][subcategoryKey] &&
                        data.categories[categoryKey][subcategoryKey][index]) {

                        const product = data.categories[categoryKey][subcategoryKey][index];

                        // Populate Data
                        document.title = `${product.name} | Cuplighton`;
                        document.getElementById('detail-category').textContent = `${categoryKey.charAt(0).toUpperCase() + categoryKey.slice(1)} / ${subcategoryKey.charAt(0).toUpperCase() + subcategoryKey.slice(1)}`;
                        document.getElementById('detail-name').textContent = product.name;
                        document.getElementById('detail-title').textContent = product.name;
                        document.getElementById('detail-price').textContent = `$${product.price.toLocaleString()}`;
                        document.getElementById('detail-description').textContent = product.description || 'Premium lighting solution designed for modern spaces.';


                        // Image Gallery handling
                        const imgElement = document.getElementById('detail-image');
                        const thumbnailsContainer = document.getElementById('image-thumbnails');

                        // Use images array if available, otherwise fall back to single image
                        const productImages = product.images && product.images.length > 0
                            ? product.images
                            : (product.image ? [product.image] : []);

                        if (productImages.length > 0) {
                            // Set main image
                            imgElement.src = productImages[0];
                            imgElement.alt = product.name;

                            // Create thumbnails if multiple images
                            if (productImages.length > 1) {
                                thumbnailsContainer.innerHTML = '';
                                productImages.forEach((imageSrc, index) => {
                                    const thumbnail = document.createElement('img');
                                    thumbnail.src = imageSrc;
                                    thumbnail.alt = `${product.name} - Image ${index + 1}`;
                                    thumbnail.className = 'thumbnail' + (index === 0 ? ' active' : '');
                                    thumbnail.addEventListener('click', () => {
                                        imgElement.src = imageSrc;
                                        // Update active thumbnail
                                        document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
                                        thumbnail.classList.add('active');
                                    });
                                    thumbnailsContainer.appendChild(thumbnail);
                                });
                            }
                        } else {
                            imgElement.style.backgroundColor = '#ffffff';
                            imgElement.alt = 'Image coming soon';
                        }


                        // Handle Datasheet Button
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

                        // Populate Features (if available)
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
                            // Default features if none specified
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
                        // Product not found
                        document.querySelector('.product-detail-container').innerHTML = '<h2 class="text-center">Product Not Found</h2><p class="text-center"><a href="products.html" class="text-gold">Return to Collection</a></p>';
                    }
                })
                .catch(error => {
                    console.error('Error loading product details:', error);
                    document.querySelector('.product-detail-container').innerHTML = '<h2 class="text-center">Error Loading Product</h2><p class="text-center"><a href="products.html" class="text-gold">Return to Collection</a></p>';
                });
        } else {
            // No product ID provided
            document.querySelector('.product-detail-container').innerHTML = '<h2 class="text-center">Product Not Found</h2><p class="text-center"><a href="products.html" class="text-gold">Return to Collection</a></p>';
        }
    }
});
