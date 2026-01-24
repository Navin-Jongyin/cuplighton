#!/usr/bin/env node

/**
 * Product Data Validator
 * Validates product.json for common issues
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function validateProducts() {
    log('\n🔍 Validating Product Data...\n', 'cyan');

    let errors = 0;
    let warnings = 0;
    let totalProducts = 0;

    try {
        // Read product.json
        const productData = JSON.parse(fs.readFileSync('product.json', 'utf8'));

        // Validate structure
        if (!productData.categories) {
            log('❌ ERROR: Missing "categories" object in product.json', 'red');
            errors++;
            return;
        }

        // Iterate through all products
        Object.keys(productData.categories).forEach(categoryKey => {
            const category = productData.categories[categoryKey];

            Object.keys(category).forEach(subcategoryKey => {
                const products = category[subcategoryKey];

                if (!Array.isArray(products)) {
                    log(`❌ ERROR: ${categoryKey}/${subcategoryKey} is not an array`, 'red');
                    errors++;
                    return;
                }

                products.forEach((product, index) => {
                    totalProducts++;
                    const productId = `${categoryKey}/${subcategoryKey}/${product.name || index}`;

                    // Check required fields
                    if (!product.name) {
                        log(`❌ ERROR: Missing name for product at ${categoryKey}/${subcategoryKey}[${index}]`, 'red');
                        errors++;
                    }

                    if (!product.price) {
                        log(`⚠️  WARNING: Missing price for ${productId}`, 'yellow');
                        warnings++;
                    }

                    if (!product.image) {
                        log(`❌ ERROR: Missing image for ${productId}`, 'red');
                        errors++;
                    } else {
                        // Check if image file exists
                        if (!fs.existsSync(product.image)) {
                            log(`❌ ERROR: Image file not found: ${product.image} (${productId})`, 'red');
                            errors++;
                        }
                    }

                    // Check for images array
                    if (!product.images || product.images.length === 0) {
                        log(`⚠️  WARNING: No images array for ${productId}`, 'yellow');
                        warnings++;
                    } else {
                        // Validate each image in array
                        product.images.forEach((img, imgIndex) => {
                            if (!fs.existsSync(img)) {
                                log(`❌ ERROR: Image file not found: ${img} (${productId}, image ${imgIndex})`, 'red');
                                errors++;
                            }
                        });
                    }

                    // Check description
                    if (!product.description || product.description.trim() === '') {
                        log(`⚠️  WARNING: Empty description for ${productId}`, 'yellow');
                        warnings++;
                    }

                    // Check datasheet
                    if (product.datasheet) {
                        if (!fs.existsSync(product.datasheet)) {
                            log(`❌ ERROR: Datasheet file not found: ${product.datasheet} (${productId})`, 'red');
                            errors++;
                        }
                    } else {
                        log(`⚠️  WARNING: No datasheet for ${productId}`, 'yellow');
                        warnings++;
                    }
                });
            });
        });

        // Summary
        log('\n' + '='.repeat(50), 'blue');
        log('Validation Summary', 'cyan');
        log('='.repeat(50), 'blue');
        log(`Total Products: ${totalProducts}`, 'blue');
        log(`Errors: ${errors}`, errors > 0 ? 'red' : 'green');
        log(`Warnings: ${warnings}`, warnings > 0 ? 'yellow' : 'green');

        if (errors === 0 && warnings === 0) {
            log('\n✅ All validations passed!', 'green');
        } else if (errors === 0) {
            log('\n✅ No errors found, but there are warnings to review', 'yellow');
        } else {
            log('\n❌ Validation failed with errors', 'red');
            process.exit(1);
        }

    } catch (error) {
        log(`\n❌ FATAL ERROR: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    }
}

// Run validation
validateProducts();
