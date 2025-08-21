const storageKey = 'inventoryItemsV2'
const locationsKey = 'inventoryLocationsV1'

const lookupForm = document.getElementById('lookupForm')
const lookupQueryInput = document.getElementById('lookupQuery')
const lookupError = document.getElementById('lookupError')

const itemForm = document.getElementById('itemForm')
const itemName = document.getElementById('itemName')
const vendor = document.getElementById('vendor')
const catalog = document.getElementById('catalog')
const cas = document.getElementById('cas')
const price = document.getElementById('price')
const unitSize = document.getElementById('unitSize')
const amount = document.getElementById('amount')
const amountUnit = document.getElementById('amountUnit')
const minStock = document.getElementById('minStock')
const maxStock = document.getElementById('maxStock')
const url = document.getElementById('url')
const locationSelect = document.getElementById('location')
const newLocationInput = document.getElementById('newLocation')
const addLocationBtn = document.getElementById('addLocationBtn')
const formError = document.getElementById('formError')

const viewerEl = document.getElementById('viewer3d-small')
const darkModeToggle = document.getElementById('darkModeToggle')
const darkModeIcon = document.getElementById('darkModeIcon')
let viewer
let spinHandle = null
let currentModelCid = null
let currentInventoryId = null
let currentLocations = []

const defaultUnits = ['mL', 'L', 'g', 'kg', 'mg', 'µL', 'units']

function showLookupSection(show) {
  const lookupSection = document.querySelector('.card:has(#lookupForm)')
  if (lookupSection) {
    lookupSection.style.display = show ? 'block' : 'none'
  }
}

function clear3DModel() {
  if (viewerEl) {
    viewerEl.innerHTML = ''
  }
  currentModelCid = null
  if (spinHandle) {
    cancelAnimationFrame(spinHandle)
    spinHandle = null
  }
}

function loadLocations() {
  const raw = localStorage.getItem(locationsKey)
  const list = raw ? JSON.parse(raw) : []
  if (list.length === 0) {
    const defaultLocations = ['Main Lab', 'Cold Room', 'Chemical Store']
    saveLocations(defaultLocations)
    return defaultLocations
  }
  return list
}

function saveLocations(list) {
  localStorage.setItem(locationsKey, JSON.stringify(list))
}

function renderLocations() {
  const list = loadLocations()
  locationSelect.innerHTML = ''
  const frag = document.createDocumentFragment()
  list.forEach(loc => {
    const opt = document.createElement('option')
    opt.value = loc
    opt.textContent = loc
    frag.appendChild(opt)
  })
  locationSelect.appendChild(frag)
}

function ensureDefaultLocations() {
  const raw = localStorage.getItem(locationsKey)
  if (!raw) {
    const defaultLocations = ['Main Lab', 'Cold Room', 'Chemical Store']
    saveLocations(defaultLocations)
  }
}

function renderAmountUnits() {
  amountUnit.innerHTML = ''
  const frag = document.createDocumentFragment()
  defaultUnits.forEach(u => {
    const opt = document.createElement('option')
    opt.value = u
    opt.textContent = u
    frag.appendChild(opt)
  })
  amountUnit.appendChild(frag)
}

function loadItems() {
  const raw = localStorage.getItem(storageKey)
  return raw ? JSON.parse(raw) : []
}

function saveItems(items) {
  localStorage.setItem(storageKey, JSON.stringify(items))
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
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

async function fetchPubChemSummary(query) {
  console.log('fetchPubChemSummary called with query:', query)
  const base = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound'
  // Check if query looks like a CAS number
  const isCas = /^(\d{1,7}-\d{2}-\d)$/.test(query.trim())
  console.log('Query is CAS number:', isCas)
  
  let url, res, data, record, id
  
  if (isCas) {
    console.log('Looking up CAS number:', query.trim())
    // Look up by CAS number - first search for the CAS to get the CID
    url = `${base}/name/${encodeURIComponent(query.trim())}/JSON`
    console.log('Trying URL:', url)
    res = await fetch(url, { headers: { 'Accept': 'application/json' } })
    console.log('First attempt response status:', res.status)
    
    if (!res.ok) {
      // If name search fails, try searching by CAS as a synonym
      url = `${base}/synonyms/${encodeURIComponent(query.trim())}/JSON`
      console.log('Trying synonyms URL:', url)
      res = await fetch(url, { headers: { 'Accept': 'application/json' } })
      console.log('Synonyms attempt response status:', res.status)
      if (!res.ok) throw new Error('CAS lookup failed')
    }
    
    data = await res.json()
    console.log('Response data structure:', Object.keys(data))
    
    // Extract CID from the response
    if (data?.PC_Compounds?.[0]) {
      id = data.PC_Compounds[0].id?.id?.cid
      console.log('Found CID from PC_Compounds:', id)
    } else if (data?.InformationList?.Information?.[0]?.CID) {
      id = data.InformationList.Information[0].CID
      console.log('Found CID from InformationList:', id)
    } else {
      console.log('No CID found in response data')
      throw new Error('No results for CAS')
    }
  } else {
    // Look up by name
    url = `${base}/name/${encodeURIComponent(query.trim())}/JSON`
    res = await fetch(url, { headers: { 'Accept': 'application/json' } })
    if (!res.ok) throw new Error('Name lookup failed')
    data = await res.json()
    record = data?.PC_Compounds?.[0]
    if (!record) throw new Error('No results')
    id = record?.id?.id?.cid
  }
  let casVal = ''
  let title = ''
  try {
    const propRes = await fetch(`${base}/cid/${id}/property/Title/JSON`)
    if (propRes.ok) {
      const prop = await propRes.json()
      const p = prop?.PropertyTable?.Properties?.[0]
      title = p?.Title || ''
    }
  } catch (_) {}
  try {
    const synRes = await fetch(`${base}/cid/${id}/synonyms/JSON`)
    if (synRes.ok) {
      const syn = await synRes.json()
      const list = syn?.InformationList?.Information?.[0]?.Synonym || []
      const found = list.find(s => /^(\d{1,7}-\d{2}-\d)$/.test(s))
      casVal = found || ''
    }
  } catch (_) {}
  const result = { cid: id, name: title || query.trim(), cas: casVal }
  console.log('fetchPubChemSummary returning:', result)
  return result
}

function initViewer() {
  if (!viewerEl || typeof $3Dmol === 'undefined') return
  viewer = $3Dmol.createViewer(viewerEl, { backgroundColor: '#ffffff' })
  viewer.render()
  if (viewerEl && viewerEl.querySelector('canvas')) {
    const canvas = viewerEl.querySelector('canvas')
    canvas.style.position = 'absolute'
    canvas.style.inset = '0'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
  }
  window.addEventListener('resize', () => {
    if (viewer) viewer.resize()
  })
}

async function render3DModel(cid) {
  if (!viewer || !cid) return
  console.log('Rendering 3D model for CID:', cid)
  currentModelCid = cid
  viewerEl.innerHTML = ''
  viewer = $3Dmol.createViewer(viewerEl, { backgroundColor: '#ffffff' })
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`
    const res = await fetch(url)
    if (!res.ok) throw new Error('No 3D available')
    const sdf = await res.text()
    viewer.addModel(sdf, 'sdf')
    viewer.setStyle({}, { stick: { radius: 0.12 } })
    viewer.zoomTo()
    viewer.render()
    if (viewerEl && viewerEl.querySelector('canvas')) {
      const canvas = viewerEl.querySelector('canvas')
      canvas.style.position = 'absolute'
      canvas.style.inset = '0'
      canvas.style.width = '100%'
      canvas.style.height = '100%'
    }
    if (viewer) viewer.resize()
    animateSpin(viewer)
    console.log('3D model rendered successfully for CID:', cid)
  } catch (error) {
    console.error('Failed to render 3D model for CID:', cid, error)
    currentModelCid = null
  }
}

function animateSpin(viewer) {
  if (spinHandle) cancelAnimationFrame(spinHandle)
  function step() {
    viewer.rotate(1, 'y')
    viewer.render()
    spinHandle = requestAnimationFrame(step)
  }
  spinHandle = requestAnimationFrame(step)
}

async function loadInventoryAndLocations() {
  const token = localStorage.getItem('authToken')
  if (!token) {
    window.location.href = 'login.html'
    return
  }

  try {
    const response = await fetch('/api/inventories', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (response.ok) {
      const inventories = await response.json()
      if (inventories.length > 0) {
        currentInventoryId = inventories[0].id
        await loadLocations()
      }
    }
  } catch (error) {
    console.error('Error loading inventories:', error)
  }
}

async function loadInventories() {
  const token = localStorage.getItem('authToken')
  if (!token) {
    window.location.href = 'login.html'
    return
  }

  try {
    const response = await fetch('/api/inventories', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (response.ok) {
      const inventories = await response.json()
      if (inventories.length > 0) {
        currentInventoryId = inventories[0].id
        await loadLocations()
      }
    }
  } catch (error) {
    console.error('Error loading inventories:', error)
  }
}

async function loadLocations() {
  const token = localStorage.getItem('authToken')
  if (!token) {
    window.location.href = 'login.html'
    return
  }

  if (!currentInventoryId) return
  
  try {
    const response = await fetch(`/api/locations/${currentInventoryId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (response.ok) {
      currentLocations = await response.json()
      renderLocationOptions()
    }
  } catch (error) {
    console.error('Error loading locations:', error)
  }
}

function renderLocationOptions() {
  const locationSelect = document.getElementById('location')
  if (!locationSelect) return
  
  locationSelect.innerHTML = '<option value="">Select a location</option>'
  currentLocations.forEach(location => {
    const option = document.createElement('option')
    option.value = location.name
    option.textContent = location.name
    locationSelect.appendChild(option)
  })
}

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Starting initialization...')
  checkAuth()
  loadInventoryAndLocations()
  ensureDefaultLocations()
  renderAmountUnits()
  initViewer()
  initDarkMode()
  
  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', toggleDarkMode)
  }
  
  showLookupSection(true)
  
  cas.addEventListener('input', () => {
    if (!cas.value.trim()) {
      showLookupSection(true)
      clear3DModel()
    }
  })
  
  try {
    const imageData = localStorage.getItem('scannedImageData')
    if (imageData) {
      const imagePreview = document.getElementById('imagePreview')
      const scannedImage = document.getElementById('scannedImage')
      if (imagePreview && scannedImage) {
        console.log('Found image elements, setting up image display...')
        scannedImage.src = imageData
        imagePreview.style.display = 'flex'
        console.log('Displaying scanned image:', imageData.substring(0, 100) + '...')
      } else {
        console.error('Image elements not found:', { imagePreview, scannedImage })
      }
    } else {
      console.log('No scanned image data found in localStorage')
    }
  } catch (error) {
    console.error('Error displaying scanned image:', error)
  }
  
  // Add a small delay to ensure form elements are fully loaded
  setTimeout(() => {
    try {
      const raw = localStorage.getItem('pendingNewItemPopulate')
      console.log('Found pending data:', raw)
      if (raw) {
        const p = JSON.parse(raw)
        console.log('Parsed pending data:', p)
        
        // Check if form elements exist
        if (!cas || !amount || !amountUnit || !itemName) {
          console.error('Form elements not found:', { cas: !!cas, amount: !!amount, amountUnit: !!amountUnit, itemName: !!itemName })
          return
        }
        
        if (p?.cas && !cas.value) {
          cas.value = p.cas
          console.log('Set CAS to:', p.cas)
        }
        
        if (p?.amount && p.amount !== null && !Number.isNaN(p.amount)) {
          amount.value = String(p.amount)
          console.log('Set amount to:', p.amount)
        }
        
        if (p?.amountUnit && p.amountUnit !== null) {
          amountUnit.value = p.amountUnit
          console.log('Set amount unit to:', p.amountUnit)
        }
        
        if (p?.cas) {
          console.log('Fetching PubChem data for CAS:', p.cas)
          fetchPubChemSummary(p.cas).then(info => {
            console.log('PubChem response:', info)
            if (info.name && !itemName.value) {
              itemName.value = info.name
              console.log('Set item name to:', info.name)
            }
            if (info.cid) {
              render3DModel(info.cid)
              console.log('Rendering 3D model for CID:', info.cid)
            }
            showLookupSection(false)
          }).catch((error) => {
            console.error('PubChem fetch error:', error)
            console.error('Error details:', error.message)
            showLookupSection(true)
          })
        }
        
        // Don't clear the data yet - let the user see it populated
        console.log('Data populated successfully, keeping pending data for now')
      } else {
        console.log('No pending data found')
      }
    } catch (error) {
      console.error('Error populating pending data:', error)
    }
  }, 100)
})

function checkAuth() {
  const token = localStorage.getItem('authToken')
  const user = localStorage.getItem('currentUser')
  
  if (!token || !user) {
    window.location.href = 'login.html'
    return
  }
}

lookupForm.addEventListener('submit', async e => {
  e.preventDefault()
  lookupError.textContent = ''
  const q = (lookupQueryInput.value || '').trim()
  if (!q) {
    lookupError.textContent = 'Enter a CAS or name.'
    return
  }
  try {
    const info = await fetchPubChemSummary(q)
    if (info.name && !itemName.value) itemName.value = info.name
    if (info.cas && !cas.value) cas.value = info.cas
    if (info.cid) render3DModel(info.cid)
    showLookupSection(false)
  } catch (_) {
    lookupError.textContent = 'No match found.'
    showLookupSection(true)
  }
})

addLocationBtn.addEventListener('click', () => {
  const name = (newLocationInput.value || '').trim()
  if (!name) return
  const list = loadLocations()
  if (!list.includes(name)) {
    list.push(name)
    saveLocations(list)
    renderLocations()
    locationSelect.value = name
  }
  newLocationInput.value = ''
})

itemForm.addEventListener('submit', async e => {
  e.preventDefault()
  formError.textContent = ''
  if (!itemName.value) {
    formError.textContent = 'Item Name is required.'
    return
  }
  
  try {
    const token = localStorage.getItem('authToken')
    const imageData = localStorage.getItem('scannedImageData') || null
    const modelCid = currentModelCid
    
    // Check image data size
    if (imageData && imageData.length > 5 * 1024 * 1024) { // 5MB limit
      formError.textContent = 'Image data is too large. Please try scanning again with a smaller image.'
      return
    }
    
    console.log('Submitting with image data:', imageData ? 'Present' : 'None')
    console.log('Submitting with model CID:', modelCid)
    console.log('Image data size:', imageData ? `${(imageData.length / 1024).toFixed(1)}KB` : 'None')
    
    const response = await fetch('/api/inventory', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        itemName: itemName.value.trim(),
        vendor: vendor.value.trim(),
        catalog: catalog.value.trim(),
        cas: cas.value.trim(),
        price: price.value ? Number(price.value) : null,
        unitSize: unitSize.value.trim(),
        amount: amount.value ? Number(amount.value) : null,
        amountUnit: amountUnit.value,
        minStock: minStock.value ? Number(minStock.value) : null,
        maxStock: maxStock.value ? Number(maxStock.value) : null,
        url: url.value.trim(),
        location: locationSelect.value,
        imageData: imageData,
        modelCid: modelCid
      })
    })
    
    if (response.ok) {
      const result = await response.json()
      console.log('Item added successfully:', result)
      localStorage.removeItem('scannedImageData')
      localStorage.removeItem('pendingNewItemPopulate')
      clear3DModel()
      window.location.href = 'index.html'
    } else {
      const data = await response.json()
      formError.textContent = data.message || 'Failed to add item'
    }
  } catch (error) {
    console.error('Submit error:', error)
    formError.textContent = 'Network error. Please try again.'
  }
})



