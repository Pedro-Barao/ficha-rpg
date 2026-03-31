const STORAGE_KEY = 'rpg_sheet_zero_v2';

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function createBlankState() {
  return {
    profile: {
      name: '',
      player: '',
      className: '',
      origin: '',
      level: 0,
      notes: '',
      image: ''
    },
    tracks: {
      hp: { id: 'hp', label: 'Vida', current: 0, max: 0, kind: 'hp' },
      en: { id: 'en', label: 'Energia', current: 0, max: 0, kind: 'en' },
      xp: { id: 'xp', label: 'Experiência', current: 0, max: 0, kind: 'xp' }
    },
    attributes: [
      { id: uid('attr'), label: 'FORÇA', current: 0, base: 0, note: '' },
      { id: uid('attr'), label: 'DESTREZA', current: 0, base: 0, note: '' },
      { id: uid('attr'), label: 'CONSTITUIÇÃO', current: 0, base: 0, note: '' },
      { id: uid('attr'), label: 'INTELIGÊNCIA', current: 0, base: 0, note: '' }
    ],
    resources: [],
    items: [],
    abilities: [],
    ui: {
      selectedAttributeId: null,
      mainResult: 'Aguardando rolagem.',
      itemResults: {},
      abilityResults: {}
    }
  };
}

function normalizeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clampCurrent(current, max) {
  const safeMax = Math.max(0, normalizeNumber(max));
  const safeCurrent = Math.max(0, normalizeNumber(current));
  return Math.min(safeCurrent, safeMax);
}

function normalizeState(raw) {
  const blank = createBlankState();
  if (!raw || typeof raw !== 'object') return blank;

  const state = {
    profile: {
      ...blank.profile,
      ...(raw.profile || {})
    },
    tracks: {
      hp: { ...blank.tracks.hp, ...(raw.tracks?.hp || {}) },
      en: { ...blank.tracks.en, ...(raw.tracks?.en || {}) },
      xp: { ...blank.tracks.xp, ...(raw.tracks?.xp || {}) }
    },
    attributes: Array.isArray(raw.attributes) && raw.attributes.length
      ? raw.attributes.map(attr => ({
          id: attr.id || uid('attr'),
          label: attr.label || 'ATRIBUTO',
          current: normalizeNumber(attr.current),
          base: normalizeNumber(attr.base),
          note: attr.note || ''
        }))
      : blank.attributes,
    resources: Array.isArray(raw.resources)
      ? raw.resources.map(resource => ({
          id: resource.id || uid('res'),
          name: resource.name || '',
          current: normalizeNumber(resource.current),
          max: normalizeNumber(resource.max),
          note: resource.note || ''
        }))
      : [],
    items: Array.isArray(raw.items)
      ? raw.items.map(item => ({
          id: item.id || uid('item'),
          name: item.name || '',
          type: item.type || '',
          damageFormula: item.damageFormula || '',
          activation: item.activation || '',
          notes: item.notes || ''
        }))
      : [],
    abilities: Array.isArray(raw.abilities)
      ? raw.abilities.map(ability => ({
          id: ability.id || uid('ability'),
          name: ability.name || '',
          description: ability.description || '',
          testCurrent: normalizeNumber(ability.testCurrent),
          testBase: normalizeNumber(ability.testBase),
          damageFormula: ability.damageFormula || '',
          notes: ability.notes || '',
          effects: Array.isArray(ability.effects)
            ? ability.effects.map(effect => ({
                id: effect.id || uid('effect'),
                target: effect.target || 'track:hp:current',
                amount: normalizeNumber(effect.amount),
                note: effect.note || ''
              }))
            : []
        }))
      : [],
    ui: {
      selectedAttributeId: raw.ui?.selectedAttributeId || null,
      mainResult: raw.ui?.mainResult || blank.ui.mainResult,
      itemResults: raw.ui?.itemResults || {},
      abilityResults: raw.ui?.abilityResults || {}
    }
  };

  Object.values(state.tracks).forEach(track => {
    track.max = Math.max(0, normalizeNumber(track.max));
    track.current = clampCurrent(track.current, track.max);
  });

  state.resources.forEach(resource => {
    resource.max = Math.max(0, normalizeNumber(resource.max));
    resource.current = clampCurrent(resource.current, resource.max);
  });

  if (!state.attributes.some(attr => attr.id === state.ui.selectedAttributeId)) {
    state.ui.selectedAttributeId = state.attributes[0]?.id || null;
  }

  return state;
}

let state = loadState();

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return createBlankState();
    return normalizeState(JSON.parse(saved));
  } catch (error) {
    console.error('Falha ao carregar estado salvo:', error);
    return createBlankState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Falha ao salvar estado:', error);
  }
}

function setMainResult(message) {
  state.ui.mainResult = message;
  const box = document.getElementById('main-roll-result');
  if (box) box.innerHTML = message;
  saveState();
}

function setAbilityResult(abilityId, message) {
  state.ui.abilityResults[abilityId] = message;
  const box = document.querySelector(`.ability-result[data-id="${abilityId}"]`);
  if (box) box.innerHTML = message;
  saveState();
}

function setItemResult(itemId, message) {
  state.ui.itemResults[itemId] = message;
  const box = document.querySelector(`.item-result[data-id="${itemId}"]`);
  if (box) box.innerHTML = message;
  saveState();
}

function getDiceCount(current) {
  const value = Math.floor(normalizeNumber(current));
  return Math.max(0, value);
}

function formatRule(current, base) {
  const dice = getDiceCount(current);
  return `${normalizeNumber(current)}/${normalizeNumber(base)} = ${dice}d20`;
}

function rollDicePool(quantity, sides = 20) {
  return Array.from({ length: quantity }, () => Math.floor(Math.random() * sides) + 1);
}

function emphasizeRoll(value, highest) {
  if (value === 20) return `<span class="crit">${value}</span>`;
  if (value === 1) return `<span class="fumble">${value}</span>`;
  if (value === highest) return `<strong>${value}</strong>`;
  return `${value}`;
}

function renderAvatar() {
  const img = document.getElementById('avatar-preview');
  const placeholder = document.getElementById('avatar-placeholder');
  if (state.profile.image) {
    img.src = state.profile.image;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    img.removeAttribute('src');
    img.style.display = 'none';
    placeholder.style.display = 'block';
  }
}

function renderProfile() {
  document.getElementById('profile-name').value = state.profile.name;
  document.getElementById('profile-player').value = state.profile.player;
  document.getElementById('profile-className').value = state.profile.className;
  document.getElementById('profile-origin').value = state.profile.origin;
  document.getElementById('profile-level').value = state.profile.level;
  document.getElementById('profile-notes').value = state.profile.notes;
  renderAvatar();
}

function renderTracks() {
  const container = document.getElementById('tracks-container');
  container.innerHTML = Object.values(state.tracks).map(track => {
    const percent = track.max > 0 ? Math.min(100, (track.current / track.max) * 100) : 0;
    return `
      <div class="track-card" data-id="${track.id}">
        <div class="label-line">
          <input type="text" value="${escapeHtml(track.label)}" data-entity="track" data-id="${track.id}" data-field="label" placeholder="Nome da barra">
          <div class="split-values">
            <input type="number" min="0" value="${track.current}" data-entity="track" data-id="${track.id}" data-field="current">
            <span>/</span>
            <input type="number" min="0" value="${track.max}" data-entity="track" data-id="${track.id}" data-field="max">
          </div>
        </div>
        <div class="bar-shell ${track.kind}">
          <div class="bar-fill" style="width:${percent}%"></div>
        </div>
        <div class="quick-row">
          ${[-5, -1, 1, 5].map(amount => `<button data-action="track-adjust" data-id="${track.id}" data-amount="${amount}">${amount > 0 ? '+' : ''}${amount}</button>`).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function renderAttributes() {
  const container = document.getElementById('attributes-container');
  if (!state.attributes.length) {
    container.innerHTML = `<div class="empty-state">Nenhum atributo criado. Clique em <strong>Adicionar atributo</strong>.</div>`;
    document.getElementById('selected-attribute-name').textContent = 'Nenhum';
    document.getElementById('main-roll-current').value = 0;
    document.getElementById('main-roll-base').value = 0;
    refreshMainRule();
    return;
  }

  container.innerHTML = state.attributes.map(attribute => {
    const isActive = attribute.id === state.ui.selectedAttributeId;
    return `
      <article class="attribute-card ${isActive ? 'active' : ''}" data-id="${attribute.id}">
        <div class="card-top">
          <button data-action="select-attribute" data-id="${attribute.id}" class="link-cover">Selecionar</button>
          <input type="text" class="title-input" value="${escapeHtml(attribute.label)}" data-entity="attribute" data-id="${attribute.id}" data-field="label" placeholder="Nome do atributo">
          <button data-action="remove-attribute" data-id="${attribute.id}" class="icon-btn danger">×</button>
        </div>
        <div class="fraction-row">
          <input type="number" min="0" value="${attribute.current}" data-entity="attribute" data-id="${attribute.id}" data-field="current">
          <span>/</span>
          <input type="number" min="0" value="${attribute.base}" data-entity="attribute" data-id="${attribute.id}" data-field="base">
        </div>
        <div class="attribute-rule">${formatRule(attribute.current, attribute.base)}</div>
        <input type="text" value="${escapeHtml(attribute.note)}" data-entity="attribute" data-id="${attribute.id}" data-field="note" placeholder="Anotação opcional do atributo">
      </article>
    `;
  }).join('');

  const active = state.attributes.find(attr => attr.id === state.ui.selectedAttributeId) || state.attributes[0];
  if (active) selectAttribute(active.id, false);
}

function renderResources() {
  const container = document.getElementById('resources-container');
  if (!state.resources.length) {
    container.innerHTML = `<div class="empty-state">Nenhum recurso criado ainda. Adicione contadores como <strong>Energético</strong>, munição, cargas, foco ou sanidade.</div>`;
    return;
  }

  container.innerHTML = state.resources.map(resource => {
    const percent = resource.max > 0 ? Math.min(100, (resource.current / resource.max) * 100) : 0;
    return `
      <article class="mini-card" data-id="${resource.id}">
        <div class="card-tools">
          <button data-action="remove-resource" data-id="${resource.id}" class="icon-btn danger">×</button>
        </div>
        <label>
          <span>Nome do recurso</span>
          <input type="text" value="${escapeHtml(resource.name)}" data-entity="resource" data-id="${resource.id}" data-field="name" placeholder="Ex.: Energético">
        </label>
        <div class="split-editors">
          <label>
            <span>Atual</span>
            <input type="number" min="0" value="${resource.current}" data-entity="resource" data-id="${resource.id}" data-field="current">
          </label>
          <label>
            <span>Máximo</span>
            <input type="number" min="0" value="${resource.max}" data-entity="resource" data-id="${resource.id}" data-field="max">
          </label>
        </div>
        <div class="resource-bar"><div class="bar-fill" style="width:${percent}%"></div></div>
        <label>
          <span>Observação</span>
          <input type="text" value="${escapeHtml(resource.note)}" data-entity="resource" data-id="${resource.id}" data-field="note" placeholder="Ex.: usado para ativar Energizado">
        </label>
        <div class="quick-row">
          ${[-5, -1, 1, 5].map(amount => `<button data-action="resource-adjust" data-id="${resource.id}" data-amount="${amount}">${amount > 0 ? '+' : ''}${amount}</button>`).join('')}
        </div>
      </article>
    `;
  }).join('');
}

function renderItems() {
  const container = document.getElementById('items-container');
  if (!state.items.length) {
    container.innerHTML = `<div class="empty-state">Nenhum item cadastrado. Adicione armas, ataques, equipamentos ou qualquer ação com dano.</div>`;
    return;
  }

  container.innerHTML = state.items.map(item => `
    <article class="mini-card item-card" data-id="${item.id}">
      <div class="card-tools">
        <button data-action="remove-item" data-id="${item.id}" class="icon-btn danger">×</button>
      </div>
      <div class="split-editors two-col">
        <label>
          <span>Nome do item</span>
          <input type="text" value="${escapeHtml(item.name)}" data-entity="item" data-id="${item.id}" data-field="name" placeholder="Ex.: Manopla, pistola, ritual">
        </label>
        <label>
          <span>Tipo / Tag</span>
          <input type="text" value="${escapeHtml(item.type)}" data-entity="item" data-id="${item.id}" data-field="type" placeholder="Ex.: Impacto / Pesado">
        </label>
      </div>
      <div class="split-editors two-col">
        <label>
          <span>Fórmula de dano</span>
          <input type="text" value="${escapeHtml(item.damageFormula)}" data-entity="item" data-id="${item.id}" data-field="damageFormula" placeholder="Ex.: 2d6+3">
        </label>
        <label>
          <span>Custo / ativação</span>
          <input type="text" value="${escapeHtml(item.activation)}" data-entity="item" data-id="${item.id}" data-field="activation" placeholder="Ex.: 3 EN ou 1 munição">
        </label>
      </div>
      <label>
        <span>Notas</span>
        <textarea rows="3" data-entity="item" data-id="${item.id}" data-field="notes" placeholder="Descrição livre, alcance, condição ou efeito.">${escapeHtml(item.notes)}</textarea>
      </label>
      <div class="action-row">
        <button data-action="roll-item-damage" data-id="${item.id}" class="primary">Rolar dano</button>
      </div>
      <div class="result-box item-result" data-id="${item.id}">${state.ui.itemResults[item.id] || 'Aguardando rolagem de dano.'}</div>
    </article>
  `).join('');
}

function getEffectTargetOptions(selectedValue = '') {
  const baseTargets = [
    { value: 'track:hp:current', label: `${state.tracks.hp.label} atual` },
    { value: 'track:hp:max', label: `${state.tracks.hp.label} máxima` },
    { value: 'track:en:current', label: `${state.tracks.en.label} atual` },
    { value: 'track:en:max', label: `${state.tracks.en.label} máxima` },
    { value: 'track:xp:current', label: `${state.tracks.xp.label} atual` },
    { value: 'track:xp:max', label: `${state.tracks.xp.label} máxima` }
  ];

  const resourceTargets = state.resources.flatMap(resource => [
    { value: `resource:${resource.id}:current`, label: `${resource.name || 'Recurso sem nome'} atual` },
    { value: `resource:${resource.id}:max`, label: `${resource.name || 'Recurso sem nome'} máximo` }
  ]);

  const allTargets = [...baseTargets, ...resourceTargets];
  return allTargets.map(option => `<option value="${option.value}" ${option.value === selectedValue ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('');
}

function renderAbilities() {
  const container = document.getElementById('abilities-container');
  if (!state.abilities.length) {
    container.innerHTML = `<div class="empty-state">Nenhuma habilidade cadastrada. Clique em <strong>Adicionar habilidade</strong> e monte seus poderes do jeito que quiser.</div>`;
    return;
  }

  container.innerHTML = state.abilities.map(ability => `
    <article class="ability-card" data-id="${ability.id}">
      <div class="card-tools">
        <button data-action="remove-ability" data-id="${ability.id}" class="icon-btn danger">×</button>
      </div>
      <div class="split-editors two-col">
        <label>
          <span>Nome da habilidade</span>
          <input type="text" value="${escapeHtml(ability.name)}" data-entity="ability" data-id="${ability.id}" data-field="name" placeholder="Ex.: Energizado">
        </label>
        <label>
          <span>Fórmula de dano</span>
          <input type="text" value="${escapeHtml(ability.damageFormula)}" data-entity="ability" data-id="${ability.id}" data-field="damageFormula" placeholder="Ex.: 1d8+4">
        </label>
      </div>
      <label>
        <span>Descrição</span>
        <textarea rows="3" data-entity="ability" data-id="${ability.id}" data-field="description" placeholder="Explique o que a habilidade faz.">${escapeHtml(ability.description)}</textarea>
      </label>
      <div class="split-editors three-col">
        <label>
          <span>Teste atual</span>
          <input type="number" min="0" value="${ability.testCurrent}" data-entity="ability" data-id="${ability.id}" data-field="testCurrent">
        </label>
        <label>
          <span>Teste base</span>
          <input type="number" min="0" value="${ability.testBase}" data-entity="ability" data-id="${ability.id}" data-field="testBase">
        </label>
        <div class="rule-box small">
          <span>Regra</span>
          <strong>${formatRule(ability.testCurrent, ability.testBase)}</strong>
        </div>
      </div>
      <label>
        <span>Notas / consequências narrativas</span>
        <input type="text" value="${escapeHtml(ability.notes)}" data-entity="ability" data-id="${ability.id}" data-field="notes" placeholder="Ex.: fica exausto por 1 rodada, concede vantagem ao aliado.">
      </label>
      <div class="effects-block">
        <div class="effects-head">
          <strong>Efeitos automáticos</strong>
          <button data-action="add-effect" data-id="${ability.id}" class="ghost">+ Adicionar efeito</button>
        </div>
        ${ability.effects.length ? ability.effects.map(effect => `
          <div class="effect-row" data-ability-id="${ability.id}" data-effect-id="${effect.id}">
            <select data-entity="effect" data-id="${ability.id}" data-effect-id="${effect.id}" data-field="target">
              ${getEffectTargetOptions(effect.target)}
            </select>
            <input type="number" step="1" value="${effect.amount}" data-entity="effect" data-id="${ability.id}" data-effect-id="${effect.id}" data-field="amount" placeholder="Quantidade">
            <input type="text" value="${escapeHtml(effect.note)}" data-entity="effect" data-id="${ability.id}" data-effect-id="${effect.id}" data-field="note" placeholder="Obs. opcional do efeito">
            <button data-action="remove-effect" data-id="${ability.id}" data-effect-id="${effect.id}" class="icon-btn danger">×</button>
          </div>
        `).join('') : `<div class="empty-inline">Sem efeitos automáticos. Você ainda pode usar teste e dano normalmente.</div>`}
      </div>
      <div class="action-row wrap">
        <button data-action="use-ability" data-id="${ability.id}" class="primary">Usar habilidade</button>
        <button data-action="roll-ability-test" data-id="${ability.id}">Rolar teste</button>
        <button data-action="roll-ability-damage" data-id="${ability.id}">Rolar dano</button>
      </div>
      <div class="result-box ability-result" data-id="${ability.id}">${state.ui.abilityResults[ability.id] || 'Aguardando uso, teste ou dano.'}</div>
    </article>
  `).join('');
}

function renderAll() {
  renderProfile();
  renderTracks();
  renderAttributes();
  renderResources();
  renderItems();
  renderAbilities();
  refreshMainRule();
  setMainResult(state.ui.mainResult || 'Aguardando rolagem.');
}

function selectAttribute(attributeId, persist = true) {
  const attribute = state.attributes.find(item => item.id === attributeId);
  if (!attribute) return;
  state.ui.selectedAttributeId = attribute.id;
  document.getElementById('selected-attribute-name').textContent = attribute.label || 'Atributo';
  document.getElementById('main-roll-current').value = attribute.current;
  document.getElementById('main-roll-base').value = attribute.base;
  document.querySelectorAll('.attribute-card').forEach(card => {
    card.classList.toggle('active', card.dataset.id === attribute.id);
  });
  refreshMainRule();
  if (persist) saveState();
}

function refreshMainRule() {
  const current = normalizeNumber(document.getElementById('main-roll-current').value);
  const base = normalizeNumber(document.getElementById('main-roll-base').value);
  document.getElementById('main-roll-rule').textContent = formatRule(current, base);
}

function rollMainTest() {
  const current = normalizeNumber(document.getElementById('main-roll-current').value);
  const base = normalizeNumber(document.getElementById('main-roll-base').value);
  const diceCount = getDiceCount(current);

  if (diceCount <= 0) {
    setMainResult('Defina um valor maior que zero para realizar o teste.');
    return;
  }

  const rolls = rollDicePool(diceCount, 20);
  const highest = Math.max(...rolls);
  const shownRolls = rolls.map(value => emphasizeRoll(value, highest)).join(', ');
  setMainResult(`Teste ${current}/${base} = ${diceCount}d20 → [${shownRolls}] → maior resultado: <strong>${highest}</strong>`);
}

function parseDamageFormula(formula) {
  const text = String(formula || '').replace(/\s+/g, '').toLowerCase();
  if (!text) return null;
  if (/^\d+$/.test(text)) {
    return { type: 'flat', amount: parseInt(text, 10), text };
  }

  const match = text.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!match) return null;
  return {
    type: 'dice',
    quantity: parseInt(match[1] || '1', 10),
    sides: parseInt(match[2], 10),
    modifier: parseInt(match[3] || '0', 10),
    text
  };
}

function resolveDamage(formula) {
  const parsed = parseDamageFormula(formula);
  if (!parsed) return null;

  if (parsed.type === 'flat') {
    return { text: `Dano fixo: <strong>${parsed.amount}</strong>` };
  }

  const rolls = rollDicePool(parsed.quantity, parsed.sides);
  const sum = rolls.reduce((acc, value) => acc + value, 0);
  const total = sum + parsed.modifier;
  const modifierText = parsed.modifier > 0 ? ` + ${parsed.modifier}` : parsed.modifier < 0 ? ` - ${Math.abs(parsed.modifier)}` : '';
  return { text: `Dano ${parsed.text}: [${rolls.join(', ')}]${modifierText} = <strong>${total}</strong>` };
}

function adjustTrack(trackId, delta) {
  const track = state.tracks[trackId];
  if (!track) return;
  track.current = clampCurrent(track.current + delta, track.max);
  renderTracks();
  saveState();
}

function adjustResource(resourceId, delta) {
  const resource = state.resources.find(item => item.id === resourceId);
  if (!resource) return;
  resource.current = clampCurrent(resource.current + delta, resource.max);
  renderResources();
  renderAbilities();
  saveState();
}

function addAttribute() {
  state.attributes.push({ id: uid('attr'), label: 'NOVO ATRIBUTO', current: 0, base: 0, note: '' });
  state.ui.selectedAttributeId = state.attributes[state.attributes.length - 1].id;
  renderAttributes();
  saveState();
}

function addResource() {
  state.resources.push({ id: uid('res'), name: '', current: 0, max: 0, note: '' });
  renderResources();
  renderAbilities();
  saveState();
}

function addItem() {
  state.items.push({ id: uid('item'), name: '', type: '', damageFormula: '', activation: '', notes: '' });
  renderItems();
  saveState();
}

function addAbility() {
  state.abilities.push({
    id: uid('ability'),
    name: '',
    description: '',
    testCurrent: 0,
    testBase: 0,
    damageFormula: '',
    notes: '',
    effects: []
  });
  renderAbilities();
  saveState();
}

function addEffect(abilityId) {
  const ability = state.abilities.find(item => item.id === abilityId);
  if (!ability) return;
  ability.effects.push({ id: uid('effect'), target: 'track:hp:current', amount: 0, note: '' });
  renderAbilities();
  saveState();
}

function removeFromCollection(collectionName, id) {
  if (collectionName === 'attribute') {
    state.attributes = state.attributes.filter(item => item.id !== id);
    if (state.ui.selectedAttributeId === id) {
      state.ui.selectedAttributeId = state.attributes[0]?.id || null;
    }
    renderAttributes();
  }
  if (collectionName === 'resource') {
    state.resources = state.resources.filter(item => item.id !== id);
    state.abilities.forEach(ability => {
      ability.effects = ability.effects.filter(effect => !effect.target.startsWith(`resource:${id}:`));
    });
    renderResources();
    renderAbilities();
  }
  if (collectionName === 'item') {
    state.items = state.items.filter(item => item.id !== id);
    delete state.ui.itemResults[id];
    renderItems();
  }
  if (collectionName === 'ability') {
    state.abilities = state.abilities.filter(item => item.id !== id);
    delete state.ui.abilityResults[id];
    renderAbilities();
  }
  saveState();
}

function removeEffect(abilityId, effectId) {
  const ability = state.abilities.find(item => item.id === abilityId);
  if (!ability) return;
  ability.effects = ability.effects.filter(effect => effect.id !== effectId);
  renderAbilities();
  saveState();
}

function parseTarget(target) {
  const [type, id, field] = String(target || '').split(':');
  return { type, id, field };
}

function getTargetLabel(target) {
  const parsed = parseTarget(target);
  if (parsed.type === 'track') {
    const track = state.tracks[parsed.id];
    if (!track) return 'Alvo ausente';
    return `${track.label} ${parsed.field === 'max' ? 'máxima' : 'atual'}`;
  }
  if (parsed.type === 'resource') {
    const resource = state.resources.find(item => item.id === parsed.id);
    if (!resource) return 'Recurso ausente';
    return `${resource.name || 'Recurso sem nome'} ${parsed.field === 'max' ? 'máximo' : 'atual'}`;
  }
  return 'Alvo';
}

function applyEffect(target, amount) {
  const parsed = parseTarget(target);
  const numericAmount = normalizeNumber(amount);

  if (parsed.type === 'track') {
    const track = state.tracks[parsed.id];
    if (!track) return null;
    if (parsed.field === 'max') {
      const before = track.max;
      track.max = Math.max(0, track.max + numericAmount);
      track.current = clampCurrent(track.current, track.max);
      const applied = track.max - before;
      return buildEffectMessage(track.label, 'máx.', numericAmount, applied, before, track.max);
    }
    const before = track.current;
    track.current = clampCurrent(track.current + numericAmount, track.max);
    const applied = track.current - before;
    return buildEffectMessage(track.label, 'atual', numericAmount, applied, before, track.current);
  }

  if (parsed.type === 'resource') {
    const resource = state.resources.find(item => item.id === parsed.id);
    if (!resource) return `• ${getTargetLabel(target)} não existe mais.`;
    if (parsed.field === 'max') {
      const before = resource.max;
      resource.max = Math.max(0, resource.max + numericAmount);
      resource.current = clampCurrent(resource.current, resource.max);
      const applied = resource.max - before;
      return buildEffectMessage(resource.name || 'Recurso', 'máx.', numericAmount, applied, before, resource.max);
    }
    const before = resource.current;
    resource.current = clampCurrent(resource.current + numericAmount, resource.max);
    const applied = resource.current - before;
    return buildEffectMessage(resource.name || 'Recurso', 'atual', numericAmount, applied, before, resource.current);
  }

  return null;
}

function buildEffectMessage(label, kind, requested, applied, before, after) {
  const requestedText = requested > 0 ? `+${requested}` : `${requested}`;
  const appliedText = applied > 0 ? `+${applied}` : `${applied}`;
  const saturated = requested !== applied;
  const extra = saturated ? ` (aplicado ${appliedText}, limitado pelos valores da ficha)` : '';
  return `• ${label} ${kind}: ${requestedText}${extra} → ${before} → ${after}`;
}

function useAbility(abilityId) {
  const ability = state.abilities.find(item => item.id === abilityId);
  if (!ability) return;

  const lines = [];
  if (ability.name) lines.push(`<strong>${escapeHtml(ability.name)}</strong>`);
  if (!ability.effects.length && !ability.notes.trim()) {
    lines.push('Nenhum efeito automático configurado.');
    setAbilityResult(ability.id, lines.join('<br>'));
    return;
  }

  ability.effects.forEach(effect => {
    const message = applyEffect(effect.target, effect.amount);
    if (message) lines.push(message);
    if (effect.note.trim()) lines.push(`• Obs.: ${escapeHtml(effect.note)}`);
  });

  if (ability.notes.trim()) {
    lines.push(`• Consequência narrativa: ${escapeHtml(ability.notes)}`);
  }

  renderTracks();
  renderResources();
  renderAbilities();
  setAbilityResult(ability.id, lines.join('<br>'));
}

function rollAbilityTest(abilityId) {
  const ability = state.abilities.find(item => item.id === abilityId);
  if (!ability) return;
  const diceCount = getDiceCount(ability.testCurrent);
  if (diceCount <= 0) {
    setAbilityResult(ability.id, 'Defina um valor maior que zero no teste da habilidade.');
    return;
  }

  const rolls = rollDicePool(diceCount, 20);
  const highest = Math.max(...rolls);
  const shown = rolls.map(value => emphasizeRoll(value, highest)).join(', ');
  setAbilityResult(ability.id, `Teste ${ability.testCurrent}/${ability.testBase} = ${diceCount}d20 → [${shown}] → maior resultado: <strong>${highest}</strong>`);
}

function rollAbilityDamage(abilityId) {
  const ability = state.abilities.find(item => item.id === abilityId);
  if (!ability) return;
  const result = resolveDamage(ability.damageFormula);
  if (!result) {
    setAbilityResult(ability.id, 'Fórmula inválida. Use formatos como <strong>1d6+3</strong>, <strong>2d8</strong> ou <strong>4</strong>.');
    return;
  }
  setAbilityResult(ability.id, result.text);
}

function rollItemDamage(itemId) {
  const item = state.items.find(entry => entry.id === itemId);
  if (!item) return;
  const result = resolveDamage(item.damageFormula);
  if (!result) {
    setItemResult(item.id, 'Fórmula inválida. Use formatos como <strong>1d6+3</strong>, <strong>2d8</strong> ou <strong>4</strong>.');
    return;
  }
  setItemResult(item.id, result.text);
}

function exportState() {
  const characterName = (state.profile.name || 'ficha-rpg').trim().replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${characterName || 'ficha-rpg'}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importStateFromFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = event => {
    try {
      const imported = JSON.parse(String(event.target?.result || '{}'));
      state = normalizeState(imported);
      renderAll();
      saveState();
      setMainResult('Ficha importada com sucesso.');
    } catch (error) {
      console.error(error);
      alert('Não foi possível importar esse arquivo JSON.');
    }
  };
  reader.readAsText(file, 'utf-8');
}

function resetSheet() {
  const confirmed = window.confirm('Isso vai apagar a ficha atual e criar uma ficha nova, zerada. Deseja continuar?');
  if (!confirmed) return;
  state = createBlankState();
  renderAll();
  saveState();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setupStaticListeners() {
  document.getElementById('main-roll-current').addEventListener('input', refreshMainRule);
  document.getElementById('main-roll-base').addEventListener('input', refreshMainRule);

  document.getElementById('profile-name').addEventListener('input', event => {
    state.profile.name = event.target.value;
    saveState();
  });
  document.getElementById('profile-player').addEventListener('input', event => {
    state.profile.player = event.target.value;
    saveState();
  });
  document.getElementById('profile-className').addEventListener('input', event => {
    state.profile.className = event.target.value;
    saveState();
  });
  document.getElementById('profile-origin').addEventListener('input', event => {
    state.profile.origin = event.target.value;
    saveState();
  });
  document.getElementById('profile-level').addEventListener('input', event => {
    state.profile.level = Math.max(0, normalizeNumber(event.target.value));
    saveState();
  });
  document.getElementById('profile-notes').addEventListener('input', event => {
    state.profile.notes = event.target.value;
    saveState();
  });

  document.getElementById('avatar-input').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = loadEvent => {
      state.profile.image = String(loadEvent.target?.result || '');
      renderAvatar();
      saveState();
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('import-json-input').addEventListener('change', event => {
    const file = event.target.files?.[0];
    importStateFromFile(file);
    event.target.value = '';
  });

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const { action, id, amount, effectId } = target.dataset;

    if (action === 'roll-main-test') return rollMainTest();
    if (action === 'add-attribute') return addAttribute();
    if (action === 'add-resource') return addResource();
    if (action === 'add-item') return addItem();
    if (action === 'add-ability') return addAbility();
    if (action === 'select-attribute') return selectAttribute(id);
    if (action === 'track-adjust') return adjustTrack(id, normalizeNumber(amount));
    if (action === 'resource-adjust') return adjustResource(id, normalizeNumber(amount));
    if (action === 'remove-attribute') return removeFromCollection('attribute', id);
    if (action === 'remove-resource') return removeFromCollection('resource', id);
    if (action === 'remove-item') return removeFromCollection('item', id);
    if (action === 'remove-ability') return removeFromCollection('ability', id);
    if (action === 'roll-item-damage') return rollItemDamage(id);
    if (action === 'add-effect') return addEffect(id);
    if (action === 'remove-effect') return removeEffect(id, effectId);
    if (action === 'use-ability') return useAbility(id);
    if (action === 'roll-ability-test') return rollAbilityTest(id);
    if (action === 'roll-ability-damage') return rollAbilityDamage(id);
    if (action === 'export-json') return exportState();
    if (action === 'import-json') return document.getElementById('import-json-input').click();
    if (action === 'new-sheet') return resetSheet();
    if (action === 'clear-avatar') {
      state.profile.image = '';
      document.getElementById('avatar-input').value = '';
      renderAvatar();
      saveState();
    }
  });

  document.addEventListener('input', event => {
    const target = event.target;
    const entity = target.dataset.entity;
    if (!entity) return;

    const id = target.dataset.id;
    const field = target.dataset.field;

    if (entity === 'track') {
      const track = state.tracks[id];
      if (!track) return;
      track[field] = field === 'label' ? target.value : Math.max(0, normalizeNumber(target.value));
      if (field === 'max') track.current = clampCurrent(track.current, track.max);
      if (field === 'current') track.current = clampCurrent(track.current, track.max);

      const card = target.closest('.track-card');
      if (card) {
        const bar = card.querySelector('.bar-fill');
        if (bar) {
          const percent = track.max > 0 ? Math.min(100, (track.current / track.max) * 100) : 0;
          bar.style.width = `${percent}%`;
        }
        if (field === 'current' || field === 'max') {
          const currentInput = card.querySelector('[data-field="current"]');
          const maxInput = card.querySelector('[data-field="max"]');
          if (currentInput) currentInput.value = track.current;
          if (maxInput) maxInput.value = track.max;
        }
      }

      if (field === 'label') renderAbilities();
      saveState();
      return;
    }

    if (entity === 'attribute') {
      const attribute = state.attributes.find(item => item.id === id);
      if (!attribute) return;
      attribute[field] = field === 'label' || field === 'note' ? target.value : Math.max(0, normalizeNumber(target.value));
      const card = target.closest('.attribute-card');
      if (card) {
        const ruleNode = card.querySelector('.attribute-rule');
        if (ruleNode) ruleNode.textContent = formatRule(attribute.current, attribute.base);
      }
      if (attribute.id === state.ui.selectedAttributeId) {
        document.getElementById('selected-attribute-name').textContent = attribute.label || 'Atributo';
        document.getElementById('main-roll-current').value = attribute.current;
        document.getElementById('main-roll-base').value = attribute.base;
        refreshMainRule();
      }
      saveState();
      return;
    }

    if (entity === 'resource') {
      const resource = state.resources.find(item => item.id === id);
      if (!resource) return;
      resource[field] = field === 'name' || field === 'note' ? target.value : Math.max(0, normalizeNumber(target.value));
      if (field === 'max') resource.current = clampCurrent(resource.current, resource.max);
      if (field === 'current') resource.current = clampCurrent(resource.current, resource.max);
      if (field === 'name') renderAbilities();
      saveState();
      const card = target.closest('.mini-card');
      if (card) {
        const bar = card.querySelector('.resource-bar .bar-fill');
        if (bar) {
          const percent = resource.max > 0 ? Math.min(100, (resource.current / resource.max) * 100) : 0;
          bar.style.width = `${percent}%`;
        }
      }
      return;
    }

    if (entity === 'item') {
      const item = state.items.find(entry => entry.id === id);
      if (!item) return;
      item[field] = target.value;
      saveState();
      return;
    }

    if (entity === 'ability') {
      const ability = state.abilities.find(entry => entry.id === id);
      if (!ability) return;
      ability[field] = ['name', 'description', 'damageFormula', 'notes'].includes(field)
        ? target.value
        : Math.max(0, normalizeNumber(target.value));
      if (field === 'testCurrent' || field === 'testBase') {
        const card = target.closest('.ability-card');
        const ruleNode = card?.querySelector('.rule-box.small strong');
        if (ruleNode) ruleNode.textContent = formatRule(ability.testCurrent, ability.testBase);
      }
      saveState();
      return;
    }

    if (entity === 'effect') {
      const ability = state.abilities.find(entry => entry.id === id);
      if (!ability) return;
      const effect = ability.effects.find(entry => entry.id === target.dataset.effectId);
      if (!effect) return;
      effect[field] = field === 'amount' ? normalizeNumber(target.value) : target.value;
      saveState();
    }
  });
}


function syncTopbarOffset() {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  const offset = Math.ceil(topbar.getBoundingClientRect().height + 24);
  document.documentElement.style.setProperty('--topbar-offset', `${offset}px`);
}

document.addEventListener('DOMContentLoaded', () => {
  renderAll();
  setupStaticListeners();
  syncTopbarOffset();
  window.addEventListener('resize', syncTopbarOffset);
  window.addEventListener('orientationchange', syncTopbarOffset);
  setTimeout(syncTopbarOffset, 0);
  setTimeout(syncTopbarOffset, 300);
});
