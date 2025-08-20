const storageKey = 'inventoryItemsV2'
const locationsKey = 'inventoryLocationsV1'

const searchInput = document.getElementById('searchInput')
const inventoryTable = document.getElementById('inventoryTable')
const itemCount = document.getElementById('itemCount')
const userInfo = document.getElementById('userInfo')
const logoutBtn = document.getElementById('logoutBtn')

let currentUser = null

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
    inventoryTable.innerHTML = '<tr><td colspan="11" class="text-center">No inventory items found</td></tr>'
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
      <td>
        <button class="btn danger" onclick="deleteItem(${item.id})">Delete</button>
      </td>
    </tr>
  `).join('')
  
  itemCount.textContent = `${filteredItems.length} items`
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

searchInput.addEventListener('input', () => {
  loadInventory()
})

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('authToken')
  localStorage.removeItem('currentUser')
  window.location.href = 'login.html'
})

checkAuth()

 


