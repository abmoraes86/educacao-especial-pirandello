# Educação Especial · E.E. Luigi Pirandello

Plataforma estática em português, com banco e autenticação Supabase. Um administrador organiza os documentos; profissionais contribuem por links com acesso limitado às áreas escolhidas.

## Situação em 11/09/2026

- Aplicação implementada e compilada.
- Banco instalado no projeto `ioeuwiqruitxmwnhbqlb`.
- Estrutura preliminar de PEI substituída; configuração da escola preservada em `ee_private.previous_school_settings`.
- Conta antiga removida por solicitação do responsável. Nenhum administrador novo foi definido.
- Cinco modelos instalados. Nenhum estudante ou documento real cadastrado.
- Publicação no GitHub Pages pendente da criação/indicação do repositório.
- Testes automatizados de banco e PDF executados. Não houve teste de interface em navegador nem login real com nova conta.

## Modelos

| Modelo | Referência no documento fornecido | Organização |
|---|---|---|
| Estudo de Caso | 56–59 | Estudante e ano |
| PAEE | 65–67 | Estudante e ano, planejamento de quatro bimestres |
| PEI | 79 | Estudante, ano, bimestre e componente curricular |
| Acolhimento da família | 90 | Estudante e ano |
| Retorno bimestral à família | 91–92 | Estudante, ano e bimestre |

O documento completo de 99 páginas foi analisado. Os exemplos fictícios de preenchimento não são inseridos como respostas. As orientações descritivas foram condensadas na interface; os principais campos e as perguntas dos planos foram transcritos. A leitura pedagógica pela gestão continua necessária.

## Ativação no projeto já preparado

1. Criar o repositório GitHub destinado a esta plataforma e enviar o conteúdo deste pacote, incluindo `public/assets`, os arquivos de dependências e `.github/workflows/pages.yml`.
2. Em Settings → Pages, escolher **GitHub Actions** como origem. O fluxo compila, testa e publica o conteúdo de `dist`.
3. No Supabase, criar a nova conta em Authentication → Users com o e-mail escolhido e uma senha definida fora do chat e do repositório.
4. Autorizar exatamente essa conta no SQL Editor, usando o procedimento em `docs/ativacao-administrador.sql`. O script exige e-mail confirmado e impede dois administradores.
5. Abrir o site publicado e entrar com essa conta. Criar um estudante de teste e conferir o fluxo de convite, salvamento, revisão e PDF antes do uso real.

A chave em `public/config.js` é **publicável**, não dá privilégio administrativo e pode estar no código. Nunca substituir por `service_role`, `sb_secret_` ou senha. O cliente verifica o tipo da chave; o banco verifica cada operação.

O projeto informado já recebeu a instalação. **Não executar novamente os arquivos 001/002 nesse projeto.** São o esquema inicial consolidado para instalação limpa e para os testes locais. O histórico remoto contém as migrações `escola_inclusiva_preservando_configuracao` e `escola_inclusiva_revisao_permissoes_indices`.

## Desenvolvimento

Requer Node.js 22 e npm.

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run build
```

O diretório `dist/` é o site compilado. É compatível com a subpasta de um repositório no GitHub Pages. Para execução local, servir `dist/` por HTTP com um servidor estático; não abrir `index.html` diretamente em `file://`.

## Fluxo de uso

1. Cadastrar estudante e criar documento.
2. Selecionar áreas na aba Convites e gerar um link. O link é mostrado uma vez; a gestão copia e envia individualmente.
3. O colaborador preenche, salva e envia para revisão.
4. O administrador aprova ou devolve cada área com comentário.
5. Finalizar guarda uma edição imutável e revoga os convites. Baixar o PDF dessa edição.
6. Reabrir cria um novo ciclo de revisão. A edição anterior continua disponível para download.

Nomes digitados, envios e aprovações **não são assinaturas digitais**. O PDF reserva espaço para assinatura e carimbo.

## Textos extensos e fidelidade do PDF

O cabeçalho usa a imagem original fornecida. Os textos são organizados em quadros com paginação calculada. Um quadro que cabe inteiro na página seguinte é mantido junto; conteúdo maior que uma página recebe continuação. Fonte de 11 pontos, sem encolhimento automático nem cortes silenciosos.

**Não é uma reprodução pixel a pixel do PDF vazio.** O número de páginas, a distribuição dos campos e alguns títulos de organização mudam de acordo com o conteúdo. Datas, elegibilidade, identificação, perguntas e espaços de assinatura precisam da conferência da escola. Cada campo admite até 20.000 caracteres; o limite é aplicado no banco. Caracteres não suportados pela fonte geram aviso na exportação, para serem substituídos.

## Dados e permissões

- Supabase Auth para o administrador, sem cadastro automático de administradores.
- Conta única autorizada em tabela privada, com consulta de `auth.uid()` no servidor.
- Sem acesso direto às tabelas por `anon` ou `authenticated`; RLS e revogação de privilégios.
- Rotas públicas pequenas chamam funções privadas com verificações de autorização.
- Convites: 256 bits aleatórios, apenas hash SHA-256 no banco, validade até 90 dias, escopo por documento/área, revogação e bloqueio após finalização.
- Token no fragmento do link, sem inclusão em parâmetros da URL enviados ao servidor de hospedagem. Referrer desativado.
- Links funcionam por posse: quem recebe o link pode usá-lo. O nome do convite não prova identidade pessoal.
- Histórico de respostas, revisões e edições preservado no banco.
- Controle de versão evita sobrescrita silenciosa. Em conflito, a interface permite comparar e escolher a versão.
- Respostas em edição ficam na memória da aba até a confirmação do banco. Não há cópia durável em localStorage. Fechar a aba com gravação pendente pode perder essas alterações; a interface avisa antes de sair.
- Sessão de autenticação fica na memória da aba. Atualizar ou fechar a página exige novo login.
- Sem ferramentas de análise, rastreamento, scripts externos, envio de e-mail automático ou arquivos de estudantes no GitHub.

## Limites desta entrega

O site ainda depende de um repositório e de uma conta administrativa nova para ativação. Login real, envio de link a um professor, teste em celular e exportação a partir do site publicado são a verificação de aceitação após a implantação.

A aplicação não substitui SED, registro oficial, validação pedagógica ou coleta de assinaturas. Backups operacionais do Supabase e um procedimento de restauração precisam ser definidos antes do uso regular; histórico dentro do mesmo banco não substitui backup. Consulte os recursos disponíveis no plano do projeto, sem presumir retenção automática.

## Referências técnicas

- [Supabase: proteção da API](https://supabase.com/docs/guides/api/securing-your-api)
- [Supabase: chaves publicáveis](https://supabase.com/docs/guides/api/api-keys)
- [Supabase: permissões e RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

As fontes Liberation Sans estão incluídas sob SIL OFL 1.1, com avisos em `public/assets/LICENCA-FONTES.txt`. O cabeçalho pertence à instituição e foi fornecido pelo responsável pelo projeto.
