document.addEventListener('DOMContentLoaded', () => {
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

    // --- Product Detail Page Logic ---

    // Product Database
    const productsData = {
        'aurum-pendant': {
            name: 'Aurum Pendant',
            category: 'Indoor / Ceiling Lights',
            price: '$1,299',
            image: 'images/aurum-pendant.png',
            description: 'The Aurum Pendant is a masterpiece of minimalist design. Crafted from high-grade brushed gold and featuring a warm LED core, it creates a sophisticated ambiance in any modern living space. Perfect for dining areas or grand entryways.',
            features: [
                'Material: Brushed Gold Aluminum',
                'Light Source: Integrated Warm LED (3000K)',
                'Dimensions: 40cm x 40cm x 20cm',
                'Dimmable: Yes',
                'Warranty: 5 Years'
            ]
        },
        'noir-chandelier': {
            name: 'Noir Chandelier',
            category: 'Indoor / Ceiling Lights',
            price: '$2,499',
            image: 'images/noir-chandelier.png',
            description: 'Make a bold statement with the Noir Chandelier. Its matte black finish and crystal accents combine to offer a dramatic interplay of light and shadow. A true centerpiece for luxury interiors.',
            features: [
                'Material: Matte Black Steel & K9 Crystal',
                'Light Source: 8 x E12 Bulbs (Not Included)',
                'Dimensions: 80cm Diameter',
                'Style: Modern Industrial',
                'Assembly Required: Yes'
            ]
        },
        'lumina-lamp': {
            name: 'Lumina Floor Lamp',
            category: 'Indoor / Floor Lamps',
            price: '$899',
            image: 'images/lumina-lamp.png',
            description: 'Sleek, tall, and elegant, the Lumina Floor Lamp features an adjustable arm and a weighted base for stability. Its directed light is ideal for reading nooks or highlighting architectural details.',
            features: [
                'Material: Powder Coated Metal',
                'Adjustable Arm & Head',
                'Height: 160cm',
                'Switch: Foot Pedal',
                'Cord Length: 2m'
            ]
        },
        'eclipse-sconce': {
            name: 'Eclipse Wall Sconce',
            category: 'Indoor / Wall Lights',
            price: '$450',
            image: '', // Placeholder logic handled below if specific image missing
            description: 'Inspired by the celestial event, the Eclipse Wall Sconce provides soft, indirect lighting that washes the wall in a warm glow. Ideal for corridors and bedrooms.',
            features: [
                'Material: Brass & Frosted Glass',
                'Mounting: Hardwired',
                'Light Output: Ambient',
                'Diameter: 25cm'
            ]
        },
        'crystal-cascade': {
            name: 'Crystal Cascade',
            category: 'Indoor / Ceiling Lights',
            price: '$3,200',
            image: '',
            description: 'A waterfall of light. The Crystal Cascade features hundreds of hand-cut crystals suspended in a wave pattern, refracting light into a spectrum of colors.',
            features: [
                'Material: Chrome & Premium Crystal',
                'Customizable Length',
                'Light Source: LED Matrix',
                'Weight: 15kg'
            ]
        },
        'orbital-desk-lamp': {
            name: 'Orbital Desk Lamp',
            category: 'Decoratives / Table Lamps',
            price: '$350',
            image: '',
            description: 'Futuristic and functional. The Orbital Desk Lamp uses magnetic levitation technology to float the light source, creating a conversation piece for any executive desk.',
            features: [
                'Technology: Magnetic Levitation',
                'Charging: Wireless Base',
                'Control: Touch Sensor',
                'Finish: Space Grey'
            ]
        }
    };

    // Check if we are on the product detail page
    if (window.location.pathname.includes('product-detail.html')) {
        const urlParams = new URLSearchParams(window.location.search);
        const productId = urlParams.get('id');

        if (productId && productsData[productId]) {
            const product = productsData[productId];

            // Populate Data
            document.title = `${product.name} | Cuplighton`;
            document.getElementById('detail-category').textContent = product.category;
            document.getElementById('detail-name').textContent = product.name;
            document.getElementById('detail-title').textContent = product.name;
            document.getElementById('detail-price').textContent = product.price;
            document.getElementById('detail-description').textContent = product.description;

            // Image handling (fallback if specific image not defined in this demo)
            const imgElement = document.getElementById('detail-image');
            if (product.image) {
                imgElement.src = product.image;
            } else {
                // Placeholder for items without generated images
                imgElement.style.backgroundColor = '#1a1a1a';
                imgElement.alt = 'Image coming soon';
            }

            // Populate Features
            const featuresList = document.getElementById('detail-features');
            featuresList.innerHTML = ''; // Clear loading text
            product.features.forEach(feature => {
                const li = document.createElement('li');
                li.textContent = feature;
                li.style.marginBottom = '0.5rem';
                featuresList.appendChild(li);
            });
        } else {
            // Handle invalid ID
            document.querySelector('.product-detail-container').innerHTML = '<h2 class="text-center">Product Not Found</h2><p class="text-center"><a href="products.html" class="text-gold">Return to Collection</a></p>';
        }
    }
});
