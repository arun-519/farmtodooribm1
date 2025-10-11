import { auth } from '../auth.js';
import { getData, saveData } from '../data.js';
import { formatCurrency, formatDate, showNotification, debounce, createSimpleChart } from '../utils.js';
import { getAvatarUrl } from '../utils.js';

export const adminDashboard = {
  menuItems: [
    { id: 'overview', label: '📊 Overview', active: true },
    { id: 'users', label: '👥 Users' },
    { id: 'farmers', label: '🚜 Farmers' },
    { id: 'products', label: '🛒 Products' },
    { id: 'orders', label: '📦 Orders' },
    { id: 'analytics', label: '📈 Analytics' }
  ],

  init() {
    this.renderMenu();
    this.showOverview();
  },

  renderMenu() {
    const sidebar = document.querySelector('.sidebar-content');
    sidebar.innerHTML = this.menuItems.map(item => `
      <button class="menu-item ${item.active ? 'active' : ''}" data-section="${item.id}">
        ${item.label}
      </button>
    `).join('');

    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        document.querySelectorAll('.menu-item').forEach(mi => mi.classList.remove('active'));
        e.target.classList.add('active');
        
        const section = e.target.dataset.section;
        switch(section) {
          case 'overview': this.showOverview(); break;
          case 'users': this.showUsers(); break;
          case 'farmers': this.showFarmers(); break;
          case 'products': this.showProducts(); break;
          case 'orders': this.showOrders(); break;
          case 'analytics': this.showAnalytics(); break;
        }
      });
    });
  },

  showOverview() {
    const data = getData();
    const totalUsers = data.users.filter(u => u.role === 'user').length;
    const totalFarmers = data.users.filter(u => u.role === 'farmer' && u.isActive !== false).length;
    const totalProducts = data.products.length;
    const totalOrders = data.orders.length;
    const totalRevenue = data.orders.reduce((sum, order) => sum + (order.orderSummary ? order.orderSummary.total : order.total), 0);
    
    // Calculate monthly revenue for chart
    const monthlyRevenue = data.orders.reduce((acc, order) => {
      const month = new Date(order.orderDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      acc[month] = (acc[month] || 0) + (order.orderSummary ? order.orderSummary.total : order.total);
      return acc;
    }, {});
    
    // Calculate category distribution
    const categoryStats = data.products.reduce((acc, product) => {
      acc[product.category] = (acc[product.category] || 0) + 1;
      return acc;
    }, {});
    
    const content = `
      <div class="section-header">
        <h2 class="section-title">Platform Overview</h2>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${totalUsers}</div>
          <div class="stat-label">Total Customers</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalFarmers}</div>
          <div class="stat-label">Active Farmers</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalProducts}</div>
          <div class="stat-label">Products Listed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalOrders}</div>
          <div class="stat-label">Total Orders</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(totalRevenue)}</div>
          <div class="stat-label">Platform Revenue</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.orders.filter(o => o.status === 'pending').length}</div>
          <div class="stat-label">Pending Orders</div>
        </div>
      </div>
      
      <div class="grid-2">
        <div class="chart-container">
          <h3 class="chart-title">Monthly Revenue</h3>
          <div id="admin-monthly-revenue-chart"></div>
        </div>
        
        <div class="chart-container">
          <h3 class="chart-title">Product Categories</h3>
          <div id="admin-category-chart"></div>
        </div>
      </div>
      
      <div class="grid-2">
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Recent Activity</h3>
          </div>
          <div class="card-content">
            ${data.orders.slice(-5).reverse().map(order => `
              <div class="order-item">
                <div>
                  <strong>Order #${order.id}</strong>
                  <small style="color: var(--text-secondary); display: block;">
                    ${order.userName} from ${order.farmerName}
                  </small>
                  <small style="color: var(--text-secondary);">
                    ${formatDate(order.orderDate)}
                  </small>
                </div>
                <div style="text-align: right;">
                  <div>${formatCurrency(order.orderSummary ? order.orderSummary.total : order.total)}</div>
                  <span class="badge badge-${order.status === 'delivered' ? 'success' : order.status === 'processing' ? 'warning' : 'primary'}">
                    ${order.status}
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
        
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Top Performing Products</h3>
          </div>
          <div class="card-content">
            ${data.products.slice(0, 5).map(product => `
              <div class="order-item">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <img src="${product.image}" alt="${product.name}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 4px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
                  <span style="display: none; font-size: 1.5rem;">🌱</span>
                  <div>
                    <strong>${product.name}</strong>
                    <small style="color: var(--text-secondary); display: block;">
                      by ${product.farmerName}
                    </small>
                  </div>
                </div>
                <div style="text-align: right;">
                  <div>${formatCurrency(product.price)}</div>
                  <small style="color: var(--text-secondary);">${product.stock} in stock</small>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('dashboard-content').innerHTML = content;
    
    // Create charts
    createSimpleChart('admin-monthly-revenue-chart', monthlyRevenue);
    createSimpleChart('admin-category-chart', categoryStats);
  },

  showUsers() {
    const data = getData();
    const users = data.users.filter(u => u.role === 'user');
    
    const content = `
      <div class="section-header">
        <h2 class="section-title">Customer Management</h2>
      </div>
      
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Orders</th>
              <th>Total Spent</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(user => {
              const userOrders = data.orders.filter(o => o.userId === user.id);
              const totalSpent = userOrders.reduce((sum, order) => sum + (order.orderSummary ? order.orderSummary.total : order.total), 0);
              
              return `
                <tr>
                  <td>
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                      <img src="${getAvatarUrl(user.name, user.photo)}" alt="${user.name}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
                      <span style="display:none; font-size:1.25rem;">👤</span>
                      <strong>${user.name}</strong>
                    </div>
                  </td>
                  <td>${user.email}</td>
                  <td>${userOrders.length}</td>
                  <td>${formatCurrency(totalSpent)}</td>
                  <td>${formatDate(user.joinedDate)}</td>
                  <td>
                    <div class="action-buttons">
                      <button class="btn-secondary btn-sm" onclick="adminDashboard.viewUserDetails(${user.id})">View</button>
                      <button class="btn-danger btn-sm" onclick="adminDashboard.suspendUser(${user.id})">Suspend</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    document.getElementById('dashboard-content').innerHTML = content;
  },

  showFarmers() {
    const data = getData();
    const farmers = data.users.filter(u => u.role === 'farmer');
    
    const content = `
      <div class="section-header">
        <h2 class="section-title">Farmer Management</h2>
      </div>
      
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Farmer</th>
              <th>Farm Name</th>
              <th>Products</th>
              <th>Orders</th>
              <th>Revenue</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${farmers.map(farmer => {
              const farmerProducts = data.products.filter(p => p.farmerId === farmer.id);
              const farmerOrders = data.orders.filter(o => o.farmerId === farmer.id);
              const revenue = farmerOrders.reduce((sum, order) => sum + (order.orderSummary ? order.orderSummary.total : order.total), 0);
              
              return `
                <tr>
                  <td>
                    <div style="display:flex; align-items:center; gap:0.75rem;">
                      <img src="${getAvatarUrl(farmer.name, farmer.photo)}" alt="${farmer.name}" style="width:32px; height:32px; border-radius:50%; object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
                      <span style="display:none; font-size:1.25rem;">👤</span>
                      <strong>${farmer.name}</strong>
                    </div>
                    <small style="display: block; color: var(--text-secondary);">${farmer.email}</small>
                  </td>
                  <td>${farmer.farmName || 'N/A'}</td>
                  <td>${farmerProducts.length}</td>
                  <td>${farmerOrders.length}</td>
                  <td>${formatCurrency(revenue)}</td>
                  <td>
                    ${farmer.rating ? `
                      <div>${'⭐'.repeat(Math.floor(farmer.rating))} ${farmer.rating.toFixed(1)}</div>
                      <small style="color: var(--text-secondary);">(${farmer.totalRatings || 0} reviews)</small>
                    ` : 'No ratings yet'}
                  </td>
                  <td>
                    <span class="badge badge-${farmer.isActive !== false ? 'success' : 'danger'}">
                      ${farmer.isActive !== false ? 'Active' : 'Removed'}
                    </span>
                  </td>
                  <td>
                    <div class="action-buttons">
                      <button class="btn-secondary btn-sm" onclick="adminDashboard.viewFarmerDetails(${farmer.id})">View</button>
                      ${farmer.isActive !== false ? 
                        `<button class="btn-danger btn-sm" onclick="adminDashboard.removeFarmer(${farmer.id})">Remove</button>` :
                        `<button class="btn-primary btn-sm" onclick="adminDashboard.restoreFarmer(${farmer.id})">Restore</button>`
                      }
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    document.getElementById('dashboard-content').innerHTML = content;
  },

  showProducts() {
    const data = getData();
    const products = data.products;
    
    const content = `
      <div class="section-header">
        <h2 class="section-title">Product Management</h2>
      </div>
      
      <div class="search-filters">
        <div class="search-row">
          <div class="search-group">
            <label>Search Products</label>
            <input type="text" id="admin-product-search" placeholder="Search products...">
          </div>
          <div class="search-group">
            <label>Category</label>
            <select id="admin-category-filter">
              <option value="">All Categories</option>
              <option value="vegetables">Vegetables</option>
              <option value="fruits">Fruits</option>
              <option value="dairy">Dairy</option>
            </select>
          </div>
          <div class="search-group">
            <label>Status</label>
            <select id="admin-stock-filter">
              <option value="">All Products</option>
              <option value="in-stock">In Stock</option>
              <option value="low-stock">Low Stock</option>
              <option value="out-of-stock">Out of Stock</option>
            </select>
          </div>
        </div>
      </div>
      
      <div class="table-container">
        <table class="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Farmer</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="admin-products-table">
            ${this.renderProductRows(products)}
          </tbody>
        </table>
      </div>
    `;
    
    document.getElementById('dashboard-content').innerHTML = content;
    
    // Add search functionality
    const searchInput = document.getElementById('admin-product-search');
    const categoryFilter = document.getElementById('admin-category-filter');
    const stockFilter = document.getElementById('admin-stock-filter');
    
    const filterProducts = debounce(() => {
      const searchTerm = searchInput.value.toLowerCase();
      const category = categoryFilter.value;
      const stockStatus = stockFilter.value;
      
      let filtered = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm) ||
                            product.farmerName.toLowerCase().includes(searchTerm);
        const matchesCategory = !category || product.category === category;
        let matchesStock = true;
        
        if (stockStatus === 'in-stock') matchesStock = product.stock > (product.lowStockThreshold || 10);
        else if (stockStatus === 'low-stock') matchesStock = product.stock <= (product.lowStockThreshold || 10) && product.stock > 0;
        else if (stockStatus === 'out-of-stock') matchesStock = product.stock === 0;
        
        return matchesSearch && matchesCategory && matchesStock;
      });
      
      document.getElementById('admin-products-table').innerHTML = this.renderProductRows(filtered);
    }, 300);
    
    searchInput.addEventListener('input', filterProducts);
    categoryFilter.addEventListener('change', filterProducts);
    stockFilter.addEventListener('change', filterProducts);
  },

  renderProductRows(products) {
    return products.map(product => `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <img src="${product.image}" alt="${product.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
            <span style="display: none; font-size: 2rem;">🌱</span>
            <div>
              <strong>${product.name}</strong>
              <small style="display: block; color: var(--text-secondary);">${product.description}</small>
            </div>
          </div>
        </td>
        <td>${product.farmerName}</td>
        <td>
          <span class="badge badge-primary">${product.category}</span>
          ${product.isOrganic ? '<span class="badge badge-success">Organic</span>' : ''}
        </td>
        <td><strong>${formatCurrency(product.price)}</strong><br><small>${product.unit}</small></td>
        <td>
          <span class="${product.stock <= (product.lowStockThreshold || 10) ? (product.stock === 0 ? 'badge badge-danger' : 'badge badge-warning') : ''}">${product.stock}</span>
        </td>
        <td>
          <span class="badge badge-${product.stock > (product.lowStockThreshold || 10) ? 'success' : product.stock > 0 ? 'warning' : 'danger'}">
            ${product.stock > (product.lowStockThreshold || 10) ? 'In Stock' : product.stock > 0 ? 'Low Stock' : 'Out of Stock'}
          </span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-danger btn-sm" onclick="adminDashboard.removeProduct(${product.id})">Remove</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  showOrders() {
    const data = getData();
    const orders = data.orders;
    
    const content = `
      <div class="section-header">
        <h2 class="section-title">Order Management</h2>
      </div>
      
      ${orders.length === 0 ? 
        '<div class="empty-state"><h3>No orders yet</h3><p>Orders will appear here when customers make purchases</p></div>' :
        orders.map(order => `
          <div class="order-card">
            <div class="order-header">
              <div>
                <div class="order-id">Order #${order.id}</div>
                <div class="order-date">
                  ${order.userName} → ${order.farmerName} • ${formatDate(order.orderDate)}
                </div>
              </div>
              <span class="badge badge-${order.status === 'delivered' ? 'success' : order.status === 'processing' ? 'warning' : 'primary'}">
                ${order.status.toUpperCase()}
              </span>
            </div>
            <div class="order-items">
              ${order.items.map(item => `
                <div class="order-item">
                  <span>${item.name} (x${item.quantity})</span>
                  <span>${formatCurrency(item.price * item.quantity)}</span>
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
            <div style="margin-top: 1rem; color: var(--text-secondary); font-size: 0.9rem;">
              <div>Delivery Address: ${order.deliveryAddress}</div>
              <div>Expected Delivery: ${formatDate(order.deliveryDate)}</div>
            </div>
          </div>
        `).join('')
      }
    `;
    
    document.getElementById('dashboard-content').innerHTML = content;
  },

  showAnalytics() {
    const data = getData();
    const totalRevenue = data.orders.reduce((sum, order) => sum + (order.orderSummary ? order.orderSummary.total : order.total), 0);
    const averageOrderValue = data.orders.length > 0 ? totalRevenue / data.orders.length : 0;
    
    // Calculate category distribution
    const categoryStats = data.products.reduce((acc, product) => {
      acc[product.category] = (acc[product.category] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate monthly revenue
    const monthlyRevenue = data.orders.reduce((acc, order) => {
      const month = new Date(order.orderDate).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      acc[month] = (acc[month] || 0) + (order.orderSummary ? order.orderSummary.total : order.total);
      return acc;
    }, {});
    
    // Calculate farmer performance
    const farmerPerformance = {};
    data.orders.forEach(order => {
      if (!farmerPerformance[order.farmerName]) {
        farmerPerformance[order.farmerName] = 0;
      }
      farmerPerformance[order.farmerName] += (order.orderSummary ? order.orderSummary.total : order.total);
    });
    
    const content = `
      <div class="section-header">
        <h2 class="section-title">Platform Analytics</h2>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(totalRevenue)}</div>
          <div class="stat-label">Total Revenue</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(averageOrderValue)}</div>
          <div class="stat-label">Average Order Value</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.orders.length}</div>
          <div class="stat-label">Total Orders</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${data.products.length}</div>
          <div class="stat-label">Products Listed</div>
        </div>
      </div>
      
      <div class="grid-2">
        <div class="chart-container">
          <h3 class="chart-title">Monthly Revenue</h3>
          <div id="admin-analytics-monthly-chart"></div>
        </div>
        
        <div class="chart-container">
          <h3 class="chart-title">Product Categories</h3>
          <div id="admin-analytics-category-chart"></div>
        </div>
      </div>
      
      <div class="grid-2">
        <div class="chart-container">
          <h3 class="chart-title">Farmer Performance</h3>
          <div id="admin-farmer-performance-chart"></div>
        </div>
      
        <div class="chart-container">
          <h3 class="chart-title">Recent Platform Activity</h3>
          <div class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>User</th>
                  <th>Details</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                ${data.orders.slice(-10).reverse().map(order => `
                  <tr>
                    <td>New Order</td>
                    <td>${order.userName}</td>
                    <td>Order #${order.id} - ${formatCurrency(order.orderSummary ? order.orderSummary.total : order.total)}</td>
                    <td>${formatDate(order.orderDate)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    document.getElementById('dashboard-content').innerHTML = content;
    
    // Create charts
    createSimpleChart('admin-analytics-monthly-chart', monthlyRevenue);
    createSimpleChart('admin-analytics-category-chart', categoryStats);
    createSimpleChart('admin-farmer-performance-chart', farmerPerformance);
  },

  // Action methods
  viewUserDetails(userId) {
    showNotification('User details feature coming soon!');
  },

  suspendUser(userId) {
    if (confirm('Are you sure you want to suspend this user?')) {
      showNotification('User suspended successfully');
    }
  },

  viewFarmerDetails(farmerId) {
    showNotification('Farmer details feature coming soon!');
  },

  removeFarmer(farmerId) {
    if (confirm('Are you sure you want to remove this farmer? This will also remove all their products.')) {
      const data = getData();
      
      // Mark farmer as inactive
      const farmer = data.users.find(u => u.id === farmerId);
      if (farmer) {
        farmer.isActive = false;
      }
      
      // Remove farmer's products
      data.products = data.products.filter(p => p.farmerId !== farmerId);
      
      saveData(data);
      showNotification('Farmer removed successfully');
      this.showFarmers();
    }
  },

  restoreFarmer(farmerId) {
    if (confirm('Are you sure you want to restore this farmer?')) {
      const data = getData();
      const farmer = data.users.find(u => u.id === farmerId);
      if (farmer) {
        farmer.isActive = true;
        saveData(data);
        showNotification('Farmer restored successfully');
        this.showFarmers();
      }
    }
  },

  removeProduct(productId) {
    if (confirm('Are you sure you want to remove this product?')) {
      const data = getData();
      data.products = data.products.filter(p => p.id !== productId);
      saveData(data);
      showNotification('Product removed successfully');
      this.showProducts();
    }
  }
};
