import { getData, saveData } from './data.js';
import { auth } from './auth.js';

// Utility functions
function getAvatarUrl(name, photoUrl) {
  const safePhoto = (photoUrl || '').trim();
  if (safePhoto) return safePhoto;
  const initials = encodeURIComponent((name || 'User').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase());
  // Fallback avatar using ui-avatars
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=16A34A&color=ffffff&bold=true`;
}

/**
 * Validates phone number for Indian mobile numbers
 * Supports formats: +91XXXXXXXXXX, 91XXXXXXXXXX, XXXXXXXXXX, +91-XXXXXXXXXX
 * @param {string} phone - Phone number to validate
 * @returns {object} - {isValid: boolean, formatted: string, error: string}
 */
function validatePhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') {
    return {
      isValid: false,
      formatted: '',
      error: 'Phone number is required'
    };
  }

  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Handle different input formats
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.substring(3); // Remove +91
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2); // Remove 91
  }

  // Validate length (should be 10 digits after cleaning)
  if (cleaned.length !== 10) {
    return {
      isValid: false,
      formatted: '',
      error: 'Phone number must be 10 digits'
    };
  }

  // Check if all characters are digits
  if (!/^\d{10}$/.test(cleaned)) {
    return {
      isValid: false,
      formatted: '',
      error: 'Phone number must contain only digits'
    };
  }

  // Check if it starts with valid Indian mobile prefixes
  const validPrefixes = ['6', '7', '8', '9'];
  if (!validPrefixes.includes(cleaned[0])) {
    return {
      isValid: false,
      formatted: '',
      error: 'Phone number must start with 6, 7, 8, or 9'
    };
  }

  // Format the phone number for display
  const formatted = `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;

  return {
    isValid: true,
    formatted: formatted,
    error: ''
  };
}
function formatCurrency(amount) {
  if (isNaN(amount)) return "₹0.00";
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
  }).format(amount);
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;

  // Add styles
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 1rem 1.5rem;
    border-radius: 8px;
    color: white;
    font-weight: 500;
    z-index: 1001;
    animation: slideInRight 0.3s;
    background: ${type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#F59E0B'};
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Remove expired products (18 hours after addition)
function removeExpiredProducts() {
  const data = getData() || {};
  if (!data.products || !Array.isArray(data.products)) return;

  const now = new Date();
  const eighteenHoursAgo = new Date(now.getTime() - (18 * 60 * 60 * 1000));

  const originalCount = data.products.length;
  data.products = data.products.filter(product => {
    const addedDate = new Date(product.addedDate || product.createdAt || Date.now());
    return addedDate > eighteenHoursAgo;
  });

  if (data.products.length < originalCount) {
    saveData(data);
    const removedCount = originalCount - data.products.length;
    console.log(`Removed ${removedCount} expired products`);
  }
}

// Check for low stock and send alerts
function checkLowStock() {
  const data = getData() || {};
  data.lowStockAlerts = data.lowStockAlerts || [];
  data.notifications = data.notifications || [];
  data.products = data.products || [];

  const lowStockProducts = data.products.filter(product =>
    product.stock <= (product.lowStockThreshold || 10)
  );

  lowStockProducts.forEach(product => {
    const alertId = `low-stock-${product.id}`;
    const existingAlert = data.lowStockAlerts.find(alert => alert.id === alertId);

    if (!existingAlert) {
      const alert = {
        id: alertId,
        productId: product.id,
        productName: product.name,
        farmerId: product.farmerId,
        farmerName: product.farmerName,
        currentStock: product.stock,
        threshold: product.lowStockThreshold || 10,
        date: new Date().toISOString(),
        message: `Low stock alert: ${product.name} has only ${product.stock} units remaining`
      };

      data.lowStockAlerts.push(alert);
      data.notifications.push({
        id: Date.now(),
        type: 'low-stock',
        message: alert.message,
        farmerId: product.farmerId,
        date: new Date().toISOString(),
        read: false
      });

      // Show immediate notification to farmer if they're logged in
      const currentUser = auth.getCurrentUser && auth.getCurrentUser();
      if (currentUser && currentUser.id === product.farmerId) {
        showNotification(`⚠️ Low Stock Alert: ${product.name} has only ${product.stock} units remaining`, 'warning');
      }
    }
  });

  saveData(data);
}

// Shopping cart functionality
class ShoppingCart {
  constructor() {
    this.items = [];
    this.loadCart();
  }

  addItem(product, quantity = 1) {
    const data = getData() || {};
    data.products = data.products || [];
    const currentProduct = data.products.find(p => p.id === product.id);

    if (!currentProduct || currentProduct.stock < quantity) {
      showNotification('Insufficient stock available', 'error');
      return false;
    }

    const existingItem = this.items.find(item => item.id === product.id);

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (currentProduct.stock < newQuantity) {
        showNotification('Insufficient stock available', 'error');
        return false;
      }
      existingItem.quantity = newQuantity;
    } else {
      this.items.push({
        id: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
        quantity: quantity,
        farmerId: product.farmerId,
        farmerName: product.farmerName
      });
    }

    this.saveCart();
    this.updateCartDisplay();
    showNotification(`${product.name} added to cart`);
    return true;
  }

  removeItem(productId) {
    this.items = this.items.filter(item => item.id !== productId);
    this.saveCart();
    this.updateCartDisplay();
  }

  updateQuantity(productId, quantity) {
    const item = this.items.find(item => item.id === productId);
    if (item) {
      if (quantity <= 0) {
        this.removeItem(productId);
      } else {
        const data = getData() || {};
        data.products = data.products || [];
        const product = data.products.find(p => p.id === productId);
        if (product && product.stock >= quantity) {
          item.quantity = quantity;
          this.saveCart();
          this.updateCartDisplay();
        } else {
          showNotification('Insufficient stock available', 'error');
        }
      }
    }
  }

  getTotal() {
    return this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  }

  getItemCount() {
    return this.items.reduce((count, item) => count + item.quantity, 0);
  }

  checkout() {
    if (this.items.length === 0) {
      showNotification('Your cart is empty', 'error');
      return false;
    }

    const data = getData() || {};
    data.products = data.products || [];
    const user = auth.getCurrentUser && auth.getCurrentUser();

    if (!user || !user.address) {
      showNotification('Please add your address in profile before checkout', 'error');
      return false;
    }

    // Check stock availability for all items
    for (let item of this.items) {
      const product = data.products.find(p => p.id === item.id);
      if (!product || product.stock < item.quantity) {
        showNotification(`Insufficient stock for ${item.name}`, 'error');
        return false;
      }
    }

    // Show purchase summary before confirming
    this.showPurchaseSummary(data, user);
    return false; // Don't complete checkout yet, wait for confirmation
  }

  showPurchaseSummary(data, user) {
    const subtotal = this.getTotal();
    const tax = subtotal * 0.08; // 8% tax
    const deliveryFee = 2.99;
    const total = subtotal + tax + deliveryFee;

    const summaryModal = document.createElement('div');
    summaryModal.className = 'modal active';
    summaryModal.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <h3>🛒 Purchase Summary</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="purchase-summary">
            <h4>Order Items:</h4>
            <div class="summary-items">
              ${this.items.map(item => `
                <div class="summary-item">
                  <div class="item-details">
                    <strong>${item.name}</strong>
                    <small style="color: var(--text-secondary); display: block;">From ${item.farmerName}</small>
                    <small>${formatCurrency(item.price)} ${item.unit} × ${item.quantity}</small>
                  </div>
                  <div class="item-total">
                    ${formatCurrency(item.price * item.quantity)}
                  </div>
                </div>
              `).join('')}
            </div>
            
            <div class="summary-breakdown">
              <div class="breakdown-row">
                <span>Subtotal:</span>
                <span>${formatCurrency(subtotal)}</span>
              </div>
              <div class="breakdown-row">
                <span>Tax (8%):</span>
                <span>${formatCurrency(tax)}</span>
              </div>
              <div class="breakdown-row">
                <span>Delivery Fee:</span>
                <span>${formatCurrency(deliveryFee)}</span>
              </div>
              <div class="breakdown-row total-row">
                <span><strong>Total:</strong></span>
                <span><strong>${formatCurrency(total)}</strong></span>
              </div>
            </div>
            
            <div class="delivery-info">
              <h4>Delivery Information:</h4>
              <p><strong>Address:</strong> ${user.address}</p>
              <p><strong>Phone:</strong> ${user.phone || 'Not provided'}</p>
              <p><strong>Expected Delivery:</strong> ${formatDate(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString())}</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" id="confirm-purchase-btn">
            Confirm Purchase
          </button>
          <button class="btn-secondary" id="cancel-purchase-btn">
            Cancel
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(summaryModal);

    // Attach event listeners safely
    const confirmBtn = document.getElementById('confirm-purchase-btn');
    const cancelBtn = document.getElementById('cancel-purchase-btn');

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        // confirmPurchase will remove the modal itself inside method
        this.confirmPurchase();
        summaryModal.remove();
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => summaryModal.remove());
    }
  }

  confirmPurchase() {
    const data = getData() || {};
    data.products = data.products || [];
    data.orders = data.orders || [];
    data.notifications = data.notifications || [];
    data.lowStockAlerts = data.lowStockAlerts || [];

    const user = auth.getCurrentUser && auth.getCurrentUser();

    // Deduct stock from products
    this.items.forEach(item => {
      const product = data.products.find(p => p.id === item.id);
      if (product) {
        product.stock = Math.max(0, (product.stock || 0) - item.quantity);
      }
    });

    // Calculate order summary
    const subtotal = this.getTotal();
    const tax = subtotal * 0.08; // 8% tax
    const deliveryFee = 2.99;
    const total = subtotal + tax + deliveryFee;

    // For safety, generate a new id even if orders empty
    const maxExistingId = data.orders.length ? Math.max(...data.orders.map(o => Number(o.id || 0))) : 1000;
    const newOrderId = maxExistingId + 1;

    // If multiple farmers exist in cart, this will still take first farmer as primary. 
    // Consider splitting per-farmer orders later if desired.
    const newOrder = {
      id: newOrderId,
      userId: user ? user.id : null,
      userName: user ? user.name : 'Guest',
      farmerId: this.items[0] ? this.items[0].farmerId : null,
      farmerName: this.items[0] ? this.items[0].farmerName : null,
      status: 'pending',
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      items: JSON.parse(JSON.stringify(this.items)),
      deliveryAddress: user ? user.address : '',
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

    // Check for low stock after purchase
    checkLowStock();

  

    this.clear();
    showNotification('Order placed successfully!');

    // Show success modal with order details
    this.showOrderConfirmation(newOrder);
  }


  showOrderConfirmation(order) {
    const confirmationModal = document.createElement('div');
    confirmationModal.className = 'modal active';
    confirmationModal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>✅ Order Confirmed!</h3>
          <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
        </div>
        <div class="modal-body">
          <div class="order-confirmation">
            <div class="success-icon" style="text-align: center; font-size: 4rem; margin-bottom: 1rem;">🎉</div>
            <h4 style="text-align: center; color: var(--success-color); margin-bottom: 2rem;">
              Your order has been placed successfully!
            </h4>
            
            <div class="order-details">
              <p><strong>Order Number:</strong> #${order.id}</p>
              <p><strong>Total Amount:</strong> ${formatCurrency(order.orderSummary.total)}</p>
              <p><strong>Expected Delivery:</strong> ${formatDate(order.deliveryDate)}</p>
              <p><strong>Delivery Address:</strong> ${order.deliveryAddress}</p>
            </div>
            
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" id="view-orders-btn">
            View My Orders
          </button>
          <button class="btn-secondary" id="continue-shopping-btn">
            Continue Shopping
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(confirmationModal);

    const viewBtn = document.getElementById('view-orders-btn');
    const contBtn = document.getElementById('continue-shopping-btn');

    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        confirmationModal.remove();
        if (auth && typeof auth.hasRole === 'function' && auth.hasRole('user') && window.userDashboard && typeof window.userDashboard.showMyOrders === 'function') {
          window.userDashboard.showMyOrders();
        }
      });
    }
    if (contBtn) {
      contBtn.addEventListener('click', () => confirmationModal.remove());
    }
  }

  loadCart() {
    const cartData = localStorage.getItem('shoppingCart');
    const data = getData() || {};
    data.products = data.products || [];

    if (cartData) {
      try {
        const savedItems = JSON.parse(cartData);
        // Only keep items that still exist and have enough stock
        this.items = Array.isArray(savedItems) ? savedItems.filter(item => {
          const product = data.products.find(p => p.id === item.id);
          return product && product.stock >= item.quantity;
        }) : [];
      } catch (e) {
        this.items = [];
      }
    } else {
      this.items = [];
    }
  }

  updateCartDisplay() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotal = document.getElementById('cart-total');

    if (!cartItemsContainer || !cartTotal) return;

    if (this.items.length === 0) {
      cartItemsContainer.innerHTML = '<div class="empty-state"><p>Your cart is empty</p></div>';
      cartTotal.textContent = '0.00';
      return;
    }

    cartItemsContainer.innerHTML = this.items.map(item => `
      <div class="cart-item">
        <div class="cart-item-info">
          <h4>${item.name}</h4>
          <p>${formatCurrency(item.price)} ${item.unit}</p>
          <small style="color: var(--text-secondary);">From ${item.farmerName}</small>
        </div>
        <div class="cart-item-actions">
          <div class="quantity-controls">
            <button class="quantity-btn" onclick="cart.updateQuantity(${JSON.stringify(item.id)}, ${item.quantity - 1})">-</button>
            <span class="quantity-display">${item.quantity}</span>
            <button class="quantity-btn" onclick="cart.updateQuantity(${JSON.stringify(item.id)}, ${item.quantity + 1})">+</button>
          </div>
          <button class="btn-danger btn-sm" onclick="cart.removeItem(${JSON.stringify(item.id)})">Remove</button>
        </div>
      </div>
    `).join('');

    cartTotal.textContent = this.getTotal().toFixed(2);
  }
}

// Simple chart creation function
function createSimpleChart(containerId, data) {
  const container = document.getElementById(containerId);
  if (!container || !data || Object.keys(data).length === 0) {
    if (container) {
      container.innerHTML = '<div class="chart-placeholder">No data available</div>';
    }
    return;
  }

  const maxValue = Math.max(...Object.values(data));
  const entries = Object.entries(data);

  container.innerHTML = entries.map(([label, value]) => {
    const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
    const displayValue = typeof value === 'number' && value % 1 !== 0 ?
      (value < 1 ? formatCurrency(value) : value.toFixed(1)) :
      (typeof value === 'number' && value > 100 ? formatCurrency(value) : value);

    return `
      <div class="chart-bar" style="margin-bottom: 1rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
          <span style="font-weight: 500; color: var(--text-primary);">${label}</span>
          <span style="color: var(--primary-color); font-weight: 600;">${displayValue}</span>
        </div>
        <div style="background: var(--bg-tertiary); height: 8px; border-radius: 4px; overflow: hidden;">
          <div style="background: linear-gradient(90deg, var(--primary-color), var(--secondary-color)); height: 100%; width: ${percentage}%; transition: width 0.5s ease;"></div>
        </div>
      </div>
    `;
  }).join('');
}

// Global cart instance
export const cart = new ShoppingCart();

// Make cart available globally for inline onclick handlers
window.cart = cart;

// Initialize product cleanup and low stock checking
setInterval(() => {
  removeExpiredProducts();
  checkLowStock();
}, 60000); // check every 1 minute — consider increasing to 15-30 minutes in production

// Initial cleanup
removeExpiredProducts();
checkLowStock();

// Export functions for use in other modules
export {
  formatCurrency,
  formatDate,
  showNotification,
  debounce,
  removeExpiredProducts,
  checkLowStock,
  ShoppingCart,
  createSimpleChart,
  getAvatarUrl,
  validatePhoneNumber
};
