// Mock data for the platform
const mockData = {
  users: [
    {
      id: 1,
      name: 'John Customer',
      email: 'customer@demo.com',
      password: 'demo123',
      role: 'user',
      address: '123 Main St, City, State',
      phone: '+1234567890',
      joinedDate: '2024-01-15',
      ratings: [] // Array of {farmerId, rating, comment, date}
    },
    {
      id: 2,
      name: 'Sarah Farmer',
      email: 'farmer@demo.com',
      password: 'demo123',
      role: 'farmer',
      farmName: 'Green Valley Farm',
      location: 'Rural County, State',
      phone: '+1234567891',
      joinedDate: '2024-01-10',
      rating: 4.5,
      totalRatings: 12,
      isActive: true,
      ratings: []
    },
    {
      id: 3,
      name: 'Admin User',
      email: 'admin@demo.com',
      password: 'demo123',
      role: 'admin',
      department: 'Platform Management',
      phone: '+1234567892',
      joinedDate: '2024-01-01'
    }
  ],
  products: [
    {
      id: 1,
      name: 'Organic Tomatoes',
      description: 'Fresh, juicy organic tomatoes grown without pesticides',
      price: 40,
      unit: 'per Kg',
      category: 'vegetables',
      farmerId: 2,
      farmerName: 'Green Valley Farm',
      stock: 50,
      image: 'https://images.pexels.com/photos/533280/pexels-photo-533280.jpeg?auto=compress&cs=tinysrgb&w=400',
      isOrganic: true,
      harvestDate: '2024-12-20',
      addedDate: new Date().toISOString(),
      lowStockThreshold: 10
    },
    {
      id: 2,
      name: 'Fresh Lettuce',
      description: 'Crisp romaine lettuce perfect for salads',
      price: 30 ,
      unit: 'per Kg',
      category: 'vegetables',
      farmerId: 2,
      farmerName: 'Green Valley Farm',
      stock: 30,
      image: 'https://images.pexels.com/photos/1656663/pexels-photo-1656663.jpeg?auto=compress&cs=tinysrgb&w=400',
      isOrganic: true,
      harvestDate: '2024-12-22',
      addedDate: new Date().toISOString(),
      lowStockThreshold: 5
    },
    {
      id: 3,
      name: 'Farm Fresh Eggs',
      description: 'Free-range chicken eggs from happy hens',
      price: 6 ,
      unit: 'per each',
      category: 'dairy',
      farmerId: 2,
      farmerName: 'Green Valley Farm',
      stock: 25,
      image: 'https://images.pexels.com/photos/162712/egg-white-food-protein-162712.jpeg?auto=compress&cs=tinysrgb&w=400',
      isOrganic: true,
      harvestDate: '2024-12-23',
      addedDate: new Date().toISOString(),
      lowStockThreshold: 12
    },
    {
      id: 4,
      name: 'Sweet Carrots',
      description: 'Crunchy orange carrots packed with vitamins',
      price: 80 ,
      unit: 'per Kg',
      category: 'vegetables',
      farmerId: 2,
      farmerName: 'Green Valley Farm',
      stock: 40,
      image: 'https://images.pexels.com/photos/143133/pexels-photo-143133.jpeg?auto=compress&cs=tinysrgb&w=400',
      isOrganic: false,
      harvestDate: '2024-12-21',
      addedDate: new Date().toISOString(),
      lowStockThreshold: 15
    },
    {
      id: 5,
      name: 'Red Apples',
      description: 'Sweet and crisp red apples, perfect for snacking',
      price: 150 ,
      unit: 'per Kg',
      category: 'fruits',
      farmerId: 2,
      farmerName: 'Green Valley Farm',
      stock: 60,
      image: 'https://images.pexels.com/photos/102104/pexels-photo-102104.jpeg?auto=compress&cs=tinysrgb&w=400',
      isOrganic: true,
      harvestDate: '2024-12-19',
      addedDate: new Date().toISOString(),
      lowStockThreshold: 20
    },
    {
      id: 6,
      name: 'Fresh Spinach',
      description: 'Nutrient-rich baby spinach leaves',
      price: 20 ,
      unit: 'per bunch',
      category: 'vegetables',
      farmerId: 2,
      farmerName: 'Green Valley Farm',
      stock: 20,
      image: 'https://images.pexels.com/photos/2325843/pexels-photo-2325843.jpeg?auto=compress&cs=tinysrgb&w=400',
      isOrganic: true,
      harvestDate: '2024-12-22',
      addedDate: new Date().toISOString(),
      lowStockThreshold: 8
    }
  ],
  orders: [
    {
      id: 1001,
      userId: 1,
      userName: 'John Customer',
      farmerId: 2,
      farmerName: 'Green Valley Farm',
      status: 'delivered',
      orderDate: '2024-12-20',
      deliveryDate: '2024-12-22',
      total: 19.47,
      items: [
        { productId: 1, name: 'Organic Tomatoes', price: 4.99, quantity: 2 },
        { productId: 3, name: 'Farm Fresh Eggs', price: 6.99, quantity: 1 },
        { productId: 4, name: 'Sweet Carrots', price: 3.49, quantity: 1 }
      ],
      deliveryAddress: '123 Main St, City, State',
      orderSummary: {
        subtotal: 19.47,
        tax: 1.56,
        deliveryFee: 2.99,
        total: 24.02
      },
      farmerRating: null
    },
    {
      id: 1002,
      userId: 1,
      userName: 'John Customer',
      farmerId: 2,
      farmerName: 'Green Valley Farm',
      status: 'processing',
      orderDate: '2024-12-23',
      deliveryDate: '2024-12-25',
      total: 14.98,
      items: [
        { productId: 2, name: 'Fresh Lettuce', price: 2.99, quantity: 2 },
        { productId: 5, name: 'Red Apples', price: 5.99, quantity: 1 },
        { productId: 6, name: 'Fresh Spinach', price: 3.99, quantity: 1 }
      ],
      deliveryAddress: '123 Main St, City, State',
      orderSummary: {
        subtotal: 14.98,
        tax: 1.20,
        deliveryFee: 2.99,
        total: 19.17
      },
      farmerRating: null
    },
    {
      id: 1003,
      userId: 1,
      userName: 'John Customer',
      farmerId: 2,
      farmerName: 'Green Valley Farm',
      status: 'pending',
      orderDate: '2024-12-24',
      deliveryDate: '2024-12-26',
      total: 7.98,
      items: [
        { productId: 2, name: 'Fresh Lettuce', price: 2.99, quantity: 1 },
        { productId: 1, name: 'Organic Tomatoes', price: 4.99, quantity: 1 }
      ],
      deliveryAddress: '123 Main St, City, State',
      orderSummary: {
        subtotal: 7.98,
        tax: 0.64,
        deliveryFee: 2.99,
        total: 11.61
      },
      farmerRating: null
    }
  ],
  notifications: [],
  lowStockAlerts: []
};

// Initialize data in localStorage if not exists
function initializeData() {
  if (!localStorage.getItem('farmToDoorData')) {
    localStorage.setItem('farmToDoorData', JSON.stringify(mockData));
  } else {
    // Check if existing data has products, if not, add them
    const existingData = JSON.parse(localStorage.getItem('farmToDoorData'));
    if (!existingData.products || existingData.products.length === 0) {
      existingData.products = mockData.products;
      localStorage.setItem('farmToDoorData', JSON.stringify(existingData));
    }
  }
}

// Get data from localStorage
function getData() {
  const data = localStorage.getItem('farmToDoorData');
  if (!data) {
    return mockData;
  }
  
  try {
    const parsedData = JSON.parse(data);
    
    // Ensure all required array properties exist
    const requiredArrays = ['users', 'products', 'orders', 'notifications', 'lowStockAlerts'];
    
    requiredArrays.forEach(arrayName => {
      if (!parsedData[arrayName] || !Array.isArray(parsedData[arrayName])) {
        parsedData[arrayName] = mockData[arrayName] || [];
      }
    });
    
    // Seed temporary mock ratings for products if missing
    let mutated = false;
    parsedData.products = (parsedData.products || []).map(p => {
      const product = { ...p };
      if (typeof product.rating !== 'number' || typeof product.totalRatings !== 'number') {
        // Generate a realistic mock between 3.8 and 4.8 with 5-50 ratings
        const mockAvg = Math.round((3.8 + Math.random() * 1.0) * 10) / 10;
        const mockCount = Math.floor(5 + Math.random() * 46);
        product.rating = mockAvg;
        product.totalRatings = mockCount;
        product.ratingMocked = true;
        if (!Array.isArray(product.ratings)) product.ratings = [];
        mutated = true;
      }
      return product;
    });

    if (mutated) {
      // Persist seeded mock ratings so UI is consistent across reloads
      localStorage.setItem('farmToDoorData', JSON.stringify(parsedData));
    }
    
    return parsedData;
  } catch (error) {
    console.error('Error parsing data from localStorage:', error);
    return mockData;
  }
}

// Save data to localStorage
function saveData(data) {
  localStorage.setItem('farmToDoorData', JSON.stringify(data));
}

// Initialize data on load
initializeData();

// Export functions for use in other modules
export { getData, saveData, initializeData };
