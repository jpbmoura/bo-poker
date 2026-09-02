/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Origem do servidor quando ele NÃO está na mesma origem do cliente
   * (ex.: https://api-poker.exemplo.com). Vazio em dev, onde o Vite faz proxy
   * de /api/auth e /socket.io para a :3001 — mantendo tudo same-origin.
   *
   * Precisa ser subdomínio do MESMO domínio raiz do cliente: subdomínios de um
   * mesmo domínio registrável são same-site, então o cookie de sessão viaja
   * normalmente. Domínios realmente distintos tornariam o cookie de terceiros,
   * que o Safari bloqueia por padrão.
   */
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
