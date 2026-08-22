// src/components/AuthModal.jsx
export default function AuthModal({
  isOpen,
  onClose,
  isLoginMode,
  setIsLoginMode,
  authForm,
  setAuthForm,
  onSubmit
}) {
  if (!isOpen) return null;

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="auth-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{isLoginMode ? 'Sign In' : 'Create an Account'}</h3>
          <button className="close-x" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={onSubmit} className="dialog-form">
          {!isLoginMode && (
            <div className="input-field">
              <label>Username</label>
              <input 
                type="text" 
                required 
                placeholder="Enter your username" 
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
              />
            </div>
          )}

          <div className="input-field">
            <label>Email Address</label>
            <input 
              type="email" 
              required 
              placeholder="name@example.com" 
              value={authForm.email}
              onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
            />
          </div>

          <div className="input-field">
            <label>Password</label>
            <input 
              type="password" 
              required 
              placeholder="••••••••" 
              value={authForm.password}
              onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
            />
          </div>

          <button type="submit" className="dialog-submit-btn">
            {isLoginMode ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div className="dialog-footer">
          <span>{isLoginMode ? "Don't have an account?" : "Already have an account?"}</span>
          <button className="link-action" onClick={() => setIsLoginMode(!isLoginMode)}>
            {isLoginMode ? 'Sign Up' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}