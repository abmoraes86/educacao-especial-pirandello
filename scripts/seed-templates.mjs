import {templates} from '../src/templates.js';
import {writeFile} from 'node:fs/promises';
const quote=x=>"'"+x.replaceAll("'","''")+"'";
const sql='-- Definições validadas no servidor. Executar após 001_escola.sql.\nbegin;\n'+Object.entries(templates).map(([kind,t])=>`insert into ee_private.templates(kind,definition) values (${quote(kind)},${quote(JSON.stringify(t))}::jsonb);`).join('\n')+'\ncommit;\n';
await writeFile('supabase/migrations/002_modelos.sql',sql);
