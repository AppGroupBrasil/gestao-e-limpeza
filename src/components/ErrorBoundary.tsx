import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; isChunkError: boolean; error?: Error };

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: Error): State {
    const msg = error?.message || '';
    const isChunkError = /Loading chunk|Failed to fetch dynamically imported module|ChunkLoadError|Importing a module script failed/i.test(msg);
    return { hasError: true, isChunkError, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reload = () => { window.location.reload(); };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { isChunkError, error } = this.state;
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--cor-fundo, #f5f7fa)', padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: 'center', background: '#fff', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,.08)' }}>
          <h2 style={{ margin: '0 0 12px', color: '#1f2937' }}>
            {isChunkError ? 'Atualização disponível' : 'Algo deu errado'}
          </h2>
          <p style={{ color: '#6b7280', margin: '0 0 20px', lineHeight: 1.5 }}>
            {isChunkError
              ? 'O aplicativo foi atualizado. Recarregue para usar a nova versão.'
              : 'Ocorreu um erro inesperado. Tente recarregar a página.'}
          </p>
          <button
            onClick={this.reload}
            style={{ background: '#f57c00', color: '#fff', border: 0, padding: '12px 24px', borderRadius: 10, fontWeight: 700, cursor: 'pointer', fontSize: 15 }}
          >
            Recarregar
          </button>
          {!isChunkError && error?.message && (
            <details style={{ marginTop: 20, textAlign: 'left', color: '#9ca3af', fontSize: 12 }}>
              <summary style={{ cursor: 'pointer' }}>Detalhes técnicos</summary>
              <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{error.message}</pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
