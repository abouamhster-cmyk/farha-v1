import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: '#FAF5EC',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      fontFamily: "'Inter', sans-serif",
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: "'Amiri', serif",
        fontSize: '5rem',
        color: '#E89528',
        marginBottom: '8px',
      }}>
        ٤٠٤
      </div>
      <h1 style={{
        fontFamily: "'Fraunces', serif",
        fontSize: '2.2rem',
        fontWeight: 700,
        color: '#14110F',
        marginBottom: '12px',
      }}>
        Page introuvable
      </h1>
      <p style={{ color: '#5C5449', marginBottom: '32px', maxWidth: '400px', fontSize: '1rem' }}>
        Cette page n'existe pas. Mais votre chanson personnalisée, elle, peut exister en 3 minutes.
      </p>
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '14px 28px',
            borderRadius: '8px',
            border: 'none',
            background: '#0A3832',
            color: '#FFF',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          ← Retour à l'accueil
        </button>
        <button
          onClick={() => navigate('/create')}
          style={{
            padding: '14px 28px',
            borderRadius: '8px',
            border: 'none',
            background: '#B83A28',
            color: '#FFF',
            fontWeight: 700,
            fontSize: '1rem',
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(184, 58, 40, 0.3)',
          }}
        >
          Créer une chanson →
        </button>
      </div>
    </div>
  )
}
