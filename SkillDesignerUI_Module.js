(function () {
  'use strict';

  const API_VERSION = 2;
  const mounted = new Map();
  let instanceSeed = 0;

  function getVue() {
    const roots = [globalThis];
    try {
      if (window.parent && window.parent !== window) roots.push(window.parent);
    } catch (error) {}
    try {
      if (window.top && window.top !== window && !roots.includes(window.top)) roots.push(window.top);
    } catch (error) {}
    return roots.find(root => root?.Vue?.createApp)?.Vue || null;
  }

  function clone(value) {
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

  function cleanText(value, fallback = '') {
    const result = value === undefined || value === null ? '' : String(value).trim();
    return result || fallback;
  }

  function getPath(root, path) {
    return (Array.isArray(path) ? path : []).reduce(
      (value, key) => (value && typeof value === 'object' ? value[key] : undefined),
      root,
    );
  }

  function setPath(root, path, value) {
    const parts = Array.isArray(path) ? path : [];
    if (!parts.length) return;
    let cursor = root;
    for (let index = 0; index < parts.length - 1; index += 1) {
      const key = parts[index];
      const next = parts[index + 1];
      if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = typeof next === 'number' ? [] : {};
      cursor = cursor[key];
    }
    cursor[parts[parts.length - 1]] = value;
  }

  function replaceObject(target, value) {
    Object.keys(target).forEach(key => delete target[key]);
    Object.assign(target, clone(value) || {});
  }

  function pathString(path) {
    return (Array.isArray(path) ? path : []).map(String).join('.');
  }

  function optionList(options) {
    const result = [];
    (Array.isArray(options) ? options : []).forEach((entry, groupIndex) => {
      if (entry && typeof entry === 'object' && Array.isArray(entry.options)) {
        entry.options.forEach((option, optionIndex) => {
          const value = option && typeof option === 'object' ? option.value : option;
          if (value === undefined || value === null || String(value) === '') return;
          result.push({
            value,
            label: cleanText(option && typeof option === 'object' ? option.label : value, String(value)),
            description: cleanText(option && typeof option === 'object' ? option.description : ''),
            group: cleanText(entry.label, `分组 ${groupIndex + 1}`),
            id: `g-${groupIndex}-${optionIndex}`,
          });
        });
        return;
      }
      const value = entry && typeof entry === 'object' ? entry.value : entry;
      if (value === undefined || value === null || String(value) === '') return;
      result.push({
        value,
        label: cleanText(entry && typeof entry === 'object' ? entry.label : value, String(value)),
        description: cleanText(entry && typeof entry === 'object' ? entry.description : ''),
        group: cleanText(entry && typeof entry === 'object' ? entry.group : ''),
        id: cleanText(entry && typeof entry === 'object' ? entry.id : '', `o-${result.length}`),
      });
    });
    return result;
  }

  function fieldError(errors, path) {
    const target = pathString(path);
    return (Array.isArray(errors) ? errors : []).find(error => cleanText(error?.path).replace(/\[(\d+)\]/g, '.$1') === target);
  }

  function themeTokens(node) {
    if (!node || typeof getComputedStyle !== 'function') return {};
    const host = node.closest?.('.skill-designer-host') || node;
    const style = getComputedStyle(host);
    return [
      '--sdu-shell',
      '--sdu-surface',
      '--sdu-control',
      '--sdu-popover',
      '--sdu-text',
      '--sdu-muted',
      '--sdu-accent',
      '--sdu-accent-secondary',
      '--sdu-accent-text',
      '--sdu-focus',
      '--sdu-border',
      '--sdu-danger',
      '--sdu-warning',
      '--sdu-success',
      '--sdu-radius',
      '--sdu-font',
      '--sdu-heading-weight',
    ].reduce((tokens, name) => {
      const value = style.getPropertyValue(name).trim();
      if (value) tokens[name] = value;
      return tokens;
    }, {});
  }

  function createComponents(Vue) {
    const {
      Teleport,
      computed,
      defineComponent,
      h,
      nextTick,
      onBeforeUnmount,
      onMounted,
      reactive,
      shallowRef,
      watch,
    } = Vue;

    const SkillCombobox = defineComponent({
      name: 'SkillCombobox',
      props: {
        modelValue: { default: '' },
        options: { type: Array, default: () => [] },
        label: { type: String, default: '选择' },
        placeholder: { type: String, default: '请选择' },
        disabled: Boolean,
        invalid: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const open = shallowRef(false);
        const query = shallowRef('');
        const active = shallowRef(0);
        const trigger = shallowRef(null);
        const search = shallowRef(null);
        const popupStyle = shallowRef({});
        const popupTokens = shallowRef({});
        const items = computed(() => optionList(props.options));
        const filtered = computed(() => {
          const keyword = query.value.trim().toLowerCase();
          if (!keyword) return items.value;
          return items.value.filter(item =>
            `${item.label} ${item.description} ${item.group}`.toLowerCase().includes(keyword),
          );
        });
        const selected = computed(() => items.value.find(item => String(item.value) === String(props.modelValue)));

        function position() {
          const rect = trigger.value?.getBoundingClientRect?.();
          if (!rect) return;
          const width = Math.min(Math.max(rect.width, 260), Math.max(260, window.innerWidth - 24));
          const below = window.innerHeight - rect.bottom;
          popupStyle.value = {
            width: `${width}px`,
            left: `${Math.max(12, Math.min(window.innerWidth - width - 12, rect.left))}px`,
            top: below >= 280 ? `${rect.bottom + 6}px` : 'auto',
            bottom: below >= 280 ? 'auto' : `${window.innerHeight - rect.top + 6}px`,
          };
        }

        function removeListeners() {
          window.removeEventListener('resize', position);
          window.removeEventListener('scroll', position, true);
          document.removeEventListener('pointerdown', outside, true);
        }

        function close(returnFocus = true) {
          if (!open.value) return;
          open.value = false;
          query.value = '';
          removeListeners();
          if (returnFocus) nextTick(() => trigger.value?.focus?.());
        }

        function outside(event) {
          if (!open.value) return;
          const popup = document.getElementById(`${props.instanceId}-popover`);
          if (event.target !== trigger.value && !trigger.value?.contains?.(event.target) && !popup?.contains?.(event.target)) close(false);
        }

        function show() {
          if (props.disabled || open.value) return;
          open.value = true;
          active.value = Math.max(0, items.value.findIndex(item => String(item.value) === String(props.modelValue)));
          popupTokens.value = themeTokens(trigger.value);
          position();
          window.addEventListener('resize', position);
          window.addEventListener('scroll', position, true);
          document.addEventListener('pointerdown', outside, true);
          nextTick(() => search.value?.focus?.());
        }

        function choose(item) {
          emit('update:modelValue', item.value);
          close();
        }

        function keydown(event) {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            close();
            return;
          }
          if (!open.value) {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
              event.preventDefault();
              show();
            }
            return;
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const delta = event.key === 'ArrowDown' ? 1 : -1;
            active.value = (active.value + delta + filtered.value.length) % Math.max(1, filtered.value.length);
          } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            active.value = event.key === 'Home' ? 0 : Math.max(0, filtered.value.length - 1);
          } else if (event.key === 'Enter' && filtered.value[active.value]) {
            event.preventDefault();
            choose(filtered.value[active.value]);
          }
        }

        watch(filtered, () => {
          active.value = 0;
        });
        onBeforeUnmount(removeListeners);

        return {
          active,
          choose,
          close,
          filtered,
          keydown,
          open,
          popupStyle,
          popupTokens,
          query,
          search,
          selected,
          show,
          trigger,
        };
      },
      template: `
        <div class="sdu-combobox">
          <button ref="trigger" type="button" class="sdu-control sdu-combobox-trigger" :class="{ 'is-invalid': invalid }" :disabled="disabled" aria-haspopup="listbox" :aria-expanded="open ? 'true' : 'false'" @click="open ? close() : show()" @keydown="keydown">
            <span :class="{ 'is-placeholder': !selected }">{{ selected?.label || placeholder }}</span>
            <i class="fa-solid fa-angle-down" aria-hidden="true"></i>
          </button>
          <Teleport to="body">
            <section v-if="open" :id="instanceId + '-popover'" class="sdu-popover" :style="[popupStyle, popupTokens]">
              <label class="sdu-popover-search">
                <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                <input ref="search" v-model="query" type="search" :aria-label="'搜索' + label" :aria-activedescendant="filtered[active] ? instanceId + '-option-' + active : undefined" placeholder="搜索选项" @keydown="keydown">
              </label>
              <div class="sdu-option-list" role="listbox" :aria-label="label">
                <template v-for="(item, index) in filtered" :key="item.id">
                  <div v-if="item.group && (index === 0 || filtered[index - 1]?.group !== item.group)" class="sdu-option-group">{{ item.group }}</div>
                  <button :id="instanceId + '-option-' + index" type="button" class="sdu-option" :class="{ 'is-active': index === active, 'is-selected': String(item.value) === String(modelValue) }" role="option" :aria-selected="String(item.value) === String(modelValue) ? 'true' : 'false'" @mouseenter="active = index" @click="choose(item)">
                    <strong>{{ item.label }}</strong>
                    <small v-if="item.description">{{ item.description }}</small>
                  </button>
                </template>
                <div v-if="!filtered.length" class="sdu-popover-empty">
                  <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                  <span>没有匹配项</span>
                </div>
              </div>
            </section>
          </Teleport>
        </div>
      `,
    });

    const SkillMultiSelect = defineComponent({
      name: 'SkillMultiSelect',
      components: { SkillCombobox },
      props: {
        modelValue: { type: Array, default: () => [] },
        options: { type: Array, default: () => [] },
        disabled: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const items = computed(() => optionList(props.options));
        const selected = computed(() => items.value.filter(item => props.modelValue.map(String).includes(String(item.value))));
        const available = computed(() => items.value.filter(item => !props.modelValue.map(String).includes(String(item.value))));
        function add(value) {
          if (value === '' || props.modelValue.map(String).includes(String(value))) return;
          emit('update:modelValue', [...props.modelValue, value]);
        }
        function remove(value) {
          emit('update:modelValue', props.modelValue.filter(item => String(item) !== String(value)));
        }
        return { add, available, remove, selected };
      },
      template: `
        <div class="sdu-multiselect">
          <div v-if="selected.length" class="sdu-tag-list">
            <span v-for="item in selected" :key="String(item.value)" class="sdu-tag">
              <span>{{ item.label }}</span>
              <button type="button" :disabled="disabled" :aria-label="'移除' + item.label" @click="remove(item.value)"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
            </span>
          </div>
          <SkillCombobox :model-value="''" :options="available" :disabled="disabled" label="添加选项" placeholder="搜索并添加" :instance-id="instanceId + '-add'" @update:model-value="add" />
          <small v-if="!selected.length" class="sdu-field-note">尚未选择</small>
        </div>
      `,
    });

    const SkillSegmentedControl = defineComponent({
      name: 'SkillSegmentedControl',
      props: {
        modelValue: { default: '' },
        options: { type: Array, default: () => [] },
        label: { type: String, default: '选项' },
        disabled: Boolean,
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const items = computed(() => optionList(props.options));
        function keydown(event, index) {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.value.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.value.length) % items.value.length;
          emit('update:modelValue', items.value[next]?.value);
          nextTick(() => event.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus?.());
        }
        return { items, keydown };
      },
      template: `
        <div class="sdu-segmented" role="radiogroup" :aria-label="label">
          <button v-for="(item, index) in items" :key="item.id" type="button" role="radio" :aria-checked="String(modelValue) === String(item.value) ? 'true' : 'false'" :tabindex="String(modelValue) === String(item.value) ? 0 : -1" :class="{ 'is-selected': String(modelValue) === String(item.value) }" :disabled="disabled" @click="$emit('update:modelValue', item.value)" @keydown="keydown($event, index)">{{ item.label }}</button>
        </div>
      `,
    });

    const SkillDurationInput = defineComponent({
      name: 'SkillDurationInput',
      props: { modelValue: { default: '' }, label: String, disabled: Boolean },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const parts = reactive({ day: '', hour: '', minute: '' });
        function sync() {
          const total = Math.max(0, Number(props.modelValue) || 0);
          parts.day = Math.floor(total / 1440) || '';
          parts.hour = Math.floor((total % 1440) / 60) || '';
          parts.minute = total % 60 || '';
        }
        function update() {
          const day = Math.max(0, Number(parts.day) || 0);
          const hour = Math.max(0, Math.min(23, Number(parts.hour) || 0));
          const minute = Math.max(0, Math.min(59, Number(parts.minute) || 0));
          emit('update:modelValue', day * 1440 + hour * 60 + minute);
        }
        watch(() => props.modelValue, sync, { immediate: true });
        return { parts, update };
      },
      template: `
        <div class="sdu-duration" role="group" :aria-label="label">
          <label><input v-model="parts.day" type="number" min="0" :disabled="disabled" @input="update"><span>日</span></label>
          <label><input v-model="parts.hour" type="number" min="0" max="23" :disabled="disabled" @input="update"><span>时</span></label>
          <label><input v-model="parts.minute" type="number" min="0" max="59" :disabled="disabled" @input="update"><span>分</span></label>
        </div>
      `,
    });

    const SkillFieldShell = defineComponent({
      name: 'SkillFieldShell',
      components: { SkillCombobox, SkillDurationInput, SkillMultiSelect, SkillSegmentedControl },
      props: {
        field: { type: Object, required: true },
        modelValue: { default: '' },
        error: { type: Object, default: null },
        disabled: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        function update(event) {
          emit('update:modelValue', event?.target ? event.target.value : event);
        }
        function resize(event) {
          const target = event.currentTarget;
          target.style.height = 'auto';
          target.style.height = `${Math.min(Math.max(target.scrollHeight, 150), 520)}px`;
        }
        return { resize, update };
      },
      template: `
        <div class="sdu-field" :class="{ 'sdu-field-wide': field.wide, 'is-invalid': error }" :data-field-path="(field.path || [field.key]).join('.')">
          <div class="sdu-field-heading">
            <label :for="instanceId">{{ field.label }}<span v-if="field.required" aria-hidden="true">*</span></label>
            <span v-if="field.unit">{{ field.unit }}</span>
          </div>
          <SkillSegmentedControl v-if="field.control === 'segmented'" :model-value="modelValue" :options="field.options" :label="field.label" :disabled="disabled" @update:model-value="$emit('update:modelValue', $event)" />
          <SkillCombobox v-else-if="field.control === 'singleEnum'" :model-value="modelValue" :options="field.options" :label="field.label" :placeholder="field.placeholder || '请选择'" :disabled="disabled" :invalid="!!error" :instance-id="instanceId" @update:model-value="$emit('update:modelValue', $event)" />
          <SkillMultiSelect v-else-if="field.control === 'multiEnum'" :model-value="Array.isArray(modelValue) ? modelValue : []" :options="field.options" :disabled="disabled" :instance-id="instanceId" @update:model-value="$emit('update:modelValue', $event)" />
          <SkillDurationInput v-else-if="field.control === 'duration'" :model-value="modelValue" :label="field.label" :disabled="disabled" @update:model-value="$emit('update:modelValue', $event)" />
          <label v-else-if="field.control === 'toggle'" class="sdu-toggle">
            <input :id="instanceId" type="checkbox" :checked="modelValue === true || modelValue === '启用' || modelValue === '是'" :disabled="disabled" @change="$emit('update:modelValue', $event.target.checked)">
            <span aria-hidden="true"></span>
            <strong>{{ modelValue === true || modelValue === '启用' || modelValue === '是' ? '启用' : '关闭' }}</strong>
          </label>
          <div v-else-if="field.control === 'static'" class="sdu-static-value">{{ modelValue || field.defaultValue || '未设置' }}</div>
          <textarea v-else-if="field.control === 'textarea'" :id="instanceId" class="sdu-control sdu-textarea" :value="modelValue" :placeholder="field.placeholder || ''" :disabled="disabled" :aria-required="field.required ? 'true' : 'false'" :aria-invalid="error ? 'true' : 'false'" :aria-describedby="error ? instanceId + '-error' : undefined" @input="update($event); resize($event)" />
          <input v-else :id="instanceId" class="sdu-control" :type="field.control === 'number' ? 'number' : 'text'" :inputmode="field.control === 'numberOrPercent' ? 'decimal' : field.control === 'number' ? 'numeric' : 'text'" :value="modelValue" :placeholder="field.placeholder || ''" :min="field.min" :max="field.max" :step="field.step" :disabled="disabled" :aria-required="field.required ? 'true' : 'false'" :aria-invalid="error ? 'true' : 'false'" :aria-describedby="error ? instanceId + '-error' : undefined" @input="update">
          <small v-if="field.help" class="sdu-field-note">{{ field.help }}</small>
          <small v-if="error" :id="instanceId + '-error'" class="sdu-field-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{{ error.message }}</small>
        </div>
      `,
    });

    const SkillDesignerPageHeader = defineComponent({
      name: 'SkillDesignerPageHeader',
      props: { eyebrow: String, title: String, description: String, errors: Number, dirty: Boolean },
      template: `
        <header class="sdu-page-header">
          <div>
            <span class="sdu-kicker">{{ eyebrow }}</span>
            <h2>{{ title }}</h2>
            <p>{{ description }}</p>
          </div>
          <div class="sdu-page-state">
            <span v-if="errors" class="is-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{{ errors }} 个问题</span>
            <span v-else-if="dirty"><i class="fa-solid fa-circle-dot" aria-hidden="true"></i>有未保存更改</span>
            <span v-else><i class="fa-solid fa-check" aria-hidden="true"></i>当前页已就绪</span>
          </div>
        </header>
      `,
    });

    const SkillFieldSection = defineComponent({
      name: 'SkillFieldSection',
      components: { SkillFieldShell },
      props: {
        title: String,
        subtitle: String,
        fields: { type: Array, default: () => [] },
        draft: { type: Object, required: true },
        errors: { type: Array, default: () => [] },
        disabled: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['patch'],
      setup(props, { emit }) {
        const primary = computed(() => props.fields.filter(field => field.presentation !== 'advanced'));
        const advanced = computed(() => props.fields.filter(field => field.presentation === 'advanced'));
        function patch(field, value) {
          emit('patch', { path: field.path || [field.key], value, dependent: !!field.dependent });
        }
        function error(field) {
          return fieldError(props.errors, field.path || [field.key]);
        }
        function value(field) {
          return getPath(props.draft, field.path || [field.key]) ?? field.defaultValue ?? '';
        }
        return { advanced, error, patch, primary, value };
      },
      template: `
        <section class="sdu-form-section">
          <header class="sdu-section-heading">
            <div><h3>{{ title }}</h3><p v-if="subtitle">{{ subtitle }}</p></div>
            <span>{{ fields.length }} 项</span>
          </header>
          <div class="sdu-field-grid">
            <SkillFieldShell v-for="field in primary" :key="field.id || field.key" :field="field" :model-value="value(field)" :error="error(field)" :disabled="disabled" :instance-id="instanceId + '-' + (field.id || field.key)" @update:model-value="patch(field, $event)" />
          </div>
          <details v-if="advanced.length" class="sdu-advanced">
            <summary><span><i class="fa-solid fa-sliders" aria-hidden="true"></i>高级设置</span><i class="fa-solid fa-angle-down" aria-hidden="true"></i></summary>
            <div class="sdu-field-grid">
              <SkillFieldShell v-for="field in advanced" :key="field.id || field.key" :field="field" :model-value="value(field)" :error="error(field)" :disabled="disabled" :instance-id="instanceId + '-advanced-' + (field.id || field.key)" @update:model-value="patch(field, $event)" />
            </div>
          </details>
        </section>
      `,
    });

    const SkillBasicPanel = defineComponent({
      name: 'SkillBasicPanel',
      components: { SkillFieldSection },
      props: {
        draft: { type: Object, required: true },
        fields: { type: Array, default: () => [] },
        errors: { type: Array, default: () => [] },
        disabled: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['patch'],
      setup(props) {
        const identity = computed(() => props.fields.filter(field => ['name', 'deliveryForm'].includes(field.key)));
        const rules = computed(() => props.fields.filter(field =>
          ['使用限制周期', '使用限制次数', '启用被动', '被动触发', '被动触发周期', '被动触发次数'].includes(field.key),
        ));
        const carrier = computed(() => props.fields.filter(field => !identity.value.includes(field) && !rules.value.includes(field)));
        return { carrier, identity, rules };
      },
      template: `
        <div class="sdu-basic-panel">
          <SkillFieldSection title="技能身份" subtitle="先确定名称与承载方式，后续字段会随承载方式变化。" :fields="identity" :draft="draft" :errors="errors" :disabled="disabled" :instance-id="instanceId + '-identity'" @patch="$emit('patch', $event)" />
          <SkillFieldSection title="施放规则" subtitle="设置使用限制和被动触发方式。" :fields="rules" :draft="draft" :errors="errors" :disabled="disabled" :instance-id="instanceId + '-rules'" @patch="$emit('patch', $event)" />
          <SkillFieldSection v-if="carrier.length" title="承载参数" subtitle="这些参数由当前承载方式或融合方式决定。" :fields="carrier" :draft="draft" :errors="errors" :disabled="disabled" :instance-id="instanceId + '-carrier'" @patch="$emit('patch', $event)" />
        </div>
      `,
    });

    const SkillConditionBuilder = defineComponent({
      name: 'SkillConditionBuilder',
      components: { SkillCombobox, SkillFieldShell, SkillSegmentedControl },
      props: {
        condition: { type: Object, required: true },
        path: { type: Array, required: true },
        index: Number,
        count: Number,
        modelApi: { type: Object, required: true },
        disabled: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['patch', 'remove'],
      setup(props, { emit }) {
        const model = computed(() => props.modelApi.getConditionModel(props.condition || {}));
        const showObject = computed(() => !['目标', '使用者', '当前行动', '环境满足', '时间', '连携前提'].includes(cleanText(props.condition?.类型, '生命比例')));
        function patch(key, value, dependent = false) {
          emit('patch', { path: [...props.path, key], value, dependent });
        }
        return { model, patch, showObject };
      },
      template: `
        <div class="sdu-condition-sentence" :data-field-path="path.join('.')">
          <span class="sdu-sentence-word">{{ index === 0 ? '如果' : '并且' }}</span>
          <div class="sdu-sentence-fields">
            <SkillCombobox :model-value="condition.类型" :options="modelApi.conditionTypeOptions" label="条件类型" :disabled="disabled" :instance-id="instanceId + '-type'" @update:model-value="patch('类型', $event, true)" />
            <SkillCombobox v-if="showObject" :model-value="condition.对象" :options="modelApi.conditionObjectOptions" label="条件对象" :disabled="disabled" :instance-id="instanceId + '-object'" @update:model-value="patch('对象', $event, true)" />
            <SkillSegmentedControl v-if="model.showCompare" :model-value="condition.比较" :options="model.compareOptions" label="比较方式" :disabled="disabled" @update:model-value="patch('比较', $event, true)" />
            <SkillFieldShell v-if="model.valueField" :field="{ ...model.valueField, label: '条件值' }" :model-value="condition[model.valueField.key]" :disabled="disabled" :instance-id="instanceId + '-value'" @update:model-value="patch(model.valueField.key, $event)" />
          </div>
          <button v-if="count > 1" type="button" class="sdu-icon-button is-danger" :disabled="disabled" title="删除条件" aria-label="删除条件" @click="$emit('remove')"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
        </div>
      `,
    });

    const SkillNestedEffect = defineComponent({
      name: 'SkillNestedEffect',
      components: { SkillCombobox, SkillFieldShell },
      props: {
        effect: { type: Object, required: true },
        path: { type: Array, required: true },
        relation: String,
        modelApi: { type: Object, required: true },
        disabled: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['patch', 'remove'],
      setup(props, { emit }) {
        const model = computed(() => props.modelApi.getPrototypeModel(props.effect || {}, { 禁用条件分支: true }));
        const fields = computed(() => model.value.fields.filter(field => !['原型', '条件分支'].includes(field.key)).slice(0, 6));
        function patch(field, value) {
          emit('patch', { path: [...props.path, ...(field.path || [field.key])], value, dependent: !!field.dependent });
        }
        return { fields, model, patch };
      },
      template: `
        <div class="sdu-nested-effect" :data-field-path="path.join('.')">
          <header>
            <span class="sdu-relation">{{ relation }}</span>
            <SkillCombobox :model-value="effect.原型" :options="modelApi.prototypeOptions" label="嵌套原型" :disabled="disabled" :instance-id="instanceId + '-prototype'" @update:model-value="$emit('patch', { path: [...path, '原型'], value: $event, dependent: true })" />
            <button type="button" class="sdu-icon-button is-danger" :disabled="disabled" :title="'删除' + relation" :aria-label="'删除' + relation" @click="$emit('remove')"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
          </header>
          <p>{{ model.summary }}</p>
          <div class="sdu-field-grid sdu-field-grid-compact">
            <SkillFieldShell v-for="field in fields" :key="field.key" :field="field" :model-value="getPath(effect, field.path || [field.key]) ?? field.defaultValue ?? ''" :disabled="disabled" :instance-id="instanceId + '-' + field.key" @update:model-value="patch(field, $event)" />
          </div>
        </div>
      `,
      methods: { getPath },
    });

    const SkillBranchEditor = defineComponent({
      name: 'SkillBranchEditor',
      components: { SkillCombobox, SkillConditionBuilder, SkillNestedEffect },
      props: {
        branch: { type: Object, required: true },
        path: { type: Array, required: true },
        index: Number,
        modelApi: { type: Object, required: true },
        disabled: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['patch', 'structure'],
      setup(props, { emit }) {
        const conditions = computed(() => Array.isArray(props.branch?.条件) ? props.branch.条件 : []);
        const action = computed(() => cleanText(props.branch?.处理, '生效'));
        const effectKey = computed(() => action.value === '追加效果' ? '追加效果' : '替换效果');
        const effects = computed(() => Array.isArray(props.branch?.[effectKey.value]) ? props.branch[effectKey.value] : []);
        return { action, conditions, effectKey, effects, emit };
      },
      template: `
        <section class="sdu-branch">
          <header class="sdu-branch-heading">
            <div><span>条件 {{ index + 1 }}</span><strong>满足条件后如何处理当前效果</strong></div>
            <button type="button" class="sdu-icon-button is-danger" :disabled="disabled" title="删除条件分支" aria-label="删除条件分支" @click="emit('structure', { type: 'remove', path: path.slice(0, -1), index })"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
          </header>
          <div class="sdu-condition-list">
            <SkillConditionBuilder v-for="(condition, conditionIndex) in conditions" :key="conditionIndex" :condition="condition" :path="[...path, '条件', conditionIndex]" :index="conditionIndex" :count="conditions.length" :model-api="modelApi" :disabled="disabled" :instance-id="instanceId + '-condition-' + conditionIndex" @patch="emit('patch', $event)" @remove="emit('structure', { type: 'remove', path: [...path, '条件'], index: conditionIndex })" />
          </div>
          <button type="button" class="sdu-link-button" :disabled="disabled || conditions.length >= 3" @click="emit('structure', { type: 'add-condition', path: [...path, '条件'] })"><i class="fa-solid fa-plus" aria-hidden="true"></i>{{ conditions.length >= 3 ? '已达到 3 个条件上限' : '添加并列条件' }}</button>
          <div class="sdu-outcome-row">
            <span class="sdu-sentence-word">满足后</span>
            <SkillCombobox :model-value="branch.处理" :options="modelApi.conditionActionOptions" label="满足后处理" :disabled="disabled" :instance-id="instanceId + '-action'" @update:model-value="emit('patch', { path: [...path, '处理'], value: $event, dependent: true })" />
          </div>
          <div v-if="action === '追加效果' || action === '替换效果'" class="sdu-nested-list">
            <SkillNestedEffect v-for="(effect, effectIndex) in effects" :key="effectIndex" :effect="effect" :path="[...path, effectKey, effectIndex]" :relation="action" :model-api="modelApi" :disabled="disabled" :instance-id="instanceId + '-nested-' + effectIndex" @patch="emit('patch', $event)" @remove="emit('structure', { type: 'remove', path: [...path, effectKey], index: effectIndex })" />
            <button type="button" class="sdu-link-button" :disabled="disabled || effects.length >= 2" @click="emit('structure', { type: 'add-prototype', path: [...path, effectKey] })"><i class="fa-solid fa-plus" aria-hidden="true"></i>{{ effects.length >= 2 ? '嵌套效果已达到上限' : '添加' + action }}</button>
          </div>
          <div v-else class="sdu-outcome-summary">{{ action === '禁用' ? '条件成立时禁用当前效果。' : '条件成立时保持当前主效果。' }}</div>
        </section>
      `,
    });

    const SkillPrototypeEditor = defineComponent({
      name: 'SkillPrototypeEditor',
      components: { SkillBranchEditor, SkillCombobox, SkillFieldShell },
      props: {
        effect: { type: Object, required: true },
        index: Number,
        count: Number,
        modelApi: { type: Object, required: true },
        errors: { type: Array, default: () => [] },
        disabled: Boolean,
        expanded: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['patch', 'structure', 'toggle'],
      setup(props, { emit }) {
        const path = computed(() => ['prototypeEffects', props.index]);
        const model = computed(() => props.modelApi.getPrototypeModel(props.effect || {}));
        const fields = computed(() => model.value.fields.filter(field => !['原型', '条件分支'].includes(field.key)));
        const branches = computed(() => Array.isArray(props.effect?.条件分支) ? props.effect.条件分支 : []);
        const errorCount = computed(() => (props.errors || []).filter(error => cleanText(error?.path).startsWith(pathString(path.value))).length);
        function patch(field, value) {
          emit('patch', { path: [...path.value, ...(field.path || [field.key])], value, dependent: !!field.dependent });
        }
        function error(field) {
          return fieldError(props.errors, [...path.value, ...(field.path || [field.key])]);
        }
        return { branches, error, errorCount, fields, model, patch, path };
      },
      template: `
        <article class="sdu-prototype" :class="{ 'is-expanded': expanded, 'is-invalid': errorCount }" :data-prototype-path="path.join('.')">
          <header class="sdu-prototype-heading">
            <button type="button" class="sdu-prototype-toggle" :aria-expanded="expanded ? 'true' : 'false'" @click="$emit('toggle')">
              <span class="sdu-prototype-index">{{ String(index + 1).padStart(2, '0') }}</span>
              <span><strong>主效果</strong><small>{{ model.summary || '选择原型后生成摘要' }}</small></span>
              <i :class="expanded ? 'fa-solid fa-angle-up' : 'fa-solid fa-angle-down'" aria-hidden="true"></i>
            </button>
            <SkillCombobox :model-value="effect.原型" :options="modelApi.prototypeOptions" label="原型" :disabled="disabled" :instance-id="instanceId + '-prototype'" @update:model-value="$emit('patch', { path: [...path, '原型'], value: $event, dependent: true })" />
            <div class="sdu-prototype-actions">
              <span v-if="errorCount" class="sdu-error-badge">{{ errorCount }}</span>
              <button v-if="index > 0" type="button" class="sdu-icon-button" :disabled="disabled" title="上移" aria-label="上移原型" @click="$emit('structure', { type: 'move-up', path: ['prototypeEffects'], index })"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
              <button v-if="index < count - 1" type="button" class="sdu-icon-button" :disabled="disabled" title="下移" aria-label="下移原型" @click="$emit('structure', { type: 'move-down', path: ['prototypeEffects'], index })"><i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button>
              <button type="button" class="sdu-icon-button" :disabled="disabled" title="复制" aria-label="复制原型" @click="$emit('structure', { type: 'duplicate', path: ['prototypeEffects'], index })"><i class="fa-solid fa-copy" aria-hidden="true"></i></button>
              <button type="button" class="sdu-icon-button is-danger" :disabled="disabled" title="删除" aria-label="删除原型" @click="$emit('structure', { type: 'remove', path: ['prototypeEffects'], index })"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
            </div>
          </header>
          <div v-if="expanded" class="sdu-prototype-body">
            <div class="sdu-field-grid">
              <SkillFieldShell v-for="field in fields" :key="field.key" :field="field" :model-value="getPath(effect, field.path || [field.key]) ?? field.defaultValue ?? ''" :error="error(field)" :disabled="disabled" :instance-id="instanceId + '-' + field.key" @update:model-value="patch(field, $event)" />
            </div>
            <div v-if="branches.length" class="sdu-branch-list">
              <SkillBranchEditor v-for="(branch, branchIndex) in branches" :key="branchIndex" :branch="branch" :path="[...path, '条件分支', branchIndex]" :index="branchIndex" :model-api="modelApi" :disabled="disabled" :instance-id="instanceId + '-branch-' + branchIndex" @patch="$emit('patch', $event)" @structure="$emit('structure', $event)" />
            </div>
            <button type="button" class="sdu-link-button sdu-add-branch" :disabled="disabled || branches.length >= 3" @click="$emit('structure', { type: 'add-branch', path: [...path, '条件分支'] })"><i class="fa-solid fa-code-branch" aria-hidden="true"></i>{{ branches.length >= 3 ? '已达到 3 个分支上限' : '添加条件分支' }}</button>
          </div>
        </article>
      `,
      methods: { getPath },
    });

    const SkillEffectPanel = defineComponent({
      name: 'SkillEffectPanel',
      components: { SkillFieldShell, SkillPrototypeEditor },
      props: {
        draft: { type: Object, required: true },
        modelApi: { type: Object, required: true },
        errors: { type: Array, default: () => [] },
        disabled: Boolean,
        expanded: { type: Object, required: true },
        instanceId: { type: String, required: true },
      },
      emits: ['patch', 'structure', 'toggle', 'collapse-all', 'expand-errors'],
      setup(props, { emit }) {
        const effects = computed(() => Array.isArray(props.draft?.prototypeEffects) ? props.draft.prototypeEffects : []);
        const sideEffects = computed(() => Array.isArray(props.draft?.副作用列表) ? props.draft.副作用列表 : []);
        const canAdd = computed(() => effects.value.length < Number(props.modelApi.prototypeLimit || 6));
        function sideFields(item) {
          return props.modelApi.getSideEffectModel(item || {}).fields;
        }
        return { canAdd, effects, emit, sideEffects, sideFields };
      },
      template: `
        <div class="sdu-effect-panel">
          <div class="sdu-canvas-tools">
            <div><strong>效果编排</strong><span>{{ effects.length }} / {{ modelApi.prototypeLimit }} 个一级原型</span></div>
            <div>
              <button type="button" class="sdu-link-button" :disabled="disabled" @click="$emit('collapse-all')"><i class="fa-solid fa-compress" aria-hidden="true"></i>折叠全部</button>
              <button type="button" class="sdu-link-button" :disabled="disabled" @click="$emit('expand-errors')"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>仅展开错误</button>
              <button type="button" class="sdu-button is-primary" :disabled="disabled || !canAdd" @click="$emit('structure', { type: 'add-prototype', path: ['prototypeEffects'] })"><i class="fa-solid fa-plus" aria-hidden="true"></i>{{ canAdd ? '新增原型' : '已达到上限' }}</button>
            </div>
          </div>
          <div v-if="!effects.length" class="sdu-empty-state">
            <span class="sdu-empty-index">00</span>
            <div><strong>还没有效果原型</strong><p>从一个主效果开始，再按需要添加条件、追加或替换效果。</p></div>
            <button type="button" class="sdu-button is-primary" :disabled="disabled || !canAdd" @click="$emit('structure', { type: 'add-prototype', path: ['prototypeEffects'] })"><i class="fa-solid fa-plus" aria-hidden="true"></i>新增第一个原型</button>
          </div>
          <div v-else class="sdu-prototype-list">
            <SkillPrototypeEditor v-for="(effect, index) in effects" :key="index" :effect="effect" :index="index" :count="effects.length" :model-api="modelApi" :errors="errors" :disabled="disabled" :expanded="expanded[index] !== false" :instance-id="instanceId + '-prototype-' + index" @patch="$emit('patch', $event)" @structure="$emit('structure', $event)" @toggle="$emit('toggle', index)" />
          </div>
          <section class="sdu-side-effects">
            <header class="sdu-section-heading">
              <div><h3>副作用</h3><p>把技能附带的代价放在效果链之后，不与主效果混在一起。</p></div>
              <button type="button" class="sdu-link-button" :disabled="disabled" @click="$emit('structure', { type: 'add-side-effect', path: ['副作用列表'] })"><i class="fa-solid fa-plus" aria-hidden="true"></i>添加副作用</button>
            </header>
            <p v-if="!sideEffects.length" class="sdu-empty-line">当前没有副作用。</p>
            <article v-for="(item, index) in sideEffects" :key="index" class="sdu-side-effect">
              <header><strong>副作用 {{ index + 1 }}</strong><button type="button" class="sdu-icon-button is-danger" :disabled="disabled" title="删除副作用" aria-label="删除副作用" @click="$emit('structure', { type: 'remove', path: ['副作用列表'], index })"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></header>
              <div class="sdu-field-grid">
                <SkillFieldShell v-for="field in sideFields(item)" :key="field.key" :field="field" :model-value="getPath(item, field.path || [field.key]) ?? field.defaultValue ?? ''" :disabled="disabled" :instance-id="instanceId + '-side-' + index + '-' + field.key" @update:model-value="$emit('patch', { path: ['副作用列表', index, ...(field.path || [field.key])], value: $event, dependent: !!field.dependent })" />
              </div>
            </article>
          </section>
        </div>
      `,
      methods: { getPath },
    });

    const SkillCostLedger = defineComponent({
      name: 'SkillCostLedger',
      props: { result: { type: Object, required: true } },
      emits: ['locate'],
      setup(props) {
        const budget = computed(() => props.result?.preview?.budget || {});
        const resources = computed(() => Array.isArray(props.result?.preview?.resourceRows) ? props.result.preview.resourceRows : []);
        const effects = computed(() => Array.isArray(props.result?.preview?.effectRows) ? props.result.preview.effectRows : []);
        const rows = computed(() => [
          ...resources.value.map((row, index) => ({
            ...row,
            key: `resource-${index}`,
            source: row.label || row.source || '资源代价',
            formula: row.detail || row.formula || '资源参数',
            value: row.value ?? row.cost ?? '—',
          })),
          ...effects.value.map((row, index) => ({
            ...row,
            key: `effect-${index}`,
            source: `${row.branchLabel ? `${row.branchLabel} / ` : ''}${row.title || '效果原型'}`,
            formula: [row.relation || '主效果', row.conditionSummary].filter(Boolean).join(' · '),
            value: row.cost ?? '—',
          })),
        ]);
        return { budget, rows };
      },
      template: `
        <section class="sdu-ledger">
          <header class="sdu-ledger-summary">
            <div><span>复杂度预算</span><strong>{{ budget.actual ?? '—' }}</strong></div>
            <div><span>预算上限</span><strong>{{ budget.limit ?? '—' }}</strong></div>
            <div :class="{ 'is-danger': budget.ok === false }"><span>{{ budget.ok === false ? '超出' : '剩余' }}</span><strong>{{ budget.actual !== undefined && budget.limit !== undefined ? Math.abs(Number(budget.limit) - Number(budget.actual)).toFixed(1) : '—' }}</strong></div>
          </header>
          <div class="sdu-ledger-table">
            <div class="sdu-ledger-head"><span>来源</span><span>计算说明</span><span>数值</span></div>
            <button v-for="row in rows" :key="row.key" type="button" class="sdu-ledger-row" @click="$emit('locate', row)">
              <strong>{{ row.source }}</strong><span>{{ row.formula || '—' }}</span><b>{{ row.value }}</b>
            </button>
            <div v-if="!rows.length" class="sdu-empty-line">当前编译结果没有提供可拆分的账单来源。</div>
            <div class="sdu-ledger-total"><span>总计</span><strong>{{ budget.label || '待评估' }}</strong><em :class="{ 'is-danger': budget.ok === false }">{{ budget.ok === false ? '预算超限' : '预算内' }}</em></div>
          </div>
        </section>
      `,
    });

    const SkillCostPanel = defineComponent({
      name: 'SkillCostPanel',
      components: { SkillCostLedger, SkillFieldSection },
      props: {
        draft: { type: Object, required: true },
        fields: { type: Array, default: () => [] },
        result: { type: Object, required: true },
        errors: { type: Array, default: () => [] },
        disabled: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['patch', 'locate'],
      setup(props) {
        const resource = computed(() => props.fields.filter(field => field.key === 'costType' || String(field.key).startsWith('cost-') || String(field.key).startsWith('sustain-')));
        const timing = computed(() => props.fields.filter(field => !resource.value.includes(field)));
        return { resource, timing };
      },
      template: `
        <div class="sdu-cost-panel">
          <SkillFieldSection title="资源代价" subtitle="设置技能启动和维持时的真实资源消耗。" :fields="resource" :draft="draft" :errors="errors" :disabled="disabled" :instance-id="instanceId + '-resource'" @patch="$emit('patch', $event)" />
          <SkillFieldSection title="时间与成长" subtitle="设置施放前摇、掌控度成长和附带属性。" :fields="timing" :draft="draft" :errors="errors" :disabled="disabled" :instance-id="instanceId + '-timing'" @patch="$emit('patch', $event)" />
          <SkillCostLedger :result="result" @locate="$emit('locate', $event)" />
        </div>
      `,
    });

    const SkillDescriptionReference = defineComponent({
      name: 'SkillDescriptionReference',
      props: { result: { type: Object, required: true }, draft: { type: Object, required: true } },
      emits: ['patch'],
      setup(props, { emit }) {
        const reference = computed(() => cleanText(props.result?.preview?.summary || props.result?.preview?.description || props.result?.preview?.effectText, '当前编译结果尚未生成自动参考文案。'));
        const hasManual = computed(() => !!cleanText(props.draft?.effectDesc));
        const confirmRestore = shallowRef(false);
        function restore() {
          if (!confirmRestore.value) {
            confirmRestore.value = true;
            return;
          }
          emit('patch', { path: ['effectDesc'], value: reference.value, dependent: false });
          confirmRestore.value = false;
        }
        return { confirmRestore, hasManual, reference, restore };
      },
      template: `
        <section class="sdu-description-reference">
          <header class="sdu-section-heading">
            <div><h3>自动参考</h3><p>这段内容来自当前编译结果，只用于帮助核对最终描述。</p></div>
            <span :class="{ 'is-manual': hasManual }">{{ hasManual ? '已手动修改' : '自动参考' }}</span>
          </header>
          <blockquote>{{ reference }}</blockquote>
          <footer>
            <span v-if="confirmRestore">恢复后会替换当前效果描述。</span>
            <button type="button" class="sdu-link-button" @click="restore"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i>{{ confirmRestore ? '确认恢复' : '恢复自动文案' }}</button>
            <button v-if="confirmRestore" type="button" class="sdu-link-button" @click="confirmRestore = false">取消</button>
          </footer>
        </section>
      `,
    });

    const SkillDescriptionPanel = defineComponent({
      name: 'SkillDescriptionPanel',
      components: { SkillDescriptionReference, SkillFieldSection },
      props: {
        draft: { type: Object, required: true },
        fields: { type: Array, default: () => [] },
        result: { type: Object, required: true },
        errors: { type: Array, default: () => [] },
        disabled: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['patch'],
      setup(props) {
        const textFields = computed(() => props.fields.filter(field => ['visualDesc', 'effectDesc'].includes(field.key)));
        const progressFields = computed(() => props.fields.filter(field => !textFields.value.includes(field)));
        return { progressFields, textFields };
      },
      template: `
        <div class="sdu-description-panel">
          <SkillDescriptionReference :result="result" :draft="draft" @patch="$emit('patch', $event)" />
          <SkillFieldSection title="最终描述" subtitle="这里的内容会作为技能正式描述保存。" :fields="textFields" :draft="draft" :errors="errors" :disabled="disabled" :instance-id="instanceId + '-text'" @patch="$emit('patch', $event)" />
          <SkillFieldSection v-if="progressFields.length" title="功法进度" subtitle="仅显示当前正式结构中真实存在的功法字段。" :fields="progressFields" :draft="draft" :errors="errors" :disabled="disabled" :instance-id="instanceId + '-progress'" @patch="$emit('patch', $event)" />
        </div>
      `,
    });

    const SkillDesignerToolbar = defineComponent({
      name: 'SkillDesignerToolbar',
      components: { SkillCombobox },
      props: {
        title: String,
        subtitle: String,
        previewKey: String,
        switchItems: { type: Array, default: () => [] },
        status: String,
        dirty: Boolean,
        busy: Boolean,
        canUndo: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['switch-skill', 'reload', 'undo'],
      setup(props, { emit }) {
        const options = computed(() => props.switchItems.map(item => ({
          value: item.preview,
          label: item.label || item.skillName || item.title || '未命名技能',
          description: item.active ? '当前技能' : '',
        })));
        return { emit, options };
      },
      template: `
        <header class="sdu-toolbar">
          <div class="sdu-context">
            <span class="sdu-kicker">魂技设计台</span>
            <h1>{{ title || '未命名技能' }}</h1>
            <p><span>{{ subtitle || '技能' }}</span><b :class="{ 'is-dirty': dirty }">{{ status }}</b></p>
          </div>
          <div class="sdu-toolbar-actions">
            <SkillCombobox v-if="options.length > 1" :model-value="previewKey" :options="options" label="切换技能" placeholder="切换技能" :disabled="busy" :instance-id="instanceId + '-switch'" @update:model-value="$emit('switch-skill', $event)" />
            <button type="button" class="sdu-icon-button" :disabled="busy || !canUndo" title="撤销上一次结构操作" aria-label="撤销上一次结构操作" @click="$emit('undo')"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button>
            <button type="button" class="sdu-button" :disabled="busy" @click="$emit('reload')"><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>重新读取</button>
          </div>
        </header>
      `,
    });

    const SkillDesignerTabs = defineComponent({
      name: 'SkillDesignerTabs',
      props: {
        tabs: { type: Array, required: true },
        active: String,
        errors: { type: Object, required: true },
        dirty: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['update:active'],
      setup(props, { emit }) {
        function keydown(event, index) {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? props.tabs.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + props.tabs.length) % props.tabs.length;
          emit('update:active', props.tabs[next].id);
          nextTick(() => document.getElementById(`${props.instanceId}-tab-${props.tabs[next].id}`)?.focus?.());
        }
        return { keydown };
      },
      template: `
        <nav class="sdu-tabs" role="tablist" aria-label="技能设计步骤">
          <button v-for="(tab, index) in tabs" :id="instanceId + '-tab-' + tab.id" :key="tab.id" type="button" role="tab" :aria-selected="active === tab.id ? 'true' : 'false'" :tabindex="active === tab.id ? 0 : -1" :class="{ 'is-active': active === tab.id, 'is-invalid': errors[tab.id] }" @click="$emit('update:active', tab.id)" @keydown="keydown($event, index)">
            <span>{{ tab.label }}</span>
            <b v-if="errors[tab.id]">{{ errors[tab.id] }}</b>
            <i v-else-if="dirty" class="fa-solid fa-circle" aria-hidden="true"></i>
          </button>
        </nav>
      `,
    });

    const SkillDesignerStatusDock = defineComponent({
      name: 'SkillDesignerStatusDock',
      props: {
        status: String,
        budget: String,
        warnings: Number,
        errors: Number,
        dirty: Boolean,
        disabled: Boolean,
      },
      emits: ['save'],
      template: `
        <footer class="sdu-status-dock">
          <div class="sdu-status-primary" :class="{ 'is-error': errors, 'is-warning': warnings && !errors, 'is-success': !errors && !warnings }">
            <span aria-hidden="true"></span><strong>{{ status }}</strong>
          </div>
          <div class="sdu-status-budget"><span>复杂度预算</span><b>{{ budget }}</b></div>
          <div class="sdu-status-detail"><span v-if="errors">{{ errors }} 个问题</span><span v-else-if="warnings">{{ warnings }} 条警告</span><span v-else>{{ dirty ? '等待保存' : '没有警告' }}</span></div>
          <button type="button" class="sdu-button is-primary sdu-save-button" :disabled="disabled || errors > 0" @click="$emit('save')"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>保存设计</button>
        </footer>
      `,
    });

    const SkillDesignerApp = defineComponent({
      name: 'SkillDesignerApp',
      components: {
        SkillBasicPanel,
        SkillCostPanel,
        SkillDescriptionPanel,
        SkillDesignerPageHeader,
        SkillDesignerStatusDock,
        SkillDesignerTabs,
        SkillDesignerToolbar,
        SkillEffectPanel,
      },
      props: { context: { type: Object, required: true }, instanceId: { type: String, required: true } },
      setup(props) {
        const rawDraft = reactive(clone(props.context.initialRawDraft) || {});
        const active = shallowRef('basic');
        const revision = shallowRef(0);
        const busy = shallowRef(false);
        const dirty = shallowRef(!!props.context.initialDirty);
        const result = shallowRef({ preview: {}, errors: [], warnings: [], transformations: [] });
        const status = shallowRef(dirty.value ? '已恢复草稿' : '未修改');
        const live = shallowRef('');
        const undoRecord = shallowRef(null);
        const destroyed = shallowRef(false);
        const operationToken = shallowRef(0);
        const previewToken = shallowRef(0);
        const expanded = reactive({});
        let cacheTimer = 0;
        let compileTimer = 0;
        let skipCache = false;

        const tabs = Object.freeze([
          { id: 'basic', label: '基础' },
          { id: 'effect', label: '效果' },
          { id: 'cost', label: '消耗' },
          { id: 'description', label: '描述' },
        ]);
        const pageMeta = computed(() => ({
          basic: { eyebrow: '01 / 建立身份', title: '基础', description: '先确定技能是什么、以什么方式存在，以及哪些附加参数会因此出现。' },
          effect: { eyebrow: '02 / 编排机制', title: '效果', description: '先建立主效果，再按需要添加条件、追加或替换效果。' },
          cost: { eyebrow: '03 / 核对预算', title: '消耗', description: '调整资源和时间参数，并核对复杂度预算的完整组成。' },
          description: { eyebrow: '04 / 完成卷面', title: '描述', description: '参考编译结果，编辑最终会保存的画面和效果描述。' },
        }[active.value]));
        const fields = computed(() => ({
          basic: props.context.editorModel.getTabFields('basic', rawDraft),
          cost: props.context.editorModel.getTabFields('cost', rawDraft),
          description: props.context.editorModel.getTabFields('description', rawDraft),
        }));
        const errorCounts = computed(() => {
          const counts = { basic: 0, effect: 0, cost: 0, description: 0 };
          (result.value.errors || []).forEach(error => {
            const tab = counts[error?.tab] === undefined ? 'effect' : error.tab;
            counts[tab] += 1;
          });
          return counts;
        });
        const budget = computed(() => result.value?.preview?.budget?.label || '待评估');

        function markChanged(message = '有未保存更改') {
          dirty.value = true;
          status.value = message;
          revision.value += 1;
          previewToken.value += 1;
        }

        function patch(change) {
          if (busy.value || !Array.isArray(change?.path)) return;
          if (change.dependent) {
            const next = props.context.actions.applyDependentFieldChange(clone(rawDraft), clone(change));
            replaceObject(rawDraft, next);
            live.value = '已更新相关字段，并清理不再适用的值。';
          } else {
            setPath(rawDraft, change.path, clone(change.value));
          }
          markChanged();
        }

        function arrayAt(path) {
          let list = getPath(rawDraft, path);
          if (!Array.isArray(list)) {
            list = [];
            setPath(rawDraft, path, list);
          }
          return list;
        }

        function structure(command) {
          if (busy.value || !Array.isArray(command?.path)) return;
          const list = arrayAt(command.path);
          const index = Number(command.index);
          undoRecord.value = { path: [...command.path], value: clone(list) };
          if (command.type === 'add-prototype') {
            const nested = command.path.some(part => typeof part === 'number');
            const limit = nested ? 2 : Number(props.context.editorModel.prototypeLimit || 6);
            if (list.length >= limit) return;
            list.push(props.context.actions.createPrototype({ draft: clone(rawDraft) }));
            if (!nested) expanded[list.length - 1] = true;
          } else if (command.type === 'add-branch' || command.type === 'add-condition') {
            if (list.length >= 3) return;
            list.push(command.type === 'add-branch' ? props.context.editorModel.createConditionBranch() : props.context.editorModel.createCondition());
          } else if (command.type === 'add-side-effect') {
            list.push(props.context.editorModel.createSideEffect());
          } else if (['remove', 'move-up', 'move-down', 'duplicate'].includes(command.type)) {
            if (index < 0 || index >= list.length) return;
            if (command.type === 'remove') list.splice(index, 1);
            if (command.type === 'move-up' && index > 0) [list[index - 1], list[index]] = [list[index], list[index - 1]];
            if (command.type === 'move-down' && index < list.length - 1) [list[index + 1], list[index]] = [list[index], list[index + 1]];
            if (command.type === 'duplicate') list.splice(index + 1, 0, clone(list[index]));
          } else {
            undoRecord.value = null;
            return;
          }
          markChanged();
          live.value = command.type === 'remove' ? '已删除，可撤销上一次结构操作。' : '结构已更新。';
          nextTick(() => {
            if (command.type === 'add-prototype' && command.path.length === 1) {
              document.getElementById(props.instanceId)?.querySelector(`[data-prototype-path="prototypeEffects.${list.length - 1}"] .sdu-combobox-trigger`)?.focus?.();
            }
          });
        }

        function undo() {
          if (!undoRecord.value || busy.value) return;
          setPath(rawDraft, undoRecord.value.path, clone(undoRecord.value.value));
          undoRecord.value = null;
          markChanged();
          live.value = '已撤销上一次结构操作。';
        }

        function locate(item = {}) {
          active.value = ['basic', 'effect', 'cost', 'description'].includes(item.tab) ? item.tab : 'effect';
          live.value = item.message || '已定位到相关设置。';
          nextTick(() => {
            const root = document.getElementById(props.instanceId);
            const path = cleanText(item.path).replace(/"/g, '\\"');
            const target = root?.querySelector(`[data-field-path="${path}"], [data-prototype-path="${path}"]`);
            target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
            target?.querySelector?.('input, textarea, button')?.focus?.();
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
          if (dirty.value) props.context.actions.cacheDraft(clone(rawDraft));
        }

        async function compile() {
          const token = ++previewToken.value;
          status.value = '正在校验';
          try {
            const next = await Promise.resolve(props.context.actions.compileDraft(clone(rawDraft), { dryRun: true }));
            if (destroyed.value || token !== previewToken.value) return;
            result.value = next || result.value;
            status.value = result.value.errors?.length
              ? '存在错误'
              : result.value.warnings?.length
                ? '存在警告'
                : dirty.value
                  ? '有未保存更改'
                  : '校验通过';
          } catch (error) {
            if (destroyed.value || token !== previewToken.value) return;
            result.value = { ...result.value, errors: [{ tab: 'effect', path: '', message: error?.message || '校验失败。' }] };
            status.value = '存在错误';
          }
        }

        function schedule() {
          clearTimers();
          if (dirty.value) cacheTimer = window.setTimeout(flushCache, 150);
          compileTimer = window.setTimeout(compile, 100);
        }

        function focusFirstError(next) {
          const error = next?.errors?.[0];
          if (!error) return;
          locate(error);
        }

        async function save() {
          if (busy.value) return;
          clearTimers();
          flushCache();
          busy.value = true;
          status.value = '正在保存';
          skipCache = true;
          const token = ++operationToken.value;
          try {
            const saved = await Promise.resolve(props.context.actions.saveCompiledDraft(clone(rawDraft)));
            if (destroyed.value || token !== operationToken.value) return;
            result.value = saved?.compileResult || saved || result.value;
            if (result.value.errors?.length) {
              status.value = '保存失败';
              skipCache = false;
              focusFirstError(result.value);
              return;
            }
            dirty.value = false;
            undoRecord.value = null;
            skipCache = false;
            status.value = '保存成功';
            live.value = saved?.message || '技能设计已保存。';
          } catch (error) {
            if (destroyed.value || token !== operationToken.value) return;
            skipCache = false;
            result.value = error?.compileResult || {
              ...result.value,
              errors: [{ tab: error?.tab || 'effect', path: error?.path || '', message: error?.message || '保存失败。' }],
            };
            status.value = '保存失败';
            focusFirstError(result.value);
          } finally {
            if (!destroyed.value && token === operationToken.value) busy.value = false;
          }
        }

        async function reload() {
          if (busy.value) return;
          if (dirty.value && !window.confirm('当前设计尚未保存，确定重新读取吗？')) return;
          clearTimers();
          busy.value = true;
          status.value = '正在重新读取';
          const token = ++operationToken.value;
          try {
            const next = await Promise.resolve(props.context.actions.reloadDraft());
            if (destroyed.value || token !== operationToken.value || !next) return;
            replaceObject(rawDraft, next);
            dirty.value = false;
            undoRecord.value = null;
            revision.value += 1;
            status.value = '未修改';
          } catch (error) {
            if (!destroyed.value && token === operationToken.value) status.value = '重新读取失败';
          } finally {
            if (!destroyed.value && token === operationToken.value) busy.value = false;
          }
        }

        function switchSkill(previewKey) {
          if (busy.value || !previewKey || previewKey === props.context.previewKey) return;
          flushCache();
          props.context.actions.switchSkill(previewKey);
        }

        function collapseAll() {
          const list = Array.isArray(rawDraft.prototypeEffects) ? rawDraft.prototypeEffects : [];
          list.forEach((_, index) => {
            expanded[index] = false;
          });
        }

        function expandErrors() {
          const list = Array.isArray(rawDraft.prototypeEffects) ? rawDraft.prototypeEffects : [];
          list.forEach((_, index) => {
            expanded[index] = (result.value.errors || []).some(error => cleanText(error?.path).startsWith(`prototypeEffects.${index}`));
          });
        }

        watch(revision, schedule, { flush: 'post' });
        onMounted(() => {
          const list = Array.isArray(rawDraft.prototypeEffects) ? rawDraft.prototypeEffects : [];
          list.forEach((_, index) => {
            expanded[index] = index === 0;
          });
          compile();
        });
        onBeforeUnmount(() => {
          destroyed.value = true;
          operationToken.value += 1;
          previewToken.value += 1;
          if (dirty.value && !skipCache) props.context.actions.cacheDraft(clone(rawDraft));
          clearTimers();
        });

        return {
          active,
          budget,
          busy,
          collapseAll,
          dirty,
          errorCounts,
          expandErrors,
          expanded,
          fields,
          live,
          locate,
          pageMeta,
          patch,
          rawDraft,
          reload,
          result,
          save,
          status,
          structure,
          switchSkill,
          tabs,
          undo,
          undoRecord,
        };
      },
      template: `
        <div :id="instanceId" class="sdu-root" data-skill-designer-layout="layout-skeleton-v1" :aria-busy="busy ? 'true' : 'false'">
          <SkillDesignerToolbar :title="rawDraft.name || context.previewMeta.label || '未命名技能'" :subtitle="context.previewMeta.category || context.previewMeta.scope || ''" :preview-key="context.previewKey" :switch-items="context.switchItems" :status="status" :dirty="dirty" :busy="busy" :can-undo="!!undoRecord" :instance-id="instanceId" @switch-skill="switchSkill" @reload="reload" @undo="undo" />
          <SkillDesignerTabs :tabs="tabs" :active="active" :errors="errorCounts" :dirty="dirty" :instance-id="instanceId" @update:active="active = $event" />
          <div v-if="busy" class="sdu-busy" role="status"><i class="fa-solid fa-spinner" aria-hidden="true"></i>{{ status }}</div>
          <main class="sdu-page-canvas">
            <SkillDesignerPageHeader :eyebrow="pageMeta.eyebrow" :title="pageMeta.title" :description="pageMeta.description" :errors="errorCounts[active]" :dirty="dirty" />
            <section class="sdu-page" role="tabpanel" :id="instanceId + '-panel-' + active" :aria-labelledby="instanceId + '-tab-' + active">
              <SkillBasicPanel v-if="active === 'basic'" :draft="rawDraft" :fields="fields.basic" :errors="result.errors" :disabled="busy" :instance-id="instanceId + '-basic'" @patch="patch" />
              <SkillEffectPanel v-else-if="active === 'effect'" :draft="rawDraft" :model-api="context.editorModel" :errors="result.errors" :disabled="busy" :expanded="expanded" :instance-id="instanceId + '-effect'" @patch="patch" @structure="structure" @toggle="expanded[$event] = expanded[$event] === false" @collapse-all="collapseAll" @expand-errors="expandErrors" />
              <SkillCostPanel v-else-if="active === 'cost'" :draft="rawDraft" :fields="fields.cost" :result="result" :errors="result.errors" :disabled="busy" :instance-id="instanceId + '-cost'" @patch="patch" @locate="locate" />
              <SkillDescriptionPanel v-else :draft="rawDraft" :fields="fields.description" :result="result" :errors="result.errors" :disabled="busy" :instance-id="instanceId + '-description'" @patch="patch" />
            </section>
            <div class="sdu-bottom-clearance" aria-hidden="true"></div>
          </main>
          <div v-if="undoRecord" class="sdu-undo-toast" role="status">
            <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
            <span>{{ live || '结构已更新，可以撤销上一次操作。' }}</span>
            <button type="button" class="sdu-link-button" :disabled="busy" @click="undo">撤销</button>
          </div>
          <SkillDesignerStatusDock :status="status" :budget="budget" :warnings="result.warnings?.length || 0" :errors="result.errors?.length || 0" :dirty="dirty" :disabled="busy" @save="save" />
          <div class="sdu-live" aria-live="assertive">{{ live }}</div>
        </div>
      `,
    });

    return { SkillDesignerApp };
  }

  function mount(host, context) {
    if (!host || host.nodeType !== 1) throw new Error('技能设计器缺少有效挂载节点。');
    if (!context?.actions || !context.editorModel) throw new Error('技能设计器上下文不完整。');
    const Vue = getVue();
    if (!Vue) throw new Error('Vue 3.5 运行时未就绪。');
    const previous = host.getAttribute('data-sdu-mounted');
    if (previous && mounted.has(previous)) mounted.get(previous).destroy();
    const id = `sdu-${Date.now()}-${++instanceSeed}`;
    const { SkillDesignerApp } = createComponents(Vue);
    const app = Vue.createApp({ render: () => Vue.h(SkillDesignerApp, { context, instanceId: id }) });
    const controller = {
      destroy() {
        if (!mounted.has(id)) return;
        mounted.delete(id);
        try {
          app.unmount();
        } finally {
          host.replaceChildren();
          host.removeAttribute('data-sdu-mounted');
        }
      },
    };
    host.replaceChildren();
    host.setAttribute('data-sdu-mounted', id);
    app.mount(host);
    mounted.set(id, controller);
    return controller;
  }

  function destroyAll() {
    Array.from(mounted.values()).forEach(controller => {
      try {
        controller.destroy();
      } catch (error) {}
    });
    mounted.clear();
  }

  globalThis.__LWCS_SKILL_DESIGNER_UI__ = Object.freeze({
    apiVersion: API_VERSION,
    mount,
    destroyAll,
  });
})();
