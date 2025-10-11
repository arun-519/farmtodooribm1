import { getData, saveData } from './data.js';


class AuthManager {
  constructor() {
    this.currentUser = null;
    this.loadCurrentUser();
  }

  login(email, password, role) {
    const data = getData();
    const user = data.users.find(u => 
      u.email === email && 
      u.password === password && 
      u.role === role
    );
    
    if (user) {
      this.currentUser = user;
      localStorage.setItem('currentUser', JSON.stringify(user));
      return { success: true, user };
    }
    
    return { success: false, message: 'Invalid credentials or role' };
  }

  register(userData) {
    const data = getData();
    
    // Check if email already exists
    if (data.users.find(u => u.email === userData.email)) {
      return { success: false, message: 'Email already exists' };
    }
    
    // Create new user
    const newUser = {
      id: Math.max(...data.users.map(u => u.id),  0) + 1,
      name: userData.name,
      email: userData.email,
      password: userData.password,
      phone: userData.phone || '',
      role: userData.role,
      joinedDate: new Date().toISOString().split('T')[0]
    };
    
    data.users.push(newUser);
    saveData(data);
    
    return { success: true, user: newUser };
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('currentUser');
  }

  loadCurrentUser() {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      this.currentUser = JSON.parse(userStr);
    }
  }

  isAuthenticated() {
    return this.currentUser !== null;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  hasRole(role) {
    return this.currentUser && this.currentUser.role === role;
  }
}

// Global auth instance
export const auth = new AuthManager();
