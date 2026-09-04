// src/components/AuthModal.jsx
export default function AuthModal({
  isOpen,
  onClose,
  isLoginMode,
  setIsLoginMode,
  authForm,
  setAuthForm,
  onSubmit,
  canClose = true
}) {
  if (!isOpen) return null;

  return (
    <div className="drawer-backdrop" onClick={canClose ? onClose : undefined}>
      <div className="auth-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>{isLoginMode ? 'Sign In' : 'Create an Account'}</h3>
          {canClose && <button className="close-x" onClick={onClose}>✕</button>}
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
              pattern="[^\s@]+@[^\s@]+\.[A-Za-z]{2,}"
              title="Enter an email address with a valid domain, such as name@example.com"
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
              minLength={isLoginMode ? undefined : 6}
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