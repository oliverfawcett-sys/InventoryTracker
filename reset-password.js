const resetPasswordForm = document.getElementById('resetPasswordForm')
const newPassword = document.getElementById('newPassword')
const confirmPassword = document.getElementById('confirmPassword')
const resetError = document.getElementById('resetError')
const resetSuccess = document.getElementById('resetSuccess')

function getTokenFromUrl() {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('token')
}

resetPasswordForm.addEventListener('submit', async (e) => {
  e.preventDefault()
  resetError.textContent = ''
  resetSuccess.textContent = ''
  
  if (newPassword.value !== confirmPassword.value) {
    resetError.textContent = 'Passwords do not match'
    return
  }
  
  const token = getTokenFromUrl()
  if (!token) {
    resetError.textContent = 'Invalid reset link. Please request a new one.'
    return
  }
  
  try {
    const response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: token,
        newPassword: newPassword.value
      })
    })
    
    const data = await response.json()
    
    if (response.ok) {
      resetSuccess.textContent = 'Password reset successfully! You can now login with your new password.'
      resetPasswordForm.reset()
      setTimeout(() => {
        window.location.href = 'login.html'
      }, 3000)
    } else {
      resetError.textContent = data.message || 'Failed to reset password'
    }
  } catch (error) {
    resetError.textContent = 'Network error. Please try again.'
  }
})
