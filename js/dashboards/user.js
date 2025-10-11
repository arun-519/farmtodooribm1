import { auth } from '../auth.js';
import { getData, saveData } from '../data.js';
import { formatCurrency, formatDate, showNotification, debounce, cart, getAvatarUrl, validatePhoneNumber, addPhoneValidationFeedback } from '../utils.js';



// ==== Email & Receipt Integration (Frontend-only) ====
// Dynamically load external libraries if missing
const __extLibs = {
  emailjs: "https://cdn.jsdelivr.net/npm/emailjs-com@3/dist/email.min.js",
  jspdf: "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js"
};

function __loadScriptOnce(url) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${url}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = url; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load " + url));
    document.head.appendChild(s);
  });
}

// Load libs and init EmailJS
(async () => {
  try {
    await __loadScriptOnce(__extLibs.jspdf);
    await __loadScriptOnce(__extLibs.emailjs);
    if (window.emailjs && !window.__emailjs_inited) {
      // TODO: Replace the public key below with your EmailJS Public Key
      emailjs.init("XI8Nf2uR4-Sln9Biv");
      window.__emailjs_inited = true;
      console.log("[EmailJS] initialized");
    }
  } catch (e) {
    console.warn("[Init] External libs failed to load:", e);
  }
})();

/**
 * Sends the "order placed" email with required fields.
 */
function sendOrderEmail(order) {
  try {
    if (!window.emailjs) return console.warn("EmailJS not loaded; skipping sendOrderEmail");
    const templateParams = {
      order_id: order.id,
      customer_name: order.userName,
      product_name: (order.items || []).map(i => i.name).join(", "),
      order_date: order.orderDate,
      amount: (order.orderSummary ? order.orderSummary.total : order.total) || 0,
      company_name: "https://i.postimg.cc/02j6bY5h/Farm-To-Door.jpg"
    };
    // TODO: Replace with your EmailJS Service and Template IDs
    emailjs.send("service_26cznhm", "template_pwu0cov", templateParams)
      .then(() => console.log("✅ Order email sent for #", order.id))
      .catch(err => console.error("❌ sendOrderEmail failed:", err));
  } catch (e) {
    console.error("sendOrderEmail error:", e);
  }
}

/**
 * Generates a PDF receipt and sends a delivery email when order is delivered.
 */
function handleDelivered(order) {
  try {
    if (window.jspdf && window.jspdf.jsPDF) {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });

      // Page margins and starting positions
      const leftMargin = 40;
      let y = 40;

      // ================== HEADER ==================
      // Logo + Title inline (emoji removed for PDF font compatibility)
      doc.setFontSize(22);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(46, 125, 50); // greenish
      doc.text("Farm to Door", 20, 35);
      doc.setTextColor(0, 0, 0);

      y += 40;

      // Receipt metadata: number & date
      doc.setFontSize(11);
      doc.text(`Receipt number: ${order.id}`, leftMargin, y);
      // Format order date as DD-MM-YYYY
      const orderDate = new Date(order.orderDate);
      const formattedDate = `${String(orderDate.getDate()).padStart(2, '0')}-${String(orderDate.getMonth() + 1).padStart(2, '0')}-${orderDate.getFullYear()}`;
      doc.text(`Date of purchase: ${formattedDate}`, 360, y);

      y += 30;

      // Company & Bill To blocks
      doc.setFontSize(12);
      doc.setFont(undefined, 'bold');
      doc.text("Farm to Door", leftMargin, y);
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      doc.text("Your FarmFresh local marketplace", leftMargin, y + 14);
      doc.text("support@farmtodoor.example", leftMargin, y + 28);

      // Bill to (customer)
      doc.setFont(undefined, 'bold');
      doc.text("Bill To", 360, y);
      doc.setFont(undefined, 'normal');
      doc.text(order.userName || "-", 360, y + 14);
      doc.text(order.deliveryAddress || "-", 360, y + 28);

      y += 50;

      // ================== TABLE HEADER ==================
      const tableLeft = leftMargin;
      const col1 = tableLeft + 6;   // Item
      const colQty = tableLeft + 320; // Qty
      const colUnit = tableLeft + 380; // Unit Price
      const colTotal = tableLeft + 480; // Total

      doc.setFillColor(240, 215, 110);
      doc.rect(tableLeft, y - 12, 520, 24, 'F');
      doc.setDrawColor(0);
      doc.rect(tableLeft, y - 12, 520, 24);

      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text("Item", col1, y + 4);
      doc.text("Quantity", colQty, y + 4);
      doc.text("Unit Price", colUnit, y + 4);
      doc.text("Total", colTotal, y + 4);

      // ================== TABLE ROWS ==================
      y += 22;
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);

      const items = order.items || [];
      if (items.length === 0) {
        doc.text("- nothing purchased -", col1, y + 18);
        y += 26;
      } else {
        items.forEach((item) => {
          const name = item.name || "";
          const qty = item.quantity || 1;
          const unit = item.price != null ? Number(item.price) : 0;
          const lineTotal = qty * unit;

          const splitName = doc.splitTextToSize(name, 290);
          doc.text(splitName, col1, y + 12);

          doc.text(String(qty).padStart(2, '0'), colQty, y + 12);
          doc.text(`Rs ${unit.toFixed(2)}`, colUnit, y + 12);
          doc.text(`Rs ${lineTotal.toFixed(2)}`, colTotal, y + 12);

          y += (splitName.length * 12) + 10;
          if (y > 720) {
            doc.addPage();
            y = 40;
          }
        });
      }

      // ================== SUMMARY ==================
      y += 10;
      const summaryX = colTotal;
      const summaryLabelX = colUnit - 20;

      const subtotal = (order.orderSummary && order.orderSummary.subtotal) ||
        (items.reduce((s, it) => s + ((it.price || 0) * (it.quantity || 1)), 0));
      const tax = (order.orderSummary && order.orderSummary.tax) ||
        +(subtotal * 0.08).toFixed(2);
      const deliveryFee = (order.orderSummary && order.orderSummary.deliveryFee) != null
        ? order.orderSummary.deliveryFee : 2.99;
      const total = (order.orderSummary && order.orderSummary.total) ||
        (subtotal + tax + deliveryFee);

      // Line before subtotal
      doc.setLineWidth(0.5);
      doc.line(tableLeft, y + 5, tableLeft + 520, y + 5);

      doc.setFontSize(11);
      doc.setFont(undefined, 'normal');
      doc.text("Subtotal:", summaryLabelX, y + 20);
      doc.text(`Rs ${subtotal.toFixed(2)}`, summaryX, y + 20, { align: 'right' });

      doc.text("Tax:", summaryLabelX, y + 36);
      doc.text(`Rs ${tax.toFixed(2)}`, summaryX, y + 36, { align: 'right' });

      doc.text("Delivery Fee:", summaryLabelX, y + 52);
      doc.text(`Rs ${deliveryFee.toFixed(2)}`, summaryX, y + 52, { align: 'right' });

      // Line before total
      doc.line(tableLeft, y + 60, tableLeft + 520, y + 60);

      doc.setFont(undefined, 'bold');
      doc.setFontSize(12);
      doc.text("TOTAL:", summaryLabelX, y + 78);
      doc.text(`Rs ${total.toFixed(2)}`, summaryX, y + 78, { align: 'right' });

      // ================== FOOTER ==================
      doc.setFont(undefined, 'normal');
      doc.setFontSize(11);
      doc.text("Thank you for Shopping with Farm to Door", 300, 780, { align: 'center' });
      doc.text("If you have questions, contact support@farmtodoor.example", 300, 795, { align: 'center' });

      // Save the PDF
      try {
        doc.save(`Receipt_${order.id}.pdf`);
        console.log(`✅ PDF receipt generated and downloaded for order #${order.id}`);
      } catch (saveError) {
        console.error("❌ Failed to save PDF:", saveError);
        throw saveError;
      }
    } else {
      console.warn("jsPDF not loaded; skipping PDF generation");
      throw new Error("PDF generation library not available");
    }


    if (window.emailjs) {
      const templateParams = {
        order_id: order.id,
        customer_name: order.userName,
        product_name: (order.items || []).map(i => i.name).join(", "),
        order_date: order.orderDate,
        amount: (order.orderSummary ? order.orderSummary.total : order.total) || 0,
        company_name: "🌾 Farm to Door"
      };
      emailjs.send("service_26cznhm", "template_pwu0cov", templateParams)
        .then(() => console.log("✅ Delivery email sent for #", order.id))
        .catch(err => console.error("❌ Delivery email failed:", err));
    } else {
      console.warn("EmailJS not loaded; skipping delivery email");
    }
  } catch (e) {
    console.error("handleDelivered error:", e);
  }
}

export const userDashboard = {
  menuItems: [
    { id: 'browse-products', label: '🛒 Browse Products', active: true },
    { id: 'my-orders', label: '📦 My Orders' },
    { id: 'profile', label: '👤 Profile' }
  ],

  init() {
    this.renderMenu();
    this.showBrowseProducts();
  },

  renderMenu() {
    const sidebar = document.querySelector('.sidebar-content');
    sidebar.innerHTML = this.menuItems.map(item => `
      <button class="menu-item ${item.active ? 'active' : ''}" data-section="${item.id}">
        ${item.label}
      </button>
    `).join('');

    // Add event listeners
    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        document.querySelectorAll('.menu-item').forEach(mi => mi.classList.remove('active'));
        e.target.classList.add('active');
        
        const section = e.target.dataset.section;
        switch(section) {
          case 'browse-products': this.showBrowseProducts(); break;
          case 'my-orders': this.showMyOrders(); break;
          case 'profile': this.showProfile(); break;
        }
      });
    });
  },

  showBrowseProducts() {
    const data = getData();
    const products = data.products;
    
    const content = `
      <div class="section-header">
        <h2 class="section-title">Fresh Products</h2>
      </div>
      
      <div class="search-filters">
        <div class="search-row">
          <div class="search-group">
            <label>Search Products</label>
            <input type="text" id="product-search" placeholder="Search for products...">
          </div>
          <div class="search-group">
            <label>Category</label>
            <select id="category-filter">
              <option value="">All Categories</option>
              <option value="vegetables">Vegetables</option>
              <option value="fruits">Fruits</option>
              <option value="dairy">Dairy</option>
            </select>
          </div>
          <div class="search-group">
            <label>Filter</label>
            <select id="organic-filter">
              <option value="">All Products</option>
              <option value="organic">Organic Only</option>
            </select>
          </div>
        </div>
      </div>
      
      <div class="product-grid" id="product-grid">
        ${this.renderProducts(products)}
      </div>
    `;
    
    document.getElementById('dashboard-content').innerHTML = content;
    
    // Add search functionality
    const searchInput = document.getElementById('product-search');
    const categoryFilter = document.getElementById('category-filter');
    const organicFilter = document.getElementById('organic-filter');
    
    const filterProducts = debounce(() => {
      const searchTerm = searchInput.value.toLowerCase();
      const category = categoryFilter.value;
      const organic = organicFilter.value;
      
      let filtered = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                            product.description.toLowerCase().includes(searchTerm);
        const matchesCategory = !category || product.category === category;
        const matchesOrganic = !organic || (organic === 'organic' && product.isOrganic);
        
        return matchesSearch && matchesCategory && matchesOrganic;
      });
      
      document.getElementById('product-grid').innerHTML = this.renderProducts(filtered);
    }, 300);
    
    searchInput.addEventListener('input', filterProducts);
    categoryFilter.addEventListener('change', filterProducts);
    organicFilter.addEventListener('change', filterProducts);
  },

  renderProducts(products) {
    if (products.length === 0) {
      return '<div class="empty-state"><h3>No products found</h3><p>Try adjusting your search or filters</p></div>';
    }
    
    return products.map(product => `
      <div class="product-card">
        <div class="product-image">
          <img src="${product.image}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
          <div style="display: none; width: 100%; height: 100%; align-items: center; justify-content: center; font-size: 3rem; background: linear-gradient(45deg, var(--primary-color), var(--secondary-color)); color: white;">🌱</div>
        </div>
        <div class="product-info">
          <h3 class="product-name">${product.name}</h3>
          ${product.totalRatings ? `<div style="margin: 0.25rem 0; color: var(--text-secondary); font-size: 0.9rem;">${'⭐'.repeat(Math.round(product.rating || 0))} ${(product.rating || 0).toFixed(1)} <small>(${product.totalRatings})</small></div>` : ''}
          <p class="product-description">${product.description}</p>
          <div style="margin-bottom: 1rem;">
            <small style="color: var(--text-secondary);">By ${product.farmerName}</small>
            ${product.isOrganic ? '<span class="badge badge-success">Organic</span>' : ''}
            <div style="margin-top: 0.5rem;">
              <small style="color: var(--text-secondary);">Stock: ${product.stock} available</small>
            </div>
          </div>
          <div class="product-footer">
            <div>
              <span class="product-price">${formatCurrency(product.price)}</span>
              <small style="color: var(--text-secondary);"> ${product.unit}</small>
            </div>
            <div class="product-actions">
              <button class="btn-primary btn-sm" onclick="userDashboard.orderProduct(${product.id})">Order Now</button>
            </div>
          </div>
        </div>
      </div>
    `).join('');
  },

  showMyOrders() {
    const data = getData();
    const currentUser = auth.getCurrentUser();
    const userOrders = data.orders.filter(order => order.userId === currentUser.id);
    
    const content = `
      <div class="section-header">
        <h2 class="section-title">My Orders</h2>
      </div>
      
      ${userOrders.length === 0 ? 
        '<div class="empty-state"><h3>No orders yet</h3><p>Start shopping to see your orders here</p></div>' :
        userOrders.map(order => `
          <div class="order-card">
            <div class="order-header">
              <div>
                <div class="order-id">Order #${order.id}</div>
                <div class="order-date">Placed on ${formatDate(order.orderDate)}</div>
                <div style="color: var(--text-secondary); font-size: 0.9rem;">From ${order.farmerName}</div>
              </div>
              <span class="badge badge-${order.status === 'delivered' ? 'success' : order.status === 'processing' ? 'warning' : 'primary'}">
                ${order.status.toUpperCase()}
              </span>
            </div>
            <div class="order-items">
              ${order.items.map(item => `
                <div class="order-item" style="flex-direction: column; align-items: stretch; gap: 0.25rem;">
                  <div style="display:flex; justify-content: space-between;">
                    <span>${item.name} (x${item.quantity})</span>
                    <span>${formatCurrency(item.price * item.quantity)}</span>
                  </div>
                  ${order.status === 'delivered' ? `
                    ${item.productRating ? `
                      <div style="color: var(--text-secondary);">
                        Your product rating: ${'⭐'.repeat(item.productRating.rating)} (${item.productRating.rating}/5)
                        ${item.productRating.comment ? `<div style=\"font-style: italic;\">\"${item.productRating.comment}\"</div>` : ''}
                      </div>
                    ` : `
                      <div class="rating-section" style="display:flex; gap:0.5rem; align-items:center;">
                        <label for="product-rating-${order.id}-${item.productId}">Rate product:</label>
                        <select id="product-rating-${order.id}-${item.productId}" style="padding:0.25rem;">
                          ${[1,2,3,4,5].map(r => `<option value=\"${r}\">${r}</option>`).join('')}
                        </select>
                        <input type="text" id="product-rating-comment-${order.id}-${item.productId}" placeholder="Optional comment" style="flex:1; min-width: 120px; padding: 0.25rem; border: 1px solid var(--border-color); border-radius: 4px;">
                        <button class="btn-primary btn-sm" onclick="userDashboard.submitProductRating(${order.id}, ${item.productId})">Submit</button>
                      </div>
                    `}
                  ` : ''}
                </div>
              `).join('')}
            </div>
            ${order.orderSummary ? `
              <div class="order-summary" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                <div class="order-item">
                  <span>Subtotal:</span>
                  <span>${formatCurrency(order.orderSummary.subtotal)}</span>
                </div>
                <div class="order-item">
                  <span>Tax (8%):</span>
                  <span>${formatCurrency(order.orderSummary.tax)}</span>
                </div>
                <div class="order-item">
                  <span>Delivery Fee:</span>
                  <span>${formatCurrency(order.orderSummary.deliveryFee)}</span>
                </div>
              </div>
            ` : ''}
            <div class="order-total">
              <span>Total: ${formatCurrency(order.orderSummary ? order.orderSummary.total : order.total)}</span>
            </div>
            ${order.status === 'delivered' ? `
  <div style="margin-top: 1rem;">
    <button class="btn-secondary btn-sm" onclick="userDashboard.downloadReceipt(${order.id})">
      📄 Download Receipt
    </button>
  </div>
` : ''}

            <div style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
              <div>Delivery Address: ${order.deliveryAddress}</div>
              <div>Expected Delivery: ${formatDate(order.deliveryDate)}</div>
            </div>
            ${order.status === 'delivered' && !order.farmerRating ? `
              <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                <h4>Rate your experience with ${order.farmerName}</h4>
                <div class="rating-section">
                  <div class="star-rating" data-order-id="${order.id}">
                    ${[1,2,3,4,5].map(star => `<span class="star" data-rating="${star}">⭐</span>`).join('')}
                  </div>
                  <textarea id="rating-comment-${order.id}" placeholder="Share your experience..." style="width: 100%; margin-top: 0.5rem; padding: 0.5rem; border: 1px solid var(--border-color); border-radius: 4px;"></textarea>
                  <button class="btn-primary btn-sm" onclick="userDashboard.submitRating(${order.id}, ${order.farmerId})" style="margin-top: 0.5rem;">Submit Rating</button>
                </div>
              </div>
            ` : order.farmerRating ? `
              <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                <div>Your rating: ${'⭐'.repeat(order.farmerRating.rating)} (${order.farmerRating.rating}/5)</div>
                ${order.farmerRating.comment ? `<div style="font-style: italic; color: var(--text-secondary);">"${order.farmerRating.comment}"</div>` : ''}
              </div>
            ` : ''}
          </div>
        `).join('')
      }
    `;
    
    document.getElementById('dashboard-content').innerHTML = content;
    
    // Add star rating functionality
    document.querySelectorAll('.star-rating').forEach(rating => {
      const stars = rating.querySelectorAll('.star');
      stars.forEach((star, index) => {
        star.addEventListener('click', () => {
          const ratingValue = index + 1;
          rating.dataset.selectedRating = ratingValue;
          stars.forEach((s, i) => {
            s.style.opacity = i < ratingValue ? '1' : '0.3';
          });
        });
      });
    });


  },

  submitRating(orderId, farmerId) {
    const ratingElement = document.querySelector(`[data-order-id="${orderId}"]`);
    const rating = parseInt(ratingElement.dataset.selectedRating);
    const comment = document.getElementById(`rating-comment-${orderId}`).value;
    
    if (!rating) {
      showNotification('Please select a rating', 'error');
      return;
    }
    
    const data = getData();
    const order = data.orders.find(o => o.id === orderId);
    const farmer = data.users.find(u => u.id === farmerId);
    
    if (order && farmer) {
      // Update order with rating
      order.farmerRating = {
        rating: rating,
        comment: comment,
        date: new Date().toISOString()
      };
      
      // Update farmer's ratings array
      if (!farmer.ratings) farmer.ratings = [];
      farmer.ratings.push({
        userId: auth.getCurrentUser().id,
        userName: auth.getCurrentUser().name,
        rating: rating,
        comment: comment,
        date: new Date().toISOString(),
        orderId: orderId
      });
      
      // Recalculate farmer's average rating
      const totalRating = farmer.ratings.reduce((sum, r) => sum + r.rating, 0);
      farmer.rating = totalRating / farmer.ratings.length;
      farmer.totalRatings = farmer.ratings.length;
      
      saveData(data);
      showNotification('Rating submitted successfully!');
      this.showMyOrders();
    }
  },

  submitProductRating(orderId, productId) {
    const data = getData();
    const order = data.orders.find(o => o.id === orderId);
    const product = data.products.find(p => p.id === productId);
    if (!order || !product) {
      showNotification('Unable to rate product right now', 'error');
      return;
    }
    // Read UI values
    const ratingSelect = document.getElementById(`product-rating-${orderId}-${productId}`);
    const commentInput = document.getElementById(`product-rating-comment-${orderId}-${productId}`);
    const rating = parseInt(ratingSelect && ratingSelect.value, 10);
    const comment = (commentInput && commentInput.value || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      showNotification('Please select a valid rating (1-5)', 'error');
      return;
    }

    // Ensure product ratings array
    if (!Array.isArray(product.ratings)) product.ratings = [];
    product.ratings.push({
      userId: auth.getCurrentUser().id,
      userName: auth.getCurrentUser().name,
      rating,
      comment,
      date: new Date().toISOString(),
      orderId
    });

    // Recalculate averages
    const total = product.ratings.reduce((s, r) => s + (r.rating || 0), 0);
    product.totalRatings = product.ratings.length;
    product.rating = product.totalRatings > 0 ? total / product.totalRatings : 0;
    // Once real ratings exist, clear mock flag
    if (product.totalRatings > 0 && product.ratingMocked) delete product.ratingMocked;

    // Mark order item as rated
    const item = (order.items || []).find(i => i.productId === productId);
    if (item) {
      item.productRating = { rating, comment, date: new Date().toISOString() };
    }

    saveData(data);
    showNotification('Thanks for rating this product!');
    this.showMyOrders();
  },

  downloadReceipt(orderId) {
    try {
      const data = getData();
      const order = data.orders.find(o => o.id === orderId);
      if (!order) {
        showNotification('Order not found', 'error');
        return;
      }

      // Same constraints as auto download
      if (order.status !== 'delivered') {
        showNotification('Receipt available only for delivered orders', 'warning');
        return;
      }

      // Check if jsPDF is loaded
      if (!window.jspdf || !window.jspdf.jsPDF) {
        showNotification('PDF generation library not loaded. Please refresh the page and try again.', 'error');
        return;
      }

      // Generate and download PDF
      handleDelivered(order);
      
      // Mark receipt as downloaded
      order.receiptSent = true;
      saveData(data);

      showNotification('Receipt downloaded successfully!');
    } catch (e) {
      console.error('downloadReceipt error:', e);
      showNotification('Failed to download receipt. Please try again.', 'error');
    }
  },

  showProfile() {
    const user = auth.getCurrentUser();
    
    const content = `
      <div class="section-header">
        <h2 class="section-title">My Profile</h2>
      </div>
      
      <div class="card">
        <form id="profile-form">
          <div style="display:flex; align-items:center; gap:1rem; margin-bottom:1rem;">
            <img src="${getAvatarUrl(user.name, user.photo)}" alt="${user.name}" style="width:64px; height:64px; border-radius:50%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
            <span style="display:none; font-size:2rem;">👤</span>
            <div>
              <div class="form-group" style="margin:0;">
                <label for="profile-photo-url">Profile Photo URL</label>
                <input type="url" id="profile-photo-url" placeholder="https://..." value="${user.photo || ''}">
              </div>
              <div class="form-group" style="margin:0.5rem 0 0;">
                <label for="profile-photo-file">Or upload a photo</label>
                <input type="file" id="profile-photo-file" accept="image/*">
                <small style="display:block; color: var(--text-secondary);">We’ll host it via imgbb.</small>
              </div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="profile-name">Full Name</label>
              <input type="text" id="profile-name" value="${user.name}" required>
            </div>
            <div class="form-group">
              <label for="profile-email">Email</label>
              <input type="email" id="profile-email" value="${user.email}" required>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="profile-phone">Phone</label>
              <input type="tel" id="profile-phone" value="${user.phone || ''}">
            </div>
            <div class="form-group">
              <label for="profile-address">Address *</label>
              <input type="text" id="profile-address" value="${user.address || ''}" required placeholder="Required for order delivery">
            </div>
          </div>
          <button type="submit" class="btn-primary">Update Profile</button>
        </form>
      </div>
    `;
    
    document.getElementById('dashboard-content').innerHTML = content;
    
    document.getElementById('profile-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = getData();
      const current = auth.getCurrentUser();
      const user = data.users.find(u => u.id === current.id);
      if (!user) return;

      // Handle photo: prioritize file upload, else use URL field
      const fileInput = document.getElementById('profile-photo-file');
      const urlInput = document.getElementById('profile-photo-url');
      let photoUrl = (urlInput && urlInput.value.trim()) || '';

      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('key', 'b590e39f72f27957f19dd8ec98577cfc');
        formData.append('image', file);
        try {
          const res = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
          const result = await res.json();
          if (result && result.data && result.data.url) {
            photoUrl = result.data.url;
          } else {
            showNotification('Image upload failed — using provided URL if any', 'warning');
          }
        } catch (err) {
          console.error('Profile image upload failed:', err);
          showNotification('Image upload failed — using provided URL if any', 'warning');
        }
      }

      // Validate phone number if provided
      const phoneValue = document.getElementById('profile-phone').value.trim();
      if (phoneValue) {
        const phoneValidation = validatePhoneNumber(phoneValue);
        if (!phoneValidation.isValid) {
          showNotification(phoneValidation.error, 'error');
          return;
        }
        user.phone = phoneValidation.formatted;
      } else {
        user.phone = '';
      }

      user.name = document.getElementById('profile-name').value;
      user.email = document.getElementById('profile-email').value;
      user.address = document.getElementById('profile-address').value;
      if (photoUrl) user.photo = photoUrl;
      saveData(data);

      // Update current user in auth
      auth.currentUser = user;
      localStorage.setItem('currentUser', JSON.stringify(user));

      // Update user name display
      const userNameEl = document.getElementById('user-name');
      if (userNameEl) userNameEl.textContent = user.name;

      showNotification('Profile updated successfully');
      // Re-render to refresh avatar preview
      userDashboard.showProfile();
    });

    // Add real-time phone validation
    addPhoneValidationFeedback('profile-phone');
  },

  orderProduct(productId) {
    const data = getData();
    const product = data.products.find(p => p.id === productId);
    const user = auth.getCurrentUser();
    
    if (!product) {
      showNotification('Product not found', 'error');
      return;
    }
    
    if (product.stock <= 0) {
      showNotification('Product is out of stock', 'error');
      return;
    }
    
    this.showOrderForm(product, user);
  },
  
  showOrderForm(product, user) {
    const subtotal = product.price;
    const tax = subtotal * 0.08;
    const deliveryFee = 2.99;
    const total = subtotal + tax + deliveryFee;

    const content = `
      <div class="section-header">
        <h2 class="section-title">Place Order</h2>
        <button class="btn-secondary" onclick="userDashboard.showBrowseProducts()">Back to Products</button>
      </div>
      
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Product Details</h3>
          </div>
          <div class="card-content">
            <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem;">
              <img src="${product.image}" alt="${product.name}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
              <span style="display: none; font-size: 3rem;">🌱</span>
              <div>
                <h4>${product.name}</h4>
                <p style="color: var(--text-secondary); margin: 0;">${product.description}</p>
                <small style="color: var(--text-secondary);">By ${product.farmerName}</small>
              </div>
            </div>
            <div class="form-group">
              <label for="order-quantity">Quantity</label>
              <input type="number" id="order-quantity" value="1" min="1" max="${product.stock}" required>
              <small style="color: var(--text-secondary);">Available: ${product.stock} ${product.unit}</small>
            </div>
            <div style="margin-top: 1rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span>Price per unit:</span>
                <span>${formatCurrency(product.price)} ${product.unit}</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem;">
                <span>Total:</span>
                <span id="order-total">${formatCurrency(product.price)}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Delivery Address</h3>
          </div>
          <div class="card-content">
            <div class="form-group">
              <label for="delivery-address">Address</label>
              <textarea id="delivery-address" rows="3" required>${user.address || ''}</textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="delivery-phone">Phone</label>
                <input type="tel" id="delivery-phone" value="${user.phone || ''}" required>
              </div>
              <div class="form-group">
                <label for="delivery-name">Contact Name</label>
                <input type="text" id="delivery-name" value="${user.name}" required>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Order Summary & Payment</h3>
        </div>
        <div class="card-content">
          <div class="summary-breakdown">
            <div class="breakdown-row">
              <span>Subtotal:</span>
              <span id="summary-subtotal">${formatCurrency(subtotal)}</span>
            </div>
            <div class="breakdown-row">
              <span>Tax (8%):</span>
              <span id="summary-tax">${formatCurrency(tax)}</span>
            </div>
            <div class="breakdown-row">
              <span>Delivery Fee:</span>
              <span id="summary-delivery">${formatCurrency(deliveryFee)}</span>
            </div>
            <div class="breakdown-row total-row">
              <span><strong>Total Amount:</strong></span>
              <span><strong id="summary-total">${formatCurrency(total)}</strong></span>
            </div>
          </div>
          
          <div style="margin-top: 2rem;">
            <h4>Payment Method</h4>
            <div style="display: flex; gap: 1rem; margin-top: 1rem;">
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="radio" name="payment-method" value="cod" checked>
                <span>💵 Cash on Delivery (COD)</span>
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="radio" name="payment-method" value="upi">
                <span>📱 UPI Payment</span>
              </label>
            </div>

            <!-- UPI Section -->
<div id="upi-section" style="display:none; margin-top: 1rem; padding: 1rem; border: 1px solid var(--border-color); border-radius: 8px;">
  <p>Scan this QR or enter your UPI ID:</p>
  <img id="upi-qr" alt="UPI QR" style="width:150px; height:150px; display:block; margin-bottom:1rem;">
  <input type="text" id="upi-id" placeholder="Enter your UPI ID" style="width:100%; padding:0.5rem; margin-bottom:1rem;">
  <button class="btn-primary btn-sm" id="pay-upi">Pay Now</button>
</div>

          </div>
          
          <div style="margin-top: 2rem;">
            <button class="btn-primary" onclick="userDashboard.confirmOrder(${product.id})" style="margin-right: 1rem;">
              Place Order
            </button>
            <button class="btn-secondary" onclick="userDashboard.showBrowseProducts()">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('dashboard-content').innerHTML = content;
    
    // Add quantity change listener
    document.getElementById('order-quantity').addEventListener('input', (e) => {
      let quantity = parseInt(e.target.value, 10);
      const maxQty = parseInt(String(product.stock), 10) || 0;
      if (isNaN(quantity) || quantity < 1) quantity = 1;
      if (maxQty > 0 && quantity > maxQty) quantity = maxQty;
      e.target.value = quantity;
      const subtotal = product.price * quantity;
      const tax = subtotal * 0.08;
      const deliveryFee = 2.99;
      const total = subtotal + tax + deliveryFee;
      
      document.getElementById('order-total').textContent = formatCurrency(subtotal);
      document.getElementById('summary-subtotal').textContent = formatCurrency(subtotal);
      document.getElementById('summary-tax').textContent = formatCurrency(tax);
      document.getElementById('summary-total').textContent = formatCurrency(total);
    });

    // Show/Hide UPI section
    document.querySelectorAll('input[name="payment-method"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const upiSection = document.getElementById('upi-section');
        if (e.target.value === 'upi') {
          upiSection.style.display = 'block';

          // Generate dynamic QR
          const quantity = parseInt(document.getElementById('order-quantity').value) || 1;
          const subtotal = product.price * quantity;
          const tax = subtotal * 0.08;
          const deliveryFee = 2.99;
          const total = subtotal + tax + deliveryFee;

          const payeeUpi = "arunselvam519@okaxis";  // ⚡ replace with your UPI ID
          const payeeName = "Farm to Door";
          const transactionNote = "Farm Order Payment";
          const upiString = `upi://pay?pa=${payeeUpi}&pn=${encodeURIComponent(payeeName)}&am=${total}&cu=INR&tn=${encodeURIComponent(transactionNote)}`;
          const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`;

          document.getElementById('upi-qr').src = qrApiUrl;
        } else {
          upiSection.style.display = 'none';
        }
      });
    });

    // Handle UPI Pay Now
    document.getElementById('pay-upi').addEventListener('click', () => {
      const quantity = parseInt(document.getElementById('order-quantity').value) || 1;
      const subtotal = product.price * quantity;
      const tax = subtotal * 0.08;
      const deliveryFee = 2.99;
      const total = subtotal + tax + deliveryFee;

      const userUpiId = document.getElementById('upi-id').value.trim();
      const payeeUpi = "arunselvam519@okaxis"; // ⚡ replace with your UPI ID
      const payeeName = "Farm to Door";

      if (!userUpiId) {
        showNotification("Please enter your UPI ID", "error");
        return;
      }

      const upiLink = `upi://pay?pa=${payeeUpi}&pn=${encodeURIComponent(payeeName)}&am=${total}&cu=INR`;

      // Redirect to UPI app (works on mobile browsers)
      window.location.href = upiLink;
    });

  },

  confirmOrder(productId) {
    const data = getData();
    const product = data.products.find(p => p.id === productId);
    const user = auth.getCurrentUser();
    
    if (!product) {
      showNotification('Product not found', 'error');
      return;
    }
    
    const quantityRaw = document.getElementById('order-quantity').value;
    const quantity = parseInt(quantityRaw, 10);
    const deliveryAddress = document.getElementById('delivery-address').value.trim();
    const deliveryPhone = document.getElementById('delivery-phone').value.trim();
    const deliveryName = document.getElementById('delivery-name').value.trim();
    const paymentMethod = document.querySelector('input[name="payment-method"]:checked').value;
    
    if (!Number.isInteger(quantity) || quantity < 1) {
      showNotification('Enter a valid quantity (1 or more)', 'error');
      return;
    }
    if (!deliveryAddress || !deliveryPhone || !deliveryName) {
      showNotification('Please fill in all delivery details', 'error');
      return;
    }
    
    // Validate phone number
    const phoneValidation = validatePhoneNumber(deliveryPhone);
    if (!phoneValidation.isValid) {
      showNotification(phoneValidation.error, 'error');
      return;
    }
    
    if (quantity > product.stock) {
      showNotification('Insufficient stock available', 'error');
      return;
    }
    
    // Calculate order totals
    const subtotal = product.price * quantity;
    const tax = subtotal * 0.08;
    const deliveryFee = 2.99;
    const total = subtotal + tax + deliveryFee;
    
    // Update product stock
    product.stock -= quantity;
    
    // Create new order
    const maxExistingId = data.orders.length ? Math.max(...data.orders.map(o => Number(o.id || 0))) : 1000;
    const newOrderId = maxExistingId + 1;
    
    const newOrder = {
      id: newOrderId,
      userId: user.id,
      userName: deliveryName,
      farmerId: product.farmerId,
      farmerName: product.farmerName,
      status: 'pending',
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: [{
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: quantity
      }],
      deliveryAddress: deliveryAddress,
      deliveryPhone: phoneValidation.formatted,
      paymentMethod: paymentMethod,
      orderSummary: {
        subtotal: subtotal,
        tax: tax,
        deliveryFee: deliveryFee,
        total: total
      },
      total: total,
      farmerRating: null
    };
    
    data.orders.push(newOrder);
    saveData(data);
    
    // Update user profile with delivery details
    const userData = data.users.find(u => u.id === user.id);
    if (userData) {
      userData.address = deliveryAddress;
      userData.phone = phoneValidation.formatted;
      userData.name = deliveryName;
      saveData(data);
      
      // Update current user in auth
      auth.currentUser = userData;
      localStorage.setItem('currentUser', JSON.stringify(userData));
    }
    
    showNotification('Order placed successfully!');
    try { sendOrderEmail(newOrder); } catch(e){ console.error(e); }
    this.showOrderConfirmation(newOrder);
  },
  
  showOrderConfirmation(order) {
    const content = `
      <div class="section-header">
        <h2 class="section-title">Order Confirmed!</h2>
      </div>
      
      <div class="card">
        <div class="success-icon" style="text-align: center; font-size: 4rem; margin-bottom: 1rem;">🎉</div>
        <h3 style="text-align: center; color: var(--success-color); margin-bottom: 2rem;">
          Your order has been placed successfully!
        </h3>
        
        <div class="order-details">
          <div class="breakdown-row">
            <span><strong>Order Number:</strong></span>
            <span>#${order.id}</span>
          </div>
          <div class="breakdown-row">
            <span><strong>Total Amount:</strong></span>
            <span>${formatCurrency(order.orderSummary.total)}</span>
          </div>
          <div class="breakdown-row">
            <span><strong>Payment Method:</strong></span>
            <span>${order.paymentMethod === 'cod' ? '💵 Cash on Delivery' : '📱 UPI Payment'}</span>
          </div>
          <div class="breakdown-row">
            <span><strong>Expected Delivery:</strong></span>
            <span>${formatDate(order.deliveryDate)}</span>
          </div>
          <div class="breakdown-row">
            <span><strong>Delivery Address:</strong></span>
            <span>${order.deliveryAddress}</span>
          </div>
          <div class="breakdown-row">
            <span><strong>Contact:</strong></span>
            <span>${order.deliveryPhone}</span>
          </div>
        </div>
        
        <div style="background: var(--bg-secondary); padding: 1rem; border-radius: 8px; margin-top: 2rem;">
          <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">
            📧 You will receive order updates via notifications. 
            📱 The farmer will contact you for delivery coordination.
          </p>
        </div>
        
        <div style="margin-top: 2rem; text-align: center;">
          <button class="btn-primary" onclick="userDashboard.showMyOrders()" style="margin-right: 1rem;">
            View My Orders
          </button>
          <button class="btn-secondary" onclick="userDashboard.showBrowseProducts()">
            Continue Shopping
          </button>
        </div>
      </div>
    `;
    
    document.getElementById('dashboard-content').innerHTML = content;
  }
};

// Expose globally so inline onclick works
window.userDashboard = userDashboard;
