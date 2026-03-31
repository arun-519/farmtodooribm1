import { auth } from './auth.js';
import { getData, saveData } from './data.js';
import { showNotification, cart } from './utils.js';
import { userDashboard } from './dashboards/user.js';
import { farmerDashboard } from './dashboards/farmer.js';
import { adminDashboard } from './dashboards/admin.js';

class FarmToDoorApp {
  constructor() {
    this.init();
  }

  init() {
    this.checkAuthentication();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Home screen buttons
    document.getElementById('nav-login-btn')?.addEventListener('click', () => {
      this.showAuthScreen();
      this.switchAuthTab('login');
    });
    
    document.getElementById('nav-register-btn')?.addEventListener('click', () => {
      this.showAuthScreen();
      this.switchAuthTab('register');
    });

    document.getElementById('hero-get-started')?.addEventListener('click', () => {
      this.showAuthScreen();
      this.switchAuthTab('register');
    });

    document.getElementById('hero-learn-more')?.addEventListener('click', () => {
      document.querySelector('.features')?.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('back-to-home')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.showHomeScreen();
    });

    // Auth form tabs
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        this.switchAuthTab(tab);
      });
    });

    // Login form
    document.getElementById('login-form').querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin();
    });

    // Register form
    document.getElementById('register-form').querySelector('form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleRegister();
    });

    // Demo account buttons
    document.querySelectorAll('.demo-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const role = e.target.dataset.role;
        this.loginDemoAccount(role);
      });
    });

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', () => {
      this.handleLogout();
    });

    // Cart modal
    this.setupCartModal();
  }

  switchAuthTab(tab) {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
    
    document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
    document.getElementById(`${tab}-form`).classList.add('active');
  }

  handleLogin() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const role = document.getElementById('login-role').value;

    const result = auth.login(email, password, role);
    
    if (result.success) {
      showNotification('Login successful!');
      this.showDashboard();
    } else {
      showNotification(result.message, 'error');
    }
  }

  handleRegister() {
    const userData = {
      name: document.getElementById('register-name').value,
      email: document.getElementById('register-email').value,
      password: document.getElementById('register-password').value,
      role: document.getElementById('register-role').value
    };

    const result = auth.register(userData);
    
    if (result.success) {
      showNotification('Registration successful! Please login.');
      this.switchAuthTab('login');
    } else {
      showNotification(result.message, 'error');
    }
  }

  loginDemoAccount(role) {
    let email, password;
    
    switch(role) {
      case 'user':
        email = 'customer@demo.com';
        password = 'demo123';
        break;
      case 'farmer':
        email = 'farmer@demo.com';
        password = 'demo123';
        break;
      case 'admin':
        email = 'admin@demo.com';
        password = 'demo123';
        break;
    }

    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = password;
    document.getElementById('login-role').value = role;
    
    const result = auth.login(email, password, role);
    
    if (result.success) {
      showNotification(`Logged in as demo ${role}!`);
      this.showDashboard();
    }
  }

  handleLogout() {
    auth.logout();
    showNotification('Logged out successfully');
    this.showHomeScreen();
  }

  checkAuthentication() {
    if (auth.isAuthenticated()) {
      this.showDashboard();
    } else {
      this.showHomeScreen();
    }
  }

  showHomeScreen() {
    document.getElementById('home-screen')?.classList.add('active');
    document.getElementById('auth-screen')?.classList.remove('active');
    document.getElementById('dashboard-screen')?.classList.remove('active');
  }

  showAuthScreen() {
    document.getElementById('home-screen')?.classList.remove('active');
    document.getElementById('auth-screen')?.classList.add('active');
    document.getElementById('dashboard-screen')?.classList.remove('active');
  }

  showDashboard() {
    document.getElementById('home-screen')?.classList.remove('active');
    document.getElementById('auth-screen')?.classList.remove('active');
    document.getElementById('dashboard-screen')?.classList.add('active');
    
    const user = auth.getCurrentUser();
    document.getElementById('user-name').textContent = user.name;
    
    // Initialize appropriate dashboard
    if (auth.hasRole('user')) {
      userDashboard.init();
    } else if (auth.hasRole('farmer')) {
      farmerDashboard.init();
    } else if (auth.hasRole('admin')) {
      adminDashboard.init();
    }
  }

  setupCartModal() {
    const modal = document.getElementById('cart-modal');
    const closeButtons = modal.querySelectorAll('.modal-close');
    
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active');
      }
    });

    // Checkout button
    document.getElementById('checkout-btn').addEventListener('click', () => {
      cart.checkout();
      modal.classList.remove('active');
    });

    // Update cart display when modal opens
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          if (modal.classList.contains('active')) {
            cart.updateCartDisplay();
          }
        }
      });
    });
    
    observer.observe(modal, { attributes: true });
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new FarmToDoorApp();
});
