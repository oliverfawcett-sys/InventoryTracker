const imageInput = document.getElementById('imageInput')
const scanStatus = document.getElementById('scanStatus')
const scanResult = document.getElementById('scanResult')
const btnCamera = document.getElementById('btnCamera')
const camera = document.getElementById('camera')
const cameraControls = document.getElementById('cameraControls')
const btnCapture = document.getElementById('btnCapture')
const btnCancelCamera = document.getElementById('btnCancelCamera')
const darkModeToggle = document.getElementById('darkModeToggle')
const darkModeIcon = document.getElementById('darkModeIcon')

let stream = null
let currentInventoryId = null

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

// Debug function to check camera support
function checkCameraSupport() {
  console.log('MediaDevices supported:', !!navigator.mediaDevices)
  console.log('getUserMedia supported:', !!navigator.mediaDevices?.getUserMedia)
  console.log('Camera element:', camera)
  console.log('Camera readyState:', camera.readyState)
}

async function handleFile(file) {
  scanStatus.textContent = 'Scanning bottle...'
  scanResult.textContent = ''
  await extractCasAndRedirect(file)
}

async function startCamera() {
  try {
    scanStatus.textContent = 'Starting camera...'
    
    // Check if camera is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera not supported in this browser')
    }
    
    // Request camera access
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      } 
    })
    
    // Set up video element
    camera.srcObject = stream
    camera.style.display = 'block'
    
    // Wait for video to be ready
    await new Promise((resolve) => {
      camera.onloadedmetadata = () => resolve()
    })
    
    // Show controls and hide camera button
    cameraControls.style.display = 'block'
    btnCamera.style.display = 'none'
    
    scanStatus.textContent = 'Camera ready. Position the bottle and click Capture.'
    console.log('Camera started successfully')
    
  } catch (e) {
    console.error('Camera error:', e)
    scanStatus.textContent = `Camera error: ${e.message}. Please use file upload instead.`
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
    stream = null
  }
  camera.style.display = 'none'
  cameraControls.style.display = 'none'
  btnCamera.style.display = 'inline-flex'
  scanStatus.textContent = ''
}

async function capturePhoto() {
  try {
    if (!stream || camera.readyState !== 4) {
      scanStatus.textContent = 'Camera not ready. Please wait...'
      return
    }
    
    scanStatus.textContent = 'Capturing photo...'
    
    const canvas = document.createElement('canvas')
    canvas.width = camera.videoWidth
    canvas.height = camera.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(camera, 0, 0)
    
    canvas.toBlob(async (blob) => {
      const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' })
      stopCamera()
      scanStatus.textContent = 'Processing photo...'
      await extractCasAndRedirect(file)
    }, 'image/jpeg', 0.9)
    
  } catch (e) {
    console.error('Capture error:', e)
    scanStatus.textContent = `Capture failed: ${e.message}`
  }
}

imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0]
  if (file) handleFile(file)
})

btnCamera.addEventListener('click', () => {
  checkCameraSupport()
  startCamera()
})
btnCapture.addEventListener('click', capturePhoto)
btnCancelCamera.addEventListener('click', stopCamera)

async function extractCasAndRedirect(file) {
  try {
    const token = localStorage.getItem('authToken')
    const form = new FormData()
    form.append('image', file)
    
    const res = await fetch('/api/extract-cas', { 
      method: 'POST', 
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: form 
    })
    
    const data = await res.json()
    
    if (!res.ok) {
      scanStatus.textContent = 'Scan failed: ' + (data.message || 'Server error')
      setTimeout(() => window.location.href = 'new.html', 2000)
      return
    }
    
    if (data.cas) {
      const payload = { cas: data.cas, amount: data.massValue ?? null, amountUnit: data.massUnit || null }
      try { 
        localStorage.setItem('pendingNewItemPopulate', JSON.stringify(payload)) 
        console.log('Stored pending data:', payload)
      } catch (error) {
        console.error('Failed to store pending data:', error)
      }
      scanStatus.textContent = 'Information found! Opening form...'
    } else {
      scanStatus.textContent = 'No information found. Opening empty form...'
    }
    
    const reader = new FileReader()
    reader.onload = function(e) {
      try { 
        // Compress the image to reduce size
        const img = new Image()
        img.onload = function() {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          
          // Set canvas size to reasonable dimensions
          const maxSize = 400
          let { width, height } = img
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width
              width = maxSize
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height
              height = maxSize
            }
          }
          
          canvas.width = width
          canvas.height = height
          
          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height)
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7)
        
          localStorage.setItem('scannedImageData', compressedDataUrl) 
          console.log('Stored compressed image data, length:', compressedDataUrl.length)
          console.log('Image data preview:', compressedDataUrl.substring(0, 100) + '...')
          
          // Verify the data was stored
          const stored = localStorage.getItem('scannedImageData')
          console.log('Verified stored data length:', stored ? stored.length : 'null')
        }
        img.src = e.target.result
      } catch (error) {
        console.error('Failed to store image data:', error)
      }
    }
    reader.readAsDataURL(file)
    
    // Wait a bit longer to ensure localStorage is written
    setTimeout(() => {
      try { 
        console.log('Redirecting to new.html with image data stored')
        console.log('Final localStorage check - scannedImageData:', localStorage.getItem('scannedImageData') ? 'Present' : 'Missing')
        window.location.href = 'new.html' 
      } catch (error) {
        console.error('Failed to redirect:', error)
      }
    }, 1500)
    
  } catch (e) {
    scanStatus.textContent = 'Scan failed: ' + (e?.message || e)
    setTimeout(() => window.location.href = 'new.html', 2000)
  }
}

async function lookupNameByCas(cas) {
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(cas)}/property/Title/JSON`
    const res = await fetch(url)
    if (!res.ok) return ''
    const data = await res.json()
    const p = data?.PropertyTable?.Properties?.[0]
    return p?.Title || ''
  } catch (_) {
    return ''
  }
}

async function loadInventoryAndLocations() {
  const pendingInventoryId = localStorage.getItem('pendingInventoryId')
  if (pendingInventoryId) {
    currentInventoryId = parseInt(pendingInventoryId)
    localStorage.removeItem('pendingInventoryId')
  } else {
    await loadInventories()
  }
}

async function loadInventories() {
  try {
    const token = localStorage.getItem('authToken')
    const response = await fetch('/api/inventories', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (response.ok) {
      const inventories = await response.json()
      if (inventories.length > 0) {
        currentInventoryId = inventories[0].id
      }
    }
  } catch (error) {
    console.error('Error loading inventories:', error)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth()
  initDarkMode()
  loadInventoryAndLocations()
  
  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', toggleDarkMode)
  }
})

function checkAuth() {
  const token = localStorage.getItem('authToken')
  const user = localStorage.getItem('currentUser')
  
  if (!token || !user) {
    window.location.href = 'login.html'
    return
  }
}


