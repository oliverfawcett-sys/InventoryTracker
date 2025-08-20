const loginForm = document.getElementById('loginForm')
const signupForm = document.getElementById('signupForm')
const signupSection = document.getElementById('signupSection')
const forgotPasswordSection = document.getElementById('forgotPasswordSection')
const showSignup = document.getElementById('showSignup')
const showLogin = document.getElementById('showLogin')
const showForgotPassword = document.getElementById('showForgotPassword')
const showLoginFromForgot = document.getElementById('showLoginFromForgot')
const forgotPasswordForm = document.getElementById('forgotPasswordForm')
const resetEmail = document.getElementById('resetEmail')
const forgotPasswordError = document.getElementById('forgotPasswordError')
const forgotPasswordSuccess = document.getElementById('forgotPasswordSuccess')
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
  forgotPasswordSection.style.display = 'none'
  document.querySelector('.card:first-of-type').style.display = 'block'
})

showForgotPassword.addEventListener('click', (e) => {
  e.preventDefault()
  document.querySelector('.card:first-of-type').style.display = 'none'
  signupSection.style.display = 'none'
  forgotPasswordSection.style.display = 'block'
})

showLoginFromForgot.addEventListener('click', (e) => {
  e.preventDefault()
  forgotPasswordSection.style.display = 'none'
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

forgotPasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  forgotPasswordError.textContent = ''
  forgotPasswordSuccess.textContent = ''
  
  const email = resetEmail.value.trim()
  
  try {
    const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    })
    
    const data = await response.json()
    
    if (response.ok) {
      forgotPasswordSuccess.textContent = 'Password reset link sent! Check your email.'
      forgotPasswordForm.reset()
    } else {
      forgotPasswordError.textContent = data.message || 'Failed to send reset link'
    }
  } catch (error) {
    forgotPasswordError.textContent = 'Network error. Please try again.'
  }
})

initDarkMode()

if (darkModeToggle) {
  darkModeToggle.addEventListener('click', toggleDarkMode)
}

checkAuth()
