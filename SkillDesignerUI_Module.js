(function () {
  'use strict';

  const API_VERSION = 2;
  const mounted = new Map();
  let seed = 0;

  function vueRuntime() {
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

  function text(value, fallback = '') {
    const result = value === undefined || value === null ? '' : String(value).trim();
    return result || fallback;
  }

  function pathKey(path) {
    return (Array.isArray(path) ? path : []).map(part => String(part)).join('.');
  }

  function getPath(root, path) {
    return (Array.isArray(path) ? path : []).reduce(
      (value, part) => (value && typeof value === 'object' ? value[part] : undefined),
      root,
    );
  }

  function setPath(root, path, value) {
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

  function replaceObject(target, value) {
    Object.keys(target).forEach(key => delete target[key]);
    Object.assign(target, clone(value) || {});
  }

  function flattenOptions(options) {
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
            id: `group-${groupIndex}-${optionIndex}`,
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
        id: text(entry && typeof entry === 'object' ? entry.id : '', `option-${result.length}`),
      });
    });
    return result;
  }

  function readThemeTokens(node) {
    if (!node || typeof getComputedStyle !== 'function') return {};
    const source = node.closest?.('.skill-designer-host') || node;
    const style = getComputedStyle(source);
    return [
      '--sdv-shell',
      '--sdv-editor',
      '--sdv-control',
      '--sdv-popover',
      '--sdv-text',
      '--sdv-muted',
      '--sdv-accent',
      '--sdv-accent-2',
      '--sdv-accent-text',
      '--sdv-focus',
      '--sdv-border',
      '--sdv-danger',
      '--sdv-warning',
      '--sdv-success',
      '--sdv-radius',
      '--sdv-font',
      '--sdv-heading-weight',
    ].reduce((tokens, name) => {
      const value = style.getPropertyValue(name).trim();
      if (value) tokens[name] = value;
      return tokens;
    }, {});
  }

  function createComponents(Vue) {
    const {
      computed,
      defineComponent,
      nextTick,
      onBeforeUnmount,
      onMounted,
      reactive,
      shallowRef,
      watch,
    } = Vue;

    const Combobox = defineComponent({
      name: 'SkillCombobox',
      props: {
        modelValue: { default: '' },
        options: { type: Array, default: () => [] },
        label: { type: String, default: '选择' },
        disabled: Boolean,
        instanceId: { type: String, required: true },
        invalid: Boolean,
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const open = shallowRef(false);
        const query = shallowRef('');
        const active = shallowRef(0);
        const trigger = shallowRef(null);
        const search = shallowRef(null);
        const items = computed(() => flattenOptions(props.options));
        const filtered = computed(() => {
          const keyword = query.value.toLowerCase();
          return keyword
            ? items.value.filter(item => `${item.label} ${item.description} ${item.group}`.toLowerCase().includes(keyword))
            : items.value;
        });
        const selected = computed(() => items.value.find(item => String(item.value) === String(props.modelValue)));
        const popupStyle = shallowRef({});
        const popupTokens = shallowRef({});
        let themeObserver = null;
        function position() {
          const rect = trigger.value?.getBoundingClientRect?.();
          if (!rect) return;
          popupStyle.value = {
            top: `${Math.min(window.innerHeight - 16, rect.bottom + 6)}px`,
            left: `${Math.max(12, Math.min(window.innerWidth - 340, rect.left))}px`,
            width: `${Math.max(220, Math.min(340, rect.width))}px`,
          };
        }
        function close(returnFocus = true) {
          open.value = false;
          query.value = '';
          if (returnFocus) nextTick(() => trigger.value?.focus?.());
        }
        function toggle() {
          if (props.disabled) return;
          open.value = !open.value;
          if (open.value) {
            popupTokens.value = readThemeTokens(trigger.value);
            position();
            nextTick(() => search.value?.focus?.());
          }
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
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggle();
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
        function outside(event) {
          if (!open.value) return;
          const target = event.target;
          if (target !== trigger.value && !target.closest?.(`#${props.instanceId}-popup`)) close(false);
        }
        function onScroll() {
          if (open.value) position();
        }
        watch(filtered, () => {
          active.value = 0;
        });
        onMounted(() => {
          document.addEventListener('pointerdown', outside, true);
          window.addEventListener('resize', onScroll);
          window.addEventListener('scroll', onScroll, true);
          if (document.body && typeof MutationObserver === 'function') {
            themeObserver = new MutationObserver(() => {
              if (open.value) close();
            });
            themeObserver.observe(document.body, {
              attributes: true,
              attributeFilter: ['class', 'data-mvu-holo-theme', 'data-holo-theme'],
            });
          }
        });
        onBeforeUnmount(() => {
          document.removeEventListener('pointerdown', outside, true);
          window.removeEventListener('resize', onScroll);
          window.removeEventListener('scroll', onScroll, true);
          themeObserver?.disconnect?.();
          themeObserver = null;
        });
        return { active, choose, close, filtered, keydown, open, popupStyle, popupTokens, query, search, selected, toggle, trigger };
      },
      template: `
        <div class="sdv-combobox">
          <button ref="trigger" type="button" class="sdv-control sdv-combobox-trigger" :class="{ invalid }" :disabled="disabled" :aria-expanded="open ? 'true' : 'false'" :aria-haspopup="'listbox'" @click="toggle" @keydown="keydown">
            <span>{{ selected?.label || '请选择' }}</span><i class="fa-solid fa-chevron-down" aria-hidden="true"></i>
          </button>
          <Teleport to="body">
            <div v-if="open" :id="instanceId + '-popup'" class="sdv-popover" :style="[popupStyle, popupTokens]">
              <input ref="search" v-model="query" class="sdv-control sdv-popover-search" :aria-label="'搜索' + label" :aria-activedescendant="filtered[active] ? instanceId + '-option-' + active : undefined" placeholder="搜索..." @keydown="keydown">
              <div class="sdv-option-list" role="listbox" :aria-label="label">
                <template v-for="(item, index) in filtered" :key="item.id">
                  <div v-if="item.group && (index === 0 || filtered[index - 1]?.group !== item.group)" class="sdv-option-group">{{ item.group }}</div>
                  <button :id="instanceId + '-option-' + index" type="button" class="sdv-option" :class="{ active: index === active, selected: String(item.value) === String(modelValue) }" @mouseenter="active = index" @click="choose(item)">
                    <strong>{{ item.label }}</strong><small v-if="item.description">{{ item.description }}</small>
                  </button>
                </template>
                <p v-if="!filtered.length" class="sdv-empty">没有匹配项</p>
              </div>
            </div>
          </Teleport>
        </div>
      `,
    });

    const MultiSelect = defineComponent({
      name: 'SkillMultiSelect',
      components: { Combobox },
      props: {
        modelValue: { type: Array, default: () => [] },
        options: { type: Array, default: () => [] },
        disabled: Boolean,
        instanceId: { type: String, required: true },
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const items = computed(() => flattenOptions(props.options));
        const selected = computed(() => items.value.filter(item => props.modelValue.map(String).includes(String(item.value))));
        function remove(value) {
          emit('update:modelValue', props.modelValue.filter(item => String(item) !== String(value)));
        }
        function add(value) {
          if (value === '' || props.modelValue.map(String).includes(String(value))) return;
          emit('update:modelValue', [...props.modelValue, value]);
        }
        return { add, remove, selected };
      },
      template: `
        <div class="sdv-multiselect">
          <div v-if="selected.length" class="sdv-token-list">
            <span v-for="item in selected" :key="String(item.value)" class="sdv-token"><span>{{ item.label }}</span><button type="button" :disabled="disabled" :aria-label="'移除' + item.label" @click="remove(item.value)"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></span>
          </div>
          <Combobox :model-value="''" :options="options" :disabled="disabled" label="添加选项" :instance-id="instanceId + '-picker'" @update:model-value="add" />
          <small v-if="!selected.length" class="sdv-muted">尚未选择</small>
        </div>
      `,
    });

    const Segmented = defineComponent({
      name: 'SkillSegmentedControl',
      props: {
        modelValue: { default: '' },
        options: { type: Array, default: () => [] },
        disabled: Boolean,
        label: { type: String, default: '选项' },
      },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const values = computed(() => flattenOptions(props.options));
        function keydown(event, index) {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? values.value.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + values.value.length) % values.value.length;
          emit('update:modelValue', values.value[next]?.value);
          nextTick(() => event.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus?.());
        }
        return { keydown, values };
      },
      template: `
        <div class="sdv-segmented" role="radiogroup" :aria-label="label">
          <button v-for="(item, index) in values" :key="item.id" type="button" role="radio" :aria-checked="String(modelValue) === String(item.value) ? 'true' : 'false'" :tabindex="String(modelValue) === String(item.value) ? 0 : -1" :class="{ active: String(modelValue) === String(item.value) }" :disabled="disabled" @click="$emit('update:modelValue', item.value)" @keydown="keydown($event, index)">{{ item.label }}</button>
        </div>
      `,
    });

    const DurationInput = defineComponent({
      name: 'SkillDurationInput',
      props: { modelValue: { default: '' }, disabled: Boolean, label: { type: String, default: '时长' } },
      emits: ['update:modelValue'],
      setup(props, { emit }) {
        const parts = reactive({ day: '', hour: '', minute: '' });
        function parse() {
          const total = Number(props.modelValue) || 0;
          parts.day = Math.floor(total / 1440) || '';
          parts.hour = Math.floor((total % 1440) / 60) || '';
          parts.minute = total % 60 || '';
        }
        function update() {
          const day = Number(parts.day) || 0;
          const hour = Number(parts.hour) || 0;
          const minute = Number(parts.minute) || 0;
          emit('update:modelValue', day * 1440 + hour * 60 + minute);
        }
        parse();
        watch(() => props.modelValue, parse);
        return { parts, update };
      },
      template: `
        <div class="sdv-duration" role="group" :aria-label="label">
          <label><input v-model="parts.day" type="number" min="0" :disabled="disabled" @input="update"><span>日</span></label>
          <label><input v-model="parts.hour" type="number" min="0" max="23" :disabled="disabled" @input="update"><span>时</span></label>
          <label><input v-model="parts.minute" type="number" min="0" max="59" :disabled="disabled" @input="update"><span>分</span></label>
        </div>
      `,
    });

    const Field = defineComponent({
      name: 'SkillField',
      components: { Combobox, DurationInput, MultiSelect, Segmented },
      props: {
        descriptor: { type: Object, required: true },
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
        return { update };
      },
      template: `
        <div class="sdv-field" :class="{ 'sdv-field-wide': descriptor.wide, 'sdv-field-error': error }" :data-field-path="(descriptor.path || [descriptor.key]).join('.')">
          <div class="sdv-field-label"><label :for="instanceId">{{ descriptor.label }}<b v-if="descriptor.required">*</b></label><span v-if="descriptor.unit">{{ descriptor.unit }}</span></div>
          <Segmented v-if="descriptor.control === 'segmented'" :model-value="modelValue" :options="descriptor.options" :disabled="disabled" :label="descriptor.label" @update:model-value="$emit('update:modelValue', $event)" />
          <Combobox v-else-if="descriptor.control === 'singleEnum'" :model-value="modelValue" :options="descriptor.options" :disabled="disabled" :label="descriptor.label" :instance-id="instanceId" :invalid="!!error" @update:model-value="$emit('update:modelValue', $event)" />
          <MultiSelect v-else-if="descriptor.control === 'multiEnum'" :model-value="Array.isArray(modelValue) ? modelValue : []" :options="descriptor.options" :disabled="disabled" :instance-id="instanceId" @update:model-value="$emit('update:modelValue', $event)" />
          <DurationInput v-else-if="descriptor.control === 'duration'" :model-value="modelValue" :disabled="disabled" :label="descriptor.label" @update:model-value="$emit('update:modelValue', $event)" />
          <label v-else-if="descriptor.control === 'toggle'" class="sdv-toggle"><input :id="instanceId" type="checkbox" :checked="modelValue === true || modelValue === '启用' || modelValue === '是'" :disabled="disabled" @change="$emit('update:modelValue', $event.target.checked)"><span aria-hidden="true"></span><em>{{ modelValue === true || modelValue === '启用' || modelValue === '是' ? '启用' : '关闭' }}</em></label>
          <span v-else-if="descriptor.control === 'static'" class="sdv-static">{{ modelValue || descriptor.defaultValue || '未设置' }}</span>
          <textarea v-else-if="descriptor.control === 'textarea'" :id="instanceId" class="sdv-control sdv-textarea" :value="modelValue" :placeholder="descriptor.placeholder || ''" :disabled="disabled" :aria-invalid="error ? 'true' : 'false'" :aria-required="descriptor.required ? 'true' : 'false'" :aria-describedby="error ? instanceId + '-error' : undefined" @input="update"></textarea>
          <input v-else :id="instanceId" class="sdv-control" :type="descriptor.control === 'number' ? 'number' : 'text'" :inputmode="descriptor.control === 'numberOrPercent' ? 'decimal' : descriptor.control === 'number' ? 'numeric' : 'text'" :value="modelValue" :placeholder="descriptor.placeholder || ''" :disabled="disabled" :aria-invalid="error ? 'true' : 'false'" :aria-required="descriptor.required ? 'true' : 'false'" :aria-describedby="error ? instanceId + '-error' : undefined" @input="update">
          <small v-if="descriptor.help" class="sdv-help">{{ descriptor.help }}</small>
          <small v-if="error" class="sdv-error-message" :id="instanceId + '-error'">{{ error.message }}</small>
        </div>
      `,
    });

    function fieldValue(effect, field) {
      return getPath(effect, field.path || [field.key]) ?? field.defaultValue ?? '';
    }

    function fieldError(errors, path) {
      return (errors || []).find(error => pathKey(error?.path ? String(error.path).split('.') : []) === pathKey(path));
    }

    const FieldPanel = defineComponent({
      name: 'SkillFieldPanel',
      components: { Field },
      props: { draft: { type: Object, required: true }, fields: { type: Array, default: () => [] }, tab: { type: String, required: true }, errors: { type: Array, default: () => [] }, disabled: Boolean, instanceId: { type: String, required: true } },
      emits: ['patch'],
      setup(props, { emit }) {
        const labels = { identity: '技能身份', target: '目标与对象', value: '资源与数值', timing: '时间与次数', scaling: '成长与规则', condition: '条件与限制' };
        const groups = computed(() => {
          const map = new Map();
          props.fields.forEach(field => {
            const key = field.group || 'identity';
            if (!map.has(key)) map.set(key, { key, label: labels[key] || '其他设置', fields: [] });
            map.get(key).fields.push(field);
          });
          return [...map.values()];
        });
        function patch(field, value) {
          emit('patch', { path: field.path || [field.key], value, dependent: !!field.dependent });
        }
        function error(field) {
          return fieldError(props.errors, field.path || [field.key]);
        }
        return { error, groups, patch };
      },
      template: `
        <div class="sdv-field-groups">
          <section v-for="group in groups" :key="group.key" class="sdv-field-group">
            <header class="sdv-group-header"><div><span class="sdv-eyebrow">{{ group.label }}</span><h2>{{ group.label }}</h2></div><span>{{ group.fields.length }} 项</span></header>
            <div class="sdv-field-grid">
              <template v-for="field in group.fields" :key="field.id || field.key">
                <details v-if="field.presentation === 'advanced'" class="sdv-advanced" :class="{ 'sdv-field-wide': field.wide }">
                  <summary>{{ field.label }}<i class="fa-solid fa-chevron-down" aria-hidden="true"></i></summary>
                  <Field :descriptor="field" :model-value="getPath(draft, field.path || [field.key]) ?? field.defaultValue ?? ''" :error="error(field)" :disabled="disabled" :instance-id="instanceId + '-' + (field.id || field.key)" @update:model-value="patch(field, $event)" />
                </details>
                <Field v-else :descriptor="field" :model-value="getPath(draft, field.path || [field.key]) ?? field.defaultValue ?? ''" :error="error(field)" :disabled="disabled" :instance-id="instanceId + '-' + (field.id || field.key)" @update:model-value="patch(field, $event)" />
              </template>
            </div>
          </section>
          <p v-if="!groups.length" class="sdv-empty">当前页面暂无可编辑字段。</p>
        </div>
      `,
      methods: { getPath },
    });

    const ConditionRow = defineComponent({
      name: 'SkillConditionRow',
      components: { Combobox, Field, Segmented },
      props: { condition: { type: Object, required: true }, path: { type: Array, required: true }, index: Number, count: Number, modelApi: { type: Object, required: true }, errors: { type: Array, default: () => [] }, disabled: Boolean, instanceId: { type: String, required: true } },
      emits: ['patch', 'remove'],
      setup(props, { emit }) {
        const model = computed(() => props.modelApi.getConditionModel(props.condition || {}));
        const type = computed(() => text(props.condition?.类型, '生命比例'));
        const objectVisible = computed(() => !['目标', '使用者', '当前行动', '环境满足', '时间', '连携前提'].includes(type.value));
        function patch(path, value, dependent = false) { emit('patch', { path, value, dependent }); }
        function error(key) { return fieldError(props.errors, [...props.path, key]); }
        return { error, model, objectVisible, patch, type };
      },
      template: `
        <div class="sdv-condition" :data-field-path="pathKey(path)">
          <span class="sdv-logic">{{ index === 0 ? '如果' : '并且' }}</span>
          <div class="sdv-condition-fields">
            <Combobox :model-value="condition.类型" :options="modelApi.conditionTypeOptions" :disabled="disabled" label="条件类型" :instance-id="instanceId + '-type'" @update:model-value="patch([...path, '类型'], $event, true)" />
            <Combobox v-if="objectVisible" :model-value="condition.对象 || '目标'" :options="modelApi.conditionObjectOptions" :disabled="disabled" label="作用对象" :instance-id="instanceId + '-object'" @update:model-value="patch([...path, '对象'], $event)" />
            <Segmented v-if="model.showCompare" :model-value="condition.比较" :options="model.compareOptions" :disabled="disabled" label="比较方式" @update:model-value="patch([...path, '比较'], $event, true)" />
            <Field v-if="model.valueField" :descriptor="model.valueField" :model-value="getPath(condition, [model.valueField.key])" :error="error(model.valueField.key)" :disabled="disabled" :instance-id="instanceId + '-value'" @update:model-value="patch([...path, model.valueField.key], $event)" />
          </div>
          <button v-if="count > 1" type="button" class="sdv-icon-button danger" :disabled="disabled" aria-label="删除条件" title="删除条件" @click="$emit('remove')"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
        </div>
      `,
      methods: { getPath, pathKey },
    });

    const NestedEffect = defineComponent({
      name: 'SkillNestedEffectEditor',
      components: { Combobox, Field },
      props: { effect: { type: Object, required: true }, path: { type: Array, required: true }, relation: String, modelApi: { type: Object, required: true }, disabled: Boolean, instanceId: { type: String, required: true }, errors: { type: Array, default: () => [] } },
      emits: ['patch', 'remove'],
      setup(props, { emit }) {
        const model = computed(() => props.modelApi.getPrototypeModel(props.effect || {}, { depth: 1, 禁用条件分支: true }));
        const fields = computed(() => (model.value.fields || []).filter(field => field.key !== '原型' && field.presentation !== 'advanced' && !['conditionList', 'effectList'].includes(field.control)));
        const summary = computed(() => [text(props.effect.原型, '未选择效果'), text(props.effect.目标, ''), ...fields.value.map(field => text(fieldValue(props.effect, field), '')).filter(Boolean).slice(0, 2)].filter(Boolean).join(' · '));
        function patch(field, value) {
          emit('patch', { path: [...props.path, ...(field.path || [field.key])], value, dependent: !!field.dependent });
        }
        return { fields, model, patch, summary };
      },
      template: `
        <div class="sdv-nested-editor">
          <div class="sdv-nested-editor-head"><span class="sdv-connector" aria-hidden="true"></span><strong>{{ relation }}</strong><span class="sdv-nested-summary">{{ summary }}</span><button type="button" class="sdv-icon-button danger" :disabled="disabled" :aria-label="'删除' + relation + '效果'" :title="'删除' + relation + '效果'" @click="$emit('remove')"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></div>
          <div class="sdv-nested-editor-fields">
            <Combobox :model-value="effect.原型" :options="modelApi.prototypeOptions" :disabled="disabled" label="嵌套效果原型" :instance-id="instanceId + '-prototype'" @update:model-value="patch({ key: '原型', dependent: true }, $event)" />
            <Field v-for="field in fields" :key="field.key" :descriptor="field" :model-value="fieldValue(effect, field)" :disabled="disabled" :instance-id="instanceId + '-' + field.key" @update:model-value="patch(field, $event)" />
          </div>
        </div>
      `,
      methods: { fieldValue },
    });

    const Branch = defineComponent({
      name: 'SkillConditionBranch',
      components: { Combobox, ConditionRow, Field, NestedEffect, Segmented },
      props: { branch: { type: Object, required: true }, path: { type: Array, required: true }, index: Number, modelApi: { type: Object, required: true }, errors: { type: Array, default: () => [] }, disabled: Boolean, instanceId: { type: String, required: true } },
      emits: ['patch', 'structure'],
      setup(props, { emit }) {
        const conditions = computed(() => Array.isArray(props.branch.条件) ? props.branch.条件 : []);
        const action = computed(() => text(props.branch.处理, '生效'));
        const effectKey = computed(() => action.value === '替换效果' ? '替换效果' : '追加效果');
        const effects = computed(() => Array.isArray(props.branch[effectKey.value]) ? props.branch[effectKey.value] : []);
        function patch(path, value, dependent = false) { emit('patch', { path, value, dependent }); }
        return { action, conditions, effectKey, effects, patch };
      },
      template: `
        <section class="sdv-branch">
          <header class="sdv-branch-header"><span>条件 {{ index + 1 }}</span><button type="button" class="sdv-icon-button danger" :disabled="disabled" aria-label="删除条件分支" title="删除条件分支" @click="$emit('structure', { type: 'remove', path: path.slice(0, -1), index })"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></header>
          <div class="sdv-condition-list">
            <ConditionRow v-for="(condition, conditionIndex) in conditions" :key="conditionIndex" :condition="condition" :path="[...path, '条件', conditionIndex]" :index="conditionIndex" :count="conditions.length" :model-api="modelApi" :errors="errors" :disabled="disabled" :instance-id="instanceId + '-condition-' + conditionIndex" @patch="$emit('patch', $event)" @remove="$emit('structure', { type: 'remove', path: [...path, '条件'], index: conditionIndex })" />
          </div>
          <div class="sdv-branch-actions">
            <button type="button" class="sdv-text-button" :disabled="disabled || conditions.length >= 3" @click="$emit('structure', { type: 'add-condition', path: [...path, '条件'] })"><i class="fa-solid fa-plus" aria-hidden="true"></i>添加条件</button>
            <span v-if="conditions.length >= 3" class="sdv-limit">已达到 3 个条件分支上限</span>
            <Segmented :model-value="branch.处理" :options="modelApi.conditionActionOptions" :disabled="disabled" label="满足后的处理" @update:model-value="patch([...path, '处理'], $event, true)" />
          </div>
          <div v-if="action === '生效' || action === '禁用'" class="sdv-outcome"><span class="sdv-logic">{{ action === '禁用' ? '否则' : '满足后' }}</span><strong>{{ action === '禁用' ? '禁用当前效果' : '保持当前效果' }}</strong></div>
          <div v-else class="sdv-nested-list">
            <NestedEffect v-for="(effect, effectIndex) in effects" :key="effectIndex" :effect="effect" :path="[...path, effectKey, effectIndex]" :relation="action === '追加效果' ? '追加' : '替换'" :model-api="modelApi" :disabled="disabled" :instance-id="instanceId + '-nested-' + effectIndex" :errors="errors" @patch="$emit('patch', $event)" @remove="$emit('structure', { type: 'remove', path: [...path, effectKey], index: effectIndex })" />
            <button type="button" class="sdv-text-button" :disabled="disabled || effects.length >= Math.min(2, Number(modelApi.nestedPrototypeLimit || 2))" @click="$emit('structure', { type: 'add-prototype', path: [...path, effectKey] })"><i class="fa-solid fa-plus" aria-hidden="true"></i>添加{{ action === '追加效果' ? '追加' : '替换' }}效果</button>
            <small v-if="effects.length >= Math.min(2, Number(modelApi.nestedPrototypeLimit || 2))" class="sdv-limit">嵌套效果最多支持 2 层。</small>
          </div>
        </section>
      `,
    });

    const Prototype = defineComponent({
      name: 'SkillPrototypeEditor',
      components: { Branch, Combobox, Field },
      props: { effect: { type: Object, required: true }, path: { type: Array, required: true }, index: Number, count: Number, modelApi: { type: Object, required: true }, errors: { type: Array, default: () => [] }, disabled: Boolean, instanceId: { type: String, required: true }, collapseMode: { type: String, default: 'normal' } },
      emits: ['patch', 'structure'],
      setup(props, { emit }) {
        const expanded = shallowRef(props.index === 0);
        const model = computed(() => props.modelApi.getPrototypeModel(props.effect, { depth: 0 }));
        const fields = computed(() => (model.value.fields || []).filter(field => field.key !== '原型' && field.presentation !== 'advanced' && !['conditionList', 'effectList'].includes(field.control)));
        const branches = computed(() => Array.isArray(props.effect.条件分支) ? props.effect.条件分支 : []);
        const hasError = computed(() => props.errors.some(error => {
          const current = pathKey([...props.path, props.index]);
          return String(error?.path || '') === current || String(error?.path || '').startsWith(`${current}.`);
        }));
        const summary = computed(() => [text(props.effect.原型, '未选择主效果'), text(props.effect.目标, ''), branches.value.length ? `${branches.value.length} 个条件` : '无条件'].filter(Boolean).join(' · '));
        function patch(field, value) { emit('patch', { path: [...props.path, props.index, ...(field.path || [field.key])], value, dependent: !!field.dependent }); }
        function toggle() { expanded.value = !expanded.value; }
        watch(() => props.collapseMode, mode => {
          if (mode === 'all') expanded.value = false;
          if (mode === 'errors') expanded.value = hasError.value;
        });
        return { branches, expanded, fields, hasError, model, patch, summary, toggle };
      },
      template: `
        <article class="sdv-prototype" :class="{ expanded, 'has-error': hasError }" :data-prototype-path="pathKey([...path, index])">
          <header class="sdv-prototype-header">
            <div class="sdv-prototype-id"><span>{{ String(index + 1).padStart(2, '0') }}</span><strong>原型 {{ index + 1 }}</strong><em>主效果</em></div>
            <Combobox :model-value="effect.原型" :options="modelApi.prototypeOptions" :disabled="disabled" label="主效果原型" :instance-id="instanceId + '-prototype'" @update:model-value="patch({ key: '原型', dependent: true }, $event)" />
            <div class="sdv-prototype-actions">
              <button type="button" class="sdv-icon-button" :aria-label="expanded ? '折叠原型' : '展开原型'" :title="expanded ? '折叠原型' : '展开原型'" @click="toggle"><i :class="expanded ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down'" aria-hidden="true"></i></button>
              <button v-if="index > 0" type="button" class="sdv-icon-button" :disabled="disabled" aria-label="上移原型" title="上移原型" @click="$emit('structure', { type: 'move-up', path, index })"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
              <button v-if="index < count - 1" type="button" class="sdv-icon-button" :disabled="disabled" aria-label="下移原型" title="下移原型" @click="$emit('structure', { type: 'move-down', path, index })"><i class="fa-solid fa-arrow-down" aria-hidden="true"></i></button>
              <button type="button" class="sdv-icon-button" :disabled="disabled" aria-label="复制原型" title="复制原型" @click="$emit('structure', { type: 'duplicate', path, index })"><i class="fa-solid fa-copy" aria-hidden="true"></i></button>
              <button v-if="count > 1" type="button" class="sdv-icon-button danger" :disabled="disabled" aria-label="删除原型" title="删除原型" @click="$emit('structure', { type: 'remove', path, index })"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
            </div>
          </header>
          <p class="sdv-summary">{{ summary }}</p>
          <div v-if="expanded" class="sdv-prototype-body">
            <div class="sdv-field-grid"><Field v-for="field in fields" :key="field.key" :descriptor="field" :model-value="fieldValue(effect, field)" :error="fieldError(errors, [...path, index, ...(field.path || [field.key])])" :disabled="disabled" :instance-id="instanceId + '-' + field.key" @update:model-value="patch(field, $event)" /></div>
            <div v-if="branches.length" class="sdv-branches"><Branch v-for="(branch, branchIndex) in branches" :key="branchIndex" :branch="branch" :path="[...path, index, '条件分支', branchIndex]" :index="branchIndex" :model-api="modelApi" :errors="errors" :disabled="disabled" :instance-id="instanceId + '-branch-' + branchIndex" @patch="$emit('patch', $event)" @structure="$emit('structure', $event)" /></div>
            <footer class="sdv-prototype-footer"><button type="button" class="sdv-text-button" :disabled="disabled || branches.length >= 3" @click="$emit('structure', { type: 'add-branch', path: [...path, index, '条件分支'] })"><i class="fa-solid fa-plus" aria-hidden="true"></i>添加条件分支</button><span v-if="branches.length >= 3" class="sdv-limit">已达到 3 个条件分支上限</span></footer>
          </div>
        </article>
      `,
      methods: { fieldValue, fieldError, pathKey },
    });

    const EffectPanel = defineComponent({
      name: 'SkillEffectPanel',
      components: { Field, Prototype },
      props: { draft: { type: Object, required: true }, modelApi: { type: Object, required: true }, errors: { type: Array, default: () => [] }, disabled: Boolean, instanceId: { type: String, required: true }, collapseMode: { type: String, default: 'normal' } },
      emits: ['patch', 'structure', 'view'],
      setup(props, { emit }) {
        const effects = computed(() => Array.isArray(props.draft.prototypeEffects) ? props.draft.prototypeEffects : []);
        const sideEffects = computed(() => Array.isArray(props.draft.副作用列表) ? props.draft.副作用列表 : []);
        const canAdd = computed(() => effects.value.length < Number(props.modelApi.prototypeLimit || 99));
        function sideFields(item) { return props.modelApi.getSideEffectModel(item || {}).fields || []; }
        return { canAdd, effects, emit, fieldValue, sideEffects, sideFields };
      },
      template: `
        <section class="sdv-page-section">
          <div class="sdv-section-toolbar"><div><span class="sdv-eyebrow">效果编排</span><h2>先建立主效果，再补充条件和分支</h2><p>原型平铺排列，关系通过自然语言和短连接线表达。</p></div><div class="sdv-actions"><button type="button" class="sdv-button primary" :disabled="disabled || !canAdd" @click="emit('structure', { type: 'add-prototype', path: ['prototypeEffects'] })"><i class="fa-solid fa-plus" aria-hidden="true"></i>新增原型</button><button type="button" class="sdv-text-button" :disabled="disabled" @click="emit('view', 'all')"><i class="fa-solid fa-compress" aria-hidden="true"></i>折叠全部</button><button type="button" class="sdv-text-button" :disabled="disabled" @click="emit('view', 'errors')"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>仅展开错误</button></div></div>
          <div v-if="!effects.length" class="sdv-empty-state"><i class="fa-solid fa-list-check" aria-hidden="true"></i><strong>还没有效果原型</strong><span>先添加一个主效果，之后再配置条件、追加或替换效果。</span><button type="button" class="sdv-button primary" :disabled="disabled || !canAdd" @click="emit('structure', { type: 'add-prototype', path: ['prototypeEffects'] })"><i class="fa-solid fa-plus" aria-hidden="true"></i>新增第一个原型</button></div>
          <div v-else class="sdv-prototype-list"><Prototype v-for="(effect, index) in effects" :key="index" :effect="effect" :path="['prototypeEffects']" :index="index" :count="effects.length" :model-api="modelApi" :errors="errors" :disabled="disabled" :instance-id="instanceId + '-prototype-' + index" :collapse-mode="collapseMode" @patch="emit('patch', $event)" @structure="emit('structure', $event)" /></div>
          <p v-if="effects.length >= Number(modelApi.prototypeLimit || 99)" class="sdv-limit sdv-limit-block">原型数量已达到当前技能位上限，不能继续新增。</p>
          <section class="sdv-side-effects"><header class="sdv-section-subheader"><div><span class="sdv-eyebrow">附带代价</span><h3>副作用</h3></div><button type="button" class="sdv-text-button" :disabled="disabled" @click="emit('structure', { type: 'add-side-effect', path: ['副作用列表'] })"><i class="fa-solid fa-plus" aria-hidden="true"></i>添加副作用</button></header><p v-if="!sideEffects.length" class="sdv-muted">没有设置副作用。</p><div v-for="(item, index) in sideEffects" :key="index" class="sdv-side-effect"><div class="sdv-side-effect-heading"><strong>副作用 {{ index + 1 }}</strong><button type="button" class="sdv-icon-button danger" :disabled="disabled" aria-label="删除副作用" title="删除副作用" @click="emit('structure', { type: 'remove', path: ['副作用列表'], index })"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></div><div class="sdv-field-grid"><Field v-for="field in sideFields(item)" :key="field.key" :descriptor="field" :model-value="fieldValue(item, field)" :disabled="disabled" :instance-id="instanceId + '-side-' + index + '-' + field.key" @update:model-value="emit('patch', { path: ['副作用列表', index, ...(field.path || [field.key])], value: $event, dependent: !!field.dependent })" /></div></div></section>
        </section>
      `,
    });

    const Ledger = defineComponent({
      name: 'SkillCostLedger',
      props: { result: { type: Object, default: () => ({}) } },
      emits: ['locate'],
      setup(props, { emit }) {
        const budget = computed(() => props.result?.preview?.budget || {});
        const resources = computed(() => Array.isArray(props.result?.preview?.resourceRows) ? props.result.preview.resourceRows : []);
        const effects = computed(() => Array.isArray(props.result?.preview?.effectRows) ? props.result.preview.effectRows : []);
        return { budget, effects, emit, resources };
      },
      template: `
        <section class="sdv-ledger"><header class="sdv-section-subheader"><div><span class="sdv-eyebrow">编译结果</span><h2>复杂度预算账单</h2></div><strong class="sdv-ledger-total">{{ budget.label || '待评估' }}</strong></header><div class="sdv-ledger-table"><div class="sdv-ledger-head"><span>来源</span><span>计算说明</span><span>数值</span></div><button v-for="(row, index) in resources" :key="'r-' + index" type="button" class="sdv-ledger-row" @click="emit('locate', row)"><span>{{ row.label || row.source || '资源' }}</span><em>资源参数</em><b>{{ row.value ?? row.cost ?? '—' }}</b></button><button v-for="(row, index) in effects" :key="'e-' + index" type="button" class="sdv-ledger-row" @click="emit('locate', row)"><span>{{ row.branchLabel ? row.branchLabel + ' / ' : '' }}{{ row.title || '效果原型' }}</span><em>{{ row.relation || '主效果' }}{{ row.conditionSummary ? ' · ' + row.conditionSummary : '' }}</em><b>{{ row.cost ?? '—' }}</b></button><p v-if="!resources.length && !effects.length" class="sdv-muted">当前编译结果没有提供可拆分的账单明细。</p></div><footer class="sdv-ledger-footer"><span>总计</span><strong>{{ budget.label || '待评估' }}</strong><em :class="{ danger: budget.ok === false }">{{ budget.stateLabel || '等待校验' }}</em></footer></section>
      `,
    });

    const DescriptionReference = defineComponent({
      name: 'SkillDescriptionReference',
      props: { result: { type: Object, default: () => ({}) }, draft: { type: Object, required: true } },
      emits: ['patch'],
      setup(props, { emit }) {
        const reference = computed(() => text(props.result?.preview?.summary || props.result?.preview?.effectDescription, '完成效果配置后，这里会显示编译链提供的参考文案。'));
        const current = computed(() => text(props.draft?.effectDesc));
        const overridden = computed(() => !!current.value && current.value !== reference.value);
        function restore() {
          if (overridden.value && !window.confirm('恢复自动参考会替换当前手动内容，确定继续吗？')) return;
          emit('patch', { path: ['effectDesc'], value: reference.value });
        }
        return { current, emit, overridden, reference, restore };
      },
      template: `
        <section class="sdv-reference"><header class="sdv-section-subheader"><div><span class="sdv-eyebrow">自动参考</span><h2>编译链生成的效果描述</h2></div><span class="sdv-reference-state">{{ overridden ? '已手动修改' : '仅供参考' }}</span></header><p>{{ reference }}</p><footer><small>{{ overridden ? '当前描述已脱离自动参考。' : '自动参考不会主动覆盖你的输入。' }}</small><button type="button" class="sdv-text-button" @click="restore"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i>{{ overridden ? '恢复自动参考' : '填入效果描述' }}</button></footer></section>
      `,
    });

    const Toolbar = defineComponent({
      name: 'SkillDesignerToolbar',
      components: { Combobox },
      props: { title: String, subtitle: String, switchItems: { type: Array, default: () => [] }, previewKey: String, busy: Boolean, canUndo: Boolean, instanceId: { type: String, required: true } },
      emits: ['switch-skill', 'reload', 'undo'],
      setup(props) {
        const options = computed(() => props.switchItems.map(item => ({ value: item.preview, label: item.label })));
        return { options };
      },
      template: `
        <header class="sdv-toolbar"><div class="sdv-context"><span class="sdv-eyebrow">魂技设计台</span><h1>{{ title || '未命名技能' }}</h1><p>{{ subtitle }}</p></div><div class="sdv-toolbar-actions"><Combobox v-if="switchItems.length > 1" :model-value="previewKey" :options="options" :disabled="busy" label="切换技能" :instance-id="instanceId + '-switch'" @update:model-value="$emit('switch-skill', $event)" /><button type="button" class="sdv-icon-button" :disabled="busy || !canUndo" aria-label="撤销上一次结构操作" title="撤销" @click="$emit('undo')"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i></button><button type="button" class="sdv-button" :disabled="busy" @click="$emit('reload')"><i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>重新读取</button></div></header>
      `,
    });

    const Tabs = defineComponent({
      name: 'SkillDesignerTabs',
      props: { tabs: { type: Array, required: true }, active: String, errors: Object, dirty: Boolean, instanceId: { type: String, required: true } },
      emits: ['update:active'],
      setup(props, { emit }) {
        function keydown(event, index) {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? props.tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + props.tabs.length) % props.tabs.length;
          emit('update:active', props.tabs[next].id);
          nextTick(() => document.getElementById(`${props.instanceId}-tab-${props.tabs[next].id}`)?.focus?.());
        }
        return { keydown };
      },
      template: `
        <nav class="sdv-tabs" role="tablist" aria-label="技能设计步骤"><button v-for="(tab, index) in tabs" :key="tab.id" :id="instanceId + '-tab-' + tab.id" type="button" role="tab" :aria-selected="active === tab.id ? 'true' : 'false'" :tabindex="active === tab.id ? 0 : -1" :class="{ active: active === tab.id, invalid: errors[tab.id] }" @click="$emit('update:active', tab.id)" @keydown="keydown($event, index)"><span>{{ tab.label }}</span><b v-if="errors[tab.id]">{{ errors[tab.id] }}</b><i v-else-if="dirty" class="fa-solid fa-circle-dot" aria-hidden="true"></i></button></nav>
      `,
    });

    const StatusDock = defineComponent({
      name: 'SkillDesignerStatusDock',
      props: { status: String, budget: String, warnings: Number, errors: Number, disabled: Boolean },
      emits: ['save'],
      template: `
        <footer class="sdv-status-dock"><div class="sdv-status-copy" :class="{ warning: warnings && !errors, danger: errors }"><span class="sdv-status-dot" aria-hidden="true"></span><strong>{{ status }}</strong><span class="sdv-status-budget">复杂度预算 <b>{{ budget }}</b></span><span v-if="warnings">{{ warnings }} 条警告</span><span v-if="errors">{{ errors }} 个问题</span></div><button type="button" class="sdv-button primary sdv-save" :disabled="disabled" @click="$emit('save')"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>保存设计</button></footer>
      `,
    });

    const App = defineComponent({
      name: 'SkillDesignerApp',
      components: { DescriptionReference, EffectPanel, FieldPanel, Ledger, StatusDock, Tabs, Toolbar },
      props: { context: { type: Object, required: true }, instanceId: { type: String, required: true } },
      setup(props) {
        const rawDraft = reactive(clone(props.context.initialRawDraft) || {});
        const active = shallowRef('basic');
        const revision = shallowRef(0);
        const busy = shallowRef(false);
        const dirty = shallowRef(!!props.context.initialDirty);
        const result = shallowRef({ preview: {}, errors: [], warnings: [] });
        const status = shallowRef(dirty.value ? '已恢复草稿' : '未修改');
        const collapseMode = shallowRef('normal');
        const undoRecord = shallowRef(null);
        const live = shallowRef('');
        const destroyed = shallowRef(false);
        const operationToken = shallowRef(0);
        const previewToken = shallowRef(0);
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
          basic: { title: '基础', description: '先确定技能身份、承载方式，以及会随承载方式变化的参数。' },
          effect: { title: '效果', description: '把主效果、条件和分支编排成一条能读懂的效果链。' },
          cost: { title: '消耗', description: '调整资源和时间参数，并核对复杂度预算的完整组成。' },
          description: { title: '描述', description: '确认自动参考，并编辑最终会保存的技能描述。' },
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

        function changed() {
          dirty.value = true;
          status.value = '有未保存更改';
          revision.value += 1;
          previewToken.value += 1;
        }
        function patch(change) {
          if (busy.value || !Array.isArray(change?.path)) return;
          if (change.dependent) replaceObject(rawDraft, props.context.actions.applyDependentFieldChange(clone(rawDraft), clone(change)));
          else setPath(rawDraft, change.path, clone(change.value));
          changed();
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
          if (command.type === 'add-prototype') {
            const nested = command.path.some(part => typeof part === 'number');
            const limit = nested ? Math.min(2, Number(props.context.editorModel.nestedPrototypeLimit || 2)) : Number(props.context.editorModel.prototypeLimit || 99);
            if (list.length >= limit) return;
            undoRecord.value = { path: [...command.path], value: clone(list) };
            list.push(props.context.actions.createPrototype({ draft: clone(rawDraft) }));
          } else if (command.type === 'add-branch' || command.type === 'add-condition') {
            if (list.length >= 3) return;
            undoRecord.value = { path: [...command.path], value: clone(list) };
            list.push(command.type === 'add-branch' ? props.context.editorModel.createConditionBranch() : props.context.editorModel.createCondition());
          } else if (command.type === 'add-side-effect') {
            undoRecord.value = { path: [...command.path], value: clone(list) };
            list.push(props.context.editorModel.createSideEffect());
          } else if (['remove', 'move-up', 'move-down', 'duplicate'].includes(command.type)) {
            if (index < 0 || index >= list.length) return;
            undoRecord.value = { path: [...command.path], value: clone(list) };
            if (command.type === 'remove') list.splice(index, 1);
            if (command.type === 'move-up' && index > 0) [list[index - 1], list[index]] = [list[index], list[index - 1]];
            if (command.type === 'move-down' && index < list.length - 1) [list[index + 1], list[index]] = [list[index], list[index + 1]];
            if (command.type === 'duplicate') list.splice(index + 1, 0, clone(list[index]));
          } else return;
          changed();
          live.value = command.type === 'remove' ? '已删除结构，可使用撤销恢复。' : '结构已更新。';
        }
        function undo() {
          if (!undoRecord.value || busy.value) return;
          setPath(rawDraft, undoRecord.value.path, undoRecord.value.value);
          undoRecord.value = null;
          changed();
          live.value = '已撤销上一次结构操作。';
        }
        function locate(item = {}) {
          active.value = ['basic', 'effect', 'cost', 'description'].includes(item.tab) ? item.tab : 'effect';
          live.value = item.message || '已定位到相关字段。';
          nextTick(() => {
            const root = document.getElementById(props.instanceId);
            const path = String(item.path || '').replace(/"/g, '\\"');
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
          if (dirty.value) props.context.actions.cacheDraft(clone(rawDraft));
        }
        async function compile() {
          const token = ++previewToken.value;
          status.value = '正在校验';
          try {
            const next = await Promise.resolve(props.context.actions.compileDraft(clone(rawDraft), { dryRun: true }));
            if (destroyed.value || token !== previewToken.value) return;
            result.value = next || result.value;
            status.value = result.value.errors?.length ? '存在错误' : result.value.warnings?.length ? '存在警告' : dirty.value ? '有未保存更改' : '校验通过';
          } catch (error) {
            if (destroyed.value || token !== previewToken.value) return;
            result.value = { ...result.value, errors: [{ tab: 'effect', path: '', message: error?.message || '预览编译失败。' }] };
            status.value = '存在错误';
          }
        }
        function schedule() {
          clearTimers();
          if (dirty.value) cacheTimer = window.setTimeout(flushCache, 150);
          compileTimer = window.setTimeout(compile, 100);
        }
        function focusError(next) {
          const error = next?.errors?.[0];
          if (!error) return;
          active.value = error.tab || 'effect';
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
              focusError(result.value);
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
            result.value = error?.compileResult || { ...result.value, errors: [{ tab: error?.tab || 'effect', path: error?.path || '', message: error?.message || '保存失败。' }] };
            status.value = '保存失败';
            focusError(result.value);
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
        watch(revision, schedule, { flush: 'post' });
        onMounted(compile);
        onBeforeUnmount(() => {
          destroyed.value = true;
          operationToken.value += 1;
          previewToken.value += 1;
          if (dirty.value && !skipCache) props.context.actions.cacheDraft(clone(rawDraft));
          clearTimers();
        });
        return { active, budget, changed, collapseMode, errorCounts, fields, live, locate, pageMeta, patch, rawDraft, reload, result, save, status, structure, switchSkill, tabs, undo, undoRecord, dirty, busy };
      },
      template: `
        <div :id="instanceId" class="sdv-root" data-skill-designer-layout="blueprint-canvas" :aria-busy="busy ? 'true' : 'false'">
          <Toolbar :title="rawDraft.name || context.previewMeta.label || '未命名技能'" :subtitle="context.previewMeta.category || context.previewMeta.scope || ''" :switch-items="context.switchItems" :preview-key="context.previewKey" :busy="busy" :can-undo="!!undoRecord" :instance-id="instanceId" @switch-skill="switchSkill" @reload="reload" @undo="undo" />
          <Tabs :tabs="tabs" :active="active" :errors="errorCounts" :dirty="dirty" :instance-id="instanceId" @update:active="active = $event" />
          <div v-if="busy" class="sdv-busy" role="status"><i class="fa-solid fa-spinner" aria-hidden="true"></i>{{ status }}</div>
          <main class="sdv-canvas">
            <header class="sdv-page-header"><div><span class="sdv-eyebrow">当前任务</span><h2>{{ pageMeta.title }}</h2><p>{{ pageMeta.description }}</p></div><strong v-if="errorCounts[active]" class="sdv-page-error"><i class="fa-solid fa-circle-exclamation" aria-hidden="true"></i>{{ errorCounts[active] }} 个问题</strong></header>
            <section class="sdv-page" role="tabpanel" :id="instanceId + '-panel-' + active">
              <FieldPanel v-if="active === 'basic'" :draft="rawDraft" :fields="fields.basic" :tab="'basic'" :errors="result.errors" :disabled="busy" :instance-id="instanceId + '-basic'" @patch="patch" />
              <EffectPanel v-else-if="active === 'effect'" :draft="rawDraft" :model-api="context.editorModel" :errors="result.errors" :disabled="busy" :instance-id="instanceId + '-effect'" :collapse-mode="collapseMode" @patch="patch" @structure="structure" @view="collapseMode = $event" />
              <div v-else-if="active === 'cost'"><FieldPanel :draft="rawDraft" :fields="fields.cost" :tab="'cost'" :errors="result.errors" :disabled="busy" :instance-id="instanceId + '-cost'" @patch="patch" /><Ledger :result="result" @locate="locate" /></div>
              <div v-else><DescriptionReference :result="result" :draft="rawDraft" @patch="patch" /><FieldPanel :draft="rawDraft" :fields="fields.description" :tab="'description'" :errors="result.errors" :disabled="busy" :instance-id="instanceId + '-description'" @patch="patch" /></div>
            </section>
          </main>
          <section v-if="undoRecord" class="sdv-undo" role="status"><i class="fa-solid fa-rotate-left" aria-hidden="true"></i><span>{{ live || '结构已更新，可以撤销上一次操作。' }}</span><button type="button" class="sdv-text-button" :disabled="busy" @click="undo">撤销</button></section>
          <StatusDock :status="status" :budget="budget" :warnings="result.warnings?.length || 0" :errors="result.errors?.length || 0" :disabled="busy" @save="save" />
          <div class="sdv-live" aria-live="assertive">{{ live }}</div>
        </div>
      `,
    });

    return { App };
  }

  function mount(host, context) {
    if (!host || host.nodeType !== 1) throw new Error('技能设计器缺少有效挂载节点。');
    if (!context?.actions || !context.editorModel) throw new Error('技能设计器上下文不完整。');
    const Vue = vueRuntime();
    if (!Vue) throw new Error('Vue 3.5 运行时未就绪。');
    const previous = host.getAttribute('data-sdv-mounted');
    if (previous && mounted.has(previous)) mounted.get(previous).destroy();
    const id = `sdv-${Date.now()}-${++seed}`;
    const { App } = createComponents(Vue);
    const app = Vue.createApp({ render: () => Vue.h(App, { context, instanceId: id }) });
    const controller = {
      destroy() {
        if (!mounted.has(id)) return;
        mounted.delete(id);
        try {
          app.unmount();
        } finally {
          host.replaceChildren();
          host.removeAttribute('data-sdv-mounted');
        }
      },
    };
    host.replaceChildren();
    host.setAttribute('data-sdv-mounted', id);
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
