# Verificação da entrega — 11/09/2026

## Executado

- Sintaxe dos módulos JavaScript e compilação estática.
- 14 testes automatizados aprovados: 10 casos de banco dentro de uma suíte e 3 casos de PDF, incluindo a suíte no total reportado pelo Node.
- PostgreSQL local em PGlite, com papéis `anon` e `authenticated` e identificadores de autenticação simulados. Não equivale a testar o login real do Supabase Auth.
- Casos: bloqueio de tabelas/funções internas, usuário comum sem gestão, cinco modelos, convites com escopo, token inválido, validação do conteúdo, conflito sem sobrescrita, envio/reabertura, histórico/restauração, expiração/revogação, finalização e edição imutável, administrador único.
- PDF: cinco modelos, texto extenso com 100 registros preservados, continuação, limites de página e erro explícito para caractere não suportado.
- PDFs gerados e inspecionados por renderização. Fonte ajustada para TrueType incorporada para evitar problemas de renderização.
- Supabase conectado: migrações aplicadas; testes de negação de acesso com papel `anon`; cinco modelos instalados; zero estudantes/documentos; conta antiga ausente; configuração anterior preservada.
- Security Advisor do Supabase retornou `lints: []` após correções.

## A concluir na implantação

- Conta nova de administrador e login real.
- Repositório, GitHub Pages e URL pública.
- Percurso no navegador e celular: cadastro → convite → salvar → revisar → PDF.
- WebMCP implementado com navegação de leitura do guia; execução em contexto WebMCP suportado não foi validada.
- Conferência pedagógica do PDF e das adaptações do formulário pela escola. A distribuição não reproduz pixel a pixel o PDF original.

Nenhum dado real de estudante foi utilizado nos testes.
