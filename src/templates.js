// Modelos transcritos do documento fornecido. Exemplos fictícios não integram os registros.
const f=(id,label,type='textarea',options=[])=>({id,label,type,options});
const s=(id,title,fields,hint='')=>({id,title,fields,hint});
const eligibility=['Deficiência Intelectual','Deficiência Visual','Deficiência Física','Deficiência Auditiva/Surdez','Surdocegueira','Deficiência Múltipla','Altas Habilidades/Superdotação','Transtorno do Espectro Autista - TEA'];
const support=f('nivel','Nível de Apoio','select',['Nível 1','Nível 2','Nível 3']);
const school=f('escola','Escola','text');
const name=f('nome','Nome do estudante','text');
const grade=f('turma','Ano/série e turma','text');
const signatures=(collab=false,family=false,regular=true)=>s('assinaturas','Assinaturas',[
 f('diretor','Nome, Carimbo e Assinatura do Diretor Escolar/Diretor de Escola','signature'),
 f('coordenador','Nome e Assinatura do Coordenador de Gestão Pedagógica','signature'),
 f('especializado','Nome e Assinatura do Professor Especializado','signature'),
 ...(collab?[f('colaborativo','Nome e Assinatura do Professor Especializado do Projeto Ensino Colaborativo','signature')]:[]),
 ...(regular?[f('regentes','Assinatura dos Professores Regentes de classes e turmas ou professores de componentes curriculares','signature')]:[]),
 ...(family?[f('responsavel','Ciência e assinatura do responsável legal','signature')]:[])
], 'Informe os nomes. O PDF reserva espaço para assinatura e carimbo. Digitar o nome ou aprovar na plataforma não equivale a assinar o documento.');
const familyIdentity=(welcome)=>s('identificacao','Identificação',[
 school,f('nome','Aluno(a)','text'),f('turma','Série/Ano','text'),
 ...(welcome?[f('data_inicial','Data do acolhimento/orientação inicial','date'),f('data_retorno','Data do retorno bimestral','date')]:[f('data','Data','date')])
]);
export const templates={
 estudo:{name:'Estudo de Caso',title:'ANEXO II – ESTUDO DE CASO',pages:'56–59',owner:'Professor especializado, com participação da escola e da família',period:'annual',sections:[
 s('identificacao','I - Das informações Gerais do Estudante',[
 name,f('nascimento','Data de nascimento','date'),f('idade','Idade','text'),school,grade,f('turno','Turno','text'),f('endereco','Endereço residencial','text'),f('responsaveis','Responsáveis','text'),f('telefone','Telefone','text'),f('emergencia','Em caso de emergência, a quem contatar?','text'),f('contato_emergencia','Telefone/WhatsApp','text'),f('elegibilidade','Estudante elegível aos serviços da Educação Especial','multiselect',[...eligibility,'Outros']),f('outros','Outros / observações sobre a elegibilidade','text')
 ],'Registre a situação observada, inclusive se estiver em investigação. O formulário não exige diagnóstico clínico.'),
 s('apoio','II - Identificação do Nível de Apoio',[support]),
 s('estudante','III - Informações Coletadas do/ sobre o Estudante',[
 f('relato','Relato sobre o estudante')
 ],'O estudante gosta da escola? Tem amigos ou colega predileto? Quais atividades prefere e quais são mais difíceis, e por quê? Solicita ajuda aos professores? O que pensa dos professores? Está satisfeito com os apoios disponíveis? Gostaria de outros apoios?'),
 s('escola','IV - Informações Coletadas da/ sobre a Escola',[
 f('relato','Relato da escola')
 ],'Participação nas atividades e espaços; interesses e expectativas percebidos pelos professores; desempenho, habilidades, potencialidades e desafios; envolvimento afetivo e social dos colegas; visão da comunidade escolar; barreiras comunicacionais, arquitetônicas, atitudinais e outras.'),
 s('familia','V - Informações Coletadas da/ sobre a Família e/ou Responsáveis',[
 f('relato','Relato da família e/ou responsáveis'),f('acompanhamentos','Acompanhamentos clínicos ou terapêuticos: tipo, frequência, especialidade, profissional, contato, local, horário e dias da semana'),f('autoriza','A escola pode contatar os profissionais que atendem o estudante?','select',['SIM','NÃO']),f('especificar','Especificar a autorização ou justificar a não autorização'),f('email_profissional','E-mail(s) para contato','text')
 ],'Opinião sobre a escola; participação e conhecimento dos direitos; habilidades e desafios; expectativas de escolarização e futuro profissional; reação à frustração, cansaço e mudanças de rotina; estratégias de autorregulação; necessidades de alimentação, higiene, comunicação ou interação. Para vários profissionais, descreva cada acompanhamento e sua autorização separadamente.'),
 s('especializado','VI - Informações coletadas pelo Professor Especializado da Educação Especial durante o Estudo de Caso',[
 f('relato','Observações do professor especializado')
 ],'Etapa de alfabetização (pré-silábica, silábica, silábico-alfabética ou alfabética); nível de Libras/Braille, se aplicável; quatro operações; estereotipias e contexto; hiperfocos; comunicação e comunicação alternativa; motricidade fina e ampla; recursos acessíveis que beneficiam o estudante.'),
 signatures(false,false,false)
 ]},
 paee:{name:'PAEE',title:'ANEXO III – PLANO DE ATENDIMENTO EDUCACIONAL ESPECIALIZADO / PAEE',pages:'65–67',owner:'Professor especializado, em articulação com os demais profissionais',period:'annual',sections:[
 s('identificacao','I - Dados pessoais e escolares',[name,f('nascimento','Data de Nascimento','date'),f('sexo','Sexo','select',['Feminino','Masculino']),school,f('turno','Turno','text'),f('turma','Turma','text'),f('ano_escolar','Ano de Escolaridade','text'),f('elegibilidade','Estudante elegível aos serviços da Educação Especial','multiselect',eligibility),support,f('observacoes','Observações')]),
 s('sintese','II - Informações identificadas no Estudo de Caso',[f('relato','Fazer um breve relato do que foi observado no Estudo de Caso.')]),
 s('servicos','III - Apoios, Recursos e Serviços',[
 f('servicos','Serviços indicados a partir do Estudo de Caso','multiselect',['Recursos Pedagógicos, de Acessibilidade e de Tecnologia Assistiva','Professor de Libras ou Professor interlocutor de Libras','Professor Instrutor-mediador ou Guia-intérprete','Serviço de Profissional de Apoio Escolar']),
 f('dimensoes','Necessidades de apoio no cotidiano escolar','multiselect',['Alimentação','Higiene pessoal, íntima e bucal, incluindo banheiro','Locomoção e autocuidado','Mediação das atividades, comunicação e interação social','Instrumentos para oportunizar a socialização']),
 f('motivos','Descrever os motivos para indicação do Apoio:'),
 f('habilidades','Descrever as habilidades que serão desenvolvidas durante o Atendimento Educacional Especializado - AEE de forma complementar ou suplementar ao currículo:'),
 f('estrategias','Descrever quais estratégias serão utilizadas para desenvolvimento das habilidades descritas no Atendimento Educacional Especializado (Sala de Recursos ou Modalidade Itinerante):')
 ]),
 s('planejamento','Planejamento bimestral do Atendimento Educacional Especializado',[f('b1','1º Bimestre'),f('b2','2º Bimestre'),f('b3','3º Bimestre'),f('b4','4º Bimestre')],'Apresente as ações pedagógicas propostas para promover o desenvolvimento da aprendizagem do estudante.'),
 s('orientacoes','Orientações aos profissionais',[
 f('regente','Em relação ao Professor Regente de classes e turmas ou professor de componentes curriculares, registrar as informações necessárias, contribuindo com a atuação do Professor:'),
 f('colaborativo','Em relação ao Projeto Ensino Colaborativo realizado no turno escolar, registrar as informações necessárias, contribuindo com a atuação do Professor Especializado atuante:'),
 f('equipe','Em relação à equipe gestora e outros profissionais da Escola (Gerente de Organização Escolar - GOE, Profissional de Apoio Escolar, merendeira, entre outros), registrar as informações necessárias, contribuindo com a atuação dos profissionais:')
 ]),
 s('recursos','Materiais, acessibilidade e superação de barreiras',[
 f('materiais','Descreva os materiais pedagógicos, recursos de acessibilidade e tecnologias assistivas que devem ser adaptados ou disponibilizados para garantir o acesso do estudante aos conteúdos curriculares.'),
 f('pdde','Indicar materiais e equipamentos a serem adquiridos pela Escola, por meio dos recursos do PDDE-Paulista:'),
 f('barreiras','Quais medidas a escola deve implementar para superar as barreiras identificadas no Estudo de Caso?')
 ]),signatures(true,true)
 ]},
 pei:{name:'PEI',title:'ANEXO IV – PLANO EDUCACIONAL INDIVIDUALIZADO - PEI',pages:'79',owner:'Professor regente do componente curricular, com apoio do especializado',period:'subject',sections:[
 s('identificacao','Identificação',[name,f('regente','Nome do Professor Regente','text'),f('especializado','Nome do Professor Especializado da Educação Especial','text'),f('componente','Componente Curricular','text'),f('bimestre','Período','select',['1º Bimestre','2º Bimestre','3º Bimestre','4º Bimestre'])]),
 s('curriculo','Conteúdos e habilidades',[f('relato','Quais conteúdos e habilidades do Currículo da Rede Estadual Paulista serão desenvolvidos no bimestre?')]),
 s('estrategias','Estratégias e acessibilidade',[f('relato','Quais estratégias, intervenções pedagógicas e recursos de acessibilidade serão utilizados para favorecer o acesso, a participação e a aprendizagem do estudante?')]),
 s('avaliacao','Acompanhamento da aprendizagem',[f('relato','Quais instrumentos serão utilizados para acompanhar o aprendizado do estudante de forma inclusiva e individualizada?')]),
 s('atividades','Atividades complementares',[f('relato','Quais vídeos, livros, jogos, exercícios ou outras atividades podem ser indicados para apoiar, complementar, suplementar e fortalecer o aprendizado do estudante neste componente curricular, considerando suas potencialidades, especificidades e ritmo de aprendizagem?')]),
 signatures(true,false)
 ]},
 acolhimento:{name:'Acolhimento da família',title:'ANEXO V – RELATÓRIO DE ACOLHIMENTO, ORIENTAÇÃO E RETORNO BIMESTRAL AOS PAIS OU RESPONSÁVEIS SOBRE O PLANO DE ATENDIMENTO EDUCACIONAL ESPECIALIZADO - PAEE',pages:'90',owner:'Professores especializado e regentes, com coordenação pedagógica',period:'annual',sections:[
 familyIdentity(true),s('acolhimento','I. Eixos norteadores para Acolhimento e Orientação Inicial',[
 f('estudo','Apresentar o relatório final do Estudo de Caso;'),f('apoios','Apresentar quais apoios, recursos e serviços serão disponibilizados ao estudante;'),f('metas','Apresentar os objetivos e Metas do Plano de Atendimento Educacional Especializado - PAEE;'),f('frequencia','Explicar sobre como se dará a frequência e organização do atendimento;'),f('casa','Orientações de como a família poderá apoiar em casa')
 ]),signatures(false,true)
 ]},
 retorno:{name:'Retorno bimestral à família',title:'ANEXO V – ALINHAMENTO BIMESTRAL COM A FAMÍLIA',pages:'91–92',owner:'Professores especializado e regentes, com coordenação pedagógica',period:'term',sections:[
 familyIdentity(false),s('objetivos','Objetivos de aprendizagem',[f('relato','Quais objetivos de aprendizagem foram definidos para o estudante neste período?')]),
 s('metodos','Metodologias e recursos',[f('relato','Quais metodologias, recursos e abordagens foram aplicados para favorecer o desenvolvimento do estudante?')]),
 s('progressos','Progressos no bimestre',[f('relato','Quais progressos foram identificados no desempenho acadêmico, na participação ou nas habilidades do estudante ao longo do bimestre?')]),
 s('desafios','Desafios e fatores envolvidos',[f('relato','Quais desafios foram enfrentados pelo estudante durante o bimestre? Há fatores que impactaram seu processo de aprendizagem?')]),
 s('intervencoes','Próximas intervenções',[f('relato','Quais intervenções, adaptações ou apoios serão implementados para enfrentar os desafios identificados e promover avanços?')]),
 signatures(false,true)
 ]}
};
export const statusLabel={draft:'Em preenchimento',submitted:'Aguardando revisão',approved:'Aprovado',final:'Finalizado'};
export function initialValues(type,student,term,subject){
 const values={nome:student.name,escola:'E.E. Luigi Pirandello',turma:student.grade,nascimento:student.birth_date||'',componente:subject,bimestre:term?`${term}º Bimestre`:''};
 return Object.fromEntries(templates[type].sections.map(section=>[section.id,Object.fromEntries(section.fields.filter(x=>values[x.id]).map(x=>[x.id,values[x.id]]))]));
}
