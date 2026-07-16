(function () {
  'use strict';

  const API_VERSION = 2;
  const instances = new Map();
  let instanceSeed = 0;

  function resolveVue() {
    const roots = [globalThis];
    try {
      if (window.parent && window.parent !== window) roots.push(window.parent);
    } catch (error) {}
    try {
      if (window.top && window.top !== window && !roots.includes(window.top)) roots.push(window.top);
    } catch (error) {}
    return roots.find(root => root?.Vue?.createApp)?.Vue || null;
  }

  function cloneValue(value) {
    if (value === undefined) return undefined;
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(value);
      } catch (error) {}
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (error) {
      return value;
    }
  }

  function text(value, fallback = '') {
    const result = value === undefined || value === null ? '' : String(value).trim();
    return result || fallback;
  }

  function pathKey(path) {
    return (Array.isArray(path) ? path : []).map(segment => String(segment)).join('.');
  }

  function readPath(root, path) {
    return (Array.isArray(path) ? path : []).reduce(
      (value, segment) => (value && typeof value === 'object' ? value[segment] : undefined),
      root,
    );
  }

  function writePath(root, path, value) {
    const parts = Array.isArray(path) ? path : [];
    if (!parts.length) return;
    let cursor = root;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const part = parts[index];
      const next = parts[index + 1];
      if (!cursor[part] || typeof cursor[part] !== 'object') cursor[part] = typeof next === 'number' ? [] : {};
      cursor = cursor[part];
    }
    cursor[parts[parts.length - 1]] = value;
  }

  function replaceObject(target, nextValue) {
    Object.keys(target).forEach(key => delete target[key]);
    Object.assign(target, cloneValue(nextValue) || {});
  }

  function normalizeOptions(options) {
    const result = [];
    (Array.isArray(options) ? options : []).forEach((entry, groupIndex) => {
      if (entry && typeof entry === 'object' && Array.isArray(entry.options)) {
        entry.options.forEach((option, optionIndex) => {
          const value = option && typeof option === 'object' ? option.value : option;
          if (value === undefined || value === null || String(value) === '') return;
          result.push({
            value,
            label: text(option && typeof option === 'object' ? option.label : value, String(value)),
            description: text(option && typeof option === 'object' ? option.description : ''),
            group: text(entry.label, `分组${groupIndex + 1}`),
            id: `g${groupIndex}-${optionIndex}`,
          });
        });
        return;
      }
      const value = entry && typeof entry === 'object' ? entry.value : entry;
      if (value === undefined || value === null || String(value) === '') return;
      result.push({
        value,
        label: text(entry && typeof entry === 'object' ? entry.label : value, String(value)),
        description: text(entry && typeof entry === 'object' ? entry.description : ''),
        group: text(entry && typeof entry === 'object' ? entry.group : ''),
        id: text(entry && typeof entry === 'object' ? entry.id : '', `o${result.length}`),
      });
    });
    return result;
  }

  function readThemeTokens(node) {
    if (!node || typeof getComputedStyle !== 'function') return {};
    const source = node.closest?.('.skill-designer-vue-host') || node;
    const computed = getComputedStyle(source);
    return [
      '--skill-designer-vue-shell',
      '--skill-designer-vue-editor',
      '--skill-designer-vue-control',
      '--skill-designer-vue-popover',
      '--skill-designer-vue-text',
      '--skill-designer-vue-muted',
      '--skill-designer-vue-accent',
      '--skill-designer-vue-accent-secondary',
      '--skill-designer-vue-accent-text',
      '--skill-designer-vue-focus',
      '--skill-designer-vue-border',
      '--skill-designer-vue-danger',
      '--skill-designer-vue-warning',
      '--skill-designer-vue-success',
      '--skill-designer-vue-radius',
      '--skill-designer-vue-cut',
      '--skill-designer-vue-font',
      '--skill-designer-vue-heading-weight',
      '--skill-designer-vue-body-weight',
    ].reduce((tokens, name) => {
      const value = computed.getPropertyValue(name).trim();
      if (value) tokens[name] = value;
      return tokens;
    }, {});
  }

  function createComponents(Vue) {
    const {
      Teleport,
      computed,
      defineComponent,
      nextTick,
      onBeforeUnmount,
      onMounted,
      reactive,
      shallowRef,
      watch,
    } = Vue;

    const SkillCombobox = defineComponent({
      name: 'SkillDesignerCombobox',
      props: {
        modelValue: { default: '' },
        options: { type: Array, default: () => [] },
        disabled: Boolean,
        label: { type: String, default: '选项' },
        instanceId: { type: String, required: true },
        invalid: Boolean,
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const open = shallowRef(false);
        const query = shallowRef('');
        const activeIndex = shallowRef(0);
        const trigger = shallowRef(null);
        const search = shallowRef(null);
        const popupStyle = shallowRef({});
        let listening = false;

        const items = computed(() => normalizeOptions(props.options));
        const filtered = computed(() => {
          const keyword = text(query.value).toLocaleLowerCase();
          if (!keyword) return items.value;
          return items.value.filter(item =>
            [item.label, item.description, item.value, item.group]
              .some(value => String(value).toLocaleLowerCase().includes(keyword)),
          );
        });
        const selectedLabel = computed(() => {
          const selected = items.value.find(item => String(item.value) === String(props.modelValue));
          return selected ? selected.label : text(props.modelValue, '请选择');
        });
        const listId = `${props.instanceId}-list`;
        const activeDescendant = computed(() => {
          const item = filtered.value[activeIndex.value];
          return item ? `${listId}-${item.id}` : '';
        });

        function reposition() {
          if (!open.value || !trigger.value) return;
          const rect = trigger.value.getBoundingClientRect();
          const width = Math.min(Math.max(220, rect.width), Math.max(180, window.innerWidth - 24));
          const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - width - 12));
          const below = Math.max(160, window.innerHeight - rect.bottom - 20);
          const above = Math.max(160, rect.top - 20);
          const upward = below < 260 && above > below;
          const maxHeight = Math.min(360, upward ? above : below);
          popupStyle.value = {
            ...readThemeTokens(trigger.value),
            left: `${left}px`,
            top: `${upward ? Math.max(12, rect.top - maxHeight - 8) : rect.bottom + 8}px`,
            width: `${width}px`,
            maxHeight: `${maxHeight}px`,
          };
        }

        function stopListening() {
          if (!listening) return;
          window.removeEventListener('resize', reposition);
          window.removeEventListener('scroll', reposition, true);
          document.removeEventListener('pointerdown', onOutside, true);
          listening = false;
        }

        function close(returnFocus = true) {
          if (!open.value) return;
          open.value = false;
          stopListening();
          if (returnFocus) nextTick(() => trigger.value?.focus());
        }

        function onOutside(event) {
          const popup = document.getElementById(`${props.instanceId}-popup`);
          if (trigger.value?.contains(event.target) || popup?.contains(event.target)) return;
          close(false);
        }

        function openMenu() {
          if (props.disabled || open.value) return;
          open.value = true;
          query.value = '';
          activeIndex.value = Math.max(
            0,
            items.value.findIndex(item => String(item.value) === String(props.modelValue)),
          );
          nextTick(() => {
            reposition();
            window.addEventListener('resize', reposition);
            window.addEventListener('scroll', reposition, true);
            document.addEventListener('pointerdown', onOutside, true);
            listening = true;
            search.value?.focus();
          });
        }

        function select(item) {
          if (!item) return;
          emit('update:modelValue', item.value);
          close();
        }

        function keydown(event) {
          if (!open.value && ['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            openMenu();
            return;
          }
          if (!open.value) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!filtered.value.length) return;
            const step = event.key === 'ArrowDown' ? 1 : -1;
            activeIndex.value = (activeIndex.value + step + filtered.value.length) % filtered.value.length;
            return;
          }
          if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            activeIndex.value = event.key === 'Home' ? 0 : Math.max(0, filtered.value.length - 1);
            return;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            select(filtered.value[activeIndex.value]);
          }
        }

        watch(query, () => { activeIndex.value = 0; });
        onBeforeUnmount(() => close(false));

        return { activeDescendant, activeIndex, close, filtered, keydown, listId, open, openMenu, popupStyle, query, search, select, selectedLabel, trigger };
      },
      template: `
        <div class="skill-designer-vue-combobox">
          <button
            ref="trigger"
            type="button"
            class="skill-designer-vue-control skill-designer-vue-combobox-trigger"
            :disabled="disabled"
            :aria-label="label + '：' + selectedLabel"
            :aria-expanded="open ? 'true' : 'false'"
            :aria-controls="listId"
            :aria-invalid="invalid ? 'true' : 'false'"
            aria-haspopup="listbox"
            @click="open ? close() : openMenu()"
            @keydown="keydown"
          >
            <span>{{ selectedLabel }}</span>
            <i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
          </button>
          <Teleport to="body">
            <div v-if="open" :id="instanceId + '-popup'" class="skill-designer-vue-popover" :style="popupStyle">
              <input
                ref="search"
                v-model="query"
                class="skill-designer-vue-control skill-designer-vue-search"
                type="search"
                :placeholder="'搜索' + label"
                :aria-label="'搜索' + label"
                :aria-activedescendant="activeDescendant"
                role="combobox"
                aria-autocomplete="list"
                :aria-controls="listId"
                @keydown="keydown"
              />
              <div :id="listId" class="skill-designer-vue-option-list" role="listbox">
                <template v-for="(item, index) in filtered" :key="item.id + '-' + String(item.value)">
                  <div v-if="item.group && (index === 0 || filtered[index - 1]?.group !== item.group)" class="skill-designer-vue-option-group">{{ item.group }}</div>
                  <button
                    :id="listId + '-' + item.id"
                    type="button"
                    class="skill-designer-vue-option"
                    :class="{ active: index === activeIndex, selected: String(item.value) === String(modelValue) }"
                    role="option"
                    :aria-selected="String(item.value) === String(modelValue) ? 'true' : 'false'"
                    @pointermove="activeIndex = index"
                    @click="select(item)"
                  >
                    <strong>{{ item.label }}</strong>
                    <span v-if="item.description">{{ item.description }}</span>
                  </button>
                </template>
                <p v-if="!filtered.length" class="skill-designer-vue-empty">没有匹配项</p>
              </div>
            </div>
          </Teleport>
        </div>
      `,
    });

    const SkillMultiSelect = defineComponent({
      name: 'SkillDesignerMultiSelect',
      components: { SkillCombobox },
      props: {
        modelValue: { type: Array, default: () => [] },
        options: { type: Array, default: () => [] },
        disabled: Boolean,
        label: { type: String, default: '选项' },
        instanceId: { type: String, required: true },
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const selected = computed(() => {
          const labels = new Map(normalizeOptions(props.options).map(item => [String(item.value), item.label]));
          return (props.modelValue || []).map(value => ({ value, label: labels.get(String(value)) || String(value) }));
        });
        const available = computed(() => {
          const chosen = new Set((props.modelValue || []).map(value => String(value)));
          return normalizeOptions(props.options).filter(item => !chosen.has(String(item.value)));
        });
        function add(value) {
          emit('update:modelValue', [...(props.modelValue || []), value]);
        }
        function remove(value) {
          emit('update:modelValue', (props.modelValue || []).filter(item => String(item) !== String(value)));
        }
        return { add, available, remove, selected };
      },
      template: `
        <div class="skill-designer-vue-multiselect">
          <div v-if="selected.length" class="skill-designer-vue-token-list">
            <span v-for="item in selected" :key="String(item.value)" class="skill-designer-vue-token">
              <span>{{ item.label }}</span>
              <button type="button" :disabled="disabled" :aria-label="'移除' + item.label" @click="remove(item.value)">
                <i class="fa-solid fa-xmark" aria-hidden="true"></i>
              </button>
            </span>
          </div>
          <SkillCombobox
            v-if="available.length"
            :options="available"
            :disabled="disabled"
            :label="label"
            :instance-id="instanceId + '-add'"
            @update:model-value="add"
          />
          <span v-else-if="!selected.length" class="skill-designer-vue-empty-inline">暂无选择</span>
        </div>
      `,
    });

    const SkillSegmented = defineComponent({
      name: 'SkillDesignerSegmented',
      props: {
        modelValue: { default: '' },
        options: { type: Array, default: () => [] },
        disabled: Boolean,
        label: { type: String, default: '选项' },
        compact: Boolean,
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        function optionValue(option) {
          return option && typeof option === 'object' ? option.value : option;
        }
        function optionLabel(option) {
          return option && typeof option === 'object' ? option.label : option;
        }
        function keydown(event, index) {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const count = props.options.length;
          if (!count) return;
          const next = event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + count) % count;
          emit('update:modelValue', optionValue(props.options[next]));
          nextTick(() => event.currentTarget.parentElement?.querySelector(`[data-index="${next}"]`)?.focus());
        }
        return { keydown, optionLabel, optionValue };
      },
      template: `
        <div class="skill-designer-vue-segmented" :class="{ compact }" role="radiogroup" :aria-label="label">
          <button
            v-for="(option, index) in options"
            :key="String(optionValue(option))"
            :data-index="index"
            type="button"
            role="radio"
            :aria-checked="String(modelValue) === String(optionValue(option)) ? 'true' : 'false'"
            :tabindex="String(modelValue) === String(optionValue(option)) ? 0 : index === 0 ? 0 : -1"
            :class="{ active: String(modelValue) === String(optionValue(option)) }"
            :disabled="disabled"
            @click="$emit('update:modelValue', optionValue(option))"
            @keydown="keydown($event, index)"
          >{{ optionLabel(option) }}</button>
        </div>
      `,
    });

    const SkillDurationInput = defineComponent({
      name: 'SkillDesignerDurationInput',
      props: {
        modelValue: { default: 0 },
        disabled: Boolean,
        label: { type: String, default: '有效时长' },
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const minutesPerTick = 10;
        const parts = computed(() => {
          const total = Math.max(0, Math.floor(Number(props.modelValue) || 0) * minutesPerTick);
          return { days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60 };
        });
        function update(part, value) {
          const next = { ...parts.value, [part]: Math.max(0, Math.floor(Number(value) || 0)) };
          const totalMinutes = next.days * 1440 + next.hours * 60 + next.minutes;
          emit('update:modelValue', Math.max(0, Math.round(totalMinutes / minutesPerTick)));
        }
        return { parts, update };
      },
      template: `
        <div class="skill-designer-vue-duration" role="group" :aria-label="label">
          <label><input type="number" min="0" :value="parts.days" :disabled="disabled" aria-label="日" @input="update('days', $event.target.value)"><span>日</span></label>
          <label><input type="number" min="0" max="23" :value="parts.hours" :disabled="disabled" aria-label="时" @input="update('hours', $event.target.value)"><span>时</span></label>
          <label><input type="number" min="0" max="59" step="10" :value="parts.minutes" :disabled="disabled" aria-label="分" @input="update('minutes', $event.target.value)"><span>分</span></label>
        </div>
      `,
    });

    const SkillField = defineComponent({
      name: 'SkillDesignerField',
      components: { SkillCombobox, SkillDurationInput, SkillMultiSelect, SkillSegmented },
      props: {
        descriptor: { type: Object, required: true },
        modelValue: { default: '' },
        disabled: Boolean,
        instanceId: { type: String, required: true },
        error: { type: Object, default: null },
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        function update(event) {
          emit('update:modelValue', event?.target ? event.target.value : event);
        }
        return { update };
      },
      template: `
        <div class="skill-designer-vue-field-shell" :class="{ 'has-error': error }">
          <div class="skill-designer-vue-label-row">
            <label class="skill-designer-vue-label" :for="instanceId">
              <span>{{ descriptor.label }}</span><b v-if="descriptor.required">*</b>
            </label>
            <span v-if="descriptor.unit" class="skill-designer-vue-field-unit">{{ descriptor.unit }}</span>
          </div>
          <SkillSegmented
            v-if="descriptor.control === 'segmented'"
            :model-value="modelValue"
            :options="descriptor.options"
            :disabled="disabled"
            :label="descriptor.label"
            @update:model-value="$emit('update:modelValue', $event)"
          />
          <SkillMultiSelect
            v-else-if="descriptor.control === 'multiEnum'"
            :model-value="Array.isArray(modelValue) ? modelValue : []"
            :options="descriptor.options"
            :disabled="disabled"
            :label="descriptor.label"
            :instance-id="instanceId"
            @update:model-value="$emit('update:modelValue', $event)"
          />
          <SkillCombobox
            v-else-if="descriptor.control === 'singleEnum'"
            :model-value="modelValue"
            :options="descriptor.options"
            :disabled="disabled"
            :label="descriptor.label"
            :instance-id="instanceId"
            :invalid="!!error"
            @update:model-value="$emit('update:modelValue', $event)"
          />
          <SkillDurationInput
            v-else-if="descriptor.control === 'duration'"
            :model-value="modelValue"
            :disabled="disabled"
            :label="descriptor.label"
            @update:model-value="$emit('update:modelValue', $event)"
          />
          <label v-else-if="descriptor.control === 'toggle'" class="skill-designer-vue-toggle">
            <input :id="instanceId" type="checkbox" :checked="modelValue === true || modelValue === '启用' || modelValue === '是'" :disabled="disabled" @change="$emit('update:modelValue', $event.target.checked)">
            <span aria-hidden="true"></span><em>{{ modelValue === true || modelValue === '启用' || modelValue === '是' ? '启用' : '关闭' }}</em>
          </label>
          <textarea
            v-else-if="descriptor.control === 'textarea'"
            :id="instanceId"
            class="skill-designer-vue-control skill-designer-vue-textarea"
            :value="modelValue"
            :placeholder="descriptor.placeholder || ''"
            :disabled="disabled"
            :aria-invalid="error ? 'true' : 'false'"
            :aria-required="descriptor.required ? 'true' : 'false'"
            @input="update"
          ></textarea>
          <span v-else-if="descriptor.control === 'static'" class="skill-designer-vue-static">{{ modelValue || descriptor.defaultValue || '未设置' }}</span>
          <input
            v-else
            :id="instanceId"
            class="skill-designer-vue-control"
            :type="descriptor.control === 'number' ? 'number' : 'text'"
            :inputmode="descriptor.control === 'number' ? 'numeric' : descriptor.control === 'numberOrPercent' ? 'decimal' : 'text'"
            :value="modelValue"
            :min="descriptor.min"
            :max="descriptor.max"
            :step="descriptor.step"
            :placeholder="descriptor.placeholder || ''"
            :disabled="disabled"
            :aria-invalid="error ? 'true' : 'false'"
            :aria-required="descriptor.required ? 'true' : 'false'"
            @input="update"
          >
          <small v-if="descriptor.help" class="skill-designer-vue-help-text">{{ descriptor.help }}</small>
          <small v-if="error" class="skill-designer-vue-field-error" :id="instanceId + '-error'">{{ error.message }}</small>
        </div>
      `,
    });

    function createFieldPanel(name, tab) {
      return defineComponent({
        name,
        components: { SkillField },
        props: {
          draft: { type: Object, required: true },
          fields: { type: Array, default: () => [] },
          disabled: Boolean,
          instanceId: { type: String, required: true },
          errorPaths: { type: Array, default: () => [] },
        },
        emits: ['patch'],
        setup(props, { emit }) {
          const groupLabels = {
            identity: '技能身份',
            target: '目标与对象',
            value: '资源与数值',
            timing: '时间与次数',
            scaling: '成长与规则',
            condition: '条件与限制',
          };
          const groupedFields = computed(() => {
            const groups = new Map();
            (props.fields || []).forEach(field => {
              const key = field.group || 'identity';
              if (!groups.has(key)) groups.set(key, { key, label: groupLabels[key] || '其他设置', fields: [] });
              groups.get(key).fields.push(field);
            });
            return [...groups.values()];
          });
          function valueFor(field) {
            return readPath(props.draft, field.path || [field.key]);
          }
          function errorFor(field) {
            const current = pathKey(field.path || [field.key]);
            return props.errorPaths.find(error => String(error?.path || '') === current);
          }
          function patch(field, value) {
            emit('patch', { path: field.path || [field.key], value, dependent: !!field.dependent });
          }
          return { errorFor, groupedFields, patch, tab, valueFor };
        },
        template: `
          <section class="skill-designer-vue-form-page" :data-panel-tab="tab" :id="instanceId + '-panel'">
            <div v-for="group in groupedFields" :key="group.key" class="skill-designer-vue-field-group">
              <header class="skill-designer-vue-group-heading"><h3>{{ group.label }}</h3><span>{{ group.fields.length }} 项</span></header>
              <div class="skill-designer-vue-field-grid">
                <template v-for="field in group.fields" :key="field.id || field.key">
                  <details v-if="field.presentation === 'advanced'" class="skill-designer-vue-advanced-field" :class="{ wide: field.wide }">
                    <summary><span>{{ field.label }}</span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
                    <SkillField :descriptor="field" :model-value="valueFor(field)" :disabled="disabled" :instance-id="instanceId + '-' + (field.id || field.key)" :error="errorFor(field)" @update:model-value="patch(field, $event)" />
                  </details>
                  <SkillField v-else :class="{ wide: field.wide }" :descriptor="field" :model-value="valueFor(field)" :disabled="disabled" :instance-id="instanceId + '-' + (field.id || field.key)" :error="errorFor(field)" @update:model-value="patch(field, $event)" />
                </template>
              </div>
            </div>
            <p v-if="!groupedFields.length" class="skill-designer-vue-empty-inline">当前页面暂无可编辑字段。</p>
          </section>
        `,
      });
    }

    const SkillBasicPanel = createFieldPanel('SkillDesignerBasicPanel', 'basic');
    const SkillCostPanel = createFieldPanel('SkillDesignerCostPanel', 'cost');
    const SkillDescriptionPanel = createFieldPanel('SkillDesignerDescriptionPanel', 'description');

    const SkillConditionLine = defineComponent({
      name: 'SkillDesignerConditionLine',
      components: { SkillCombobox, SkillField, SkillSegmented },
      props: {
        condition: { type: Object, required: true },
        path: { type: Array, required: true },
        index: { type: Number, required: true },
        count: { type: Number, required: true },
        modelApi: { type: Object, required: true },
        disabled: Boolean,
        instanceId: { type: String, required: true },
        errorPaths: { type: Array, default: () => [] },
      },
      emits: ['patch', 'remove'],
      setup(props, { emit }) {
        const model = computed(() => props.modelApi.getConditionModel(props.condition || {}));
        const type = computed(() => text(props.condition?.类型, '生命比例'));
        const objectVisible = computed(() => !['目标', '使用者', '当前行动', '环境满足', '时间', '连携前提'].includes(type.value));
        const valueKey = computed(() => model.value.valueField?.key || '');
        function conditionPath(key) { return [...props.path, key]; }
        function errorFor(key) {
          const current = pathKey(conditionPath(key));
          return props.errorPaths.find(error => String(error?.path || '') === current);
        }
        return { conditionPath, errorFor, emit, model, objectVisible, type, valueKey };
      },
      methods: { pathKey },
      template: `
        <div class="skill-designer-vue-condition-line" :data-field-path="pathKey(path)">
          <span class="skill-designer-vue-logic-word">{{ index === 0 ? '如果' : '并且' }}</span>
          <SkillCombobox :model-value="condition.类型" :options="modelApi.conditionTypeOptions" :disabled="disabled" label="条件类型" :instance-id="instanceId + '-type'" @update:model-value="emit('patch', { path: conditionPath('类型'), value: $event, dependent: true })" />
          <SkillCombobox v-if="objectVisible" :model-value="condition.对象 || '目标'" :options="modelApi.conditionObjectOptions" :disabled="disabled" label="作用对象" :instance-id="instanceId + '-object'" @update:model-value="emit('patch', { path: conditionPath('对象'), value: $event })" />
          <SkillSegmented v-if="model.showCompare" :model-value="condition.比较" :options="model.compareOptions" :disabled="disabled" :label="'比较方式：' + type" compact @update:model-value="emit('patch', { path: conditionPath('比较'), value: $event, dependent: true })" />
          <SkillField v-if="model.valueField" :descriptor="model.valueField" :model-value="condition[valueKey] || ''" :disabled="disabled" :instance-id="instanceId + '-value'" :error="errorFor(valueKey)" @update:model-value="emit('patch', { path: conditionPath(valueKey), value: $event })" />
          <button v-if="count > 1" type="button" class="skill-designer-vue-icon-button danger" :disabled="disabled" aria-label="删除条件" title="删除条件" @click="emit('remove')"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
        </div>
      `,
    });

    const SkillBranchEffect = defineComponent({
      name: 'SkillDesignerBranchEffect',
      components: { SkillCombobox, SkillField },
      props: {
        effect: { type: Object, required: true },
        path: { type: Array, required: true },
        relation: { type: String, required: true },
        modelApi: { type: Object, required: true },
        disabled: Boolean,
        instanceId: { type: String, required: true },
        errorPaths: { type: Array, default: () => [] },
      },
      emits: ['patch', 'remove'],
      setup(props, { emit }) {
        const expanded = shallowRef(false);
        const model = computed(() => props.modelApi.getPrototypeModel(props.effect, { depth: 1, 禁用条件分支: true }));
        const fields = computed(() => model.value.fields.filter(field => field.presentation !== 'advanced' && !['conditionList', 'effectList'].includes(field.control)).slice(0, 4));
        const summary = computed(() => {
          const values = fields.value.map(field => text(readPath(props.effect, [field.key]), '')).filter(Boolean).slice(0, 2);
          return [text(props.effect?.原型, '未选择效果'), text(props.effect?.目标, ''), ...values].filter(Boolean).join(' · ');
        });
        function patch(field, value) {
          emit('patch', { path: [...props.path, field.key], value, dependent: !!field.dependent });
        }
        return { emit, expanded, fields, model, patch, readPath, summary };
      },
      template: `
        <div class="skill-designer-vue-branch-effect" :class="{ expanded }">
          <div class="skill-designer-vue-branch-effect-row">
            <span class="skill-designer-vue-relationship-line" aria-hidden="true"></span>
            <strong>{{ relation }}</strong>
            <button type="button" class="skill-designer-vue-branch-summary" :aria-expanded="expanded ? 'true' : 'false'" @click="expanded = !expanded">
              <span>{{ summary }}</span><i :class="expanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" aria-hidden="true"></i>
            </button>
            <button type="button" class="skill-designer-vue-icon-button danger" :disabled="disabled" aria-label="删除分支效果" title="删除分支效果" @click="emit('remove')"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
          </div>
          <div v-if="expanded" class="skill-designer-vue-branch-editor">
            <SkillCombobox :model-value="effect.原型" :options="modelApi.prototypeOptions" :disabled="disabled" label="分支效果原型" :instance-id="instanceId + '-prototype'" @update:model-value="patch({ key: '原型', dependent: true }, $event)" />
            <SkillField v-for="field in fields.filter(item => item.key !== '原型')" :key="field.key" :descriptor="field" :model-value="readPath(effect, [field.key]) ?? field.defaultValue ?? ''" :disabled="disabled" :instance-id="instanceId + '-' + field.key" @update:model-value="patch(field, $event)" />
          </div>
        </div>
      `,
    });

    const SkillConditionBranch = defineComponent({
      name: 'SkillDesignerConditionBranch',
      components: { SkillConditionLine, SkillSegmented, SkillBranchEffect },
      props: {
        branch: { type: Object, required: true },
        path: { type: Array, required: true },
        index: { type: Number, required: true },
        modelApi: { type: Object, required: true },
        disabled: Boolean,
        instanceId: { type: String, required: true },
        errorPaths: { type: Array, default: () => [] },
      },
      emits: ['patch', 'structure'],
      setup(props, { emit }) {
        const conditions = computed(() => Array.isArray(props.branch.条件) ? props.branch.条件 : []);
        const action = computed(() => text(props.branch.处理, '生效'));
        const effectKey = computed(() => action.value === '追加效果' ? '追加效果' : '替换效果');
        const effects = computed(() => Array.isArray(props.branch[effectKey.value]) ? props.branch[effectKey.value] : []);
        function branchPath(key) { return [...props.path, key]; }
        function emitPatch(path, value, dependent = false) { emit('patch', { path, value, dependent }); }
        return { action, branchPath, conditions, effectKey, effects, emit, emitPatch };
      },
      template: `
        <section class="skill-designer-vue-condition-branch">
          <header class="skill-designer-vue-branch-heading"><span>条件 {{ index + 1 }}</span><button type="button" class="skill-designer-vue-icon-button danger" :disabled="disabled" aria-label="删除条件分支" title="删除条件分支" @click="emit('structure', { type: 'remove', path: path.slice(0, -1), index })"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></header>
          <div class="skill-designer-vue-condition-lines">
            <SkillConditionLine v-for="(condition, conditionIndex) in conditions" :key="conditionIndex" :condition="condition" :path="[...branchPath('条件'), conditionIndex]" :index="conditionIndex" :count="conditions.length" :model-api="modelApi" :disabled="disabled" :instance-id="instanceId + '-condition-' + conditionIndex" :error-paths="errorPaths" @patch="emit('patch', $event)" @remove="emit('structure', { type: 'remove', path: branchPath('条件'), index: conditionIndex })" />
          </div>
          <div class="skill-designer-vue-branch-decision">
            <button type="button" class="skill-designer-vue-link-button" :disabled="disabled || conditions.length >= 3" @click="emit('structure', { type: 'add-condition', path: branchPath('条件') })"><i class="fa-solid fa-plus" aria-hidden="true"></i>添加条件</button>
            <SkillSegmented :model-value="branch.处理" :options="modelApi.conditionActionOptions" :disabled="disabled" label="满足后的处理" compact @update:model-value="emitPatch(branchPath('处理'), $event, true)" />
          </div>
          <div v-if="action === '生效' || action === '禁用'" class="skill-designer-vue-branch-outcome"><span class="skill-designer-vue-logic-word">{{ action === '禁用' ? '否则' : '满足后' }}</span><strong>{{ action === '禁用' ? '禁用当前效果' : '保持当前效果' }}</strong></div>
          <div v-else class="skill-designer-vue-branch-effects">
            <SkillBranchEffect v-for="(effect, effectIndex) in effects" :key="effectIndex" :effect="effect" :path="[...branchPath(effectKey), effectIndex]" :relation="action === '追加效果' ? '追加' : '替换'" :model-api="modelApi" :disabled="disabled" :instance-id="instanceId + '-effect-' + effectIndex" :error-paths="errorPaths" @patch="emit('patch', $event)" @remove="emit('structure', { type: 'remove', path: branchPath(effectKey), index: effectIndex })" />
            <button type="button" class="skill-designer-vue-link-button" :disabled="disabled || effects.length >= Math.min(2, Number(modelApi.nestedPrototypeLimit || 2))" @click="emit('structure', { type: 'add-prototype', path: branchPath(effectKey) })"><i class="fa-solid fa-plus" aria-hidden="true"></i>添加{{ action === '追加效果' ? '追加' : '替换' }}效果</button>
            <small v-if="effects.length >= Math.min(2, Number(modelApi.nestedPrototypeLimit || 2))" class="skill-designer-vue-limit-note">嵌套效果最多支持 2 层。</small>
          </div>
        </section>
      `,
    });

    const SkillPrototypeRow = defineComponent({
      name: 'SkillDesignerPrototypeRow',
      components: { SkillCombobox, SkillConditionBranch, SkillField },
      props: {
        effect: { type: Object, required: true },
        path: { type: Array, required: true },
        index: { type: Number, required: true },
        count: { type: Number, required: true },
        modelApi: { type: Object, required: true },
        disabled: Boolean,
        instanceId: { type: String, required: true },
        errorPaths: { type: Array, default: () => [] },
        collapseMode: { type: String, default: 'normal' },
      },
      emits: ['patch', 'structure'],
      setup(props, { emit }) {
        const expanded = shallowRef(props.index === 0);
        const model = computed(() => props.modelApi.getPrototypeModel(props.effect, { depth: 0 }));
        const fields = computed(() => model.value.fields.filter(field => field.key !== '原型' && field.presentation !== 'advanced' && !['conditionList', 'effectList'].includes(field.control)));
        const conditions = computed(() => Array.isArray(props.effect.条件分支) ? props.effect.条件分支 : []);
        const hasError = computed(() => props.errorPaths.some(error => {
          const current = pathKey([...props.path, props.index]);
          return String(error?.path || '') === current || String(error?.path || '').startsWith(`${current}.`);
        }));
        const summary = computed(() => [text(props.effect?.原型, '未选择效果'), text(props.effect?.目标, ''), conditions.value.length ? `${conditions.value.length} 个条件分支` : '无条件分支'].filter(Boolean).join(' · '));
        function patch(field, value) { emit('patch', { path: [...props.path, props.index, field.key], value, dependent: !!field.dependent }); }
        function toggle() { if (props.collapseMode === 'normal') expanded.value = !expanded.value; }
        watch(() => props.collapseMode, mode => {
          if (mode === 'all') expanded.value = false;
          if (mode === 'errors') expanded.value = hasError.value;
        });
        return { conditions, emit, expanded, fields, hasError, patch, readPath, summary, toggle };
      },
      methods: { pathKey, readPath },
      template: `
        <article class="skill-designer-vue-prototype" :class="{ expanded, 'has-error': hasError }" :data-prototype-path="pathKey([...path, index])">
          <header class="skill-designer-vue-prototype-heading">
            <div class="skill-designer-vue-prototype-identity"><span class="skill-designer-vue-index">{{ String(index + 1).padStart(2, '0') }}</span><span>原型 {{ index + 1 }}</span><b>主效果</b></div>
            <SkillCombobox :model-value="effect.原型" :options="modelApi.prototypeOptions" :disabled="disabled" label="主效果原型" :instance-id="instanceId + '-prototype'" @update:model-value="patch({ key: '原型', dependent: true }, $event)" />
            <button type="button" class="skill-designer-vue-icon-button" :aria-label="expanded ? '折叠原型' : '展开原型'" :title="expanded ? '折叠原型' : '展开原型'" @click="toggle"><i :class="expanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" aria-hidden="true"></i></button>
            <button v-if="index > 0" type="button" class="skill-designer-vue-icon-button" :disabled="disabled" aria-label="上移原型" title="上移原型" @click="emit('structure', { type: 'move-up', path, index })"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
            <button v-if="index < count - 1" type="button" class="skill-designer-vue-icon-button" :disabled="disabled" aria-label="下移原型" title="下移原型" @click="emit('structure', { type: 'move-down', path, index })"><i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button>
            <button type="button" class="skill-designer-vue-icon-button" :disabled="disabled" aria-label="复制原型" title="复制原型" @click="emit('structure', { type: 'duplicate', path, index })"><i class="fa-solid fa-copy" aria-hidden="true"></i></button>
            <button v-if="count > 1" type="button" class="skill-designer-vue-icon-button danger" :disabled="disabled" aria-label="删除原型" title="删除原型" @click="emit('structure', { type: 'remove', path, index })"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
          </header>
          <p class="skill-designer-vue-prototype-summary">{{ summary }}</p>
          <div v-if="expanded" class="skill-designer-vue-prototype-content">
            <div class="skill-designer-vue-field-grid">
              <SkillField v-for="field in fields" :key="field.key" :descriptor="field" :model-value="readPath(effect, [field.key]) ?? field.defaultValue ?? ''" :disabled="disabled" :instance-id="instanceId + '-' + field.key" :error="errorPaths.find(error => String(error?.path || '') === pathKey([...path, index, field.key]))" @update:model-value="patch(field, $event)" />
            </div>
            <div v-if="conditions.length" class="skill-designer-vue-condition-stack">
              <SkillConditionBranch v-for="(branch, branchIndex) in conditions" :key="branchIndex" :branch="branch" :path="[...path, index, '条件分支', branchIndex]" :index="branchIndex" :model-api="modelApi" :disabled="disabled" :instance-id="instanceId + '-branch-' + branchIndex" :error-paths="errorPaths" @patch="emit('patch', $event)" @structure="emit('structure', $event)" />
            </div>
            <div class="skill-designer-vue-prototype-footer">
              <button type="button" class="skill-designer-vue-link-button" :disabled="disabled || conditions.length >= 3" @click="emit('structure', { type: 'add-branch', path: [...path, index, '条件分支'] })"><i class="fa-solid fa-plus" aria-hidden="true"></i>添加条件分支</button>
              <span v-if="conditions.length >= 3" class="skill-designer-vue-limit-note">已达到 3 个条件分支上限</span>
            </div>
          </div>
        </article>
      `,
    });

    const SkillEffectPanel = defineComponent({
      name: 'SkillDesignerEffectPanel',
      components: { SkillField, SkillPrototypeRow },
      props: {
        draft: { type: Object, required: true },
        modelApi: { type: Object, required: true },
        disabled: Boolean,
        instanceId: { type: String, required: true },
        errorPaths: { type: Array, default: () => [] },
        collapseMode: { type: String, default: 'normal' },
      },
      emits: ['patch', 'structure', 'view'],
      setup(props, { emit }) {
        const effects = computed(() => Array.isArray(props.draft.prototypeEffects) ? props.draft.prototypeEffects : []);
        const sideEffects = computed(() => Array.isArray(props.draft.副作用列表) ? props.draft.副作用列表 : []);
        const canAddPrototype = computed(() => effects.value.length < Number(props.modelApi.prototypeLimit || 99));
        function sideEffectFields(item) { return props.modelApi.getSideEffectModel(item || {}).fields || []; }
        function patchSideEffect(index, field, value) { emit('patch', { path: ['副作用列表', index, field.key], value, dependent: !!field.dependent }); }
        return { canAddPrototype, effects, emit, patchSideEffect, readPath, sideEffectFields, sideEffects };
      },
      template: `
        <section class="skill-designer-vue-effect-page" id="skill-designer-effect-content">
          <div class="skill-designer-vue-effect-toolbar">
            <div><span class="skill-designer-vue-section-kicker">效果编排</span><h2>先建立主效果，再补充条件和分支</h2><p>原型按顺序平铺；复杂关系用短线、标签和自然语言表达。</p></div>
            <div class="skill-designer-vue-action-row">
              <button type="button" class="skill-designer-vue-button primary" :disabled="disabled || !canAddPrototype" @click="emit('structure', { type: 'add-prototype', path: ['prototypeEffects'] })"><i class="fa-solid fa-plus" aria-hidden="true"></i>新增原型</button>
              <button type="button" class="skill-designer-vue-text-button" :disabled="disabled" @click="emit('view', 'all')"><i class="fa-solid fa-compress" aria-hidden="true"></i>折叠全部</button>
              <button type="button" class="skill-designer-vue-text-button" :disabled="disabled" @click="emit('view', 'errors')"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>仅展开错误</button>
            </div>
          </div>
          <div v-if="!effects.length" class="skill-designer-vue-empty-state">
            <i class="fa-solid fa-list-check" aria-hidden="true"></i><strong>还没有效果原型</strong><span>先添加一个主效果，之后再配置条件、追加或替换效果。</span>
            <button type="button" class="skill-designer-vue-button primary" :disabled="disabled || !canAddPrototype" @click="emit('structure', { type: 'add-prototype', path: ['prototypeEffects'] })"><i class="fa-solid fa-plus" aria-hidden="true"></i>新增第一个原型</button>
          </div>
          <div v-else class="skill-designer-vue-prototype-list">
            <SkillPrototypeRow v-for="(effect, index) in effects" :key="index" :effect="effect" :path="['prototypeEffects']" :index="index" :count="effects.length" :model-api="modelApi" :disabled="disabled" :instance-id="instanceId + '-prototype-' + index" :error-paths="errorPaths" :collapse-mode="collapseMode" @patch="emit('patch', $event)" @structure="emit('structure', $event)" />
          </div>
          <p v-if="effects.length >= Number(modelApi.prototypeLimit || 99)" class="skill-designer-vue-limit-note skill-designer-vue-limit-note--block">原型数量已达到当前技能位上限，不能继续新增。</p>
          <section class="skill-designer-vue-side-effects">
            <header class="skill-designer-vue-subsection-heading"><div><span class="skill-designer-vue-section-kicker">附带代价</span><h3>副作用</h3></div><button type="button" class="skill-designer-vue-text-button" :disabled="disabled" @click="emit('structure', { type: 'add-side-effect', path: ['副作用列表'] })"><i class="fa-solid fa-plus" aria-hidden="true"></i>添加副作用</button></header>
            <p v-if="!sideEffects.length" class="skill-designer-vue-empty-inline">没有设置副作用。</p>
            <div v-for="(item, index) in sideEffects" :key="index" class="skill-designer-vue-side-effect">
              <div class="skill-designer-vue-side-effect-heading"><strong>副作用 {{ index + 1 }}</strong><button type="button" class="skill-designer-vue-icon-button danger" :disabled="disabled" aria-label="删除副作用" title="删除副作用" @click="emit('structure', { type: 'remove', path: ['副作用列表'], index })"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></div>
              <div class="skill-designer-vue-field-grid"><SkillField v-for="field in sideEffectFields(item)" :key="field.key" :descriptor="field" :model-value="readPath(item, [field.key]) ?? field.defaultValue ?? ''" :disabled="disabled" :instance-id="instanceId + '-side-' + index + '-' + field.key" @update:model-value="patchSideEffect(index, field, $event)" /></div>
            </div>
          </section>
        </section>
      `,
    });

    const SkillCostLedger = defineComponent({
      name: 'SkillDesignerCostLedger',
      props: { result: { type: Object, default: () => ({}) } },
      emits: ['locate'],
      setup(props, { emit }) {
        const budget = computed(() => props.result?.preview?.budget || {});
        const rows = computed(() => Array.isArray(props.result?.preview?.resourceRows) ? props.result.preview.resourceRows : []);
        const effects = computed(() => Array.isArray(props.result?.preview?.effectRows) ? props.result.preview.effectRows : []);
        return { budget, effects, emit, rows };
      },
      template: `
        <section class="skill-designer-vue-ledger">
          <header class="skill-designer-vue-ledger-heading"><div><span class="skill-designer-vue-section-kicker">编译结果</span><h3>复杂度预算账单</h3></div><strong>{{ budget.label || '待评估' }}</strong></header>
          <div class="skill-designer-vue-ledger-table">
            <div class="skill-designer-vue-ledger-head"><span>来源</span><span>计算说明</span><span>数值</span></div>
            <button v-for="(row, index) in rows" :key="'resource-' + index" type="button" class="skill-designer-vue-ledger-row" @click="emit('locate', row)"><span>{{ row.label || row.source || '资源' }}</span><em>资源参数</em><b>{{ row.value ?? row.cost ?? '—' }}</b></button>
            <button v-for="(row, index) in effects" :key="'effect-' + index" type="button" class="skill-designer-vue-ledger-row" @click="emit('locate', row)"><span>{{ row.branchLabel ? row.branchLabel + ' / ' : '' }}{{ row.title || '效果原型' }}</span><em>{{ row.relation || '主效果' }}{{ row.conditionSummary ? ' · ' + row.conditionSummary : '' }}</em><b>{{ row.cost ?? '—' }}</b></button>
            <div v-if="!rows.length && !effects.length" class="skill-designer-vue-empty-inline">当前编译结果没有提供可拆分的账单明细。</div>
          </div>
          <footer class="skill-designer-vue-ledger-total"><span>总计</span><strong>{{ budget.label || '待评估' }}</strong><em :class="{ danger: budget.ok === false }">{{ budget.stateLabel || '等待校验' }}</em></footer>
        </section>
      `,
    });

    const SkillDescriptionReference = defineComponent({
      name: 'SkillDesignerDescriptionReference',
      props: { result: { type: Object, default: () => ({}) }, draft: { type: Object, required: true } },
      emits: ['patch'],
      setup(props, { emit }) {
        const reference = computed(() => text(props.result?.preview?.summary || props.result?.preview?.effectDescription, '完成效果配置后，这里会显示编译链提供的参考文案。'));
        const manual = computed(() => text(props.draft?.effectDesc));
        const overridden = computed(() => !!manual.value && manual.value !== reference.value);
        function restore() {
          if (overridden.value && !window.confirm('恢复自动参考会替换当前效果描述，确定继续吗？')) return;
          emit('patch', { path: ['effectDesc'], value: reference.value });
        }
        return { emit, overridden, reference, restore };
      },
      template: `
        <section class="skill-designer-vue-reference">
          <div class="skill-designer-vue-reference-heading"><div><span class="skill-designer-vue-section-kicker">自动参考</span><h3>编译链生成的效果描述</h3></div><span class="skill-designer-vue-reference-state">{{ overridden ? '已手动修改' : '仅供参考' }}</span></div>
          <p>{{ reference }}</p>
          <footer><small>{{ overridden ? '当前描述已脱离自动参考。' : '自动参考不会主动覆盖你的输入。' }}</small><button type="button" class="skill-designer-vue-text-button" @click="restore"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i>{{ overridden ? '恢复自动参考' : '填入效果描述' }}</button></footer>
        </section>
      `,
    });

    const SkillToolbar = defineComponent({
      name: 'SkillDesignerToolbar',
      components: { SkillCombobox },
      props: {
        title: { type: String, default: '未命名技能' },
        subtitle: { type: String, default: '' },
        switchItems: { type: Array, default: () => [] },
        previewKey: { type: String, default: '' },
        busy: Boolean,
        canUndo: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['switch-skill', 'reload', 'undo'],
      setup(props) {
        const switchOptions = computed(() => props.switchItems.map(item => ({ value: item.preview, label: item.label })));
        return { switchOptions };
      },
      template: `
        <header class="skill-designer-vue-toolbar">
          <div class="skill-designer-vue-toolbar-context"><span class="skill-designer-vue-brand">魂技设计台</span><h2>{{ title }}</h2><small>{{ subtitle }}</small></div>
          <div class="skill-designer-vue-toolbar-actions">
            <SkillCombobox v-if="switchItems.length > 1" :model-value="previewKey" :options="switchOptions" :disabled="busy" label="切换技能" :instance-id="instanceId + '-switch'" @update:model-value="$emit('switch-skill', $event)" />
            <button type="button" class="skill-designer-vue-icon-button" :disabled="busy || !canUndo" aria-label="撤销上一次结构操作" title="撤销" @click="$emit('undo')"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>
            <button type="button" class="skill-designer-vue-text-button" :disabled="busy" @click="$emit('reload')"><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>重新读取</button>
          </div>
        </header>
      `,
    });

    const SkillTabs = defineComponent({
      name: 'SkillDesignerTabs',
      props: { tabs: { type: Array, required: true }, activeTab: { type: String, required: true }, errorCounts: { type: Object, required: true }, dirty: Boolean, instanceId: { type: String, required: true } },
      emits: ['update:activeTab'],
      setup(props, { emit }) {
        function keydown(event, index) {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? props.tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + props.tabs.length) % props.tabs.length;
          emit('update:activeTab', props.tabs[next].id);
          nextTick(() => document.getElementById(`${props.instanceId}-tab-${props.tabs[next].id}`)?.focus());
        }
        return { keydown };
      },
      template: `
        <nav class="skill-designer-vue-tabs" role="tablist" aria-label="技能设计步骤">
          <button v-for="(tab, index) in tabs" :key="tab.id" :id="instanceId + '-tab-' + tab.id" type="button" role="tab" :aria-selected="activeTab === tab.id ? 'true' : 'false'" :aria-controls="instanceId + '-panel-' + tab.id" :tabindex="activeTab === tab.id ? 0 : -1" :class="{ active: activeTab === tab.id, invalid: errorCounts[tab.id] }" @click="$emit('update:activeTab', tab.id)" @keydown="keydown($event, index)"><span>{{ tab.label }}</span><b v-if="errorCounts[tab.id]">{{ errorCounts[tab.id] }}</b><i v-else-if="dirty" class="fa-solid fa-circle-dot" aria-hidden="true"></i></button>
        </nav>
      `,
    });

    const SkillStatusDock = defineComponent({
      name: 'SkillDesignerStatusDock',
      props: { statusText: { type: String, default: '未修改' }, budgetSummary: { type: String, default: '预算待评估' }, warnings: Number, errors: Number, disabled: Boolean },
      emits: ['save'],
      template: `
        <footer class="skill-designer-vue-status-dock">
          <div class="skill-designer-vue-status-main" :class="{ 'has-error': errors, 'has-warning': !errors && warnings }"><span class="skill-designer-vue-status-dot" aria-hidden="true"></span><span class="skill-designer-vue-status-label">{{ statusText }}</span><span class="skill-designer-vue-dock-budget">复杂度预算 <strong>{{ budgetSummary }}</strong></span><span v-if="warnings" class="skill-designer-vue-dock-warning">{{ warnings }} 条警告</span><span v-if="errors" class="skill-designer-vue-dock-error">{{ errors }} 个问题</span></div>
          <button type="button" class="skill-designer-vue-button primary skill-designer-vue-save" :disabled="disabled" @click="$emit('save')"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>保存设计</button>
        </footer>
      `,
    });

    const SkillDesignerApp = defineComponent({
      name: 'SkillDesignerApp',
      components: { SkillBasicPanel, SkillCostLedger, SkillCostPanel, SkillDescriptionPanel, SkillDescriptionReference, SkillEffectPanel, SkillStatusDock, SkillTabs, SkillToolbar },
      props: { context: { type: Object, required: true }, instanceId: { type: String, required: true } },
      setup(props) {
        const rawDraft = reactive(cloneValue(props.context.initialRawDraft) || {});
        const activeTab = shallowRef('basic');
        const revision = shallowRef(0);
        const busy = shallowRef(false);
        const dirty = shallowRef(!!props.context.initialDirty);
        const compileResult = shallowRef({ preview: {}, errors: [], warnings: [] });
        const statusText = shallowRef(dirty.value ? '已恢复草稿' : '未修改');
        const collapseMode = shallowRef('normal');
        const undoRecord = shallowRef(null);
        const liveMessage = shallowRef('');
        const destroyed = shallowRef(false);
        const operationToken = shallowRef(0);
        const previewToken = shallowRef(0);
        let cacheTimer = 0;
        let compileTimer = 0;
        let skipUnmountCache = false;

        const tabs = Object.freeze([
          { id: 'basic', label: '基础' },
          { id: 'effect', label: '效果' },
          { id: 'cost', label: '消耗' },
          { id: 'description', label: '描述' },
        ]);
        const tabFields = computed(() => ({
          basic: props.context.editorModel.getTabFields('basic', rawDraft),
          cost: props.context.editorModel.getTabFields('cost', rawDraft),
          description: props.context.editorModel.getTabFields('description', rawDraft),
        }));
        const errorCounts = computed(() => {
          const counts = { basic: 0, effect: 0, cost: 0, description: 0 };
          (compileResult.value.errors || []).forEach(error => {
            const tab = counts[error?.tab] === undefined ? 'effect' : error.tab;
            counts[tab] += 1;
          });
          return counts;
        });
        const pageMeta = computed(() => ({
          basic: { title: '基础', description: '先确定技能身份、承载方式，以及会随承载方式变化的参数。' },
          effect: { title: '效果', description: '把主效果、条件和分支编排成一条能读懂的效果链。' },
          cost: { title: '消耗', description: '调整资源和时间参数，并核对复杂度预算的完整组成。' },
          description: { title: '描述', description: '确认自动参考，并编辑最终会保存的技能描述。' },
        }[activeTab.value]));
        const budgetSummary = computed(() => {
          const budget = compileResult.value?.preview?.budget;
          return budget?.label || '预算待评估';
        });

        function markChanged() {
          dirty.value = true;
          statusText.value = '有未保存更改';
          previewToken.value += 1;
          revision.value += 1;
        }

        function applyPatch(patch) {
          if (busy.value || !Array.isArray(patch?.path)) return;
          if (patch.dependent) {
            replaceObject(rawDraft, props.context.actions.applyDependentFieldChange(cloneValue(rawDraft), cloneValue(patch)));
          } else {
            writePath(rawDraft, patch.path, cloneValue(patch.value));
          }
          markChanged();
        }

        function arrayAt(path) {
          let list = readPath(rawDraft, path);
          if (!Array.isArray(list)) {
            list = [];
            writePath(rawDraft, path, list);
          }
          return list;
        }

        function applyStructure(command) {
          if (busy.value || !Array.isArray(command?.path)) return;
          const list = arrayAt(command.path);
          if (command.type === 'add-prototype') {
            const nested = command.path.some(part => typeof part === 'number') && command.path.length > 1;
            const limit = nested ? 2 : Number(props.context.editorModel.prototypeLimit || 99);
            if (list.length >= limit) return;
            undoRecord.value = { path: [...command.path], value: cloneValue(list) };
            list.push(props.context.actions.createPrototype({ draft: cloneValue(rawDraft) }));
          } else if (command.type === 'add-branch') {
            if (list.length >= 3) return;
            undoRecord.value = { path: [...command.path], value: cloneValue(list) };
            list.push(props.context.editorModel.createConditionBranch());
          } else if (command.type === 'add-condition') {
            if (list.length >= 3) return;
            undoRecord.value = { path: [...command.path], value: cloneValue(list) };
            list.push(props.context.editorModel.createCondition());
          } else if (command.type === 'add-side-effect') {
            undoRecord.value = { path: [...command.path], value: cloneValue(list) };
            list.push(props.context.editorModel.createSideEffect());
          } else if (['remove', 'move-up', 'move-down', 'duplicate'].includes(command.type)) {
            const index = Number(command.index);
            if (index < 0 || index >= list.length) return;
            undoRecord.value = { path: [...command.path], value: cloneValue(list) };
            if (command.type === 'remove') list.splice(index, 1);
            if (command.type === 'move-up' && index > 0) [list[index - 1], list[index]] = [list[index], list[index - 1]];
            if (command.type === 'move-down' && index < list.length - 1) [list[index + 1], list[index]] = [list[index], list[index + 1]];
            if (command.type === 'duplicate') list.splice(index + 1, 0, cloneValue(list[index]));
          } else {
            return;
          }
          markChanged();
          liveMessage.value = command.type === 'remove' ? '已删除结构，可使用撤销恢复。' : '结构已更新。';
        }

        function undo() {
          if (!undoRecord.value || busy.value) return;
          writePath(rawDraft, undoRecord.value.path, cloneValue(undoRecord.value.value));
          undoRecord.value = null;
          markChanged();
          liveMessage.value = '已撤销上一次结构操作。';
        }

        function locateItem(item = {}) {
          activeTab.value = ['basic', 'effect', 'cost', 'description'].includes(item.tab) ? item.tab : 'effect';
          liveMessage.value = item.message || '已定位到相关字段。';
          nextTick(() => {
            const root = document.getElementById(props.instanceId);
            const path = text(item.path).replace(/"/g, '\\"');
            const target = root?.querySelector(`[data-field-path="${path}"], [data-prototype-path="${path}"]`);
            target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
            target?.querySelector('input, textarea, button')?.focus?.();
          });
        }

        function clearTimers() {
          if (cacheTimer) window.clearTimeout(cacheTimer);
          if (compileTimer) window.clearTimeout(compileTimer);
          cacheTimer = 0;
          compileTimer = 0;
        }

        function flushCache() {
          if (cacheTimer) window.clearTimeout(cacheTimer);
          cacheTimer = 0;
          if (dirty.value) props.context.actions.cacheDraft(cloneValue(rawDraft));
        }

        async function compileNow() {
          const token = ++previewToken.value;
          statusText.value = '正在校验';
          try {
            const result = await Promise.resolve(props.context.actions.compileDraft(cloneValue(rawDraft), { dryRun: true }));
            if (destroyed.value || token !== previewToken.value) return;
            compileResult.value = result || compileResult.value;
            statusText.value = compileResult.value.errors?.length
              ? '存在错误'
              : compileResult.value.warnings?.length
                ? '存在警告'
                : dirty.value ? '有未保存更改' : '校验通过';
          } catch (error) {
            if (destroyed.value || token !== previewToken.value) return;
            compileResult.value = { ...compileResult.value, errors: [{ tab: 'effect', path: '', message: error?.message || '预览编译失败。' }] };
            statusText.value = '存在错误';
          }
        }

        function scheduleCompile() {
          clearTimers();
          if (dirty.value) cacheTimer = window.setTimeout(flushCache, 150);
          compileTimer = window.setTimeout(compileNow, 100);
        }

        function focusFirstError(result) {
          const error = result?.errors?.[0];
          if (!error) return;
          activeTab.value = error.tab || 'effect';
          locateItem(error);
        }

        async function save() {
          if (busy.value) return;
          clearTimers();
          flushCache();
          busy.value = true;
          statusText.value = '正在保存';
          skipUnmountCache = true;
          const token = ++operationToken.value;
          try {
            const result = await Promise.resolve(props.context.actions.saveCompiledDraft(cloneValue(rawDraft)));
            if (destroyed.value || token !== operationToken.value) return;
            compileResult.value = result?.compileResult || result || compileResult.value;
            if (compileResult.value.errors?.length) {
              statusText.value = '保存失败';
              skipUnmountCache = false;
              focusFirstError(compileResult.value);
              return;
            }
            dirty.value = false;
            undoRecord.value = null;
            skipUnmountCache = false;
            statusText.value = '保存成功';
            liveMessage.value = result?.message || '技能设计已保存。';
          } catch (error) {
            if (destroyed.value || token !== operationToken.value) return;
            skipUnmountCache = false;
            compileResult.value = error?.compileResult || { ...compileResult.value, errors: [{ tab: error?.tab || 'effect', path: error?.path || '', message: error?.message || '保存失败。' }] };
            statusText.value = '保存失败';
            focusFirstError(compileResult.value);
          } finally {
            if (!destroyed.value && token === operationToken.value) busy.value = false;
          }
        }

        async function reload() {
          if (busy.value) return;
          if (dirty.value && !window.confirm('当前设计尚未保存，确定重新读取吗？')) return;
          clearTimers();
          busy.value = true;
          statusText.value = '正在重新读取';
          const token = ++operationToken.value;
          try {
            const nextDraft = await Promise.resolve(props.context.actions.reloadDraft());
            if (destroyed.value || token !== operationToken.value || !nextDraft) return;
            replaceObject(rawDraft, nextDraft);
            dirty.value = false;
            undoRecord.value = null;
            revision.value += 1;
            statusText.value = '未修改';
          } catch (error) {
            if (!destroyed.value && token === operationToken.value) statusText.value = '重新读取失败';
          } finally {
            if (!destroyed.value && token === operationToken.value) busy.value = false;
          }
        }

        function switchSkill(previewKey) {
          if (busy.value || !previewKey || previewKey === props.context.previewKey) return;
          flushCache();
          props.context.actions.switchSkill(previewKey);
        }

        watch(revision, scheduleCompile, { flush: 'post' });
        onMounted(compileNow);
        onBeforeUnmount(() => {
          destroyed.value = true;
          operationToken.value += 1;
          previewToken.value += 1;
          if (dirty.value && !skipUnmountCache) props.context.actions.cacheDraft(cloneValue(rawDraft));
          clearTimers();
        });

        return { activeTab, applyPatch, applyStructure, busy, collapseMode, compileResult, dirty, errorCounts, errorPaths: computed(() => compileResult.value.errors || []), locateItem, pageMeta, rawDraft, reload, save, statusText, switchSkill, tabFields, tabs, undo, undoRecord, budgetSummary, liveMessage };
      },
      template: `
        <div :id="instanceId" class="skill-designer-vue-root" data-skill-designer-layout="single-canvas" :class="{ 'is-busy': busy }" :aria-busy="busy ? 'true' : 'false'">
          <SkillToolbar :title="rawDraft.name || context.previewMeta.label || '未命名技能'" :subtitle="context.previewMeta.category || context.previewMeta.scope || ''" :switch-items="context.switchItems" :preview-key="context.previewKey" :busy="busy" :can-undo="!!undoRecord" :instance-id="instanceId" @switch-skill="switchSkill" @reload="reload" @undo="undo" />
          <SkillTabs :tabs="tabs" :active-tab="activeTab" :error-counts="errorCounts" :dirty="dirty" :instance-id="instanceId" @update:active-tab="activeTab = $event" />
          <div v-if="busy" class="skill-designer-vue-busy-strip" role="status"><i class="fa-solid fa-spinner" aria-hidden="true"></i>{{ statusText }}</div>
          <main class="skill-designer-vue-editor">
            <header class="skill-designer-vue-page-heading">
              <div><span class="skill-designer-vue-section-kicker">当前任务</span><h1>{{ pageMeta.title }}</h1><p>{{ pageMeta.description }}</p></div>
              <strong v-if="errorCounts[activeTab]" class="skill-designer-vue-heading-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{{ errorCounts[activeTab] }} 个问题</strong>
            </header>
            <section class="skill-designer-vue-page-canvas" role="tabpanel" :id="instanceId + '-panel-' + activeTab">
              <SkillBasicPanel v-show="activeTab === 'basic'" :draft="rawDraft" :fields="tabFields.basic" :error-paths="errorPaths" :disabled="busy" :instance-id="instanceId + '-basic'" @patch="applyPatch" />
              <SkillEffectPanel v-show="activeTab === 'effect'" :draft="rawDraft" :model-api="context.editorModel" :error-paths="errorPaths" :disabled="busy" :instance-id="instanceId + '-effect'" :collapse-mode="collapseMode" @patch="applyPatch" @structure="applyStructure" @view="collapseMode = $event" />
              <div v-show="activeTab === 'cost'">
                <SkillCostPanel :draft="rawDraft" :fields="tabFields.cost" :error-paths="errorPaths" :disabled="busy" :instance-id="instanceId + '-cost'" @patch="applyPatch" />
                <SkillCostLedger :result="compileResult" @locate="locateItem" />
              </div>
              <div v-show="activeTab === 'description'">
                <SkillDescriptionReference :result="compileResult" :draft="rawDraft" @patch="applyPatch" />
                <SkillDescriptionPanel :draft="rawDraft" :fields="tabFields.description" :error-paths="errorPaths" :disabled="busy" :instance-id="instanceId + '-description'" @patch="applyPatch" />
              </div>
            </section>
          </main>
          <section v-if="undoRecord" class="skill-designer-vue-undo-notice" role="status"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i><span>{{ liveMessage || '结构已更新，可以撤销上一次操作。' }}</span><button type="button" class="skill-designer-vue-text-button" :disabled="busy" @click="undo">撤销</button></section>
          <SkillStatusDock :status-text="statusText" :budget-summary="budgetSummary" :warnings="compileResult.warnings?.length || 0" :errors="compileResult.errors?.length || 0" :disabled="busy" @save="save" />
          <div class="skill-designer-vue-live-region" aria-live="assertive">{{ liveMessage }}</div>
        </div>
      `,
    });

    return {
      SkillBasicPanel,
      SkillCombobox,
      SkillConditionBranch,
      SkillConditionLine,
      SkillCostLedger,
      SkillCostPanel,
      SkillDescriptionPanel,
      SkillDescriptionReference,
      SkillDesignerApp,
      SkillDurationInput,
      SkillEffectPanel,
      SkillField,
      SkillMultiSelect,
      SkillPrototypeRow,
      SkillSegmented,
      SkillStatusDock,
      SkillTabs,
      SkillToolbar,
    };
  }

  function mount(host, context) {
    if (!host || host.nodeType !== 1) throw new Error('技能设计器缺少有效挂载节点。');
    if (!context?.actions || !context.editorModel) throw new Error('技能设计器上下文不完整。');
    const Vue = resolveVue();
    if (!Vue) throw new Error('Vue 3.5 运行时未就绪。');
    const previous = host.getAttribute('data-skill-designer-vue-mounted');
    if (previous && instances.has(previous)) instances.get(previous).destroy();
    const instanceId = `skill-designer-vue-${Date.now()}-${++instanceSeed}`;
    const components = createComponents(Vue);
    const app = Vue.createApp({ render: () => Vue.h(components.SkillDesignerApp, { context, instanceId }) });
    Object.entries(components).forEach(([name, component]) => app.component(name, component));
    const controller = {
      destroy() {
        if (!instances.has(instanceId)) return;
        instances.delete(instanceId);
        try {
          app.unmount();
        } finally {
          host.replaceChildren();
          host.removeAttribute('data-skill-designer-vue-mounted');
        }
      },
    };
    host.replaceChildren();
    host.setAttribute('data-skill-designer-vue-mounted', instanceId);
    try {
      app.mount(host);
      instances.set(instanceId, controller);
      return controller;
    } catch (error) {
      try {
        app.unmount();
      } catch (unmountError) {}
      host.replaceChildren();
      host.removeAttribute('data-skill-designer-vue-mounted');
      throw error;
    }
  }

  function destroyAll() {
    Array.from(instances.values()).forEach(controller => {
      try {
        controller.destroy();
      } catch (error) {}
    });
    instances.clear();
  }

  globalThis.__LWCS_SKILL_DESIGNER_UI__ = Object.freeze({
    apiVersion: API_VERSION,
    mount,
    destroyAll,
  });
})();
