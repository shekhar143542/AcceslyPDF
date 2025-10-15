import { SignInButton, SignUpButton } from "@clerk/nextjs";

export default function Home() {
  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      flexDirection: "column", 
      alignItems: "center", 
      justifyContent: "center",
      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      color: "white",
      padding: "2rem"
    }}>
      <div style={{ 
        textAlign: "center", 
        maxWidth: "800px",
        background: "rgba(255, 255, 255, 0.1)",
        backdropFilter: "blur(10px)",
        borderRadius: "20px",
        padding: "3rem",
        border: "1px solid rgba(255, 255, 255, 0.2)"
      }}>
        <h1 style={{ 
          fontSize: "3.5rem", 
          fontWeight: "bold", 
          marginBottom: "1rem",
          background: "linear-gradient(45deg, #fff, #f0f0f0)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent"
        }}>
          Welcome to Accessly
        </h1>
        
        <p style={{ 
          fontSize: "1.25rem", 
          marginBottom: "2rem", 
          opacity: 0.9,
          lineHeight: "1.6"
        }}>
          Your secure gateway to a personalized dashboard experience. 
          Sign up or sign in to access your account and explore all the features we have to offer.
        </p>
        
        <div style={{ 
          display: "flex", 
          gap: "1rem", 
          justifyContent: "center",
          flexWrap: "wrap"
        }}>
          <SignUpButton 
            forceRedirectUrl="/dashboard"
            appearance={{
              elements: {
                root: {
                  background: "rgba(255, 255, 255, 0.2)",
                  border: "2px solid rgba(255, 255, 255, 0.3)",
                  borderRadius: "12px",
                  padding: "12px 24px",
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  color: "white",
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                  backdropFilter: "blur(10px)"
                }
              }
            }}
          >
            Get Started
          </SignUpButton>
          
          <SignInButton 
            forceRedirectUrl="/dashboard"
            appearance={{
              elements: {
                root: {
                  background: "transparent",
                  border: "2px solid rgba(255, 255, 255, 0.5)",
                  borderRadius: "12px",
                  padding: "12px 24px",
                  fontSize: "1.1rem",
                  fontWeight: "600",
                  color: "white",
                  transition: "all 0.3s ease",
                  cursor: "pointer"
                }
              }
            }}
          >
            Sign In
          </SignInButton>
        </div>
        
        <div style={{ 
          marginTop: "3rem", 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
          gap: "2rem" 
        }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ 
              fontSize: "2rem", 
              marginBottom: "0.5rem" 
            }}>🔒</div>
            <h3 style={{ marginBottom: "0.5rem" }}>Secure</h3>
            <p style={{ opacity: 0.8, fontSize: "0.9rem" }}>
              Enterprise-grade security with Clerk authentication
            </p>
          </div>
          
          <div style={{ textAlign: "center" }}>
            <div style={{ 
              fontSize: "2rem", 
              marginBottom: "0.5rem" 
            }}>⚡</div>
            <h3 style={{ marginBottom: "0.5rem" }}>Fast</h3>
            <p style={{ opacity: 0.8, fontSize: "0.9rem" }}>
              Lightning-fast performance with Next.js App Router
            </p>
          </div>
          
          <div style={{ textAlign: "center" }}>
            <div style={{ 
              fontSize: "2rem", 
              marginBottom: "0.5rem" 
            }}>🎨</div>
            <h3 style={{ marginBottom: "0.5rem" }}>Modern</h3>
            <p style={{ opacity: 0.8, fontSize: "0.9rem" }}>
              Beautiful, responsive design that works everywhere
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
