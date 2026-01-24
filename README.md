# Cuplighton - Premium Lighting E-Commerce

A modern, elegant e-commerce website for premium lighting solutions featuring a dark luxury theme with sophisticated animations and smooth user experience.

![Cuplighton Banner](images/Logo/logo.png)

## ✨ Features

### 🛍️ Product Catalog
- **Dynamic Product Loading**: Products loaded from JSON for easy management
- **Advanced Filtering**: Filter by category, subcategory, and price range
- **Real-time Search**: Instant product search with debouncing for optimal performance
- **Product Details**: Comprehensive product pages with image galleries and datasheets

### 🎨 Design & UX
- **Dark Luxury Theme**: Premium aesthetic with gold accents
- **Responsive Design**: Optimized for all devices (mobile, tablet, desktop)
- **Smooth Animations**: Glassmorphism effects and micro-interactions
- **Loading States**: Skeleton loaders for better perceived performance
- **Lazy Loading**: Images load on-demand for faster page loads

### 🚀 Performance
- **Optimized Images**: Lazy loading implementation
- **Debounced Search**: Prevents excessive re-renders
- **Efficient Filtering**: Client-side filtering for instant results
- **Clean Code**: Modular JavaScript with JSDoc documentation

### ♿ Accessibility
- **ARIA Labels**: Proper accessibility attributes
- **Keyboard Navigation**: Full keyboard support
- **Semantic HTML**: Proper HTML5 structure
- **Screen Reader Friendly**: Optimized for assistive technologies

## 📁 Project Structure

```
cuplighton/
├── index.html              # Homepage with featured products
├── products.html           # Product catalog with filtering
├── product-detail.html     # Individual product details
├── about.html             # About page
├── services.html          # Services page
├── contact.html           # Contact page
├── styles.css             # Main stylesheet
├── script.js              # JavaScript functionality
├── product.json           # Product database
├── Products/              # Product assets
│   ├── Images/           # Product images
│   └── Datasheet/        # Product datasheets (PDFs)
└── images/               # Site images and logo
```

## 🚀 Getting Started

### Prerequisites
- A modern web browser (Chrome, Firefox, Safari, Edge)
- A local web server (optional, but recommended)

### Installation

1. **Clone or download the repository**
   ```bash
   git clone <repository-url>
   cd cuplighton
   ```

2. **Serve the files**
   
   Using Python:
   ```bash
   # Python 3
   python -m http.server 8000
   
   # Python 2
   python -m SimpleHTTPServer 8000
   ```
   
   Using Node.js (with `http-server`):
   ```bash
   npx http-server -p 8000
   ```
   
   Using PHP:
   ```bash
   php -S localhost:8000
   ```

3. **Open in browser**
   Navigate to `http://localhost:8000`

## 📝 Product Management

### Adding New Products

Edit `product.json` to add new products. Follow this structure:

```json
{
  "name": "Product Name",
  "price": 1299,
  "image": "Products/Images/Category/Subcategory/ProductName/image.png",
  "images": [
    "Products/Images/Category/Subcategory/ProductName/image1.png",
    "Products/Images/Category/Subcategory/ProductName/image2.png"
  ],
  "description": "Product description here",
  "datasheet": "Products/Datasheet/Category/Subcategory/ProductName/datasheet.pdf"
}
```

### Product Categories

**Indoor:**
- Recessed
- Surface
- Pendant
- Chandelier
- Track Light

**Outdoor:**
- Wall
- Ceiling
- Ground
- Solar
- Underwater
- Bollard
- Flood Light
- Street Light

## 🎨 Customization

### Colors
Edit CSS variables in `styles.css`:

```css
:root {
    --bg-primary: #050505;
    --bg-secondary: #0f0f0f;
    --accent-gold: #d4af37;
    --text-primary: #ffffff;
    /* ... more variables */
}
```

### Typography
The site uses the **Outfit** font family from Google Fonts. To change:

```css
@import url('https://fonts.googleapis.com/css2?family=YourFont:wght@300;400;500;700&display=swap');
```

## 🔧 Key Features Explained

### Search Functionality
- Real-time search with 300ms debounce
- Searches product names
- Updates results count dynamically
- Preserves other active filters

### Price Range Filtering
- Under $500
- $500 - $1,000
- $1,000 - $2,500
- Above $2,500

### Loading States
- Skeleton loaders show while products load
- Smooth transitions when content appears
- Better perceived performance

### Image Gallery
- Multiple images per product
- Thumbnail navigation
- Click to change main image
- Lazy loading for performance

## 🌐 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 📱 Responsive Breakpoints

- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

## 🐛 Known Issues & Future Enhancements

### Planned Features
- [ ] Shopping cart functionality
- [ ] Product comparison
- [ ] User reviews and ratings
- [ ] Wishlist feature
- [ ] Advanced filtering (color, wattage, etc.)
- [ ] Product recommendations
- [ ] Newsletter signup
- [ ] Multi-language support

## 📄 License

© 2025 Cuplighton. All rights reserved.

## 🤝 Contributing

This is a private project. For any questions or suggestions, please contact the development team.

## 📞 Support

For technical support or inquiries, visit the contact page or reach out through the website's contact form.

---

**Built with ❤️ using vanilla HTML, CSS, and JavaScript**
