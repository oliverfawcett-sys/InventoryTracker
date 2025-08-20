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
      <td>${item.image_data ? `<img src="${escapeHtml(item.image_data)}" alt="Item" style="width:50px;height:50px;object-fit:cover;border-radius:4px;">` : ''}</td>
      <td>${item.model_cid ? `<div class="viewer3d-tiny" data-cid="${escapeHtml(item.model_cid)}" style="width:50px;height:50px;"></div>` : ''}</td>
      <td>
        <button class="btn danger" onclick="deleteItem(${item.id})">Delete</button>
      </td>
    </tr>
  `).join('')
  
  itemCount.textContent = `${filteredItems.length} items`
  
  // Initialize 3D models for items that have them
  setTimeout(() => {
    filteredItems.forEach(item => {
      if (item.model_cid) {
        const viewerEl = document.querySelector(`[data-cid="${item.model_cid}"]`)
        if (viewerEl && typeof $3Dmol !== 'undefined') {
          render3DModelTiny(viewerEl, item.model_cid)
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

async function render3DModelTiny(viewerEl, cid) {
  try {
    const viewer = $3Dmol.createViewer(viewerEl, { backgroundColor: '#ffffff' })
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`
    const res = await fetch(url)
    if (!res.ok) throw new Error('No 3D available')
    const sdf = await res.text()
    viewer.addModel(sdf, 'sdf')
    viewer.setStyle({}, { stick: { radius: 0.08 } })
    viewer.zoomTo()
    viewer.render()
  } catch (error) {
    console.error('Failed to render 3D model:', error)
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

checkAuth()

 


