const darkModeToggle = document.getElementById('darkModeToggle')
const darkModeIcon = document.getElementById('darkModeIcon')

let navTabs
let tabContents

const inventorySelect = document.getElementById('inventorySelect')
const createInventoryBtn = document.getElementById('createInventoryBtn')
const createInventoryModal = document.getElementById('createInventoryModal')
const createInventoryForm = document.getElementById('createInventoryForm')
const cancelCreateInventory = document.getElementById('cancelCreateInventory')
const inventoryName = document.getElementById('inventoryName')
const inventoryDescription = document.getElementById('inventoryDescription')
const scanBottleBtn = document.getElementById('scanBottleBtn')
const manualEntryBtn = document.getElementById('manualEntryBtn')
const inventoryContent = document.getElementById('inventoryContent')
const locationsContent = document.getElementById('locationsContent')

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
      renderInventorySelector()
      
      if (inventories.length > 0) {
        currentInventoryId = inventories[0].id
        inventorySelect.value = currentInventoryId
        await loadCurrentInventory()
      }
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

function renderInventorySelector() {
  inventorySelect.innerHTML = ''
  
  if (inventories.length === 0) {
    inventorySelect.innerHTML = '<option value="">No inventories found</option>'
    return
  }
  
  inventories.forEach(inventory => {
    const option = document.createElement('option')
    option.value = inventory.id
    option.textContent = inventory.name
    inventorySelect.appendChild(option)
  })
}

async function loadCurrentInventory() {
  if (!currentInventoryId) return
  
  await Promise.all([
    loadInventoryItems(),
    loadLocations()
  ])
}

async function loadInventoryItems() {
  try {
    const token = localStorage.getItem('authToken')
    const response = await fetch(`/api/inventory/${currentInventoryId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (response.ok) {
      currentInventoryItems = await response.json()
      renderInventory()
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
  if (!currentInventoryId) {
    inventoryContent.innerHTML = '<div class="empty-state"><p>Select an inventory to view items</p></div>'
    return
  }
  
  const currentInventory = inventories.find(inv => inv.id === currentInventoryId)
  
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
  if (!tableBody) return
  
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
  
  currentInventoryItems.forEach(item => {
    if (item.model_cid) {
      render3DModelTiny(item.id, item.model_cid)
    }
  })
}

function renderLocations() {
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
  const name = inventoryName.value.trim()
  const description = inventoryDescription.value.trim()
  
  if (!name) return
  
  try {
    const token = localStorage.getItem('authToken')
    const response = await fetch('/api/inventories', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, description })
    })
    
    if (response.ok) {
      const newInventory = await response.json()
      inventories.push(newInventory)
      renderInventorySelector()
      
      currentInventoryId = newInventory.id
      inventorySelect.value = currentInventoryId
      
      await loadCurrentInventory()
      closeCreateInventoryModal()
    }
  } catch (error) {
    console.error('Error creating inventory:', error)
  }
}

function openCreateInventoryModal() {
  createInventoryModal.classList.add('active')
  inventoryName.focus()
}

function closeCreateInventoryModal() {
  createInventoryModal.classList.remove('active')
  createInventoryForm.reset()
}

function setupSearch() {
  const searchInput = document.getElementById('searchInput')
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase()
      const filteredItems = currentInventoryItems.filter(item =>
        item.item_name?.toLowerCase().includes(searchTerm) ||
        item.vendor?.toLowerCase().includes(searchTerm) ||
        item.cas?.toLowerCase().includes(searchTerm)
      )
      renderFilteredInventory(filteredItems)
    })
  }
}

function renderFilteredInventory(filteredItems) {
  const tableBody = document.getElementById('inventoryTable')
  if (!tableBody) return
  
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
  
  filteredItems.forEach(item => {
    if (item.model_cid) {
      render3DModelTiny(item.id, item.model_cid)
    }
  })
}

function setupEventListeners() {
  navTabs = document.querySelectorAll('.nav-tab')
  tabContents = document.querySelectorAll('.tab-content')
  
  if (inventorySelect) {
    inventorySelect.addEventListener('change', async (e) => {
      currentInventoryId = parseInt(e.target.value)
      if (currentInventoryId) {
        await loadCurrentInventory()
      }
    })
  }

  if (createInventoryBtn) {
    createInventoryBtn.addEventListener('click', openCreateInventoryModal)
  }

  if (cancelCreateInventory) {
    cancelCreateInventory.addEventListener('click', closeCreateInventoryModal)
  }

  if (createInventoryForm) {
    createInventoryForm.addEventListener('submit', (e) => {
      e.preventDefault()
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

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab
      switchTab(tabName)
    })
  })

  const mobileNavToggle = document.getElementById('mobileNavToggle')
  if (mobileNavToggle) {
    mobileNavToggle.addEventListener('click', () => {
      const dropdown = document.getElementById('mobileNavDropdown')
      if (dropdown) {
        dropdown.classList.toggle('active')
      }
    })
  }

  const mobileNavItems = document.querySelectorAll('.mobile-nav-item')
  mobileNavItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.dataset.tab
      switchTab(tabName)
      const dropdown = document.getElementById('mobileNavDropdown')
      if (dropdown) {
        dropdown.classList.remove('active')
      }
    })
  })

  document.addEventListener('click', (e) => {
    const mobileNavToggle = document.getElementById('mobileNavToggle')
    const mobileNavDropdown = document.getElementById('mobileNavDropdown')
    if (mobileNavToggle && mobileNavDropdown && !mobileNavToggle.contains(e.target) && !mobileNavDropdown.contains(e.target)) {
      mobileNavDropdown.classList.remove('active')
    }
  })
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

function render3DModelTiny(itemId, cid) {
  const viewer = document.getElementById(`viewer3d-tiny-${itemId}`)
  if (!viewer || !cid || !window.$3Dmol) return
  
  try {
    const config = { backgroundColor: 'white' }
    const viewer3d = $3Dmol.createViewer(viewer, config)
    
    const timeoutId = setTimeout(() => {
      viewer.innerHTML = '<span style="color: #666; font-size: 12px;">3D Model</span>'
    }, 5000)
    
    fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/record/SDF/?record_type=3d`)
      .then(response => response.text())
      .then(data => {
        clearTimeout(timeoutId)
        if (data && data.trim()) {
          viewer3d.addModel(data, 'sdf')
          viewer3d.zoomTo()
        } else {
          viewer.innerHTML = '<span style="color: #666; font-size: 12px;">No 3D data</span>'
        }
      })
      .catch(error => {
        clearTimeout(timeoutId)
        console.error('Error loading 3D model:', error)
        viewer.innerHTML = '<span style="color: #666; font-size: 12px;">3D Model</span>'
      })
  } catch (error) {
    console.error('Error rendering 3D model:', error)
    viewer.innerHTML = '<span style="color: #666; font-size: 12px;">3D Model</span>'
  }
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

function switchTab(tabName) {
  navTabs.forEach(tab => tab.classList.remove('active'))
  tabContents.forEach(content => content.classList.remove('active'))
  
  const activeTab = document.querySelector(`[data-tab="${tabName}"]`)
  const activeContent = document.getElementById(`${tabName}-tab`)
  
  if (activeTab) activeTab.classList.add('active')
  if (activeContent) activeContent.classList.add('active')
  
  const mobileNavText = document.getElementById('mobileNavText')
  if (mobileNavText) {
    mobileNavText.textContent = tabName.charAt(0).toUpperCase() + tabName.slice(1)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    initDarkMode()
    setupEventListeners()
    checkAuth()
  } catch (error) {
    console.error('Initialization error:', error)
  }
})


