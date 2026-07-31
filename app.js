import * as db from './db.js';
import { DEMO_MODE } from './db.js';
import * as ai from './ai.js';
import { BASIS_OPTIONS, PROTEINE_OPTIONS, KEUKEN_OPTIONS, DAGEN, DAG_NAMEN, KENMERK_STYLE } from './constants.js';
import { escapeHtml, normName, fridgeMatchForRecipe, buildShoppingList, fileToResizedBase64, downloadJSON, slugify } from './utils.js';

const state = {
  loaded: false,
  recipes: [],
  weekmenu: { Ma: null, Di: null, Wo: null, Do: null, Vr: null, Za: null, Zo: null },
  fridge: [],
  instellingen: { huishoud_personen: 2, boodschappen_vinkjes: {} },
  activeTab: 'recepten',
  filters: { basis: '', proteine: '', keuken: '', maxTijd: '', zoek: '' },
  pickerSortFridge: false,
  viewPersonen: null,
  planDay: null,
  modal: null,
  confirm: null
};

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
  root.innerHTML = renderLoading();
  hydrateIcons();
  try {
    const [recipes, weekmenu, fridge, instellingen] = await Promise.all([
      db.fetchRecipes(), db.fetchWeekmenu(), db.fetchKoelkast(), db.fetchInstellingen()
    ]);
    state.recipes = recipes;
    state.weekmenu = weekmenu;
    state.fridge = fridge;
    state.instellingen = instellingen;
    state.loaded = true;
    rerender();
  } catch (e) {
    root.innerHTML = renderLoadError((e && e.message) || 'Onbekende fout.');
    hydrateIcons();
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
      <span class="text-sm text-soft">Receptenkist wordt geladen...</span>
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
    else if (state.modal.type === 'ai-settings') html += renderAiSettingsModal();
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
        <div class="brand">${icon('chef-hat')}<span class="display">Receptenkist</span></div>
        <div class="flex gap-2">
          <button class="btn btn-outline btn-sm" data-action="open-ai-settings">${icon('sparkles')} AI-key</button>
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
  return `
    <div class="card recipe-card" data-action="${action || 'open-view'}" data-id="${recipe.id}">
      <h3 class="display">${escapeHtml(recipe.titel)}</h3>
      <div class="pills">
        ${renderPill('basis', recipe.basis)}${renderPill('proteine', recipe.proteine)}${renderPill('keuken', recipe.keuken)}
      </div>
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
  const active = f.basis || f.proteine || f.keuken || f.maxTijd || f.zoek;
  return `
    <div class="card flex flex-wrap items-end gap-3" style="padding:14px">
      <div style="flex:1;min-width:160px">
        <label class="field-label">Zoeken</label>
        <input class="input" name="f-zoek" placeholder="Titel of ingrediënt..." value="${escapeHtml(f.zoek)}">
      </div>
      <div><label class="field-label">Basis</label><select class="input" name="f-basis">${optionListHtml(BASIS_OPTIONS, f.basis)}</select></div>
      <div><label class="field-label">Proteïne</label><select class="input" name="f-proteine">${optionListHtml(PROTEINE_OPTIONS, f.proteine)}</select></div>
      <div><label class="field-label">Keuken</label><select class="input" name="f-keuken">${optionListHtml(KEUKEN_OPTIONS, f.keuken)}</select></div>
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
    if (filters.maxTijd && r.bereidingstijd > Number(filters.maxTijd)) return false;
    if (filters.zoek) {
      const q = filters.zoek.toLowerCase();
      const inTitle = r.titel.toLowerCase().includes(q);
      const inIng = (r.ingredienten || []).some((i) => (i.naam || '').toLowerCase().includes(q));
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
  const maxTijd = bar.querySelector('[name="f-maxtijd"]');
  const sortFridge = bar.querySelector('[name="f-sortfridge"]');
  if (zoek) zoek.addEventListener('input', () => { state.filters.zoek = zoek.value; refresh(); });
  if (maxTijd) maxTijd.addEventListener('input', () => { state.filters.maxTijd = maxTijd.value; refresh(); });
  if (basis) basis.addEventListener('change', () => { state.filters.basis = basis.value; rebuildBar(hasSortFridge); });
  if (proteine) proteine.addEventListener('change', () => { state.filters.proteine = proteine.value; rebuildBar(hasSortFridge); });
  if (keuken) keuken.addEventListener('change', () => { state.filters.keuken = keuken.value; rebuildBar(hasSortFridge); });
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
            <span class="text-sm">Personen thuis</span>
            <div class="stepper">
              <button data-action="huishoud-min">${icon('minus')}</button>
              <span class="mono">${state.instellingen.huishoud_personen}</span>
              <button data-action="huishoud-plus">${icon('plus')}</button>
            </div>
          </div>
          <button class="btn btn-primary" data-action="go-shopping">${icon('shopping-cart')} Boodschappenlijst</button>
        </div>
      </div>
    </div>
    <div class="week-grid">${DAGEN.map((d) => renderWeekDay(d)).join('')}</div>
  `;
}

function renderWeekDay(dag) {
  const recipeId = state.weekmenu[dag];
  const recipe = recipeId ? getRecipe(recipeId) : null;
  return `
    <div class="card" style="padding:12px;display:flex;flex-direction:column;min-height:170px">
      <div class="mono text-soft" style="font-size:11px;font-weight:600;margin-bottom:8px">${DAG_NAMEN[dag]}</div>
      ${recipe ? `
        <div style="flex:1;display:flex;flex-direction:column">
          <div style="font-weight:600;font-size:13.5px;margin-bottom:8px;flex:1">${escapeHtml(recipe.titel)}</div>
          <div class="pills mb-2">${renderPill('basis', recipe.basis)}${renderPill('proteine', recipe.proteine)}</div>
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
function renderBoodschappen() {
  const fridgeNames = state.fridge.map((f) => f.naam);
  const list = buildShoppingList(state.weekmenu, state.recipes, state.instellingen.huishoud_personen, fridgeNames);
  if (list.length === 0) {
    return renderEmptyState('shopping-cart', 'Je weekmenu is nog leeg. Plan eerst een paar dagen in.', { label: 'Naar weekmenu', action: 'go-weekmenu' });
  }
  const teKopen = list.filter((i) => !i.inHuis);
  const alInHuis = list.filter((i) => i.inHuis);
  const checked = state.instellingen.boodschappen_vinkjes || {};
  const checkedCount = list.filter((i) => checked[i.key]).length;
  return `
    <div class="card mb-4" style="padding:16px">
      <div class="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 class="display" style="font-size:18px;margin:0 0 2px">Boodschappenlijst</h2>
          <p class="text-sm text-soft" style="margin:0">${checkedCount} van ${list.length} afgevinkt · voor ${state.instellingen.huishoud_personen} personen</p>
        </div>
        <button class="btn btn-outline btn-sm" data-action="clear-checked">${icon('rotate-ccw')} Wis vinkjes</button>
      </div>
    </div>
    ${renderShopSection('Nog te kopen', teKopen, checked)}
    ${alInHuis.length ? renderShopSection('Al in huis', alInHuis, checked, true) : ''}
  `;
}

function renderShopSection(title, items, checked, muted) {
  return `
    <div class="card mb-4" style="padding:16px;${muted ? 'opacity:.75' : ''}">
      <h3 class="display" style="font-size:15px;margin:0 0 10px">${escapeHtml(title)} <span class="mono text-soft" style="font-size:12px;font-weight:400">(${items.length})</span></h3>
      ${items.map((item) => `
        <div class="shop-item ${checked[item.key] ? 'checked' : ''}">
          <input type="checkbox" data-action="toggle-checked" data-key="${item.key}" ${checked[item.key] ? 'checked' : ''}>
          <span class="naam">${escapeHtml(item.naam)}</span>
          <span class="mono hoeveelheid">${item.hoeveelheid != null ? item.hoeveelheid : ''} ${escapeHtml(item.eenheid)}</span>
        </div>
      `).join('')}
    </div>
  `;
}

// ─────────────────────────────────────────── Receptformulier (nieuw & bewerken)
function ingredientRowHtml(ing) {
  ing = ing || {};
  return `
    <div class="ing-row">
      <input class="input naam" placeholder="Ingrediënt" value="${escapeHtml(ing.naam || '')}">
      <input class="input aantal" type="number" step="any" placeholder="aantal" value="${ing.hoeveelheid != null ? ing.hoeveelheid : ''}">
      <input class="input eenheid" placeholder="eenheid" value="${escapeHtml(ing.eenheid || '')}">
      <button type="button" class="btn btn-outline btn-icon" data-action="remove-ing-row">${icon('x')}</button>
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

function renderRecipeFormFields(initialRecipe, opts) {
  opts = opts || {};
  const r = initialRecipe || {};
  const ingredienten = (r.ingredienten && r.ingredienten.length) ? r.ingredienten : [{}];
  const instructiesText = (r.instructies || []).join('\n');
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
        ${selectFieldHtml('Basis', 'basis', BASIS_OPTIONS, r.basis)}
        ${selectFieldHtml('Proteïne', 'proteine', PROTEINE_OPTIONS, r.proteine)}
        ${selectFieldHtml('Keuken', 'keuken', KEUKEN_OPTIONS, r.keuken)}
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
        <div class="flex justify-between items-center mb-1">
          <label class="field-label" style="margin:0">Ingrediënten</label>
          <button type="button" class="btn btn-outline btn-sm" data-action="add-ing-row">${icon('plus')} Regel</button>
        </div>
        <div id="ing-rows">${ingredienten.map(ingredientRowHtml).join('')}</div>
      </div>
      <div class="mb-4">
        <label class="field-label">Bereidingswijze (één stap per regel)</label>
        <textarea class="input" name="instructiesText" rows="6" placeholder="Snijd de ui fijn.&#10;Bak de kip aan.">${escapeHtml(instructiesText)}</textarea>
      </div>
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
  const ingredienten = Array.from(form.querySelectorAll('.ing-row'))
    .map((row) => ({
      naam: row.querySelector('.naam').value.trim(),
      hoeveelheid: row.querySelector('.aantal').value,
      eenheid: row.querySelector('.eenheid').value.trim()
    }))
    .filter((i) => i.naam)
    .map((i) => ({ naam: i.naam, hoeveelheid: i.hoeveelheid === '' ? null : Number(i.hoeveelheid), eenheid: i.eenheid }));
  const instructiesText = (fd.get('instructiesText') || '').toString();
  const instructies = instructiesText.split('\n').map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);

  const payload = {
    titel,
    basis: fd.get('basis'),
    proteine: fd.get('proteine'),
    keuken: fd.get('keuken'),
    personen: Math.max(1, Number(fd.get('personen')) || 1),
    bereidingstijd: Math.max(0, Number(fd.get('bereidingstijd')) || 0),
    ingredienten,
    instructies,
    bron: (fd.get('bron') || '').toString().trim()
  };
  if (state.modal && state.modal.type === 'edit') payload.id = state.modal.id;

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  try {
    const saved = await db.saveRecipe(payload);
    const exists = state.recipes.some((r) => r.id === saved.id);
    state.recipes = exists ? state.recipes.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...state.recipes];
    state.modal = null;
    rerender();
  } catch (err) {
    errorBox.innerHTML = bannerError((err && err.message) || 'Opslaan mislukt.');
    hydrateIcons();
    submitBtn.disabled = false;
  }
}

// ─────────────────────────────────────────── Modal: Nieuw recept (handmatig / link / foto)
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
      <div class="method-grid">
        <button class="btn btn-outline method-btn" data-action="ai-method" data-method="manual">${icon('pencil')}<span>Handmatig</span><span class="hint">Zelf alles invullen</span></button>
        <button class="btn btn-outline method-btn" data-action="ai-method" data-method="link">${icon('link-2')}<span>Vanaf link</span><span class="hint">AI leest de pagina</span></button>
        <button class="btn btn-outline method-btn" data-action="ai-method" data-method="foto">${icon('camera')}<span>Vanaf foto</span><span class="hint">AI leest de foto</span></button>
      </div>
    `;
  } else if (m.step === 'link') {
    inner = `
      <div class="flex items-center gap-2 mb-1">
        <button class="btn btn-outline btn-icon" data-action="ai-back">${icon('arrow-left')}</button>
        <h2 class="display" style="font-size:20px;margin:0">Recept vanaf link</h2>
      </div>
      <p class="text-sm text-soft mb-3">Plak de link naar een receptpagina. De AI zoekt de pagina op en vult de velden voor je in.</p>
      <input id="ai-link-url" class="input mb-3" placeholder="https://..." ${m.busy ? 'disabled' : ''}>
      ${m.error ? bannerError(m.error) : ''}
      <div class="flex gap-2">
        <button class="btn btn-primary" data-action="analyze-link" ${m.busy ? 'disabled' : ''}>
          ${m.busy ? icon('loader-2', 'spin') : icon('sparkles')} ${m.busy ? 'Recept analyseren...' : 'Analyseer recept'}
        </button>
        <button class="btn btn-outline" data-action="ai-method" data-method="manual" ${m.busy ? 'disabled' : ''}>Toch handmatig invullen</button>
      </div>
    `;
  } else if (m.step === 'foto') {
    inner = `
      <div class="flex items-center gap-2 mb-1">
        <button class="btn btn-outline btn-icon" data-action="ai-back">${icon('arrow-left')}</button>
        <h2 class="display" style="font-size:20px;margin:0">Recept vanaf foto</h2>
      </div>
      <p class="text-sm text-soft mb-3">Maak een foto van een recept (kookboek, tijdschrift, briefje) of upload er een.</p>
      <label class="file-drop">
        ${icon('image-plus')}<span>Klik om een foto te kiezen</span>
        <input id="ai-photo-input" type="file" accept="image/*" class="hidden" ${m.busy ? 'disabled' : ''}>
      </label>
      ${m.photoPreviewUrl ? `<img class="photo-preview" src="${m.photoPreviewUrl}" alt="Voorbeeld van het recept">` : ''}
      ${m.error ? bannerError(m.error) : ''}
      <div class="flex gap-2">
        <button class="btn btn-primary" data-action="analyze-photo" ${m.busy ? 'disabled' : ''}>
          ${m.busy ? icon('loader-2', 'spin') : icon('sparkles')} ${m.busy ? 'Foto analyseren...' : 'Analyseer foto'}
        </button>
        <button class="btn btn-outline" data-action="ai-method" data-method="manual" ${m.busy ? 'disabled' : ''}>Toch handmatig invullen</button>
      </div>
    `;
  } else {
    inner = renderRecipeFormFields(m.step === 'vorm' ? m.draftRecipe : null, {
      heading: m.step === 'vorm' ? 'Controleer het recept' : 'Nieuw recept',
      subheading: m.step === 'vorm' ? 'De AI heeft dit ingevuld — controleer en pas aan waar nodig.' : null,
      submitLabel: 'Recept opslaan'
    });
  }
  return `<div class="modal-backdrop"><div class="modal-card">${inner}</div></div>`;
}

async function handleAnalyzeLink() {
  const input = document.getElementById('ai-link-url');
  const url = input.value.trim();
  if (!url) { state.modal.error = 'Plak eerst een link naar het recept.'; rerender(); return; }
  state.modal.busy = true; state.modal.error = '';
  rerender();
  try {
    const recipe = await ai.extractRecipeFromLink(url);
    state.modal.draftRecipe = recipe;
    state.modal.step = 'vorm';
    state.modal.busy = false;
    rerender();
  } catch (e) {
    state.modal.busy = false;
    state.modal.error = (e && e.message) || 'Kon het recept niet ophalen.';
    rerender();
  }
}

async function handleAnalyzePhoto() {
  if (!state.modal.photoFile) { state.modal.error = 'Kies eerst een foto.'; rerender(); return; }
  state.modal.busy = true; state.modal.error = '';
  rerender();
  try {
    const base64 = await fileToResizedBase64(state.modal.photoFile);
    const recipe = await ai.extractRecipeFromPhoto(base64);
    state.modal.draftRecipe = recipe;
    state.modal.step = 'vorm';
    state.modal.busy = false;
    rerender();
  } catch (e) {
    state.modal.busy = false;
    state.modal.error = (e && e.message) || 'Kon het recept niet herkennen op de foto.';
    rerender();
  }
}

// ─────────────────────────────────────────── Modal: Receptdetail
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
        <h3 class="display mb-2" style="font-size:15px">Ingrediënten</h3>
        <div class="mb-4">
          ${(recipe.ingredienten || []).map((ing) => `
            <div class="flex justify-between text-sm" style="padding:5px 0;border-bottom:1px solid var(--line)">
              <span>${escapeHtml(ing.naam)}</span>
              <span class="mono text-soft">${ing.hoeveelheid != null ? Math.round(ing.hoeveelheid * factor * 100) / 100 : ''} ${escapeHtml(ing.eenheid || '')}</span>
            </div>
          `).join('')}
        </div>
        <h3 class="display mb-2" style="font-size:15px">Bereiding</h3>
        <ol class="text-sm mb-4" style="padding-left:20px">
          ${(recipe.instructies || []).map((s) => `<li style="margin-bottom:6px">${escapeHtml(s)}</li>`).join('')}
        </ol>
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

// ─────────────────────────────────────────── Modal: AI-instellingen
function renderAiSettingsModal() {
  const key = ai.getApiKey();
  const masked = key ? key.slice(0, 8) + '••••••••' + key.slice(-4) : '';
  return `
    <div class="modal-backdrop">
      <div class="modal-card narrow">
        <div class="flex justify-between items-center mb-2">
          <h2 class="display" style="font-size:18px;margin:0">AI-instellingen</h2>
          <button class="btn btn-outline btn-icon" data-action="close-modal">${icon('x')}</button>
        </div>
        <p class="text-sm text-soft mb-3">Nodig voor "recept vanaf link/foto". Je Anthropic API-key wordt alleen lokaal in jouw browser bewaard, nooit in de GitHub-repo.</p>
        ${key ? `<div class="banner banner-info">${icon('sparkles')}<span>Actieve key: <span class="mono">${masked}</span></span></div>` : ''}
        <label class="field-label">Anthropic API-key</label>
        <input id="api-key-input" class="input mb-3" type="password" placeholder="sk-ant-...">
        <div class="flex gap-2 justify-between">
          <button class="btn btn-outline" data-action="clear-api-key">Verwijderen</button>
          <button class="btn btn-primary" data-action="save-api-key">Opslaan</button>
        </div>
        <p class="text-sm text-soft mt-4">Nog geen key? Maak er een op <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">console.anthropic.com</a>.</p>
      </div>
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
  if (state.modal && state.modal.photoPreviewUrl) URL.revokeObjectURL(state.modal.photoPreviewUrl);
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
      state.filters = { basis: '', proteine: '', keuken: '', maxTijd: '', zoek: '' };
      rerender();
      break;

    case 'open-add':
      state.modal = { type: 'add', step: 'kies', busy: false, error: '', photoFile: null, photoPreviewUrl: '', draftRecipe: null };
      rerender();
      break;

    case 'close-modal':
      closeModal();
      break;

    case 'open-view':
      state.modal = { type: 'view', id: el.dataset.id };
      state.viewPersonen = null;
      state.planDay = null;
      rerender();
      break;

    case 'open-edit':
      state.modal = { type: 'edit', id: el.dataset.id };
      rerender();
      break;

    case 'open-pick':
      state.modal = { type: 'pick', day: el.dataset.day };
      state.pickerSortFridge = false;
      rerender();
      break;

    case 'open-ai-settings':
      state.modal = { type: 'ai-settings' };
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

    case 'analyze-link':
      await handleAnalyzeLink();
      break;

    case 'analyze-photo':
      await handleAnalyzePhoto();
      break;

    case 'save-api-key': {
      const input = document.getElementById('api-key-input');
      ai.setApiKey(input.value);
      closeModal();
      break;
    }

    case 'clear-api-key':
      ai.setApiKey('');
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
          DAGEN.forEach((d) => { if (state.weekmenu[d] === recipe.id) state.weekmenu[d] = null; });
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

    case 'plan-from-detail': {
      const day = document.getElementById('plan-day-select').value;
      const recipeId = el.dataset.id;
      await db.setWeekmenuDag(day, recipeId);
      state.weekmenu[day] = recipeId;
      state.modal = null;
      rerender();
      break;
    }

    case 'pick-recipe': {
      const day = state.modal.day;
      const recipeId = el.dataset.id;
      await db.setWeekmenuDag(day, recipeId);
      state.weekmenu[day] = recipeId;
      state.modal = null;
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

    case 'add-ing-row': {
      const container = document.getElementById('ing-rows');
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
      state.filters = { basis: '', proteine: '', keuken: '', maxTijd: '', zoek: '' };
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

    default:
      break;
  }
}

// ─────────────────────────────────────────── Dynamische listeners (na elke render opnieuw aangekoppeld)
function wireDynamicListeners() {
  const fridgeInput = document.getElementById('fridge-input');
  if (fridgeInput) fridgeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddFridgeItem(); } });

  const urlInput = document.getElementById('ai-link-url');
  if (urlInput) urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); handleAnalyzeLink(); } });

  const photoInput = document.getElementById('ai-photo-input');
  if (photoInput) photoInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    state.modal.photoFile = file;
    state.modal.photoPreviewUrl = URL.createObjectURL(file);
    state.modal.error = '';
    rerender();
  });

  const form = document.getElementById('recipe-form');
  if (form) form.addEventListener('submit', handleRecipeFormSubmit);

  if (state.activeTab === 'recepten') wireFilterBar('recepten-filterbar', 'recepten-results', renderReceptenResults);
  if (state.modal && state.modal.type === 'pick') wireFilterBar('pick-filterbar', 'pick-results', renderPickResults);
}

init();
