import * as db from './db.js';
import { DEMO_MODE } from './db.js';
import { DAGEN, DAG_NAMEN, KENMERK_STYLE } from './constants.js';
import { escapeHtml, normName, fridgeMatchForRecipe, buildShoppingList, downloadJSON, slugify, normalizeRecipeJson, formatDatumNL, alleIngredienten, suggestAfdeling, shoppingListToText } from './utils.js';

const state = {
  loaded: false,
  recipes: [],
  weekmenu: { Ma: null, Di: null, Wo: null, Do: null, Vr: null, Za: null, Zo: null },
  fridge: [],
  instellingen: { huishoud_personen: 2, boodschappen_vinkjes: {} },
  kenmerkOpties: { basis: [], proteine: [], keuken: [] },
  tags: [],
  ingredients: [],
  afdelingen: [],
  eenheden: [],
  activeTab: 'recepten',
  filters: { basis: '', proteine: '', keuken: '', tag: '', maxTijd: '', zoek: '' },
  pickerSortFridge: false,
  viewPersonen: null,
  planDay: null,
  viewNotities: [],
  notitiesLoading: false,
  modal: null,
  confirm: null
};

function basisNamen() { return state.kenmerkOpties.basis.map((o) => o.naam); }
function proteineNamen() { return state.kenmerkOpties.proteine.map((o) => o.naam); }
function keukenNamen() { return state.kenmerkOpties.keuken.map((o) => o.naam); }

const root = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');

// ─────────────────────────────────────────── Icoontjes (lucide)
function icon(name, cls) {
  return `<i data-lucide="${name}"${cls ? ` class="${cls}"` : ''}></i>`;
}
function hydrateIcons() {
  if (window.lucide) window.lucide.createIcons();
}

// ─────────────────────────────────────────── Opstarten
async function init() {
  root.addEventListener('click', onContainerClick);
  modalRoot.addEventListener('click', onContainerClick);
  modalRoot.addEventListener('change', onContainerChange);
  root.innerHTML = renderLoading();
  hydrateIcons();
  try {
    const [recipes, weekmenu, fridge, instellingen, kenmerkOptiesRaw, tags, ingredients, eenheden, afdelingen] = await Promise.all([
      db.fetchRecipes(), db.fetchWeekmenu(), db.fetchKoelkast(), db.fetchInstellingen(),
      db.fetchKenmerkOpties(), db.fetchTags(), db.fetchIngredients(), db.fetchEenheden(), db.fetchAfdelingen()
    ]);
    state.recipes = recipes;
    state.weekmenu = weekmenu;
    state.fridge = fridge;
    state.instellingen = instellingen;
    state.kenmerkOpties = {
      basis: kenmerkOptiesRaw.filter((o) => o.categorie === 'basis'),
      proteine: kenmerkOptiesRaw.filter((o) => o.categorie === 'proteine'),
      keuken: kenmerkOptiesRaw.filter((o) => o.categorie === 'keuken')
    };
    state.tags = tags;
    state.ingredients = ingredients;
    state.eenheden = eenheden;
    state.afdelingen = afdelingen;
    state.loaded = true;
    rerender();
  } catch (e) {
    root.innerHTML = renderLoadError((e && e.message) || 'Onbekende fout.');
    hydrateIcons();
  }
}

// Kopieert tekst naar het klembord (met een vangnet voor oudere browsers).
async function copyText(tekst) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(tekst); return true; }
  } catch (_) { /* val terug op de oude methode */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = tekst;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (_) { return false; }
}

// Toont even een korte tekst op een knop (bv. "Gekopieerd ✓") en zet hem terug.
function flashButton(el, tekst) {
  const oud = el.innerHTML;
  el.innerHTML = escapeHtml(tekst);
  setTimeout(() => { if (el.isConnected) { el.innerHTML = oud; hydrateIcons(); } }, 1800);
}

async function onContainerChange(e) {
  const t = e.target;
  if (!t || !t.matches || !t.matches('[data-afdeling-select]')) return;
  const id = t.dataset.id;
  const afdelingId = t.value || null;
  try {
    await db.setIngredientAfdelingen([{ id, afdeling_id: afdelingId }]);
    state.ingredients = state.ingredients.map((i) => (i.id === id ? { ...i, afdeling_id: afdelingId } : i));
    if (state.modal && state.modal.zonderAfdeling && afdelingId) {
      const row = t.closest('.manage-row');
      if (row) row.remove();
    }
    const zonderKnop = document.querySelector('[data-action="manage-toggle-zonder"]');
    if (zonderKnop && zonderKnop.lastChild) {
      zonderKnop.lastChild.textContent = ` Zonder afdeling (${state.ingredients.filter((i) => !i.afdeling_id).length})`;
    }
  } catch (err) {
    state.modal.error = (err && err.message) || 'Opslaan mislukt.';
    rerender();
  }
}

function onContainerClick(e) {
  if (e.target.classList && e.target.classList.contains('modal-backdrop')) {
    if (state.confirm) { state.confirm = null; rerender(); return; }
    closeModal();
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  Promise.resolve(handleAction(el.dataset.action, el)).catch((err) => {
    console.error(err);
    window.alert('Er ging iets mis: ' + ((err && err.message) || 'onbekende fout'));
  });
}

function renderLoading() {
  return `<div style="min-height:60vh;display:flex;align-items:center;justify-content:center">
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px">
      ${icon('loader-2', 'spin')}
      <span class="text-sm text-soft">MMenu-Planner wordt geladen...</span>
    </div>
  </div>`;
}

function renderLoadError(msg) {
  return `<div style="min-height:60vh;display:flex;align-items:center;justify-content:center;padding:20px">
    <div class="card" style="padding:24px;max-width:480px;text-align:center">
      ${icon('alert-circle')}
      <h2 class="display mt-4" style="font-size:17px">Kon de gegevens niet laden</h2>
      <p class="text-sm text-soft mt-4">${escapeHtml(msg)}</p>
      <p class="text-sm text-soft mt-4">Controleer of config.js is ingevuld met je Supabase-project en of schema.sql is uitgevoerd.</p>
    </div>
  </div>`;
}

// ─────────────────────────────────────────── Render (top-level)
function rerender() {
  root.innerHTML = renderMain();
  modalRoot.innerHTML = renderModalRoot();
  hydrateIcons();
  wireDynamicListeners();
}

function renderMain() {
  return `${renderHeaderNav()}${renderDemoBanner()}<main class="wrap">${renderActiveView()}</main>`;
}

function renderDemoBanner() {
  if (!DEMO_MODE) return '';
  return `
    <div class="wrap mt-4">
      <div class="banner banner-info" style="margin-bottom:0">
        ${icon('sparkles')}
        <span>Demo-modus: Supabase is nog niet ingesteld, dus je ziet voorbeeldrecepten. Wijzigingen worden niet bewaard totdat je <span class="mono">config.js</span> invult (zie README.md).</span>
      </div>
    </div>
  `;
}

function renderActiveView() {
  if (state.activeTab === 'weekmenu') return renderWeekmenu();
  if (state.activeTab === 'koelkast') return renderKoelkast();
  if (state.activeTab === 'boodschappen') return renderBoodschappen();
  return renderRecepten();
}

function renderModalRoot() {
  let html = '';
  if (state.modal) {
    if (state.modal.type === 'add') html += renderAddModal();
    else if (state.modal.type === 'view') html += renderViewModal(getRecipe(state.modal.id));
    else if (state.modal.type === 'edit') html += renderEditModal(getRecipe(state.modal.id));
    else if (state.modal.type === 'pick') html += renderPickModal(state.modal.day);
    else if (state.modal.type === 'manage') html += renderManageModal();
    else if (state.modal.type === 'shop-item') html += renderShopItemModal(state.modal.key);
  }
  if (state.confirm) html += renderConfirmDialog(state.confirm.message);
  return html;
}

function getRecipe(id) {
  return state.recipes.find((r) => r.id === id);
}

// ─────────────────────────────────────────── Header / navigatie
function renderHeaderNav() {
  const tabs = [
    { key: 'recepten', label: 'Recepten', icon: 'chef-hat' },
    { key: 'weekmenu', label: 'Weekmenu', icon: 'calendar' },
    { key: 'koelkast', label: 'Koelkast', icon: 'refrigerator' },
    { key: 'boodschappen', label: 'Boodschappen', icon: 'shopping-cart' }
  ];
  return `
    <div class="header">
      <div class="wrap header-top">
        <div class="brand">${icon('chef-hat')}<span class="display">MMenu-Planner</span></div>
        <div class="flex gap-2">
          <button class="btn btn-outline btn-sm" data-action="open-manage">${icon('settings')} Beheren</button>
          <button class="btn btn-primary btn-sm" data-action="open-add">${icon('plus')} Nieuw recept</button>
        </div>
      </div>
      <div class="wrap nav">
        ${tabs.map((t) => `
          <button class="nav-tab ${state.activeTab === t.key ? 'active' : ''}" data-action="tab" data-tab="${t.key}">
            ${icon(t.icon)} ${t.label}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────── Kenmerk-pills & kaarten
function renderPill(field, value) {
  const s = KENMERK_STYLE[field];
  return `<span class="pill" style="background:${s.bg};color:${s.color}">${icon(s.icon)}${escapeHtml(value)}</span>`;
}

function renderRecipeCard(recipe, matchInfo, action) {
  const tags = recipe.tags || [];
  return `
    <div class="card recipe-card" data-action="${action || 'open-view'}" data-id="${recipe.id}">
      <h3 class="display">${escapeHtml(recipe.titel)}</h3>
      <div class="pills">
        ${renderPill('basis', recipe.basis)}${renderPill('proteine', recipe.proteine)}${renderPill('keuken', recipe.keuken)}
      </div>
      ${tags.length ? `<div class="pills mb-2">${tags.map((t) => `<span class="tag-chip-sm">${escapeHtml(t.naam)}</span>`).join('')}</div>` : ''}
      <div class="recipe-meta mono">
        <span>${icon('clock')}${recipe.bereidingstijd} min</span>
        <span>${icon('users')}${recipe.personen}p</span>
      </div>
      ${matchInfo ? `
        <div class="mt-4">
          <div class="flex justify-between text-sm mb-1"><span>${matchInfo.matched}/${matchInfo.total} in huis</span><span>${matchInfo.pct}%</span></div>
          <div class="progress-track"><div class="progress-fill" style="width:${matchInfo.pct}%"></div></div>
        </div>` : ''}
    </div>
  `;
}

function renderEmptyState(iconName, text, action) {
  return `
    <div class="card empty-state">
      ${icon(iconName)}
      <p class="text-sm" style="margin:0">${escapeHtml(text)}</p>
      ${action ? `<button class="btn btn-primary" data-action="${action.action}">${escapeHtml(action.label)}</button>` : ''}
    </div>
  `;
}

function bannerError(msg) {
  return `<div class="banner banner-error">${icon('alert-circle')}<span>${escapeHtml(msg)}</span></div>`;
}

// ─────────────────────────────────────────── Filterbalk (gedeeld door Recepten-tab en dagkeuze-modal)
function optionListHtml(options, value) {
  return `<option value="">Alle</option>` + options.map((o) => `<option value="${escapeHtml(o)}" ${o === value ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
}

function renderFilterBarInner(showSortFridge) {
  const f = state.filters;
  const active = f.basis || f.proteine || f.keuken || f.tag || f.maxTijd || f.zoek;
  return `
    <div class="card flex flex-wrap items-end gap-3" style="padding:14px">
      <div style="flex:1;min-width:160px">
        <label class="field-label">Zoeken</label>
        <input class="input" name="f-zoek" placeholder="Titel of ingrediënt..." value="${escapeHtml(f.zoek)}">
      </div>
      <div><label class="field-label">Basis</label><select class="input" name="f-basis">${optionListHtml(basisNamen(), f.basis)}</select></div>
      <div><label class="field-label">Proteïne</label><select class="input" name="f-proteine">${optionListHtml(proteineNamen(), f.proteine)}</select></div>
      <div><label class="field-label">Keuken</label><select class="input" name="f-keuken">${optionListHtml(keukenNamen(), f.keuken)}</select></div>
      <div><label class="field-label">Tag</label><select class="input" name="f-tag">${optionListHtml(state.tags.map((t) => t.naam), f.tag)}</select></div>
      <div style="width:110px"><label class="field-label">Max. tijd</label><input class="input" type="number" min="0" name="f-maxtijd" placeholder="min" value="${escapeHtml(f.maxTijd)}"></div>
      ${showSortFridge ? `<label class="flex items-center gap-2 text-sm" style="padding-bottom:9px"><input type="checkbox" name="f-sortfridge" ${state.pickerSortFridge ? 'checked' : ''}> Sorteer op koelkastmatch</label>` : ''}
      ${active ? `<button type="button" class="btn btn-outline btn-sm" data-action="clear-filters">${icon('x')} Wis filters</button>` : ''}
    </div>
  `;
}

function filterRecipes(recipes, filters) {
  return recipes.filter((r) => {
    if (filters.basis && r.basis !== filters.basis) return false;
    if (filters.proteine && r.proteine !== filters.proteine) return false;
    if (filters.keuken && r.keuken !== filters.keuken) return false;
    if (filters.tag && !(r.tags || []).some((t) => t.naam === filters.tag)) return false;
    if (filters.maxTijd && r.bereidingstijd > Number(filters.maxTijd)) return false;
    if (filters.zoek) {
      const q = filters.zoek.toLowerCase();
      const inTitle = r.titel.toLowerCase().includes(q);
      const inIng = alleIngredienten(r).some((i) => (i.naam || '').toLowerCase().includes(q));
      if (!inTitle && !inIng) return false;
    }
    return true;
  });
}

function wireFilterBar(barId, resultsId, renderResultsFn) {
  const bar = document.getElementById(barId);
  if (!bar) return;
  const refresh = () => {
    const target = document.getElementById(resultsId);
    if (target) { target.innerHTML = renderResultsFn(); hydrateIcons(); }
  };
  const rebuildBar = (showSortFridge) => {
    bar.innerHTML = renderFilterBarInner(showSortFridge);
    hydrateIcons();
    wireFilterBar(barId, resultsId, renderResultsFn);
    refresh();
  };
  const hasSortFridge = !!bar.querySelector('[name="f-sortfridge"]');
  const zoek = bar.querySelector('[name="f-zoek"]');
  const basis = bar.querySelector('[name="f-basis"]');
  const proteine = bar.querySelector('[name="f-proteine"]');
  const keuken = bar.querySelector('[name="f-keuken"]');
  const tag = bar.querySelector('[name="f-tag"]');
  const maxTijd = bar.querySelector('[name="f-maxtijd"]');
  const sortFridge = bar.querySelector('[name="f-sortfridge"]');
  if (zoek) zoek.addEventListener('input', () => { state.filters.zoek = zoek.value; refresh(); });
  if (maxTijd) maxTijd.addEventListener('input', () => { state.filters.maxTijd = maxTijd.value; refresh(); });
  if (basis) basis.addEventListener('change', () => { state.filters.basis = basis.value; rebuildBar(hasSortFridge); });
  if (proteine) proteine.addEventListener('change', () => { state.filters.proteine = proteine.value; rebuildBar(hasSortFridge); });
  if (keuken) keuken.addEventListener('change', () => { state.filters.keuken = keuken.value; rebuildBar(hasSortFridge); });
  if (tag) tag.addEventListener('change', () => { state.filters.tag = tag.value; rebuildBar(hasSortFridge); });
  if (sortFridge) sortFridge.addEventListener('change', () => { state.pickerSortFridge = sortFridge.checked; rebuildBar(hasSortFridge); });
}

// ─────────────────────────────────────────── Tab: Recepten
function renderRecepten() {
  return `
    <div id="recepten-filterbar" class="mb-4">${renderFilterBarInner(false)}</div>
    <div id="recepten-results">${renderReceptenResults()}</div>
  `;
}

function renderReceptenResults() {
  if (state.recipes.length === 0) {
    return renderEmptyState('chef-hat', 'Nog geen recepten bewaard. Voeg je eerste recept toe.', { label: 'Nieuw recept', action: 'open-add' });
  }
  const filtered = filterRecipes(state.recipes, state.filters);
  if (filtered.length === 0) return renderEmptyState('search', 'Geen recepten gevonden met deze filters.');
  return `<div class="grid grid-3">${filtered.map((r) => renderRecipeCard(r)).join('')}</div>`;
}

// ─────────────────────────────────────────── Tab: Weekmenu
function renderWeekmenu() {
  const filled = DAGEN.filter((d) => state.weekmenu[d]).length;
  return `
    <div class="card mb-4" style="padding:16px">
      <div class="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 class="display" style="font-size:18px;margin:0 0 2px">Weekmenu</h2>
          <p class="text-sm text-soft" style="margin:0">${filled} van de 7 dagen gepland</p>
        </div>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="text-sm">Standaard personen</span>
            <div class="stepper">
              <button data-action="huishoud-min">${icon('minus')}</button>
              <span class="mono">${state.instellingen.huishoud_personen}</span>
              <button data-action="huishoud-plus">${icon('plus')}</button>
            </div>
          </div>
          ${filled > 0 ? `<button class="btn btn-outline" data-action="ask-clear-week">${icon('trash-2')} Weekmenu leegmaken</button>` : ''}
          <button class="btn btn-primary" data-action="go-shopping">${icon('shopping-cart')} Boodschappenlijst</button>
        </div>
      </div>
      <p class="text-sm text-soft mt-4" style="margin-bottom:0">Dit is het aantal personen dat wordt ingevuld zodra je een dag invult — je kunt het per dag aanpassen, bijvoorbeeld als er gasten zijn.</p>
    </div>
    <div class="week-grid">${DAGEN.map((d) => renderWeekDay(d)).join('')}</div>
  `;
}

function renderWeekDay(dag) {
  const entry = state.weekmenu[dag];
  const recipe = entry ? getRecipe(entry.recipeId) : null;
  const personen = entry ? (entry.personen || (recipe && recipe.personen) || 1) : null;
  return `
    <div class="card" style="padding:12px;display:flex;flex-direction:column;min-height:190px">
      <div class="mono text-soft" style="font-size:11px;font-weight:600;margin-bottom:8px">${DAG_NAMEN[dag]}</div>
      ${recipe ? `
        <div style="flex:1;display:flex;flex-direction:column">
          <div class="week-titel" style="font-weight:600;font-size:13.5px;margin-bottom:8px;flex:1;cursor:pointer" data-action="open-view" data-id="${recipe.id}" title="Open recept">${escapeHtml(recipe.titel)}</div>
          <div class="pills mb-2">${renderPill('basis', recipe.basis)}${renderPill('proteine', recipe.proteine)}</div>
          <div class="flex items-center gap-2 mb-2">
            <span class="text-sm text-soft">${icon('users')}</span>
            <div class="stepper">
              <button data-action="day-personen-min" data-day="${dag}">${icon('minus')}</button>
              <span class="mono">${personen}</span>
              <button data-action="day-personen-plus" data-day="${dag}">${icon('plus')}</button>
            </div>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-outline btn-sm" style="flex:1" data-action="open-pick" data-day="${dag}">Wijzig</button>
            <button class="btn btn-outline btn-sm btn-icon" data-action="remove-day" data-day="${dag}">${icon('x')}</button>
          </div>
        </div>
      ` : `
        <button class="btn btn-outline btn-block" style="flex:1;flex-direction:column;border-style:dashed" data-action="open-pick" data-day="${dag}">
          ${icon('plus')}<span style="margin-top:4px">Kies recept</span>
        </button>
      `}
    </div>
  `;
}

// ─────────────────────────────────────────── Tab: Koelkast
function renderKoelkast() {
  return `
    <div class="card mb-4" style="padding:16px">
      <h2 class="display" style="font-size:18px;margin:0 0 4px">Koelkast</h2>
      <p class="text-sm text-soft mb-3">Vul in wat je in huis hebt, dan zie je welke recepten je er (bijna) mee kunt maken.</p>
      <div class="flex gap-2 mb-3">
        <input id="fridge-input" class="input" style="flex:1" placeholder="Bijv. ui, kipfilet, kokosmelk...">
        <button class="btn btn-primary btn-icon" data-action="add-fridge-item">${icon('plus')}</button>
      </div>
      <div class="flex flex-wrap gap-2">
        ${state.fridge.length === 0 ? `<span class="text-sm text-soft">Nog niets toegevoegd.</span>` :
          state.fridge.map((item) => `<span class="tag-chip">${escapeHtml(item.naam)}<button data-action="remove-fridge-item" data-id="${item.id}">${icon('x')}</button></span>`).join('')}
      </div>
    </div>
    <h3 class="display mb-3" style="font-size:16px">Recepten op basis van je koelkast</h3>
    ${renderKoelkastResults()}
  `;
}

function renderKoelkastResults() {
  if (state.fridge.length === 0) return renderEmptyState('refrigerator', 'Voeg ingrediënten toe om suggesties te zien.');
  const fridgeNames = state.fridge.map((f) => f.naam);
  const scored = state.recipes
    .map((r) => ({ recipe: r, match: fridgeMatchForRecipe(r, fridgeNames) }))
    .filter((x) => x.match.total > 0)
    .sort((a, b) => b.match.pct - a.match.pct);
  if (scored.length === 0) return renderEmptyState('refrigerator', 'Nog geen match. Voeg meer ingrediënten toe of bewaar meer recepten.');
  return `<div class="grid grid-3">${scored.map((x) => renderRecipeCard(x.recipe, x.match)).join('')}</div>`;
}

// ─────────────────────────────────────────── Tab: Boodschappenlijst
// Eén bron voor scherm én deeltekst: de lijst per afdeling, rekening houdend
// met Thuis/Alles (basisvoorraad verborgen of niet) en de koelkast.
function getShoppingView() {
  const fridgeNames = state.fridge.map((f) => f.naam);
  const list = buildShoppingList(state.weekmenu, state.recipes, fridgeNames);
  const thuis = state.instellingen.boodschappen_thuis !== false;
  const byIng = Object.fromEntries(state.ingredients.map((i) => [i.id, i]));
  const isBasis = (item) => !!(item.ingredientId && byIng[item.ingredientId] && byIng[item.ingredientId].altijd_in_huis);
  const hidden = thuis ? list.filter(isBasis) : [];
  const visible = thuis ? list.filter((i) => !isBasis(i)) : list;
  const teKopen = visible.filter((i) => !i.inHuis);
  const alInHuis = visible.filter((i) => i.inHuis);
  const afdelingVan = (item) => (byIng[item.ingredientId] ? byIng[item.ingredientId].afdeling_id : null);
  const groepen = [];
  state.afdelingen.forEach((afd) => {
    const items = teKopen.filter((i) => afdelingVan(i) === afd.id);
    if (items.length) groepen.push({ titel: afd.naam, items });
  });
  const bekend = new Set(state.afdelingen.map((afd) => afd.id));
  const rest = teKopen.filter((i) => !bekend.has(afdelingVan(i)));
  if (rest.length) groepen.push({ titel: 'Nog niet ingedeeld', items: rest });
  return { list, visible, hidden, groepen, alInHuis, thuis };
}

function renderBoodschappen() {
  const v = getShoppingView();
  if (v.list.length === 0) {
    return renderEmptyState('shopping-cart', 'Je weekmenu is nog leeg. Plan eerst een paar dagen in.', { label: 'Naar weekmenu', action: 'go-weekmenu' });
  }
  const checked = state.instellingen.boodschappen_vinkjes || {};
  const checkedCount = v.visible.filter((i) => checked[i.key]).length;
  const uitleg = v.thuis
    ? (v.hidden.length ? `${v.hidden.length} basisproduct${v.hidden.length === 1 ? '' : 'en'} (altijd in huis) staan niet op de lijst.` : '')
    : 'Alles wordt getoond, ook je basisvoorraad.';
  return `
    <div class="card mb-4" style="padding:16px">
      <div class="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 class="display" style="font-size:18px;margin:0 0 2px">Boodschappenlijst</h2>
          <p class="text-sm text-soft" style="margin:0">${checkedCount} van ${v.visible.length} afgevinkt</p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button class="btn btn-outline btn-sm" data-action="share-list">${icon('share-2')} Deel lijst</button>
          <button class="btn btn-outline btn-sm" data-action="clear-checked">${icon('rotate-ccw')} Wis vinkjes</button>
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap mt-4">
        <button class="btn btn-sm ${v.thuis ? 'btn-primary' : 'btn-outline'}" data-action="set-thuis" data-waarde="1">${icon('home')} Thuis</button>
        <button class="btn btn-sm ${v.thuis ? 'btn-outline' : 'btn-primary'}" data-action="set-thuis" data-waarde="0">${icon('luggage')} Alles</button>
        ${uitleg ? `<span class="text-sm text-soft">${escapeHtml(uitleg)}</span>` : ''}
      </div>
    </div>
    ${v.visible.length === 0 ? renderEmptyState('shopping-cart', 'Alles op je lijst is al in huis.') : ''}
    ${v.groepen.map((g) => renderShopSection(g.titel, g.items, checked)).join('')}
    ${v.alInHuis.length ? renderShopSection('Al in huis', v.alInHuis, checked, true) : ''}
  `;
}

function renderShopSection(title, items, checked, muted) {
  const klaar = items.filter((i) => checked[i.key]).length;
  const alles = items.length > 0 && klaar === items.length;
  return `
    <div class="card mb-4" style="padding:16px;${muted ? 'opacity:.75;' : alles ? 'opacity:.55;' : ''}">
      <h3 class="display" style="font-size:15px;margin:0 0 10px">${escapeHtml(title)} <span class="mono text-soft" style="font-size:12px;font-weight:400">(${klaar}/${items.length})</span></h3>
      ${[...items.filter((i) => !checked[i.key]), ...items.filter((i) => checked[i.key])].map((item) => `
        <div class="shop-item ${checked[item.key] ? 'checked' : ''}">
          <input type="checkbox" data-action="toggle-checked" data-key="${item.key}" ${checked[item.key] ? 'checked' : ''}>
          <span class="naam" data-action="open-shop-item" data-key="${escapeHtml(item.key)}" style="cursor:pointer" title="Toon in welke recepten">${escapeHtml(item.naam)}</span>
          <span class="mono hoeveelheid">${item.hoeveelheid != null ? item.hoeveelheid : ''} ${escapeHtml(item.eenheid)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderShopItemModal(key) {
  const fridgeNames = state.fridge.map((f) => f.naam);
  const item = buildShoppingList(state.weekmenu, state.recipes, fridgeNames).find((i) => i.key === key);
  if (!item) return '';
  const fmt = (b) => (b.hoeveelheid != null ? `${b.hoeveelheid} ${escapeHtml(item.eenheid)}`.trim() : '<span class="text-soft">naar smaak</span>');
  return `
    <div class="modal-backdrop">
      <div class="modal-card narrow">
        <div class="flex justify-between items-center mb-4">
          <h2 class="display" style="font-size:18px;margin:0">${escapeHtml(item.naam)}</h2>
          <button class="btn btn-outline btn-icon" data-action="close-modal">${icon('x')}</button>
        </div>
        <p class="text-sm text-soft mb-3">Totaal: <span class="mono">${item.hoeveelheid != null ? item.hoeveelheid : ''} ${escapeHtml(item.eenheid)}</span></p>
        ${item.bronnen.map((b) => `
          <div class="flex items-center gap-2 mb-2" style="justify-content:space-between">
            <button class="btn btn-outline btn-sm" style="text-align:left;flex:1" data-action="open-view" data-id="${b.recipeId}">
              <span class="mono text-soft" style="font-size:11px">${DAG_NAMEN[b.dag]}</span> ${escapeHtml(b.titel)}
            </button>
            <span class="mono text-sm">${fmt(b)}</span>
          </div>`).join('')}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────── Receptformulier (nieuw & bewerken)
function eenheidOptiesHtml(huidigeWaarde) {
  const namen = state.eenheden.map((e) => e.naam);
  const extra = huidigeWaarde && !namen.includes(huidigeWaarde) ? [huidigeWaarde] : [];
  const alle = ['', ...namen, ...extra];
  return alle.map((e) => `<option value="${escapeHtml(e)}" ${e === (huidigeWaarde || '') ? 'selected' : ''}>${e ? escapeHtml(e) : '(geen)'}</option>`).join('');
}

function ingredientRowHtml(ing) {
  ing = ing || {};
  return `
    <div class="ing-row" data-afdeling="${escapeHtml(ing.afdeling || '')}">
      <input class="input naam" list="ingredient-namen" placeholder="Ingrediënt" value="${escapeHtml(ing.naam || '')}">
      <input class="input aantal" type="number" step="any" placeholder="aantal" value="${ing.hoeveelheid != null ? ing.hoeveelheid : ''}">
      <select class="input eenheid">${eenheidOptiesHtml(ing.eenheid || '')}</select>
      <button type="button" class="btn btn-outline btn-icon" data-action="remove-ing-row">${icon('x')}</button>
    </div>
  `;
}

function ingredientNamenDatalist() {
  return `<datalist id="ingredient-namen">${state.ingredients.map((i) => `<option value="${escapeHtml(i.naam)}">`).join('')}</datalist>`;
}

function onderdeelBlockHtml(onderdeel) {
  onderdeel = onderdeel || {};
  const ingredienten = (onderdeel.ingredienten && onderdeel.ingredienten.length) ? onderdeel.ingredienten : [{}];
  const instructiesText = (onderdeel.instructies || []).join('\n');
  return `
    <div class="card onderdeel-block mb-3" style="padding:14px">
      <div class="flex items-center gap-2 mb-3">
        <input class="input onderdeel-naam" style="flex:1" placeholder="Naam onderdeel (optioneel, bv. Marinade)" value="${escapeHtml(onderdeel.naam || '')}">
        <button type="button" class="btn btn-outline btn-icon" data-action="remove-onderdeel" title="Onderdeel verwijderen">${icon('x')}</button>
      </div>
      <div class="flex justify-between items-center mb-1">
        <label class="field-label" style="margin:0">Ingrediënten</label>
        <button type="button" class="btn btn-outline btn-sm" data-action="add-ing-row">${icon('plus')} Regel</button>
      </div>
      <div class="ing-rows mb-3">${ingredienten.map(ingredientRowHtml).join('')}</div>
      <label class="field-label">Bereidingswijze (één stap per regel)</label>
      <textarea class="input onderdeel-instructies" rows="4" placeholder="Snijd de ui fijn.&#10;Bak de kip aan.">${escapeHtml(instructiesText)}</textarea>
    </div>
  `;
}

function selectFieldHtml(label, name, options, value) {
  return `
    <div>
      <label class="field-label">${label}</label>
      <select class="input" name="${name}">
        ${options.map((o) => `<option value="${escapeHtml(o)}" ${o === value ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
      </select>
    </div>
  `;
}

function tagCheckboxesHtml(selectedIds) {
  selectedIds = selectedIds || [];
  if (state.tags.length === 0) return `<span class="text-sm text-soft">Nog geen tags — maak er hieronder één aan.</span>`;
  return state.tags.map((t) => `
    <label class="tag-chip" style="cursor:pointer">
      <input type="checkbox" name="tagIds" value="${t.id}" ${selectedIds.includes(t.id) ? 'checked' : ''} style="margin:0">
      ${escapeHtml(t.naam)}
    </label>
  `).join('');
}

function renderRecipeFormFields(initialRecipe, opts) {
  opts = opts || {};
  const r = initialRecipe || {};
  const onderdelen = (r.onderdelen && r.onderdelen.length) ? r.onderdelen : [{}];
  return `
    <form id="recipe-form">
      <div class="flex justify-between items-start mb-1">
        <h2 class="display" style="font-size:20px;margin:0">${escapeHtml(opts.heading || 'Recept')}</h2>
        <button type="button" class="btn btn-outline btn-icon" data-action="close-modal">${icon('x')}</button>
      </div>
      ${opts.subheading ? `<p class="text-sm text-soft mb-3">${escapeHtml(opts.subheading)}</p>` : '<div class="mb-3"></div>'}
      <div id="form-error"></div>
      <div class="mb-3">
        <label class="field-label">Naam van het recept</label>
        <input class="input" name="titel" value="${escapeHtml(r.titel || '')}" placeholder="Bijv. Kip-kerrie met rijst" required>
      </div>
      <div class="grid mb-3">
        ${selectFieldHtml('Basis', 'basis', basisNamen(), r.basis)}
        ${selectFieldHtml('Proteïne', 'proteine', proteineNamen(), r.proteine)}
        ${selectFieldHtml('Keuken', 'keuken', keukenNamen(), r.keuken)}
        <div class="field-row">
          <div style="flex:1">
            <label class="field-label">Personen</label>
            <input class="input" type="number" min="1" name="personen" value="${r.personen || 4}">
          </div>
          <div style="flex:1">
            <label class="field-label">Bereidingstijd (min)</label>
            <input class="input" type="number" min="0" name="bereidingstijd" value="${r.bereidingstijd || 30}">
          </div>
        </div>
      </div>
      <div class="mb-4">
        <label class="field-label">Tags</label>
        <div id="form-tags" class="flex flex-wrap gap-2 mb-2">${tagCheckboxesHtml((r.tags || []).map((t) => t.id))}</div>
        <div class="flex gap-2">
          <input id="form-new-tag" class="input" style="flex:1" placeholder="Nieuwe tag, bv. Grote groepen">
          <button type="button" class="btn btn-outline btn-sm" data-action="quick-add-tag">${icon('plus')} Toevoegen</button>
        </div>
      </div>
      <div class="mb-4">
        <div class="flex justify-between items-center mb-2">
          <label class="field-label" style="margin:0">Onderdelen</label>
          <button type="button" class="btn btn-outline btn-sm" data-action="add-onderdeel">${icon('plus')} Onderdeel</button>
        </div>
        <p class="text-sm text-soft mb-2">Voor de meeste recepten is één onderdeel genoeg — laat de naam dan leeg. Bestaat het recept uit aparte delen (zoals een marinade en een saus), voeg dan een extra onderdeel toe en geef ze allebei een naam.</p>
        <div id="onderdelen-list">${onderdelen.map(onderdeelBlockHtml).join('')}</div>
      </div>
      ${ingredientNamenDatalist()}
      <div class="mb-4">
        <label class="field-label">Bron (optioneel)</label>
        <input class="input" name="bron" value="${escapeHtml(r.bron || '')}" placeholder="https://...">
      </div>
      <div class="flex justify-between items-center" style="border-top:1px solid var(--line);padding-top:16px">
        <button type="button" class="btn btn-outline" data-action="close-modal">Annuleren</button>
        <button type="submit" class="btn btn-primary">${escapeHtml(opts.submitLabel || 'Opslaan')}</button>
      </div>
    </form>
  `;
}

async function handleRecipeFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const errorBox = document.getElementById('form-error');
  const fd = new FormData(form);
  const titel = (fd.get('titel') || '').toString().trim();
  if (!titel) {
    errorBox.innerHTML = bannerError('Geef het recept een naam.');
    hydrateIcons();
    return;
  }
  const onderdelen = Array.from(form.querySelectorAll('.onderdeel-block')).map((block) => {
    const naam = block.querySelector('.onderdeel-naam').value.trim();
    const ingredienten = Array.from(block.querySelectorAll('.ing-row'))
      .map((row) => ({
        naam: row.querySelector('.naam').value.trim(),
        hoeveelheid: row.querySelector('.aantal').value,
        eenheid: row.querySelector('.eenheid').value,
        afdeling: row.dataset.afdeling || ''
      }))
      .filter((i) => i.naam)
      .map((i) => ({ naam: i.naam, hoeveelheid: i.hoeveelheid === '' ? null : Number(i.hoeveelheid), eenheid: i.eenheid, afdeling: i.afdeling }));
    const instructiesText = block.querySelector('.onderdeel-instructies').value;
    const instructies = instructiesText.split('\n').map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
    return { naam, ingredienten, instructies };
  }).filter((o) => o.ingredienten.length || o.instructies.length || o.naam);
  const finalOnderdelen = onderdelen.length ? onderdelen : [{ naam: '', ingredienten: [], instructies: [] }];
  const tagIds = Array.from(form.querySelectorAll('[name="tagIds"]:checked')).map((cb) => cb.value);

  const payload = {
    titel,
    basis: fd.get('basis'),
    proteine: fd.get('proteine'),
    keuken: fd.get('keuken'),
    personen: Math.max(1, Number(fd.get('personen')) || 1),
    bereidingstijd: Math.max(0, Number(fd.get('bereidingstijd')) || 0),
    onderdelen: finalOnderdelen,
    tagIds,
    bron: (fd.get('bron') || '').toString().trim()
  };
  if (state.modal && state.modal.type === 'edit') payload.id = state.modal.id;

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const saved = await db.saveRecipe(payload);
    const exists = state.recipes.some((r) => r.id === saved.id);
    state.recipes = exists ? state.recipes.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...state.recipes];
    state.ingredients = await db.fetchIngredients();
    state.modal = null;
    rerender();
  } catch (err) {
    errorBox.innerHTML = bannerError((err && err.message) || 'Opslaan mislukt.');
    hydrateIcons();
    submitBtn.disabled = false;
  }
}

// ─────────────────────────────────────────── Modal: Nieuw recept (handmatig / JSON-upload)
function renderAddModal() {
  const m = state.modal;
  let inner = '';
  if (m.step === 'kies') {
    inner = `
      <div class="flex justify-between items-center mb-1">
        <h2 class="display" style="font-size:20px;margin:0">Nieuw recept</h2>
        <button class="btn btn-outline btn-icon" data-action="close-modal">${icon('x')}</button>
      </div>
      <p class="text-sm text-soft mb-4">Kies hoe je het recept wilt toevoegen.</p>
      <div class="method-grid" style="grid-template-columns:1fr 1fr">
        <button class="btn btn-outline method-btn" data-action="ai-method" data-method="manual">${icon('pencil')}<span>Handmatig</span><span class="hint">Zelf alles invullen</span></button>
        <button class="btn btn-outline method-btn" data-action="ai-method" data-method="json">${icon('upload')}<span>JSON uploaden</span><span class="hint">Bestand van jouw AI-prompt</span></button>
      </div>
    `;
  } else if (m.step === 'json') {
    inner = `
      <div class="flex items-center gap-2 mb-1">
        <button class="btn btn-outline btn-icon" data-action="ai-back">${icon('arrow-left')}</button>
        <h2 class="display" style="font-size:20px;margin:0">Recept vanaf JSON</h2>
      </div>
      <p class="text-sm text-soft mb-3">Kies een .json-bestand met één recept (of een lijst van recepten) volgens het schema uit README.md.</p>
      <label class="file-drop">
        ${icon('upload')}<span>Klik om een .json-bestand te kiezen</span>
        <input id="json-file-input" type="file" accept=".json,application/json" class="hidden">
      </label>
      ${m.fileName ? `<p class="text-sm text-soft mb-2">Gekozen bestand: <span class="mono">${escapeHtml(m.fileName)}</span></p>` : ''}
      ${m.error ? bannerError(m.error) : ''}
      ${m.info ? `<div class="banner banner-info">${icon('sparkles')}<span>${escapeHtml(m.info)}</span></div>` : ''}
    `;
  } else {
    inner = renderRecipeFormFields(m.step === 'vorm' ? m.draftRecipe : null, {
      heading: m.step === 'vorm' ? 'Controleer het recept' : 'Nieuw recept',
      subheading: m.step === 'vorm' ? 'Uit het JSON-bestand — controleer en pas aan waar nodig.' : null,
      submitLabel: 'Recept opslaan'
    });
  }
  return `<div class="modal-backdrop"><div class="modal-card">${inner}</div></div>`;
}

async function handleJsonFile(file) {
  state.modal.fileName = file.name;
  state.modal.error = '';
  state.modal.info = '';
  try {
    const text = await file.text();
    const raw = JSON.parse(text);
    const basis = basisNamen(), proteine = proteineNamen(), keuken = keukenNamen();
    if (Array.isArray(raw)) {
      const recipes = raw.map((r) => normalizeRecipeJson(r, basis, proteine, keuken));
      const saved = [];
      for (const r of recipes) {
        const s = await db.saveRecipe(r);
        saved.push(s);
      }
      state.recipes = [...saved, ...state.recipes];
      state.modal = null;
      rerender();
      return;
    }
    const recipe = normalizeRecipeJson(raw, basis, proteine, keuken);
    state.modal.draftRecipe = recipe;
    state.modal.step = 'vorm';
    rerender();
  } catch (e) {
    state.modal.error = e instanceof SyntaxError
      ? 'Dit is geen geldig JSON-bestand. Controleer of de AI alleen JSON heeft teruggegeven (geen extra tekst of ```json-markering).'
      : ((e && e.message) || 'Kon het bestand niet verwerken.');
    rerender();
  }
}

// ─────────────────────────────────────────── Modal: Receptdetail
function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function renderNotitiesLijst() {
  if (state.notitiesLoading) return `<p class="text-sm text-soft">Opmerkingen laden...</p>`;
  if (state.viewNotities.length === 0) return `<p class="text-sm text-soft">Nog geen opmerkingen.</p>`;
  return state.viewNotities.map((n) => `
    <div class="flex justify-between items-start gap-2" style="padding:6px 0;border-bottom:1px solid var(--line)">
      <div class="text-sm"><span class="mono text-soft">${formatDatumNL(n.datum)}</span> — ${escapeHtml(n.tekst)}</div>
      <button class="btn btn-outline btn-icon btn-sm" data-action="delete-notitie" data-id="${n.id}">${icon('x')}</button>
    </div>
  `).join('');
}

function ingredientenListHtml(ingredienten, factor) {
  return (ingredienten || []).map((ing) => `
    <div class="flex justify-between text-sm" style="padding:5px 0;border-bottom:1px solid var(--line)">
      <span>${escapeHtml(ing.naam)}${ing.notitie ? ` <span class="text-soft">(${escapeHtml(ing.notitie)})</span>` : ''}</span>
      <span class="mono text-soft">${ing.hoeveelheid != null ? Math.round(ing.hoeveelheid * factor * 100) / 100 : ''} ${escapeHtml(ing.eenheid || '')}</span>
    </div>
  `).join('');
}

function instructiesListHtml(instructies) {
  return (instructies || []).map((s) => `<li style="margin-bottom:6px">${escapeHtml(s)}</li>`).join('');
}

function renderViewModal(recipe) {
  if (!recipe) return '';
  const vp = state.viewPersonen || recipe.personen;
  const factor = recipe.personen > 0 ? vp / recipe.personen : 1;
  const fridgeNames = state.fridge.map((f) => f.naam);
  const match = fridgeMatchForRecipe(recipe, fridgeNames);
  const planDay = state.planDay || DAGEN.find((d) => !state.weekmenu[d]) || 'Ma';
  return `
    <div class="modal-backdrop">
      <div class="modal-card">
        <div class="flex justify-between items-start gap-3 mb-2">
          <h2 class="display" style="font-size:22px;margin:0">${escapeHtml(recipe.titel)}</h2>
          <button class="btn btn-outline btn-icon" data-action="close-modal">${icon('x')}</button>
        </div>
        <div class="pills mb-3">${renderPill('basis', recipe.basis)}${renderPill('proteine', recipe.proteine)}${renderPill('keuken', recipe.keuken)}</div>
        ${(recipe.tags || []).length ? `<div class="pills mb-3">${recipe.tags.map((t) => `<span class="tag-chip-sm">${escapeHtml(t.naam)}</span>`).join('')}</div>` : ''}
        ${recipe.bron ? `<a href="${escapeHtml(recipe.bron)}" target="_blank" rel="noreferrer" class="text-sm" style="display:inline-block;margin-bottom:12px">Bron bekijken</a>` : ''}
        <div class="flex gap-4 mb-4 flex-wrap">
          <div>
            <div class="field-label">Bereidingstijd</div>
            <div class="mono" style="font-weight:600;color:var(--plum)">${recipe.bereidingstijd} min</div>
          </div>
          <div>
            <div class="field-label">Personen</div>
            <div class="stepper">
              <button data-action="view-personen-min">${icon('minus')}</button>
              <span class="mono">${vp}</span>
              <button data-action="view-personen-plus">${icon('plus')}</button>
            </div>
          </div>
        </div>
        <div class="mb-3" style="padding:10px;border-radius:8px;background:#F6F2E7">
          <div class="text-sm mb-1">${match.matched}/${match.total} ingrediënten in je koelkast</div>
          <div class="progress-track"><div class="progress-fill" style="width:${match.pct}%"></div></div>
        </div>
        ${(recipe.onderdelen || []).length <= 1 ? `
          <h3 class="display mb-2" style="font-size:15px">Ingrediënten</h3>
          <div class="mb-4">${ingredientenListHtml(((recipe.onderdelen || [])[0] || {}).ingredienten, factor)}</div>
          <h3 class="display mb-2" style="font-size:15px">Bereiding</h3>
          <ol class="text-sm mb-4" style="padding-left:20px">${instructiesListHtml(((recipe.onderdelen || [])[0] || {}).instructies)}</ol>
        ` : recipe.onderdelen.map((onderdeel) => `
          <div class="mb-4">
            <h3 class="display mb-2" style="font-size:15px;color:var(--teal)">${escapeHtml(onderdeel.naam || 'Onderdeel')}</h3>
            <div class="mb-2">${ingredientenListHtml(onderdeel.ingredienten, factor)}</div>
            <ol class="text-sm" style="padding-left:20px">${instructiesListHtml(onderdeel.instructies)}</ol>
          </div>
        `).join('')}
        <h3 class="display mb-2" style="font-size:15px">Opmerkingen</h3>
        <div id="notities-lijst" class="mb-3">${renderNotitiesLijst()}</div>
        <div class="flex gap-2 mb-4">
          <input id="notitie-tekst" class="input" style="flex:1" placeholder="Bijv. iets meer zout toegevoegd, was lekker">
          <input id="notitie-datum" class="input" type="date" style="width:150px" value="${todayISODate()}">
          <button class="btn btn-outline btn-sm" data-action="add-notitie" data-id="${recipe.id}">${icon('plus')}</button>
        </div>
        <div class="flex flex-wrap items-center gap-2" style="border-top:1px solid var(--line);padding-top:16px">
          <select id="plan-day-select" class="input" style="width:auto">
            ${DAGEN.map((d) => `<option value="${d}" ${d === planDay ? 'selected' : ''}>${DAG_NAMEN[d]}</option>`).join('')}
          </select>
          <button class="btn btn-primary btn-sm" data-action="plan-from-detail" data-id="${recipe.id}">${icon('calendar')} Inplannen</button>
          <button class="btn btn-outline btn-sm" data-action="download-json" data-id="${recipe.id}">${icon('download')} JSON</button>
          <button class="btn btn-outline btn-sm" data-action="open-edit" data-id="${recipe.id}">${icon('pencil')} Bewerken</button>
          <button class="btn btn-danger btn-sm" style="margin-left:auto" data-action="ask-delete" data-id="${recipe.id}">${icon('trash-2')} Verwijderen</button>
        </div>
      </div>
    </div>
  `;
}

function renderEditModal(recipe) {
  if (!recipe) return '';
  return `<div class="modal-backdrop"><div class="modal-card">${renderRecipeFormFields(recipe, { heading: 'Recept bewerken', submitLabel: 'Wijzigingen opslaan' })}</div></div>`;
}

// ─────────────────────────────────────────── Modal: dag kiezen voor weekmenu
function renderPickModal(day) {
  return `
    <div class="modal-backdrop">
      <div class="modal-card wide">
        <div class="flex justify-between items-center mb-4">
          <h2 class="display" style="font-size:18px;margin:0">Kies recept voor ${DAG_NAMEN[day]}</h2>
          <button class="btn btn-outline btn-icon" data-action="close-modal">${icon('x')}</button>
        </div>
        <div id="pick-filterbar" class="mb-4">${renderFilterBarInner(true)}</div>
        <div id="pick-results">${renderPickResults()}</div>
      </div>
    </div>
  `;
}

function renderPickResults() {
  let list = filterRecipes(state.recipes, state.filters);
  const fridgeNames = state.fridge.map((f) => f.naam);
  if (state.pickerSortFridge) {
    list = list.map((r) => ({ r, m: fridgeMatchForRecipe(r, fridgeNames) })).sort((a, b) => b.m.pct - a.m.pct).map((x) => x.r);
  }
  if (list.length === 0) return renderEmptyState('search', 'Geen recepten gevonden.');
  return `<div class="grid">${list.map((r) => renderRecipeCard(r, state.pickerSortFridge ? fridgeMatchForRecipe(r, fridgeNames) : null, 'pick-recipe')).join('')}</div>`;
}

// ─────────────────────────────────────────── Modal: Kenmerken, tags & ingrediënten beheren
const MANAGE_PLACEHOLDER = { tags: 'tag', ingredienten: 'ingrediënt', eenheden: 'eenheid', afdelingen: 'afdeling' };

function renderManageModal() {
  const m = state.modal;
  const tabs = [
    { key: 'basis', label: 'Basis' },
    { key: 'proteine', label: 'Proteïne' },
    { key: 'keuken', label: 'Keuken' },
    { key: 'tags', label: 'Tags' },
    { key: 'ingredienten', label: 'Ingrediënten' },
    { key: 'afdelingen', label: 'Afdelingen' },
    { key: 'basisvoorraad', label: 'Basisvoorraad' },
    { key: 'eenheden', label: 'Eenheden' }
  ];
  const isBasisTab = m.categorie === 'basisvoorraad';
  const isIng = m.categorie === 'ingredienten';
  const items = isBasisTab ? [] : manageItems(m.categorie);
  const getoond = isIng && m.zonderAfdeling ? items.filter((i) => !i.afdeling_id) : items;
  const zonderCount = isIng ? items.filter((i) => !i.afdeling_id).length : 0;
  const body = isBasisTab ? renderBasisvoorraadBody() : `
        ${isIng ? `
        <div class="flex gap-2 flex-wrap mb-3">
          <button class="btn btn-sm ${m.zonderAfdeling ? 'btn-primary' : 'btn-outline'}" data-action="manage-toggle-zonder">${icon('filter')} Zonder afdeling (${zonderCount})</button>
          <button class="btn btn-outline btn-sm" data-action="manage-auto-afdeling">${icon('wand-2')} Automatisch indelen</button>
          <button class="btn btn-outline btn-sm" data-action="manage-copy-namen">${icon('copy')} Kopieer namen</button>
        </div>` : ''}
        <div id="manage-list" class="mb-3" style="max-height:340px;overflow-y:auto">
          ${getoond.length === 0 ? `<p class="text-sm text-soft">${isIng && m.zonderAfdeling ? 'Alle ingrediënten hebben een afdeling.' : 'Nog niets toegevoegd.'}</p>` : getoond.map((it) => (isIng ? renderIngredientRow(it, m) : renderManageRow(it, m))).join('')}
        </div>
        <div class="flex gap-2">
          <input id="manage-new-item" class="input" style="flex:1" placeholder="Nieuwe ${MANAGE_PLACEHOLDER[m.categorie] || 'optie'}...">
          <button class="btn btn-primary btn-sm" data-action="manage-add">${icon('plus')} Toevoegen</button>
        </div>`;
  return `
    <div class="modal-backdrop">
      <div class="modal-card">
        <div class="flex justify-between items-center mb-1">
          <h2 class="display" style="font-size:20px;margin:0">Beheren</h2>
          <button class="btn btn-outline btn-icon" data-action="close-modal">${icon('x')}</button>
        </div>
        <p class="text-sm text-soft mb-3">Wijzigingen gelden voor alle recepten. Hernoemen werkt overal door; verwijderen kan alleen als niets deze waarde meer gebruikt. Bij ingrediënten kun je twee dubbele varianten ook samenvoegen (bv. "rode ui" → "ui"), zodat de boodschappenlijst ze als één ding optelt. Sleep aan het handvat links om de volgorde te wijzigen; die volgorde zie je ook in de keuzelijsten en (bij Afdelingen) op de boodschappenlijst.</p>
        <div class="flex gap-2 mb-4 flex-wrap" style="border-bottom:1px solid var(--line);padding-bottom:12px">
          ${tabs.map((t) => `<button class="btn ${m.categorie === t.key ? 'btn-primary' : 'btn-outline'} btn-sm" data-action="manage-tab" data-categorie="${t.key}">${escapeHtml(t.label)}</button>`).join('')}
        </div>
        ${m.error ? bannerError(m.error) : ''}
        ${m.info ? `<div class="banner banner-info" style="margin-bottom:12px">${icon('info')}<span>${escapeHtml(m.info)}</span></div>` : ''}
        ${body}
      </div>
    </div>
  `;
}

// ── Basisvoorraad: ingrediënten die altijd in huis zijn (niet op de lijst in Thuis-modus)
function basisLijstHtml() {
  const lijst = state.ingredients.filter((i) => i.altijd_in_huis).slice().sort((a, b) => a.naam.localeCompare(b.naam));
  if (lijst.length === 0) return `<p class="text-sm text-soft">Nog niets. Voeg hieronder ingrediënten toe met het plusje.</p>`;
  return lijst.map((i) => `
    <div class="flex items-center gap-2" style="padding:6px 0;border-bottom:1px solid var(--line)">
      <span class="text-sm" style="flex:1">${escapeHtml(i.naam)}</span>
      <button class="btn btn-outline btn-sm btn-icon" data-action="basis-remove" data-id="${i.id}" title="Niet meer altijd in huis">${icon('x')}</button>
    </div>`).join('');
}

function basisKandidatenHtml() {
  const zoek = normName((state.modal && state.modal.zoek) || '');
  const lijst = state.ingredients
    .filter((i) => !i.altijd_in_huis && (!zoek || normName(i.naam).includes(zoek)))
    .slice().sort((a, b) => a.naam.localeCompare(b.naam));
  if (lijst.length === 0) return `<p class="text-sm text-soft">${zoek ? 'Geen ingrediënt gevonden.' : 'Alle ingrediënten staan al in je basisvoorraad.'}</p>`;
  return lijst.map((i) => `
    <div class="flex items-center gap-2" style="padding:6px 0;border-bottom:1px solid var(--line)">
      <span class="text-sm" style="flex:1">${escapeHtml(i.naam)}</span>
      <button class="btn btn-outline btn-sm btn-icon" data-action="basis-add" data-id="${i.id}" title="Altijd in huis">${icon('plus')}</button>
    </div>`).join('');
}

function renderBasisvoorraadBody() {
  const m = state.modal;
  const aantal = state.ingredients.filter((i) => i.altijd_in_huis).length;
  return `
    <h3 class="display" style="font-size:15px;margin:0 0 4px">Altijd in huis <span id="basis-aantal" class="mono text-soft" style="font-size:12px;font-weight:400">(${aantal})</span></h3>
    <p class="text-sm text-soft mb-3">Dit komt niet op de boodschappenlijst als die op <strong>Thuis</strong> staat. Zet je de lijst op <strong>Alles</strong> (bv. voor een vakantie), dan staan ze er wel op.</p>
    <div id="basis-lijst" class="mb-4" style="max-height:200px;overflow-y:auto">${basisLijstHtml()}</div>
    <h3 class="display" style="font-size:15px;margin:0 0 8px">Toevoegen</h3>
    <input id="basis-zoek" class="input mb-2" placeholder="Zoek een ingrediënt..." value="${escapeHtml(m.zoek || '')}">
    <div id="basis-kandidaten" style="max-height:240px;overflow-y:auto">${basisKandidatenHtml()}</div>
  `;
}

function refreshBasisvoorraad() {
  const lijst = document.getElementById('basis-lijst');
  const kand = document.getElementById('basis-kandidaten');
  const aantal = document.getElementById('basis-aantal');
  if (lijst) lijst.innerHTML = basisLijstHtml();
  if (kand) kand.innerHTML = basisKandidatenHtml();
  if (aantal) aantal.textContent = `(${state.ingredients.filter((i) => i.altijd_in_huis).length})`;
  hydrateIcons();
}

const DRAG_HANDLE_HTML = () => `<span class="drag-handle" data-drag-handle title="Sleep om de volgorde te wijzigen">${icon('grip-vertical')}</span>`;

function renderManageRow(item, m) {
  const isRenaming = m.renameId === item.id;
  if (isRenaming) {
    return `
      <div class="flex items-center gap-2" style="padding:6px 0;border-bottom:1px solid var(--line)">
        <input id="manage-rename-input" class="input" style="flex:1" value="${escapeHtml(item.naam)}">
        <button class="btn btn-primary btn-sm btn-icon" data-action="manage-rename-save" data-id="${item.id}">${icon('check')}</button>
        <button class="btn btn-outline btn-sm btn-icon" data-action="manage-rename-cancel">${icon('x')}</button>
      </div>
    `;
  }
  return `
    <div class="flex items-center gap-2 manage-row" data-id="${item.id}" style="padding:6px 0;border-bottom:1px solid var(--line)">
      ${DRAG_HANDLE_HTML()}<span class="text-sm" style="flex:1">${escapeHtml(item.naam)}</span>
      <button class="btn btn-outline btn-sm btn-icon" data-action="manage-rename-start" data-id="${item.id}">${icon('pencil')}</button>
      <button class="btn btn-outline btn-sm btn-icon" data-action="manage-delete" data-id="${item.id}" data-naam="${escapeHtml(item.naam)}">${icon('trash-2')}</button>
    </div>
  `;
}

function afdelingSelectHtml(item) {
  return `<select class="input" data-afdeling-select data-id="${item.id}" style="width:100%;max-width:240px;margin-top:4px;padding:4px 8px;font-size:12.5px">
    <option value="">(geen afdeling)</option>
    ${state.afdelingen.map((a) => `<option value="${a.id}" ${a.id === item.afdeling_id ? 'selected' : ''}>${escapeHtml(a.naam)}</option>`).join('')}
  </select>`;
}

function renderIngredientRow(item, m) {
  const isRenaming = m.renameId === item.id;
  const isMerging = m.mergeId === item.id;
  if (isRenaming) {
    return `
      <div class="flex items-center gap-2" style="padding:6px 0;border-bottom:1px solid var(--line)">
        <input id="manage-rename-input" class="input" style="flex:1" value="${escapeHtml(item.naam)}">
        <button class="btn btn-primary btn-sm btn-icon" data-action="manage-rename-save" data-id="${item.id}">${icon('check')}</button>
        <button class="btn btn-outline btn-sm btn-icon" data-action="manage-rename-cancel">${icon('x')}</button>
      </div>
    `;
  }
  if (isMerging) {
    const opties = state.ingredients.filter((i) => i.id !== item.id);
    return `
      <div class="flex items-center gap-2" style="padding:6px 0;border-bottom:1px solid var(--line)">
        <span class="text-sm text-soft" style="white-space:nowrap">"${escapeHtml(item.naam)}" → </span>
        <select id="merge-target-select" class="input" style="flex:1">
          ${opties.map((o) => `<option value="${o.id}">${escapeHtml(o.naam)}</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm btn-icon" data-action="manage-merge-save" data-id="${item.id}">${icon('check')}</button>
        <button class="btn btn-outline btn-sm btn-icon" data-action="manage-merge-cancel">${icon('x')}</button>
      </div>
    `;
  }
  return `
    <div class="flex items-center gap-2 manage-row" data-id="${item.id}" style="padding:6px 0;border-bottom:1px solid var(--line)">
      ${m.zonderAfdeling ? '' : DRAG_HANDLE_HTML()}
      <div style="flex:1;min-width:0">
        <div class="text-sm">${escapeHtml(item.naam)}</div>
        ${afdelingSelectHtml(item)}
      </div>
      <button class="btn btn-outline btn-sm btn-icon" data-action="manage-merge-start" data-id="${item.id}" title="Samenvoegen met ander ingrediënt">${icon('git-merge')}</button>
      <button class="btn btn-outline btn-sm btn-icon" data-action="manage-rename-start" data-id="${item.id}">${icon('pencil')}</button>
      <button class="btn btn-outline btn-sm btn-icon" data-action="manage-delete" data-id="${item.id}" data-naam="${escapeHtml(item.naam)}">${icon('trash-2')}</button>
    </div>
  `;
}

// ─────────────────────────────────────────── Bevestigingsdialoog
function renderConfirmDialog(message) {
  return `
    <div class="modal-backdrop" style="z-index:60">
      <div class="modal-card narrow">
        <p class="text-sm mb-4">${escapeHtml(message)}</p>
        <div class="flex gap-2 justify-end">
          <button class="btn btn-outline" data-action="confirm-no">Annuleren</button>
          <button class="btn btn-danger" data-action="confirm-yes">Verwijderen</button>
        </div>
      </div>
    </div>
  `;
}

function closeModal() {
  state.modal = null;
  rerender();
}

// ─────────────────────────────────────────── Koelkast-acties
async function handleAddFridgeItem() {
  const input = document.getElementById('fridge-input');
  const naam = input.value.trim();
  if (!naam) return;
  if (state.fridge.some((f) => normName(f.naam) === normName(naam))) { input.value = ''; return; }
  const row = await db.addKoelkastItem(naam);
  state.fridge.push(row);
  rerender();
}

// ─────────────────────────────────────────── Actie-router
async function handleAction(action, el) {
  switch (action) {
    case 'tab':
      state.activeTab = el.dataset.tab;
      state.filters = { basis: '', proteine: '', keuken: '', tag: '', maxTijd: '', zoek: '' };
      rerender();
      break;

    case 'open-add':
      state.modal = { type: 'add', step: 'kies', error: '', info: '', fileName: '', draftRecipe: null };
      rerender();
      break;

    case 'close-modal':
      closeModal();
      break;

    case 'open-view':
      state.modal = { type: 'view', id: el.dataset.id };
      state.viewPersonen = null;
      state.planDay = null;
      state.viewNotities = [];
      state.notitiesLoading = true;
      rerender();
      db.fetchNotities(el.dataset.id).then((notities) => {
        if (!state.modal || state.modal.type !== 'view' || state.modal.id !== el.dataset.id) return;
        state.viewNotities = notities;
        state.notitiesLoading = false;
        rerender();
      }).catch((err) => {
        state.notitiesLoading = false;
        console.error(err);
        rerender();
      });
      break;

    case 'add-notitie': {
      const tekst = document.getElementById('notitie-tekst').value.trim();
      const datum = document.getElementById('notitie-datum').value;
      if (!tekst) break;
      const row = await db.addNotitie(el.dataset.id, tekst, datum);
      state.viewNotities = [row, ...state.viewNotities].sort((a, b) => (b.datum + b.aangemaakt).localeCompare(a.datum + a.aangemaakt));
      rerender();
      break;
    }

    case 'delete-notitie': {
      const recipeId = state.modal.id;
      await db.deleteNotitie(el.dataset.id, recipeId);
      state.viewNotities = state.viewNotities.filter((n) => n.id !== el.dataset.id);
      rerender();
      break;
    }

    case 'open-edit':
      state.modal = { type: 'edit', id: el.dataset.id };
      rerender();
      break;

    case 'open-pick':
      state.modal = { type: 'pick', day: el.dataset.day };
      state.pickerSortFridge = false;
      rerender();
      break;

    case 'open-manage':
      state.modal = { type: 'manage', categorie: 'basis', error: '', renameId: null, mergeId: null };
      rerender();
      break;

    case 'ai-method':
      state.modal.step = el.dataset.method === 'manual' ? 'manual' : el.dataset.method;
      state.modal.error = '';
      rerender();
      break;

    case 'ai-back':
      state.modal.step = 'kies';
      state.modal.error = '';
      rerender();
      break;

    case 'ask-delete': {
      const recipe = getRecipe(el.dataset.id);
      if (!recipe) break;
      state.confirm = {
        message: `Weet je zeker dat je "${recipe.titel}" wilt verwijderen?`,
        onConfirm: async () => {
          await db.deleteRecipe(recipe.id);
          state.recipes = state.recipes.filter((r) => r.id !== recipe.id);
          DAGEN.forEach((d) => { if (state.weekmenu[d] && state.weekmenu[d].recipeId === recipe.id) state.weekmenu[d] = null; });
          state.confirm = null;
          state.modal = null;
          rerender();
        }
      };
      rerender();
      break;
    }

    case 'confirm-yes':
      if (state.confirm) await state.confirm.onConfirm();
      break;

    case 'confirm-no':
      state.confirm = null;
      rerender();
      break;

    case 'remove-day':
      await db.setWeekmenuDag(el.dataset.day, null);
      state.weekmenu[el.dataset.day] = null;
      rerender();
      break;

    case 'ask-clear-week':
      state.confirm = {
        message: 'Weet je zeker dat je het hele weekmenu wilt leegmaken?',
        onConfirm: async () => {
          for (const d of DAGEN) {
            if (state.weekmenu[d]) {
              await db.setWeekmenuDag(d, null);
              state.weekmenu[d] = null;
            }
          }
          state.confirm = null;
          rerender();
        }
      };
      rerender();
      break;

    case 'set-thuis': {
      const waarde = el.dataset.waarde === '1';
      state.instellingen = { ...state.instellingen, boodschappen_thuis: waarde };
      await db.updateInstellingen({ boodschappen_thuis: waarde });
      rerender();
      break;
    }

    case 'share-list': {
      const v = getShoppingView();
      const checked = state.instellingen.boodschappen_vinkjes || {};
      const groepen = v.groepen
        .map((g) => ({ titel: g.titel, items: g.items.filter((i) => !checked[i.key]) }))
        .filter((g) => g.items.length);
      if (groepen.length === 0) { flashButton(el, 'Niets te delen'); break; }
      const tekst = shoppingListToText(groepen);
      if (navigator.share) {
        try { await navigator.share({ title: 'Boodschappen', text: tekst }); break; }
        catch (err) { if (err && err.name === 'AbortError') break; }
      }
      const ok = await copyText(tekst);
      flashButton(el, ok ? 'Gekopieerd ✓' : 'Kopiëren mislukt');
      break;
    }

    case 'manage-toggle-zonder':
      state.modal.zonderAfdeling = !state.modal.zonderAfdeling;
      state.modal.info = '';
      rerender();
      break;

    case 'manage-auto-afdeling': {
      const perNaam = new Map(state.afdelingen.map((x) => [normName(x.naam), x.id]));
      const updates = [];
      let onbekend = 0;
      state.ingredients.filter((i) => !i.afdeling_id).forEach((i) => {
        const voorstel = suggestAfdeling(i.naam);
        const afdelingId = voorstel ? perNaam.get(normName(voorstel)) : null;
        if (afdelingId) updates.push({ id: i.id, afdeling_id: afdelingId }); else onbekend++;
      });
      if (updates.length) await db.setIngredientAfdelingen(updates);
      const nieuw = new Map(updates.map((u) => [u.id, u.afdeling_id]));
      state.ingredients = state.ingredients.map((i) => (nieuw.has(i.id) ? { ...i, afdeling_id: nieuw.get(i.id) } : i));
      state.modal.info = `${updates.length} ingrediënt${updates.length === 1 ? '' : 'en'} ingedeeld, ${onbekend} niet herkend. Controleer de indeling gerust: je kunt elke afdeling zelf aanpassen.`;
      state.modal.error = '';
      rerender();
      break;
    }

    case 'manage-copy-namen': {
      const lijst = state.modal.zonderAfdeling ? state.ingredients.filter((i) => !i.afdeling_id) : state.ingredients;
      const ok = await copyText(lijst.map((i) => i.naam).join('\n'));
      flashButton(el, ok ? `${lijst.length} namen gekopieerd ✓` : 'Kopiëren mislukt');
      break;
    }

    case 'basis-add':
    case 'basis-remove': {
      const aan = action === 'basis-add';
      const id = el.dataset.id;
      await db.setIngredientBasisvoorraad(id, aan);
      state.ingredients = state.ingredients.map((i) => (i.id === id ? { ...i, altijd_in_huis: aan } : i));
      refreshBasisvoorraad();
      break;
    }

    case 'open-shop-item':
      state.modal = { type: 'shop-item', key: el.dataset.key };
      rerender();
      break;

    case 'plan-from-detail': {
      const day = document.getElementById('plan-day-select').value;
      const recipeId = el.dataset.id;
      const personen = state.instellingen.huishoud_personen;
      await db.setWeekmenuDag(day, recipeId, personen);
      state.weekmenu[day] = { recipeId, personen };
      state.modal = null;
      rerender();
      break;
    }

    case 'pick-recipe': {
      const day = state.modal.day;
      const recipeId = el.dataset.id;
      const personen = state.instellingen.huishoud_personen;
      await db.setWeekmenuDag(day, recipeId, personen);
      state.weekmenu[day] = { recipeId, personen };
      state.modal = null;
      rerender();
      break;
    }

    case 'day-personen-min':
    case 'day-personen-plus': {
      const day = el.dataset.day;
      const entry = state.weekmenu[day];
      if (!entry) break;
      const base = entry.personen || (getRecipe(entry.recipeId) || {}).personen || 1;
      const next = Math.max(1, base + (action === 'day-personen-plus' ? 1 : -1));
      state.weekmenu[day] = { ...entry, personen: next };
      await db.setWeekmenuPersonen(day, next);
      rerender();
      break;
    }

    case 'go-shopping':
      state.activeTab = 'boodschappen';
      rerender();
      break;

    case 'go-weekmenu':
      state.activeTab = 'weekmenu';
      rerender();
      break;

    case 'huishoud-min':
    case 'huishoud-plus': {
      const next = Math.max(1, state.instellingen.huishoud_personen + (action === 'huishoud-plus' ? 1 : -1));
      state.instellingen.huishoud_personen = next;
      await db.updateInstellingen({ huishoud_personen: next });
      rerender();
      break;
    }

    case 'view-personen-min':
    case 'view-personen-plus': {
      const recipe = getRecipe(state.modal.id);
      const base = state.viewPersonen || recipe.personen;
      state.viewPersonen = Math.max(1, base + (action === 'view-personen-plus' ? 1 : -1));
      rerender();
      break;
    }

    case 'download-json': {
      const recipe = getRecipe(el.dataset.id);
      downloadJSON(recipe, slugify(recipe.titel) + '.json');
      break;
    }

    case 'add-onderdeel': {
      document.getElementById('onderdelen-list').insertAdjacentHTML('beforeend', onderdeelBlockHtml());
      hydrateIcons();
      break;
    }

    case 'remove-onderdeel': {
      const blocks = document.querySelectorAll('.onderdeel-block');
      if (blocks.length > 1) el.closest('.onderdeel-block').remove();
      break;
    }

    case 'add-ing-row': {
      const container = el.closest('.onderdeel-block').querySelector('.ing-rows');
      container.insertAdjacentHTML('beforeend', ingredientRowHtml());
      hydrateIcons();
      break;
    }

    case 'remove-ing-row':
      el.closest('.ing-row').remove();
      break;

    case 'add-fridge-item':
      await handleAddFridgeItem();
      break;

    case 'remove-fridge-item':
      await db.removeKoelkastItem(el.dataset.id);
      state.fridge = state.fridge.filter((f) => f.id !== el.dataset.id);
      rerender();
      break;

    case 'clear-filters':
      state.filters = { basis: '', proteine: '', keuken: '', tag: '', maxTijd: '', zoek: '' };
      rerender();
      break;

    case 'toggle-checked': {
      const key = el.dataset.key;
      const vinkjes = { ...(state.instellingen.boodschappen_vinkjes || {}) };
      vinkjes[key] = !vinkjes[key];
      state.instellingen.boodschappen_vinkjes = vinkjes;
      await db.updateInstellingen({ boodschappen_vinkjes: vinkjes });
      rerender();
      break;
    }

    case 'clear-checked':
      state.instellingen.boodschappen_vinkjes = {};
      await db.updateInstellingen({ boodschappen_vinkjes: {} });
      rerender();
      break;

    case 'quick-add-tag': {
      const input = document.getElementById('form-new-tag');
      const naam = input.value.trim();
      if (!naam) break;
      if (state.tags.some((t) => t.naam.toLowerCase() === naam.toLowerCase())) { input.value = ''; break; }
      const tagsContainer = document.getElementById('form-tags');
      const checkedIds = tagsContainer
        ? Array.from(tagsContainer.querySelectorAll('[name="tagIds"]:checked')).map((cb) => cb.value)
        : [];
      const newTag = await db.addTag(naam);
      state.tags = [...state.tags, newTag];
      if (tagsContainer) { tagsContainer.innerHTML = tagCheckboxesHtml([...checkedIds, newTag.id]); hydrateIcons(); }
      input.value = '';
      break;
    }

    case 'manage-tab':
      state.modal.categorie = el.dataset.categorie;
      state.modal.renameId = null;
      state.modal.mergeId = null;
      state.modal.zonderAfdeling = false;
      state.modal.zoek = '';
      state.modal.info = '';
      state.modal.error = '';
      rerender();
      break;

    case 'manage-add': {
      const input = document.getElementById('manage-new-item');
      const naam = input.value.trim();
      if (!naam) break;
      const categorie = state.modal.categorie;
      try {
        if (categorie === 'tags') {
          const row = await db.addTag(naam);
          state.tags = [...state.tags, row];
        } else if (categorie === 'ingredienten') {
          const row = await db.addIngredient(naam);
          state.ingredients = [...state.ingredients, row];
        } else if (categorie === 'afdelingen') {
          const row = await db.addAfdeling(naam);
          state.afdelingen = [...state.afdelingen, row];
        } else if (categorie === 'eenheden') {
          const row = await db.addEenheid(naam);
          state.eenheden = [...state.eenheden, row];
        } else {
          const row = await db.addKenmerkOptie(categorie, naam);
          state.kenmerkOpties[categorie] = [...state.kenmerkOpties[categorie], row];
        }
        state.modal.error = '';
        rerender();
      } catch (err) {
        state.modal.error = (err && err.message) || 'Toevoegen mislukt.';
        rerender();
      }
      break;
    }

    case 'manage-rename-start':
      state.modal.renameId = el.dataset.id;
      rerender();
      break;

    case 'manage-rename-cancel':
      state.modal.renameId = null;
      rerender();
      break;

    case 'manage-rename-save': {
      const id = el.dataset.id;
      const categorie = state.modal.categorie;
      const input = document.getElementById('manage-rename-input');
      const nieuweNaam = input.value.trim();
      if (!nieuweNaam) break;
      try {
        if (categorie === 'tags') {
          await db.renameTag(id, nieuweNaam);
          state.tags = state.tags.map((t) => (t.id === id ? { ...t, naam: nieuweNaam } : t));
          state.recipes = state.recipes.map((r) => ({ ...r, tags: (r.tags || []).map((t) => (t.id === id ? { ...t, naam: nieuweNaam } : t)) }));
        } else if (categorie === 'ingredienten') {
          await db.renameIngredient(id, nieuweNaam);
          state.ingredients = state.ingredients.map((i) => (i.id === id ? { ...i, naam: nieuweNaam } : i));
          state.recipes = state.recipes.map((r) => ({
            ...r,
            onderdelen: (r.onderdelen || []).map((o) => ({
              ...o,
              ingredienten: o.ingredienten.map((ing) => (ing.ingredientId === id ? { ...ing, naam: nieuweNaam } : ing))
            }))
          }));
        } else if (categorie === 'afdelingen') {
          await db.renameAfdeling(id, nieuweNaam);
          state.afdelingen = state.afdelingen.map((x) => (x.id === id ? { ...x, naam: nieuweNaam } : x));
        } else if (categorie === 'eenheden') {
          const oud = state.eenheden.find((e) => e.id === id);
          const oudeNaam = oud ? oud.naam : null;
          await db.renameEenheid(id, oudeNaam, nieuweNaam);
          state.eenheden = state.eenheden.map((e) => (e.id === id ? { ...e, naam: nieuweNaam } : e));
          if (oudeNaam) {
            state.recipes = state.recipes.map((r) => ({
              ...r,
              onderdelen: (r.onderdelen || []).map((o) => ({
                ...o,
                ingredienten: o.ingredienten.map((ing) => (ing.eenheid === oudeNaam ? { ...ing, eenheid: nieuweNaam } : ing))
              }))
            }));
          }
        } else {
          const oud = state.kenmerkOpties[categorie].find((k) => k.id === id);
          const oudeNaam = oud ? oud.naam : null;
          await db.renameKenmerkOptie(id, categorie, oudeNaam, nieuweNaam);
          state.kenmerkOpties[categorie] = state.kenmerkOpties[categorie].map((k) => (k.id === id ? { ...k, naam: nieuweNaam } : k));
          if (oudeNaam) state.recipes = state.recipes.map((r) => (r[categorie] === oudeNaam ? { ...r, [categorie]: nieuweNaam } : r));
        }
        state.modal.renameId = null;
        state.modal.error = '';
        rerender();
      } catch (err) {
        state.modal.error = (err && err.message) || 'Hernoemen mislukt.';
        rerender();
      }
      break;
    }

    case 'manage-merge-start':
      state.modal.mergeId = el.dataset.id;
      rerender();
      break;

    case 'manage-merge-cancel':
      state.modal.mergeId = null;
      rerender();
      break;

    case 'manage-merge-save': {
      const vanId = el.dataset.id;
      const select = document.getElementById('merge-target-select');
      const naarId = select && select.value;
      if (!naarId) break;
      try {
        await db.mergeIngredients(vanId, naarId);
        state.ingredients = state.ingredients.filter((i) => i.id !== vanId);
        state.recipes = await db.fetchRecipes();
        state.modal.mergeId = null;
        state.modal.error = '';
        rerender();
      } catch (err) {
        state.modal.error = (err && err.message) || 'Samenvoegen mislukt.';
        rerender();
      }
      break;
    }

    case 'manage-delete': {
      const id = el.dataset.id;
      const naam = el.dataset.naam;
      const categorie = state.modal.categorie;
      state.confirm = {
        message: categorie === 'tags'
          ? `Tag "${naam}" verwijderen? Dit haalt hem ook weg bij recepten die hem gebruiken.`
          : categorie === 'afdelingen'
            ? `Afdeling "${naam}" verwijderen? De ingrediënten in deze afdeling worden "niet ingedeeld".`
          : categorie === 'ingredienten'
            ? `Ingrediënt "${naam}" verwijderen?`
            : `"${naam}" verwijderen?`,
        onConfirm: async () => {
          try {
            if (categorie === 'tags') {
              await db.deleteTag(id);
              state.tags = state.tags.filter((t) => t.id !== id);
              state.recipes = state.recipes.map((r) => ({ ...r, tags: (r.tags || []).filter((t) => t.id !== id) }));
            } else if (categorie === 'ingredienten') {
              await db.deleteIngredient(id);
              state.ingredients = state.ingredients.filter((i) => i.id !== id);
            } else if (categorie === 'afdelingen') {
              await db.deleteAfdeling(id);
              state.afdelingen = state.afdelingen.filter((x) => x.id !== id);
              state.ingredients = state.ingredients.map((i) => (i.afdeling_id === id ? { ...i, afdeling_id: null } : i));
            } else if (categorie === 'eenheden') {
              await db.deleteEenheid(id, naam);
              state.eenheden = state.eenheden.filter((e) => e.id !== id);
            } else {
              await db.deleteKenmerkOptie(id, categorie, naam);
              state.kenmerkOpties[categorie] = state.kenmerkOpties[categorie].filter((k) => k.id !== id);
            }
            state.confirm = null;
            rerender();
          } catch (err) {
            state.confirm = null;
            state.modal.error = (err && err.message) || 'Verwijderen mislukt.';
            rerender();
          }
        }
      };
      rerender();
      break;
    }

    default:
      break;
  }
}

// ─────────────────────────────────────────── Slepen in Beheren (pointer events: werkt met muis en touch)
const MANAGE_TABELLEN = { tags: 'tags', ingredienten: 'ingredients', eenheden: 'eenheden', afdelingen: 'afdelingen' };

function manageItems(categorie) {
  return categorie === 'tags' ? state.tags
    : categorie === 'ingredienten' ? state.ingredients
    : categorie === 'eenheden' ? state.eenheden
    : categorie === 'afdelingen' ? state.afdelingen
    : state.kenmerkOpties[categorie];
}

function setManageItems(categorie, lijst) {
  if (categorie === 'tags') state.tags = lijst;
  else if (categorie === 'ingredienten') state.ingredients = lijst;
  else if (categorie === 'eenheden') state.eenheden = lijst;
  else if (categorie === 'afdelingen') state.afdelingen = lijst;
  else state.kenmerkOpties[categorie] = lijst;
}

function wireManageDrag() {
  const list = document.getElementById('manage-list');
  if (!list) return;
  list.querySelectorAll('[data-drag-handle]').forEach((handle) => {
    handle.addEventListener('pointerdown', (e) => startManageDrag(e, list, handle));
  });
}

function startManageDrag(e, list, handle) {
  const row = handle.closest('.manage-row');
  if (!row) return;
  e.preventDefault();
  try { handle.setPointerCapture(e.pointerId); } catch (_) { /* niet kritiek */ }
  row.classList.add('dragging');
  let lastY = e.clientY;

  const place = () => {
    const rows = Array.from(list.querySelectorAll('.manage-row')).filter((r) => r !== row);
    const next = rows.find((r) => {
      const b = r.getBoundingClientRect();
      return lastY < b.top + b.height / 2;
    });
    if (next) { if (row.nextElementSibling !== next) list.insertBefore(row, next); }
    else if (list.lastElementChild !== row) list.appendChild(row);
  };
  const onMove = (ev) => { lastY = ev.clientY; place(); };
  // Automatisch scrollen als je dicht bij de rand van de lijst sleept.
  const scrollTimer = setInterval(() => {
    const b = list.getBoundingClientRect();
    if (lastY < b.top + 28) { list.scrollTop -= 10; place(); }
    else if (lastY > b.bottom - 28) { list.scrollTop += 10; place(); }
  }, 16);
  const onEnd = () => {
    clearInterval(scrollTimer);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onEnd);
    window.removeEventListener('pointercancel', onEnd);
    row.classList.remove('dragging');
    const ids = Array.from(list.querySelectorAll('.manage-row')).map((r) => r.dataset.id);
    commitManageOrder(ids).catch((err) => console.error(err));
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onEnd);
  window.addEventListener('pointercancel', onEnd);
}

async function commitManageOrder(ids) {
  const categorie = state.modal && state.modal.categorie;
  if (!categorie) return;
  const huidig = manageItems(categorie);
  const byId = Object.fromEntries(huidig.map((i) => [i.id, i]));
  const nieuw = ids.filter((id) => byId[id]).map((id, idx) => ({ ...byId[id], volgorde: idx + 1 }));
  if (nieuw.length !== huidig.length) return;
  const gewijzigd = nieuw.filter((i) => (byId[i.id].volgorde || 0) !== i.volgorde).map((i) => ({ id: i.id, volgorde: i.volgorde }));
  if (gewijzigd.length === 0) return;
  setManageItems(categorie, nieuw);
  try {
    await db.reorderItems(MANAGE_TABELLEN[categorie] || 'kenmerk_opties', gewijzigd);
    state.modal.error = '';
  } catch (err) {
    setManageItems(categorie, huidig);
    state.modal.error = (err && err.message) || 'Volgorde opslaan mislukt.';
    rerender();
  }
}

// ─────────────────────────────────────────── Dynamische listeners (na elke render opnieuw aangekoppeld)
function wireDynamicListeners() {
  const fridgeInput = document.getElementById('fridge-input');
  if (fridgeInput) fridgeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFridgeItem(); } });

  const jsonInput = document.getElementById('json-file-input');
  if (jsonInput) jsonInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    handleJsonFile(file);
  });

  wireManageDrag();

  const basisZoek = document.getElementById('basis-zoek');
  if (basisZoek) basisZoek.addEventListener('input', () => {
    state.modal.zoek = basisZoek.value;
    const kand = document.getElementById('basis-kandidaten');
    if (kand) { kand.innerHTML = basisKandidatenHtml(); hydrateIcons(); }
  });

  const form = document.getElementById('recipe-form');
  if (form) form.addEventListener('submit', handleRecipeFormSubmit);

  if (state.activeTab === 'recepten') wireFilterBar('recepten-filterbar', 'recepten-results', renderReceptenResults);
  if (state.modal && state.modal.type === 'pick') wireFilterBar('pick-filterbar', 'pick-results', renderPickResults);
}

init();
