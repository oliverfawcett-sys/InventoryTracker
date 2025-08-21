const storageKey = 'inventoryItemsV2'
const locationsKey = 'inventoryLocationsV1'

const searchInput = document.getElementById('searchInput')
const inventoryTable = document.getElementById('inventoryTable')
const itemCount = document.getElementById('itemCount')
const userInfo = document.getElementById('userInfo')
const logoutBtn = document.getElementById('logoutBtn')
const darkModeToggle = document.getElementById('darkModeToggle')
const darkModeIcon = document.getElementById('darkModeIcon')
const navTabs = document.querySelectorAll('.nav-tab')
const tabContents = document.querySelectorAll('.tab-content')
const mobileNavToggle = document.getElementById('mobileNavToggle')
const mobileNavDropdown = document.getElementById('mobileNavDropdown')
const mobileNavItems = document.querySelectorAll('.mobile-nav-item')
const mobileNavText = document.querySelector('.mobile-nav-text')
const newLocationInput = document.getElementById('newLocationInput')
const addLocationBtn = document.getElementById('addLocationBtn')
const locationItems = document.getElementById('locationItems')
const accountName = document.getElementById('accountName')
const accountEmail = document.getElementById('accountEmail')
const passwordForm = document.getElementById('passwordForm')
const currentPassword = document.getElementById('currentPassword')
const newPassword = document.getElementById('newPassword')
const confirmNewPassword = document.getElementById('confirmNewPassword')
const passwordError = document.getElementById('passwordError')
const passwordSuccess = document.getElementById('passwordSuccess')

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

function checkAuth() {
  const token = localStorage.getItem('authToken')
  const user = localStorage.getItem('currentUser')
  
  if (!token || !user) {
    window.location.href = 'login.html'
    return
  }
  
  try {
    currentUser = JSON.parse(user)
    userInfo.textContent = `Welcome, ${currentUser.name}`
    loadInventory()
    loadAccountInfo()
    renderLocations()
  } catch (e) {
    localStorage.removeItem('authToken')
    localStorage.removeItem('currentUser')
    window.location.href = 'login.html'
  }
}

async function loadInventory() {
  try {
    const token = localStorage.getItem('authToken')
    const response = await fetch('/api/inventory', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.status === 401) {
      localStorage.removeItem('authToken')
      localStorage.removeItem('currentUser')
      window.location.href = 'login.html'
      return
    }
    
    const items = await response.json()
    renderInventory(items)
  } catch (error) {
    console.error('Failed to load inventory:', error)
  }
}

function renderInventory(items) {
  if (!items || items.length === 0) {
    inventoryTable.innerHTML = '<tr><td colspan="14" class="text-center">No inventory items found</td></tr>'
    itemCount.textContent = '0 items'
    return
  }
  
  const filteredItems = searchInput.value ? items.filter(item => 
    Object.values(item).some(val => 
      val && val.toString().toLowerCase().includes(searchInput.value.toLowerCase())
    )
  ) : items
  
  inventoryTable.innerHTML = filteredItems.map(item => `
    <tr>
      <td>${escapeHtml(item.item_name || '')}</td>
      <td>${escapeHtml(item.vendor || '')}</td>
      <td>${escapeHtml(item.catalog || '')}</td>
      <td>${escapeHtml(item.cas || '')}</td>
      <td>${item.amount || ''}</td>
      <td>${escapeHtml(item.unit_size || '')}</td>
      <td>${item.price ? `$${item.price}` : ''}</td>
      <td>${escapeHtml(item.location || '')}</td>
      <td>${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank">Link</a>` : ''}</td>
      <td>${item.min_stock || ''}</td>
      <td>${item.max_stock || ''}</td>
      <td>${item.image_data ? `<img src="${escapeHtml(item.image_data)}" alt="Item" style="width:50px;height:50px;object-fit:cover;border-radius:4px;">` : ''}</td>
      <td>${item.model_cid ? `<div class="viewer3d-tiny" data-cid="${escapeHtml(item.model_cid)}" title="3D Model (CID: ${escapeHtml(item.model_cid)})" style="width:50px;height:50px;"><div style="display:flex;align-items:center;justify-content:center;height:100%;color:#6b7280;font-size:10px;">Loading...</div></div>` : '<div class="viewer3d-tiny" title="No 3D Model Available" style="width:50px;height:50px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:10px;">No 3D</div>'}</td>
      <td>
        <button class="btn danger" onclick="deleteItem(${item.id})">Delete</button>
      </td>
    </tr>
  `).join('')
  
  itemCount.textContent = `${filteredItems.length} items`
  
  // Initialize 3D models for items that have them
  setTimeout(() => {
    if (typeof $3Dmol === 'undefined') {
      console.warn('3Dmol library not loaded yet, retrying...')
      setTimeout(() => renderInventory(items), 500)
      return
    }
    
    let renderedCount = 0
    filteredItems.forEach(item => {
      if (item.model_cid) {
        const viewerEl = document.querySelector(`[data-cid="${item.model_cid}"]`)
        if (viewerEl) {
          render3DModelTiny(viewerEl, item.model_cid).then(() => {
            renderedCount++
            console.log(`Rendered ${renderedCount}/${filteredItems.filter(i => i.model_cid).length} 3D models`)
          })
        } else {
          console.warn('Could not find viewer element for CID:', item.model_cid)
        }
      }
    })
  }, 100)
}

async function deleteItem(id) {
  if (!confirm('Are you sure you want to delete this item?')) return
  
  try {
    const token = localStorage.getItem('authToken')
    const response = await fetch(`/api/inventory/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    
    if (response.ok) {
      loadInventory()
    } else {
      alert('Failed to delete item')
    }
  } catch (error) {
    console.error('Delete error:', error)
    alert('Failed to delete item')
  }
}

function escapeHtml(s) {
  if (!s) return ''
  return s.toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function initDarkMode() {
  const savedTheme = localStorage.getItem('theme') || 'light'
  document.documentElement.setAttribute('data-theme', savedTheme)
  updateDarkModeIcon(savedTheme)
}

function toggleDarkMode() {
  const currentTheme = document.documentElement.getAttribute('data-theme')
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark'
  
  document.documentElement.setAttribute('data-theme', newTheme)
  localStorage.setItem('theme', newTheme)
  updateDarkModeIcon(newTheme)
}

function updateDarkModeIcon(theme) {
  if (darkModeIcon) {
    darkModeIcon.textContent = theme === 'dark' ? '☀️' : '🌙'
  }
}

function switchTab(tabName) {
  navTabs.forEach(tab => {
    tab.classList.remove('active')
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active')
    }
  })
  
  mobileNavItems.forEach(item => {
    item.classList.remove('active')
    if (item.dataset.tab === tabName) {
      item.classList.add('active')
    }
  })
  
  tabContents.forEach(content => {
    content.classList.remove('active')
    if (content.id === `${tabName}-tab`) {
      content.classList.add('active')
    }
  })
  
  if (mobileNavText) {
    mobileNavText.textContent = tabName.charAt(0).toUpperCase() + tabName.slice(1)
  }
  
  if (mobileNavDropdown) {
    mobileNavDropdown.classList.remove('active')
    mobileNavToggle.classList.remove('active')
  }
}

function loadLocations() {
  const raw = localStorage.getItem('inventoryLocationsV1')
  const list = raw ? JSON.parse(raw) : ['Main Lab', 'Cold Room', 'Chemical Store']
  return list
}

function saveLocations(list) {
  localStorage.setItem('inventoryLocationsV1', JSON.stringify(list))
}

function renderLocations() {
  const locations = loadLocations()
  locationItems.innerHTML = locations.map(location => `
    <div class="location-item">
      <span class="location-name">${escapeHtml(location)}</span>
      <div class="location-actions">
        <button class="btn danger" onclick="deleteLocation('${escapeHtml(location)}')">Delete</button>
      </div>
    </div>
  `).join('')
}

function addLocation(name) {
  const locations = loadLocations()
  if (!locations.includes(name)) {
    locations.push(name)
    saveLocations(locations)
    renderLocations()
    newLocationInput.value = ''
  }
}

function deleteLocation(name) {
  if (confirm(`Are you sure you want to delete the location "${name}"?`)) {
    const locations = loadLocations()
    const filtered = locations.filter(loc => loc !== name)
    saveLocations(filtered)
    renderLocations()
  }
}

function loadAccountInfo() {
  if (currentUser) {
    accountName.value = currentUser.name || ''
    accountEmail.value = currentUser.email || ''
  }
}

async function changePassword() {
  if (newPassword.value !== confirmNewPassword.value) {
    passwordError.textContent = 'New passwords do not match'
    passwordError.style.display = 'block'
    passwordSuccess.style.display = 'none'
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
      passwordSuccess.style.display = 'block'
      passwordError.style.display = 'none'
      passwordForm.reset()
    } else {
      passwordError.textContent = data.message || 'Failed to change password'
      passwordError.style.display = 'block'
      passwordSuccess.style.display = 'none'
    }
  } catch (error) {
    passwordError.textContent = 'Network error. Please try again.'
    passwordError.style.display = 'block'
    passwordSuccess.style.display = 'none'
  }
}

async function render3DModelTiny(viewerEl, cid) {
  try {
    if (!cid || !viewerEl) return
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)
    
    const viewer = $3Dmol.createViewer(viewerEl, { 
      backgroundColor: '#ffffff',
      antialias: true
    })
    
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`
    const res = await fetch(url, { signal: controller.signal })
    
    clearTimeout(timeoutId)
    
    if (!res.ok) {
      throw new Error('No 3D data available')
    }
    
    const sdf = await res.text()
    if (!sdf || sdf.trim() === '') {
      throw new Error('Empty SDF data')
    }
    
    viewer.addModel(sdf, 'sdf')
    viewer.setStyle({}, { stick: { radius: 0.08 } })
    viewer.zoomTo()
    viewer.render()
    
    viewerEl.style.border = '1px solid #10b981'
    console.log('3D model rendered successfully for CID:', cid)
  } catch (error) {
    console.error('Failed to render 3D model for CID', cid, ':', error)
    if (error.name === 'AbortError') {
      viewerEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#6b7280;font-size:10px;">Timeout</div>'
    } else {
      viewerEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#6b7280;font-size:10px;">3D</div>'
    }
    viewerEl.style.border = '1px solid #e5e7eb'
  }
}

searchInput.addEventListener('input', () => {
  loadInventory()
})

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('authToken')
  localStorage.removeItem('currentUser')
  window.location.href = 'login.html'
})

if (darkModeToggle) {
  darkModeToggle.addEventListener('click', toggleDarkMode)
}

navTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    switchTab(tab.dataset.tab)
  })
})

if (mobileNavToggle) {
  mobileNavToggle.addEventListener('click', () => {
    mobileNavDropdown.classList.toggle('active')
    mobileNavToggle.classList.toggle('active')
  })
}

mobileNavItems.forEach(item => {
  item.addEventListener('click', () => {
    switchTab(item.dataset.tab)
  })
})

if (addLocationBtn) {
  addLocationBtn.addEventListener('click', () => {
    const name = newLocationInput.value.trim()
    if (name) {
      addLocation(name)
    }
  })
}

if (newLocationInput) {
  newLocationInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const name = newLocationInput.value.trim()
      if (name) {
        addLocation(name)
      }
    }
  })
}

if (passwordForm) {
  passwordForm.addEventListener('submit', (e) => {
    e.preventDefault()
    changePassword()
  })
}

document.addEventListener('click', (e) => {
  if (mobileNavToggle && mobileNavDropdown) {
    if (!mobileNavToggle.contains(e.target) && !mobileNavDropdown.contains(e.target)) {
      mobileNavDropdown.classList.remove('active')
      mobileNavToggle.classList.remove('active')
    }
  }
})

initDarkMode()
checkAuth()

async function loadInventories() {
  try {
    const token = localStorage.getItem('authToken')
    const response = await fetch('/api/inventories', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (response.ok) {
      inventories = await response.json()
      renderInventorySelector()
      
      if (inventories.length > 0) {
        currentInventoryId = inventories[0].id
        inventorySelect.value = currentInventoryId
        await loadCurrentInventory()
      }
    }
  } catch (error) {
    console.error('Error loading inventories:', error)
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

inventorySelect.addEventListener('change', async (e) => {
  currentInventoryId = parseInt(e.target.value)
  if (currentInventoryId) {
    await loadCurrentInventory()
  }
})

createInventoryBtn.addEventListener('click', openCreateInventoryModal)
cancelCreateInventory.addEventListener('click', closeCreateInventoryModal)
createInventoryForm.addEventListener('submit', (e) => {
  e.preventDefault()
  createInventory()
})

scanBottleBtn.addEventListener('click', () => {
  if (currentInventoryId) {
    localStorage.setItem('pendingInventoryId', currentInventoryId)
    window.location.href = 'scan.html'
  } else {
    alert('Please select an inventory first')
  }
})

manualEntryBtn.addEventListener('click', () => {
  if (currentInventoryId) {
    localStorage.setItem('pendingInventoryId', currentInventoryId)
    window.location.href = 'new.html'
  } else {
    alert('Please select an inventory first')
  }
})

 


