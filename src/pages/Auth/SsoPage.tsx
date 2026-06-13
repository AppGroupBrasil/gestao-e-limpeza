import { useEffect, useRef, useState } from 'react';
import { setToken } from '../../services/api';

// Login único vindo do App Condomínio (central): o hub redireciona para
// /sso?token=<JWT RS256>. Trocamos esse token pelo token PRÓPRIO do app em
// POST /api/sso e recarregamos /dashboard — o AuthContext restaura a sessão.
const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

export default function SsoPage() {
  const [erro, setErro] = useState(false);
  const jaRodou = useRef(false);

  useEffect(() => {
    if (jaRodou.current) return;
    jaRodou.current = true;

    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      window.location.replace('/login?sso=invalido');
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/sso`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) throw new Error('sso');
        const { token: appToken } = await res.json();
        if (!appToken) throw new Error('sem token');
        setToken(appToken);
        // reload completo para o AuthContext reidratar via /auth/me
        window.location.replace('/dashboard');
      } catch {
        setErro(true);
        setTimeout(() => window.location.replace('/login?sso=invalido'), 1500);
      }
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, fontFamily: 'system-ui, sans-serif' }}>
      {erro ? (
        <p style={{ color: '#b91c1c' }}>Não foi possível entrar. Redirecionando…</p>
      ) : (
        <>
          <div style={{ width: 40, height: 40, border: '4px solid #e5e7eb', borderTopColor: '#2563eb', borderRadius: '50%', animation: 'sso-spin 0.8s linear infinite' }} />
          <p style={{ color: '#374151' }}>Entrando…</p>
          <style>{'@keyframes sso-spin{to{transform:rotate(360deg)}}'}</style>
        </>
      )}
    </div>
  );
}
