const darkModeToggle = document.getElementById('darkModeToggle')
const darkModeIcon = document.getElementById('darkModeIcon')

const inventoriesBtn = document.getElementById('inventoriesBtn')
const accountBtn = document.getElementById('accountBtn')
const logoutBtn = document.getElementById('logoutBtn')
const backToInventoriesBtn = document.getElementById('backToInventoriesBtn')

const createInventoryBtn = document.getElementById('createInventoryBtn')
const createInventoryModal = document.getElementById('createInventoryModal')
const createInventoryForm = document.getElementById('createInventoryForm')
const cancelCreateInventory = document.getElementById('cancelCreateInventory')
const inventoryName = document.getElementById('inventoryName')
const inventoryDescription = document.getElementById('inventoryDescription')
const scanBottleBtn = document.getElementById('scanBottleBtn')
const manualEntryBtn = document.getElementById('manualEntryBtn')

const detailTabs = document.querySelectorAll('.detail-tab')
const detailTabContents = document.querySelectorAll('.detail-tab-content')
const mobileMenuToggle = document.getElementById('mobileMenuToggle')

let currentUser = null
let currentInventoryId = null
let inventories = []
let currentInventoryItems = []
let currentLocations = []

function initDarkMode() {
  const savedTheme = localStorage.getItem('theme') || 'light'
  document.documentElement.setAttribute('data-theme', savedTheme)
  updateDarkModeIcon()
}

function toggleDarkMode() {
  const currentTheme = document.documentElement.getAttribute('data-theme')
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark'
  
  document.documentElement.setAttribute('data-theme', newTheme)
  localStorage.setItem('theme', newTheme)
  updateDarkModeIcon()
}

function updateDarkModeIcon() {
  const currentTheme = document.documentElement.getAttribute('data-theme')
  if (darkModeIcon) {
    darkModeIcon.textContent = currentTheme === 'dark' ? '☀️' : '🌙'
  }
}

if (darkModeToggle) {
  darkModeToggle.addEventListener('click', toggleDarkMode)
}

async function checkAuth() {
  console.log('Checking authentication...')
  const token = localStorage.getItem('authToken')
  console.log('Token found:', !!token)
  
  if (!token) {
    console.log('No token found, redirecting to login')
    window.location.href = 'login.html'
    return
  }
  
  try {
    const user = localStorage.getItem('currentUser')
    console.log('User found:', !!user)
    
    if (user) {
      currentUser = JSON.parse(user)
      console.log('Current user:', currentUser)
    } else {
      console.log('No user found, redirecting to login')
      localStorage.removeItem('authToken')
      window.location.href = 'login.html'
      return
    }
    
    console.log('Loading inventories...')
    await loadInventories()
    console.log('Loading account info...')
    await loadAccountInfo()
    console.log('Authentication successful')
  } catch (error) {
    console.error('Auth check error:', error)
    localStorage.removeItem('authToken')
    localStorage.removeItem('currentUser')
    window.location.href = 'login.html'
  }
}

async function loadInventories() {
  try {
    console.log('Loading inventories...')
    const token = localStorage.getItem('authToken')
    console.log('Using token:', !!token)
    
    const response = await fetch('/api/inventories', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    console.log('Inventories response status:', response.status)
    
    if (response.ok) {
      inventories = await response.json()
      console.log('Inventories loaded:', inventories.length)
      renderInventoriesList()
    } else {
      console.error('Failed to load inventories:', response.status, response.statusText)
    }
  } catch (error) {
    console.error('Error loading inventories:', error)
  }
}

async function loadAccountInfo() {
  try {
    if (currentUser) {
      const accountInfo = document.getElementById('accountInfo')
      if (accountInfo) {
        accountInfo.innerHTML = `
          <div class="field">
            <label>Name</label>
            <input type="text" value="${currentUser.name}" readonly>
          </div>
          <div class="field">
            <label>Email</label>
            <input type="email" value="${currentUser.email}" readonly>
          </div>
        `
      }
    }
  } catch (error) {
    console.error('Error loading account info:', error)
  }
}

function renderInventoriesList() {
  const inventoriesList = document.getElementById('inventoriesList')
  if (!inventoriesList) return
  
  if (inventories.length === 0) {
    inventoriesList.innerHTML = `
      <div class="empty-state">
        <p>No inventories found. Create your first inventory to get started!</p>
      </div>
    `
    return
  }
  
  inventoriesList.innerHTML = `
    <div class="inventories-grid">
      ${inventories.map(inventory => `
        <div class="inventory-card" onclick="showInventoryDetail(${inventory.id})">
          <h3>${inventory.name}</h3>
          ${inventory.description ? `<p>${inventory.description}</p>` : ''}
          <div class="meta">
            <span>📦 Inventory</span>
            <span>🔄 Click to view</span>
          </div>
        </div>
      `).join('')}
    </div>
  `
}

async function loadCurrentInventory() {
  console.log('loadCurrentInventory called with currentInventoryId:', currentInventoryId)
  
  if (!currentInventoryId) {
    console.log('No currentInventoryId, returning early')
    return
  }
  
  console.log('Loading inventory items and locations...')
  await Promise.all([
    loadInventoryItems(),
    loadLocations()
  ])
  console.log('Finished loading current inventory')
}

async function loadInventoryItems() {
  try {
    console.log('Loading inventory items for inventory ID:', currentInventoryId)
    const token = localStorage.getItem('authToken')
    const response = await fetch(`/api/inventory/${currentInventoryId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    console.log('Inventory items response status:', response.status)
    
    if (response.ok) {
      currentInventoryItems = await response.json()
      console.log('Inventory items loaded:', currentInventoryItems.length)
      console.log('Items:', currentInventoryItems)
      renderInventory()
    } else {
      console.error('Failed to load inventory items:', response.status, response.statusText)
    }
  } catch (error) {
    console.error('Error loading inventory items:', error)
  }
}

async function loadLocations() {
  try {
    const token = localStorage.getItem('authToken')
    const response = await fetch(`/api/locations/${currentInventoryId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (response.ok) {
      currentLocations = await response.json()
      renderLocations()
    }
  } catch (error) {
    console.error('Error loading locations:', error)
  }
}

function renderInventory() {
  console.log('renderInventory called with currentInventoryId:', currentInventoryId)
  
  // Get the inventoryContent element from the current view
  const inventoryContent = document.getElementById('inventoryContent')
  console.log('inventoryContent element:', inventoryContent)
  
  if (!inventoryContent) {
    console.log('inventoryContent element not found, returning early')
    return
  }
  
  if (!currentInventoryId) {
    console.log('No currentInventoryId, showing empty state')
    inventoryContent.innerHTML = '<div class="empty-state"><p>Select an inventory to view items</p></div>'
    return
  }
  
  const currentInventory = inventories.find(inv => inv.id === currentInventoryId)
  console.log('Current inventory found:', currentInventory)
  
  if (!currentInventory) {
    console.log('No current inventory found')
    return
  }
  
  let html = `
    <div class="inventory-info">
      <h3>${currentInventory.name}</h3>
      ${currentInventory.description ? `<p>${currentInventory.description}</p>` : ''}
    </div>
  `
  
  if (currentInventoryItems.length === 0) {
    html += '<div class="empty-state"><p>No items in this inventory yet</p></div>'
  } else {
    html += `
      <div class="toolbar">
        <div class="search-wrapper">
          <input type="text" class="search" id="searchInput" placeholder="Search inventory...">
        </div>
      </div>
      
      <div class="table-wrapper">
        <table class="inventory-table">
          <thead>
            <tr>
              <th>Item Name</th>
              <th>Vendor</th>
              <th>Catalog #</th>
              <th>CAS</th>
              <th>Amount</th>
              <th>Unit Size</th>
              <th>Price</th>
              <th>Location</th>
              <th>URL</th>
              <th>Min Stock</th>
              <th>Max Stock</th>
              <th>Image</th>
              <th>3D Model</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="inventoryTable">
          </tbody>
        </table>
      </div>
      
      <div class="footer">
        <div id="itemCount">${currentInventoryItems.length} items</div>
      </div>
    `
  }
  
  inventoryContent.innerHTML = html
  
  if (currentInventoryItems.length > 0) {
    renderInventoryTable()
    setupSearch()
  }
}

function renderInventoryTable() {
  const tableBody = document.getElementById('inventoryTable')
  if (!tableBody) {
    console.log('inventoryTable element not found')
    return
  }
  
  console.log('Rendering inventory table with', currentInventoryItems.length, 'items')
  
  tableBody.innerHTML = currentInventoryItems.map(item => `
    <tr>
      <td>${item.item_name || ''}</td>
      <td>${item.vendor || ''}</td>
      <td>${item.catalog || ''}</td>
      <td>${item.cas || ''}</td>
      <td>${item.amount || ''}</td>
      <td>${item.amount_unit || ''}</td>
      <td>${item.price ? `$${item.price}` : ''}</td>
      <td>${item.location || ''}</td>
      <td>${item.url ? `<a href="${item.url}" target="_blank">Link</a>` : ''}</td>
      <td>${item.min_stock || ''}</td>
      <td>${item.max_stock || ''}</td>
      <td>${item.image_data ? `<img src="${item.image_data}" alt="Item" style="width: 50px; height: 50px; object-fit: cover;">` : ''}</td>
      <td>
        <div id="viewer3d-tiny-${item.id}" class="viewer3d-tiny" data-cid="${item.model_cid || ''}" title="3D Model"></div>
      </td>
      <td>
        <button class="btn secondary" onclick="deleteItem(${item.id})">Delete</button>
      </td>
    </tr>
  `).join('')
  
  // Render 3D models with a delay to ensure 3Dmol library is loaded
  setTimeout(() => {
    console.log('Starting 3D model rendering...')
    console.log('3Dmol library available:', typeof window.$3Dmol !== 'undefined')
    console.log('Items with model_cid:', currentInventoryItems.filter(item => item.model_cid).length)
    
    currentInventoryItems.forEach(item => {
      if (item.model_cid) {
        console.log(`Rendering 3D model for item ${item.id} with CID ${item.model_cid}`)
        render3DModelTiny(item.id, item.model_cid)
      }
    })
  }, 1000)
}

function renderLocations() {
  // Get the locationsContent element from the current view
  const locationsContent = document.getElementById('locationsContent')
  
  if (!locationsContent) {
    console.log('locationsContent element not found, returning early')
    return
  }
  
  if (!currentInventoryId) {
    locationsContent.innerHTML = '<div class="empty-state"><p>Select an inventory to manage its locations</p></div>'
    return
  }
  
  let html = `
    <div class="location-form">
      <div class="field">
        <label for="newLocationInput">Add New Location</label>
        <div style="display: flex; gap: 8px;">
          <input id="newLocationInput" type="text" placeholder="Enter location name">
          <button id="addLocationBtn" class="btn primary">Add</button>
        </div>
      </div>
    </div>
    
    <div class="location-list">
      <h3>Current Locations</h3>
      <div id="locationItems"></div>
    </div>
  `
  
  locationsContent.innerHTML = html
  
  renderLocationItems()
  setupLocationHandlers()
}

function renderLocationItems() {
  const locationItems = document.getElementById('locationItems')
  if (!locationItems) return
  
  locationItems.innerHTML = currentLocations.map(location => `
    <div class="location-item">
      <span>${location.name}</span>
      <div class="location-actions">
        <button class="btn secondary" onclick="deleteLocation(${location.id})">Delete</button>
      </div>
    </div>
  `).join('')
}

function setupLocationHandlers() {
  const addLocationBtn = document.getElementById('addLocationBtn')
  const newLocationInput = document.getElementById('newLocationInput')
  
  if (addLocationBtn && newLocationInput) {
    addLocationBtn.addEventListener('click', addLocation)
    newLocationInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') addLocation()
    })
  }
}

async function addLocation() {
  const newLocationInput = document.getElementById('newLocationInput')
  const name = newLocationInput.value.trim()
  
  if (!name) return
  
  try {
    const token = localStorage.getItem('authToken')
    const response = await fetch(`/api/locations/${currentInventoryId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name })
    })
    
    if (response.ok) {
      const newLocation = await response.json()
      currentLocations.push(newLocation)
      renderLocationItems()
      newLocationInput.value = ''
    }
  } catch (error) {
    console.error('Error adding location:', error)
  }
}

async function deleteLocation(locationId) {
  try {
    const token = localStorage.getItem('authToken')
    const response = await fetch(`/api/locations/${locationId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (response.ok) {
      currentLocations = currentLocations.filter(loc => loc.id !== locationId)
      renderLocationItems()
    }
  } catch (error) {
    console.error('Error deleting location:', error)
  }
}

async function createInventory() {
  const nameInput = document.getElementById('inventoryName')
  const descriptionInput = document.getElementById('inventoryDescription')
  
  if (!nameInput || !descriptionInput) {
    console.error('Form elements not found')
    return
  }
  
  const name = nameInput.value.trim()
  const description = descriptionInput.value.trim()
  
  if (!name) {
    alert('Please enter an inventory name')
    return
  }
  
  try {
    console.log('Creating inventory:', { name, description })
    const token = localStorage.getItem('authToken')
    console.log('Using token:', !!token)
    
    const requestBody = { name, description }
    console.log('Request body:', requestBody)
    
    const response = await fetch('/api/inventories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestBody)
    })
    
    console.log('Create inventory response status:', response.status)
    
          if (response.ok) {
        const newInventory = await response.json()
        console.log('New inventory created:', newInventory)
        inventories.push(newInventory)
        renderInventoriesList()
        
        // Show the new inventory detail view
        showInventoryDetail(newInventory.id)
        closeCreateInventoryModal()
                  } else {
               console.error('Response not OK. Status:', response.status, response.statusText)
               let errorMessage = 'Unknown error'
               try {
                 const errorData = await response.json()
                 console.error('Error response data:', errorData)
                 errorMessage = errorData.message || errorData.error || 'Server error'
                 
                 if (response.status === 401 && errorData.message.includes('User not found')) {
                   alert('Your session has expired. Please log in again.')
                   localStorage.removeItem('authToken')
                   localStorage.removeItem('currentUser')
                   window.location.href = 'login.html'
                   return
                 }
                 
                 if (response.status === 500 && errorData.message.includes('Database schema needs to be updated')) {
                   alert('Database schema needs to be updated. Please:\n\n1. Go to the Account tab\n2. Click "Database Migration"\n3. Click "Run Migration"\n4. Try creating the inventory again')
                   return
                 }
               } catch (parseError) {
                 console.error('Could not parse error response:', parseError)
                 errorMessage = `HTTP ${response.status}: ${response.statusText}`
               }
               alert('Failed to create inventory: ' + errorMessage)
             }
  } catch (error) {
    console.error('Error creating inventory:', error)
    alert('Network error. Please try again.')
  }
}

function openCreateInventoryModal() {
  console.log('Opening create inventory modal')
  if (createInventoryModal) {
    createInventoryModal.classList.add('active')
    const nameInput = document.getElementById('inventoryName')
    if (nameInput) {
      nameInput.focus()
    }
  } else {
    console.error('Modal element not found')
  }
}

function closeCreateInventoryModal() {
  console.log('Closing create inventory modal')
  if (createInventoryModal) {
    createInventoryModal.classList.remove('active')
    if (createInventoryForm) {
      createInventoryForm.reset()
    }
  }
}

function setupSearch() {
  const searchInput = document.getElementById('searchInput')
  if (searchInput) {
    console.log('Setting up search functionality')
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase()
      const filteredItems = currentInventoryItems.filter(item =>
        item.item_name?.toLowerCase().includes(searchTerm) ||
        item.vendor?.toLowerCase().includes(searchTerm) ||
        item.cas?.toLowerCase().includes(searchTerm)
      )
      console.log('Search term:', searchTerm, 'Filtered items:', filteredItems.length)
      renderFilteredInventory(filteredItems)
    })
  } else {
    console.log('Search input not found')
  }
}

function renderFilteredInventory(filteredItems) {
  const tableBody = document.getElementById('inventoryTable')
  if (!tableBody) {
    console.log('inventoryTable element not found in renderFilteredInventory')
    return
  }
  
  console.log('Rendering filtered inventory with', filteredItems.length, 'items')
  
  tableBody.innerHTML = filteredItems.map(item => `
    <tr>
      <td>${item.item_name || ''}</td>
      <td>${item.vendor || ''}</td>
      <td>${item.catalog || ''}</td>
      <td>${item.cas || ''}</td>
      <td>${item.amount || ''}</td>
      <td>${item.amount_unit || ''}</td>
      <td>${item.price ? `$${item.price}` : ''}</td>
      <td>${item.location || ''}</td>
      <td>${item.url ? `<a href="${item.url}" target="_blank">Link</a>` : ''}</td>
      <td>${item.min_stock || ''}</td>
      <td>${item.max_stock || ''}</td>
      <td>${item.image_data ? `<img src="${item.image_data}" alt="Item" style="width: 50px; height: 50px; object-fit: cover;">` : ''}</td>
      <td>
        <div id="viewer3d-tiny-${item.id}" class="viewer3d-tiny" data-cid="${item.model_cid || ''}" title="3D Model"></div>
      </td>
      <td>
        <button class="btn secondary" onclick="deleteItem(${item.id})">Delete</button>
      </td>
    </tr>
  `).join('')
  
  // Render 3D models with a delay to ensure 3Dmol library is loaded
  setTimeout(() => {
    console.log('Starting filtered 3D model rendering...')
    console.log('3Dmol library available:', typeof window.$3Dmol !== 'undefined')
    console.log('Filtered items with model_cid:', filteredItems.filter(item => item.model_cid).length)
    
    filteredItems.forEach(item => {
      if (item.model_cid) {
        console.log(`Rendering filtered 3D model for item ${item.id} with CID ${item.model_cid}`)
        render3DModelTiny(item.id, item.model_cid)
      }
    })
  }, 1000)
}

function setupEventListeners() {
  // Sidebar navigation
  if (inventoriesBtn) {
    inventoriesBtn.addEventListener('click', () => showView('inventories-view'))
  }
  
  if (accountBtn) {
    accountBtn.addEventListener('click', () => showView('account-view'))
  }
  
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('authToken')
      localStorage.removeItem('currentUser')
      window.location.href = 'login.html'
    })
  }
  
  if (backToInventoriesBtn) {
    backToInventoriesBtn.addEventListener('click', () => showView('inventories-view'))
  }
  
  // Detail tabs
  detailTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab
      switchDetailTab(tabName)
    })
  })
  
  // Mobile menu toggle
  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
      const sidebar = document.querySelector('.sidebar')
      if (sidebar) {
        sidebar.classList.toggle('active')
      }
    })
  }
  
  // Close mobile menu when clicking outside
  document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar')
    const mobileMenuToggle = document.getElementById('mobileMenuToggle')
    
    if (sidebar && mobileMenuToggle && 
        !sidebar.contains(e.target) && 
        !mobileMenuToggle.contains(e.target)) {
      sidebar.classList.remove('active')
    }
  })

  if (createInventoryBtn) {
    createInventoryBtn.addEventListener('click', openCreateInventoryModal)
  }

  if (cancelCreateInventory) {
    cancelCreateInventory.addEventListener('click', closeCreateInventoryModal)
  }

  if (createInventoryForm) {
    createInventoryForm.addEventListener('submit', (e) => {
      e.preventDefault()
      console.log('Create inventory form submitted')
      createInventory()
    })
  }

  if (scanBottleBtn) {
    scanBottleBtn.addEventListener('click', () => {
      if (currentInventoryId) {
        localStorage.setItem('pendingInventoryId', currentInventoryId)
        window.location.href = 'scan.html'
      } else {
        alert('Please select an inventory first')
      }
    })
  }

  if (manualEntryBtn) {
    manualEntryBtn.addEventListener('click', () => {
      if (currentInventoryId) {
        localStorage.setItem('pendingInventoryId', currentInventoryId)
        window.location.href = 'new.html'
      } else {
        alert('Please select an inventory first')
      }
    })
  }

  const changePasswordForm = document.getElementById('changePasswordForm')
  if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault()
      await changePassword()
    })
  }
}

function deleteItem(itemId) {
  if (confirm('Are you sure you want to delete this item?')) {
    const token = localStorage.getItem('authToken')
    fetch(`/api/inventory/${itemId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => {
      if (response.ok) {
        loadCurrentInventory()
      }
    })
    .catch(error => console.error('Error deleting item:', error))
  }
}

function waitFor3Dmol(callback, maxAttempts = 20) {
  if (typeof window.$3Dmol !== 'undefined') {
    callback()
    return
  }
  
  if (maxAttempts <= 0) {
    console.error('3Dmol library failed to load after multiple attempts')
    return
  }
  
  console.log(`Waiting for 3Dmol library... (${maxAttempts} attempts remaining)`)
  setTimeout(() => waitFor3Dmol(callback, maxAttempts - 1), 250)
}

function render3DModelTiny(itemId, cid) {
  const viewer = document.getElementById(`viewer3d-tiny-${itemId}`)
  if (!viewer || !cid) return
  
  // Wait for 3Dmol library to be loaded
  waitFor3Dmol(() => {
    try {
      console.log(`Rendering 3D model for item ${itemId} with CID ${cid}`)
      const config = { backgroundColor: 'white' }
      const viewer3d = $3Dmol.createViewer(viewer, config)
      
      const timeoutId = setTimeout(() => {
        viewer.innerHTML = '<span style="color: #666; font-size: 12px;">Loading...</span>'
      }, 3000)
      
      fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/record/SDF/?record_type=3d`)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`)
          }
          return response.text()
        })
        .then(data => {
          clearTimeout(timeoutId)
          if (data && data.trim()) {
            viewer3d.addModel(data, 'sdf')
            viewer3d.zoomTo()
            viewer3d.render()
            console.log(`3D model rendered successfully for item ${itemId}`)
          } else {
            viewer.innerHTML = '<span style="color: #666; font-size: 12px;">No 3D data</span>'
          }
        })
        .catch(error => {
          clearTimeout(timeoutId)
          console.error(`Error loading 3D model for item ${itemId}:`, error)
          viewer.innerHTML = '<span style="color: #666; font-size: 12px;">3D Model</span>'
        })
    } catch (error) {
      console.error(`Error rendering 3D model for item ${itemId}:`, error)
      viewer.innerHTML = '<span style="color: #666; font-size: 12px;">3D Model</span>'
    }
  })
}

async function changePassword() {
  const currentPassword = document.getElementById('currentPassword')
  const newPassword = document.getElementById('newPassword')
  const confirmPassword = document.getElementById('confirmPassword')
  const passwordError = document.getElementById('passwordError')
  const passwordSuccess = document.getElementById('passwordSuccess')
  
  if (!currentPassword || !newPassword || !confirmPassword) return
  
  passwordError.textContent = ''
  passwordSuccess.textContent = ''
  
  if (newPassword.value !== confirmPassword.value) {
    passwordError.textContent = 'New passwords do not match'
    return
  }
  
  try {
    const token = localStorage.getItem('authToken')
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        currentPassword: currentPassword.value,
        newPassword: newPassword.value
      })
    })
    
    const data = await response.json()
    
    if (response.ok) {
      passwordSuccess.textContent = 'Password changed successfully!'
      currentPassword.value = ''
      newPassword.value = ''
      confirmPassword.value = ''
    } else {
      passwordError.textContent = data.message || 'Failed to change password'
    }
  } catch (error) {
    console.error('Change password error:', error)
    passwordError.textContent = 'Network error. Please try again.'
  }
}

function showView(viewName) {
  // Hide all views
  document.querySelectorAll('.view-content').forEach(view => {
    view.classList.remove('active')
  })
  
  // Show selected view
  const selectedView = document.getElementById(viewName)
  if (selectedView) {
    selectedView.classList.add('active')
  }
  
  // Update sidebar button states
  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.classList.remove('active')
  })
  
  if (viewName === 'inventories-view') {
    inventoriesBtn.classList.add('active')
  } else if (viewName === 'account-view') {
    accountBtn.classList.add('active')
  }
}

function showInventoryDetail(inventoryId) {
  console.log('showInventoryDetail called with inventoryId:', inventoryId)
  currentInventoryId = inventoryId
  console.log('Setting currentInventoryId to:', currentInventoryId)
  
  showView('inventory-detail-view')
  
  // Update inventory name
  const currentInventory = inventories.find(inv => inv.id === inventoryId)
  console.log('Found inventory:', currentInventory)
  
  if (currentInventory) {
    const nameElement = document.getElementById('currentInventoryName')
    if (nameElement) {
      nameElement.textContent = currentInventory.name
    }
  }
  
  // Load inventory data
  console.log('Calling loadCurrentInventory...')
  loadCurrentInventory()
}

function switchDetailTab(tabName) {
  console.log('switchDetailTab called with tabName:', tabName)
  
  detailTabs.forEach(tab => tab.classList.remove('active'))
  detailTabContents.forEach(content => content.classList.remove('active'))
  
  const activeTab = document.querySelector(`[data-tab="${tabName}"]`)
  if (activeTab) {
    activeTab.classList.add('active')
    console.log('Activated tab:', activeTab)
  }
  
  let activeContent
  if (tabName === 'inventory') {
    activeContent = document.getElementById('inventory-items-tab')
  } else if (tabName === 'locations') {
    activeContent = document.getElementById('inventory-locations-tab')
  }
  
  if (activeContent) {
    activeContent.classList.add('active')
    console.log('Activated content:', activeContent)
    
    // If switching to inventory tab, re-render the inventory
    if (tabName === 'inventory') {
      console.log('Re-rendering inventory for tab switch')
      renderInventory()
    }
  } else {
    console.log('Active content not found for tab:', tabName)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    initDarkMode()
    setupEventListeners()
    checkAuth()
    
    // Test 3Dmol library loading
    setTimeout(() => {
      console.log('3Dmol library status check:')
      console.log('- Library loaded:', typeof window.$3Dmol !== 'undefined')
      console.log('- Library object:', window.$3Dmol)
    }, 2000)
  } catch (error) {
    console.error('Initialization error:', error)
  }
})


