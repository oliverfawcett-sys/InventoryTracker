const loginForm = document.getElementById('loginForm')
const signupForm = document.getElementById('signupForm')
const signupSection = document.getElementById('signupSection')
const showSignup = document.getElementById('showSignup')
const showLogin = document.getElementById('showLogin')
const darkModeToggle = document.getElementById('darkModeToggle')
const darkModeIcon = document.getElementById('darkModeIcon')

let currentUser = null

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

function checkAuth() {
  const token = localStorage.getItem('authToken')
  const user = localStorage.getItem('currentUser')
  
  if (token && user) {
    try {
      currentUser = JSON.parse(user)
      window.location.href = 'index.html'
    } catch (e) {
      localStorage.removeItem('authToken')
      localStorage.removeItem('currentUser')
    }
  }
}

showSignup.addEventListener('click', (e) => {
  e.preventDefault()
  signupSection.style.display = 'block'
  document.querySelector('.card:first-of-type').style.display = 'none'
})

showLogin.addEventListener('click', (e) => {
  e.preventDefault()
  signupSection.style.display = 'none'
  document.querySelector('.card:first-of-type').style.display = 'block'
})

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    
    const data = await response.json()
    
    if (response.ok) {
      localStorage.setItem('authToken', data.token)
      localStorage.setItem('currentUser', JSON.stringify(data.user))
      window.location.href = 'index.html'
    } else {
      document.getElementById('loginError').textContent = data.message || 'Login failed'
    }
  } catch (error) {
    document.getElementById('loginError').textContent = 'Network error. Please try again.'
  }
})

signupForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  const name = document.getElementById('signupName').value
  const email = document.getElementById('signupEmail').value
  const password = document.getElementById('signupPassword').value
  const confirmPassword = document.getElementById('confirmPassword').value
  
  if (password !== confirmPassword) {
    document.getElementById('signupError').textContent = 'Passwords do not match'
    return
  }
  
  try {
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    })
    
    const data = await response.json()
    
    if (response.ok) {
      document.getElementById('signupError').textContent = 'Account created! Please login.'
      document.getElementById('signupError').className = 'success'
      setTimeout(() => {
        signupSection.style.display = 'none'
        document.querySelector('.card:first-of-type').style.display = 'block'
        document.getElementById('loginError').textContent = ''
        document.getElementById('signupError').className = 'error'
      }, 2000)
    } else {
      document.getElementById('signupError').textContent = data.message || 'Signup failed'
    }
  } catch (error) {
    document.getElementById('signupError').textContent = 'Network error. Please try again.'
  }
})

initDarkMode()

if (darkModeToggle) {
  darkModeToggle.addEventListener('click', toggleDarkMode)
}

checkAuth()
