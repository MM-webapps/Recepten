// Alle communicatie met Supabase loopt via dit bestand.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

if (!SUPABASE_URL || SUPABASE_URL.includes('JOUW-PROJECT')) {
  console.warn('Supabase is nog niet geconfigureerd — vul config.js in.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function check(error) {
  if (error) throw new Error(error.message || 'Onbekende Supabase-fout');
}

// ─────────────────────────────── Recepten
export async function fetchRecipes() {
  const { data, error } = await supabase.from('recipes').select('*').order('aangemaakt', { ascending: false });
  check(error);
  return data;
}

export async function saveRecipe(recipe) {
  const payload = { ...recipe };
  if (!payload.id) delete payload.id;
  const { data, error } = await supabase.from('recipes').upsert(payload, { onConflict: 'id' }).select().single();
  check(error);
  return data;
}

export async function deleteRecipe(id) {
  const { error } = await supabase.from('recipes').delete().eq('id', id);
  check(error);
}

// ─────────────────────────────── Weekmenu
export async function fetchWeekmenu() {
  const { data, error } = await supabase.from('weekmenu').select('*');
  check(error);
  const map = {};
  data.forEach((row) => { map[row.dag] = row.recipe_id; });
  return map;
}

export async function setWeekmenuDag(dag, recipeId) {
  const { error } = await supabase.from('weekmenu').update({ recipe_id: recipeId }).eq('dag', dag);
  check(error);
}

// ─────────────────────────────── Koelkast
export async function fetchKoelkast() {
  const { data, error } = await supabase.from('koelkast').select('*').order('aangemaakt', { ascending: true });
  check(error);
  return data;
}

export async function addKoelkastItem(naam) {
  const { data, error } = await supabase.from('koelkast').insert({ naam }).select().single();
  check(error);
  return data;
}

export async function removeKoelkastItem(id) {
  const { error } = await supabase.from('koelkast').delete().eq('id', id);
  check(error);
}

// ─────────────────────────────── Instellingen
export async function fetchInstellingen() {
  const { data, error } = await supabase.from('instellingen').select('*').eq('id', 1).single();
  check(error);
  return data;
}

export async function updateInstellingen(patch) {
  const { data, error } = await supabase.from('instellingen').update(patch).eq('id', 1).select().single();
  check(error);
  return data;
}
