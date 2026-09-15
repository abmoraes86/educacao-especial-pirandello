import { createClient } from '@supabase/supabase-js';
export function configured(c){return Boolean(c?.supabaseUrl=== 'https://rijpfddlkkmrugztulhb.supabase.co' && /^(sb_publishable_|eyJ)/.test(c?.supabasePublishableKey||''));}
export function createApi(config){
 const key=config.supabasePublishableKey;
 if(key.startsWith('sb_secret_')) throw Error('Não use chave secreta no navegador.');
 if(key.startsWith('eyJ')){try {if(JSON.parse(atob(key.split('.')[1])).role!=='anon') throw Error('role');} catch{throw Error('Use apenas a chave publicável ou anon do projeto.');}}
 const client=createClient(config.supabaseUrl,key,{auth:{persistSession:false,autoRefreshToken:true,detectSessionInUrl:false}});
 const rpc=async(name,args)=>{const {data,error}=await client.rpc(name,args);if(error) throw Error(error.message);return data;};
 return {
  async login(email,password){const {error}=await client.auth.signInWithPassword({email,password});if(error) throw Error('Não foi possível entrar. Confira o e-mail e a senha.');return rpc('ee_admin',{p_action:'list'});},
  async logout(){const {error}=await client.auth.signOut({scope:'local'});if(error) throw error;},
  admin:(action,data={})=>rpc('ee_admin',{p_action:action,p_data:data}),
  openInvite:token=>rpc('ee_open_invite',{p_token:token}),
  save:(document,key,values,version,token=null)=>rpc('ee_save_section',{p_document:document,p_key:key,p_values:values,p_version:version,p_token:token}),
  submit:(token,versions)=>rpc('ee_submit_invite',{p_token:token,p_versions:versions}),
  onSignedOut:fn=>client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')fn();}),
 };
}
export function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');}
export function inviteUrl(token){const url=new URL(location.href);url.search='';url.hash=`convite=${token}`;return url.href;}
